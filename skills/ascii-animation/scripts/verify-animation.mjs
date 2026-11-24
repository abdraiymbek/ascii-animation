#!/usr/bin/env node
/**
 * Zero-dependency headless Chromium CDP verifier for ASCII, Bayer-dither, and polychromatic
 * illustrated animations. Captures desktop (t1, t2, hover, optional drag, optional clicked
 * UI states, optional direct canvas click-pos pokes/seeds), mobile (390x844 @2x), and
 * prefers-reduced-motion screenshots. Reports motion diff ratios, chromatic richness
 * (saturation & distinct hue bins), overflow, and console/WebGL errors.
 *
 * Usage:
 *   node verify-animation.mjs <file.html | url> [--out <dir>] [--settle 1200] [--gap 1000]
 *     [--click "<css-selector>:<label>"]... [--click-pos "<x>,<y>:<label>"]... [--drag]
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const args = process.argv.slice(2);
let targetArg = null;
let outDir = resolve(process.cwd(), 'ascii-audit');
let settleMs = 1200;
let gapMs = 1000;
let testDrag = false;
const clickSteps = [];
const clickPosSteps = [];

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') outDir = resolve(args[++i]);
  else if (a === '--settle') settleMs = Number(args[++i]) || 1200;
  else if (a === '--gap') gapMs = Number(args[++i]) || 1000;
  else if (a === '--drag') testDrag = true;
  else if (a === '--click') {
    const raw = args[++i] || '';
    const atIdx = raw.lastIndexOf('@');
    let hoverPos = null;
    let body = raw;
    if (atIdx > 0) {
      const xy = raw.slice(atIdx + 1).split(',').map(Number);
      if (xy.length === 2 && Number.isFinite(xy[0]) && Number.isFinite(xy[1])) {
        hoverPos = { x: xy[0], y: xy[1] };
        body = raw.slice(0, atIdx);
      }
    }
    const idx = body.lastIndexOf(':');
    if (idx > 0 && idx < body.length - 1) {
      clickSteps.push({ selector: body.slice(0, idx), label: body.slice(idx + 1).replace(/[^a-z0-9_-]/gi, '-'), hoverPos });
    } else if (body) {
      clickSteps.push({ selector: body, label: `state-${clickSteps.length + 1}`, hoverPos });
    }
  } else if (a === '--click-pos') {
    const raw = args[++i] || '';
    const idx = raw.lastIndexOf(':');
    const coords = (idx > 0 ? raw.slice(0, idx) : raw).split(',').map(Number);
    const label = idx > 0 ? raw.slice(idx + 1).replace(/[^a-z0-9_-]/gi, '-') : `pos-${clickPosSteps.length + 1}`;
    if (coords.length === 2 && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
      clickPosSteps.push({ x: coords[0], y: coords[1], label });
    }
  } else if (!a.startsWith('--') && !targetArg) targetArg = a;
}

if (!targetArg) {
  console.error('Usage: node verify-animation.mjs <file.html | url> [--out <dir>] [--settle 1200] [--gap 1000] [--click "<sel>:<label>"] [--click-pos "x,y:<label>"] [--drag]');
  process.exit(1);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  for (const p of candidates) if (existsSync(p)) return p;

  const pwRoots = [
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
  ];
  for (const root of pwRoots) {
    if (!existsSync(root)) continue;
    const dirs = readdirSync(root).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const d of dirs) {
      const macArm = join(root, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      const macX64 = join(root, d, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
      const linux = join(root, d, 'chrome-linux', 'chrome');
      const linux64 = join(root, d, 'chrome-linux64', 'chrome');
      for (const p of [macArm, macX64, linux, linux64]) if (existsSync(p)) return p;
    }
  }
  throw new Error('Could not find Chrome/Chromium binary. Set CHROME_PATH or install Chromium/Playwright.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

function startStaticServer(filePath) {
  const root = dirname(filePath);
  const entry = '/' + filePath.slice(root.length + 1);
  return new Promise((res) => {
    const server = createServer((req, resp) => {
      const clean = decodeURIComponent((req.url || '/').split('?')[0]);
      const full = resolve(root, '.' + (clean === '/' ? entry : clean));
      if (!full.startsWith(root) || !existsSync(full) || statSync(full).isDirectory()) {
        resp.writeHead(404); resp.end('Not found'); return;
      }
      resp.writeHead(200, { 'Content-Type': MIME[extname(full)] || 'application/octet-stream' });
      resp.end(readFileSync(full));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      res({ server, url: `http://127.0.0.1:${port}${entry}` });
    });
  });
}

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format depth=${bitDepth} colorType=${colorType}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(width * height * bpp);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const rowOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src++];
      const a = x >= bpp ? out[rowOff + x - bpp] : 0;
      const b = y > 0 ? out[rowOff - stride + x] : 0;
      const c = y > 0 && x >= bpp ? out[rowOff - stride + x - bpp] : 0;
      let val = v;
      if (filter === 1) val = (v + a) & 255;
      else if (filter === 2) val = (v + b) & 255;
      else if (filter === 3) val = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) val = (v + paeth(a, b, c)) & 255;
      out[rowOff + x] = val;
    }
  }
  return { width, height, bpp, data: out };
}

function diffPngs(pngA, pngB) {
  const a = decodePng(pngA), b = decodePng(pngB);
  const n = Math.min(a.width * a.height, b.width * b.height);
  let changed = 0, meanDelta = 0;
  for (let i = 0; i < n; i++) {
    const ia = i * a.bpp, ib = i * b.bpp;
    const d = Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2]);
    if (d > 9) changed++;
    meanDelta += d;
  }
  return { diffRatio: +(changed / n).toFixed(5), meanRgbDelta: +(meanDelta / (n * 3)).toFixed(3) };
}

function colorStats(pngBuf) {
  const img = decodePng(pngBuf);
  const buckets = new Set();
  const hueCounts = new Int32Array(12);
  const n = img.width * img.height;
  let lumaSum = 0, lumaSq = 0, satSum = 0;
  const step = Math.max(1, Math.floor(n / 60000));
  let count = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * img.bpp;
    const r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
    buckets.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    const rf = r / 255, gf = g / 255, bf = b / 255;
    const l = 0.299 * rf + 0.587 * gf + 0.114 * bf;
    const mx = Math.max(rf, gf, bf), mn = Math.min(rf, gf, bf), d = mx - mn;
    const sat = mx > 0.001 ? d / mx : 0;
    satSum += sat;
    if (sat > 0.22 && mx > 0.18) {
      let h = 0;
      if (d > 0.001) {
        if (mx === rf) h = ((gf - bf) / d + (gf < bf ? 6 : 0)) / 6;
        else if (mx === gf) h = ((bf - rf) / d + 2) / 6;
        else h = ((rf - gf) / d + 4) / 6;
      }
      hueCounts[Math.min(11, Math.floor(h * 12))]++;
    }
    lumaSum += l; lumaSq += l * l; count++;
  }
  const meanLuma = lumaSum / count;
  const stdLuma = Math.sqrt(Math.max(0, lumaSq / count - meanLuma * meanLuma));
  let hueBins = 0;
  for (let k = 0; k < 12; k++) if (hueCounts[k] > count * 0.004) hueBins++;
  return {
    uniqueQuantColors: buckets.size,
    meanLuma: +meanLuma.toFixed(4),
    stdLuma: +stdLuma.toFixed(4),
    avgSaturation: +(satSum / count).toFixed(4),
    hueBins,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(fn) { this.listeners.push(fn); }
  close() { this.ws.close(); }
}

async function launchBrowser(chromePath) {
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--enable-unsafe-swiftshader',
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((res, rej) => {
    let stderr = '';
    const timer = setTimeout(() => rej(new Error('Timed out waiting for Chromium DevTools WS:\n' + stderr)), 15000);
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) { clearTimeout(timer); res(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); rej(new Error(`Chromium exited ${code}:\n${stderr}`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  return { proc, cdp: new CDP(ws) };
}

async function runAudit() {
  mkdirSync(outDir, { recursive: true });
  const isLocal = existsSync(targetArg) && statSync(targetArg).isFile();
  const srv = isLocal ? await startStaticServer(resolve(targetArg)) : null;
  const url = srv ? srv.url : targetArg;
  const chromePath = findChrome();
  const { proc, cdp } = await launchBrowser(chromePath);

  const consoleErrors = [];
  const pageErrors = [];
  const consoleWarnings = [];

  try {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (m, p) => cdp.send(m, p, sessionId);

    cdp.on((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        if (msg.params.type === 'error') consoleErrors.push(text);
        else if (msg.params.type === 'warning') consoleWarnings.push(text);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        pageErrors.push(d.exception?.description || d.text || 'Unhandled exception');
      }
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    const loadDone = new Promise((r) => {
      const h = (m) => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') r(); };
      cdp.on(h);
    });
    await send('Page.navigate', { url });
    await Promise.race([loadDone, sleep(8000)]);
    await send('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready : Promise.resolve()', awaitPromise: true });
    await sleep(settleMs);

    const shot = async (name) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(data, 'base64');
      writeFileSync(join(outDir, name), buf);
      return buf;
    };

    const t1 = await shot('desktop-t1.png');
    await sleep(gapMs);
    const t2 = await shot('desktop-t2.png');

    // Pointer sweep for ASCII lens / vortex wake / eye tracking / hover reactivity
    for (let s = 0; s <= 12; s++) {
      const x = 360 + (620 - 360) * (s / 12);
      const y = 320 + (460 - 320) * (s / 12);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await sleep(35);
    }
    await sleep(450);
    const hoverBuf = await shot('desktop-hover.png');

    // Optional direct canvas click-pos interactions (poking characters, launching waves, painting PDE)
    const posCaptures = [];
    for (const step of clickPosSteps) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: step.x, y: step.y });
      await sleep(60);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: step.x, y: step.y, button: 'left', clickCount: 1 });
      await sleep(40);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: step.x, y: step.y, button: 'left', clickCount: 1 });
      await sleep(320);
      const buf = await shot(`pos-${step.label}.png`);
      posCaptures.push({ label: step.label, x: step.x, y: step.y, ...colorStats(buf), diffFromT2: diffPngs(t2, buf).diffRatio });
    }

    // Optional drag gesture test (orbital camera, wind steering, PDE painting)
    let dragDelta = null;
    if (testDrag) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 720, y: 450, button: 'left', clickCount: 1 });
      for (let s = 1; s <= 10; s++) {
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 720 + s * 22, y: 450 - s * 10, buttons: 1 });
        await sleep(30);
      }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 940, y: 350, button: 'left', clickCount: 1 });
      await sleep(450);
      const dragBuf = await shot('desktop-drag.png');
      dragDelta = diffPngs(hoverBuf, dragBuf);
    }

    // Optional multi-state UI click captures (presets, render modes, sculptures, palettes)
    const states = [];
    for (const step of clickSteps) {
      const res = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const el = document.querySelector(${JSON.stringify(step.selector)});
          if (!el) return { found: false };
          el.click();
          return { found: true, text: (el.textContent || '').trim() };
        })()`,
      });
      const found = !!res.result?.value?.found;
      if (found) {
        const hx = step.hoverPos ? step.hoverPos.x : 8;
        const hy = step.hoverPos ? step.hoverPos.y : 8;
        await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx, y: hy });
        await sleep(750);
        const buf = await shot(`state-${step.label}.png`);
        states.push({ label: step.label, selector: step.selector, found: true, ...colorStats(buf), diffFromT1: diffPngs(t1, buf).diffRatio });
      } else {
        states.push({ label: step.label, selector: step.selector, found: false });
      }
    }

    const evalRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const canvases = [...document.querySelectorAll('canvas')].map((c) => {
          const r = c.getBoundingClientRect();
          return { id: c.id || c.className || 'canvas', w: c.width, h: c.height, cssW: Math.round(r.width), cssH: Math.round(r.height) };
        });
        return {
          title: document.title,
          canvases,
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
          hasWebGL2: !!document.createElement('canvas').getContext('webgl2'),
        };
      })()`,
    });
    const desktopInfo = evalRes.result?.value || {};

    // Reduced motion audit
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await send('Page.reload', { ignoreCache: true });
    await sleep(Math.min(settleMs, 950));
    const rm1 = await shot('reduced-motion.png');
    await sleep(800);
    const rm2 = await shot('reduced-motion-check.png');

    // Mobile audit
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.reload', { ignoreCache: true });
    await sleep(settleMs);
    await shot('mobile.png');
    const mobInfoRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({ overflowX: document.documentElement.scrollWidth - window.innerWidth })`,
    });

    const motion = diffPngs(t1, t2);
    const hoverDelta = diffPngs(t2, hoverBuf);
    const rmMotion = diffPngs(rm1, rm2);
    const visuals = colorStats(t1);
    const rmVisuals = colorStats(rm1);
    const allStatesFound = states.every((s) => s.found);

    const report = {
      target: targetArg,
      outDir,
      desktopInfo,
      mobileOverflowX: mobInfoRes.result?.value?.overflowX ?? 0,
      motion,
      hoverDelta,
      ...(posCaptures.length ? { posCaptures } : {}),
      ...(dragDelta ? { dragDelta } : {}),
      ...(states.length ? { states } : {}),
      reducedMotion: { ...rmMotion, ...rmVisuals },
      visuals,
      consoleErrors,
      pageErrors,
      consoleWarnings,
      checks: {
        noRuntimeErrors: consoleErrors.length === 0 && pageErrors.length === 0,
        nonBlankVisuals: visuals.uniqueQuantColors >= 3 && visuals.stdLuma >= 0.015,
        liveMotionDetected: motion.diffRatio >= 0.002,
        reducedMotionStable: rmMotion.diffRatio <= 0.005 && rmVisuals.uniqueQuantColors >= 2,
        noDesktopOverflow: (desktopInfo.overflowX ?? 0) <= 2,
        noMobileOverflow: (mobInfoRes.result?.value?.overflowX ?? 0) <= 2,
        ...(states.length ? { allClickedStatesFound: allStatesFound } : {}),
      },
    };
    report.passed = Object.values(report.checks).every(Boolean);
    writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.passed ? 0 : 2;
  } finally {
    cdp.close();
    proc.kill('SIGKILL');
    if (srv) srv.server.close();
  }
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
