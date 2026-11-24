# Reference: Bayer 4x4 Dithered Atmospheric Worlds & ASCII Lens

This reference encodes the exact WebGL2 + 2D-Canvas architecture pioneered by Aria's
glacier sky (`joinariapp.com`) and generalizes it to any atmospheric, celestial, landscape,
or volumetric scene with an optional live 5x7 ASCII lens or full-grid ASCII mode.

---

## 1. Unified Screen-Space Cell Grid & Top-Down FBO Convention

Every visual element locks to whole device pixels so squares stay razor sharp while
underlying continuous fields glide at sub-cell precision:

```js
const cellSize = (w, h) => Math.max(3, Math.round(Math.max(w, h * 1.4) / 480));
const maxPixels = 3840 * 2400;

function resize(canvas, S) {
  const vw = Math.max(1, innerWidth), vh = Math.max(1, innerHeight);
  let dpr = Math.max(1, Math.min(devicePixelRatio || 1, 3));
  if (vw * vh * dpr * dpr > maxPixels) dpr = Math.max(1, Math.sqrt(maxPixels / (vw * vh)));
  const cellCss = cellSize(vw, vh);
  const cellDev = Math.max(1, Math.round(cellCss * dpr));
  const dw = Math.ceil(vw * dpr), dh = Math.ceil(vh * dpr);
  canvas.width = dw; canvas.height = dh;
  canvas.style.width = (dw / dpr) + 'px';
  canvas.style.height = (dh / dpr) + 'px';
  S.gw = Math.ceil(dw / cellDev);     // ~480 wide on desktop
  S.gh = Math.ceil(dh / cellDev);     // ~300 tall
  S.lw = Math.ceil(S.gw / 6);         // glyph grid (6x9 sky cells per 5x7 glyph)
  S.lh = Math.ceil(S.gh / 9);
  S.cell = cellDev / dpr;             // true CSS px per cell
  S.cellDev = cellDev; S.dw = dw; S.dh = dh; S.vw = vw; S.vh = vh;
}
```

### Coordinate Convention Across the 3 Passes (CRITICAL — Avoid Inverted Y!)

Keep the offscreen FBOs (`sky` and `gly`) strictly **top-down** (`row 0 = top of viewport`,
matching DOM CSS `top: 0` and `getBoundingClientRect()`):
1. **Pass 1 (`FIELD` -> FBO `sky`, `gw x gh`, `RGBA8`, `NEAREST`)**:
   - `ivec2 ic = ivec2(gl_FragCoord.xy);` -> `ic.y == 0` is viewport TOP.
   - `vec2 P = (vec2(ic) + 0.5) * uCell;` -> matches DOM CSS coordinates `(clientX, clientY)` directly!
   - Writes `oc = vec4(quantizedColor, (1.0 + Ls * 36.0) / 255.0)` (`alpha == 0.0` = masked).
2. **Pass 2 (`GLYPHPASS` -> FBO `gly`, `lw x lh`, `RGBA8`, `NEAREST`)**:
   - `ivec2 gc = ivec2(gl_FragCoord.xy);` -> also top-down, reading `c0 = gc * ivec2(6, 9)` directly from `uTex`!
3. **Pass 3 (`BLIT` -> Default Screen Framebuffer, `dw x dh`)**:
   - **Only here** do we flip WebGL's bottom-up `gl_FragCoord.y` into top-down cell space:
     `ivec2 c = ivec2(f.x / uCellDev, (uTop - 1 - f.y) / uCellDev);`
   - Fetches `sky` and `gly` via `texelFetch`. Never flip Y in Pass 1 or Pass 2!

Fullscreen triangle vertex shader (shared by all 3 passes, zero VBO needed):
```glsl
#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
```

### Safe WebGL2 Init & Canvas-Cloning 2D Fallback Pattern (CRITICAL!)

Per the HTML Canvas specification, once `canvas.getContext('webgl2')` returns a context,
calling `canvas.getContext('2d')` on that **same `<canvas>` element permanently returns `null`**
— even if shader compilation/linking subsequently fails! Always log compile errors AND
clone/replace the canvas node before initializing the 2D fallback:

```js
function initWithFallback(canvas, initGL, init2D) {
  let glCtrl = null;
  try {
    glCtrl = initGL(canvas);
  } catch (err) {
    console.error('[ascii-animation] WebGL2 init failed, falling back to 2D:', err);
    glCtrl = null;
  }
  if (glCtrl) return { ctrl: glCtrl, canvas, mode: 'webgl2' };

  // Clone/replace canvas so getContext('2d') is never blocked by a prior webgl2 binding
  const fresh = canvas.cloneNode(false);
  canvas.replaceWith(fresh);
  return { ctrl: init2D(fresh), canvas: fresh, mode: '2d' };
}
```

Do NOT set `failIfMajorPerformanceCaveat: true` when you want headless/software-GL
browsers to verify your WebGL2 shaders directly.

---

## 2. Aperiodic Noise, Domain Warping & Directional Cloud Lighting

Never use `fract(sin(dot(p, ...)))` hashing — it causes banding and precision drift. Use
integer PCG2 hashing and a ~36 deg rotated octave matrix (`OCT`):

```glsl
const int BAYER[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
const mat2 OCT = mat2(1.62, 1.18, -1.18, 1.62); // ~2x scale, rotated ~36 deg per octave

uint pcg2(uvec2 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= v >> 16u;
  return v.x ^ v.y;
}
float rnd(ivec2 p, uint salt) {
  return float(pcg2(uvec2(p) + uvec2(salt, salt * 7919u))) * (1.0 / 4294967296.0);
}
vec2 grad(ivec2 p) { float a = rnd(p, 0u) * 6.2831853; return vec2(cos(a), sin(a)); }

float noise(vec2 p) {
  vec2 i = floor(p), f = p - i;
  ivec2 q = ivec2(i);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic smoothstep
  float a = dot(grad(q), f);
  float b = dot(grad(q + ivec2(1, 0)), f - vec2(1.0, 0.0));
  float c = dot(grad(q + ivec2(0, 1)), f - vec2(0.0, 1.0));
  float d = dot(grad(q + ivec2(1, 1)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.45;
}

float fbm(vec2 p, int n) {
  float s = 0.0, a = 0.5, w = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= n) break;
    s += a * noise(p); w += a;
    p = OCT * p + vec2(17.31, 9.17);
    a *= 0.5;
  }
  return s / w;
}
```

### Three-Deck Parallax & Volumetric Shading

- **Far haze** (3 octaves, scale `480 x 190` cells, drift `t * 0.7`, scroll `0.10`, fly `0.35`): sets regional sky mood and modulates cumulus coverage.
- **Main cumulus** (5 octaves, scale `205 x 86` cells, drift `t * 2.3`, scroll `0.22`, fly `1.1`): domain-warped by two 3-octave FBM fields (`pw = pm + w * 0.42`).
  - **Directional lighting**: Sample offset `dmSun = fbm(pw + toL, 4)` toward the sun/moon (or zenith `vec2(-0.05, -0.11)`). `shade = clamp((dm - dmSun) * 2.4, -1.0, 1.0)` gives sunlit crowns and deeper shadowed undersides!
- **Near wisps** (4 octaves, scale `240 x 70` cells, drift `t * 4.0`, scroll `0.40`, fly `2.4`): sparse crisp highlights rushing past.

### Ladder Composition & Dusk

```glsl
float yh = 1.0 - d * 1.1;
float g = smoothstep(yh - 0.55, yh + 0.20, yf);
float night = clamp(d * 0.45 + g * min(1.0, d * 1.5) * 0.62, 0.0, 1.0);
float L = 4.0 + 3.0 * clamp(v, 0.0, 1.05) - night * 4.35 - d * d * 0.7 * yf;
```

---

## 3. Celestial & Atmospheric Phenomena (All on the Same Ladder)

Derive `cl = max(D, N)`, `clear = 1.0 - smoothstep(0.05, 0.5, cl)`, and
`edge = smoothstep(0.03, 0.2, cl) * (1.0 - smoothstep(0.3, 0.72, cl))`:

- **Sun**: Flattening horizon halo (`vec2(1.0 + 2.8*sLow, 1.0 - 0.25*sLow)`), stepped halo
  rings (`6.2 - 1.2 * pow(sHx, 0.72)`), silver linings on `edge`, dark backlit cloud bodies
  when clouds pass in front (`L -= ... * smoothstep(0.4, 0.9, cl)`), and a dithered limb
  disc cut where thick cloud occludes it. Low sun spawns a cloud sea at `0.84 * vh`.
  - **Mobile Safe Zone:** On narrow viewports (`vw < 760`), place sun/moon discs at
    `y <= 0.11 * vh` (or ensure hero copy sits clearly below `y + r + 24px`) so a solid
    white solar disc never collides with white eyebrow/headline text!
- **Moon**: Real spherical Lambertian shading (`vec3 n = vec3(mQ, sqrt(max(1.0 - mRd*mRd, 0.0)))`,
  `lam = dot(n, uMoonL)`). Exact phase light vector (`ph ∈ [0..1]`, `0.25` = waxing crescent):
  ```js
  const ph = ((phase % 1) + 1) % 1, s = Math.sin(Math.PI * ph), lit = Math.pow(s * s, 1.5);
  const c = 1 - 2 * lit, sn = Math.sqrt(Math.max(0, 1 - c * c)) * (ph < 0.5 ? 1 : -1);
  // Note -c on z: 0 = new (-1, behind), 0.25 = crescent, 0.5 = full (+1, toward viewer)
  gl.uniform3f(u.uMoonL, sn * 0.914, sn * -0.407, -c);
  ```
  Add mare patches via noise and gate subtle earthshine (`max(L0, earthshine)`) by dusk so
  the dark limb never stamps a dark hole over bright dawn skies!
- **Milky Way**: Rotated ~28 deg diagonal Gaussian band with warped edge, thin dark dust
  lanes along the core, and `3.6x` star density boost (`dens = 0.0024 * (1.0 + 2.6 * mwS)`).
- **Stars**: Deterministic cell hash `rnd(sp, 101u) < dens` scrolling slowly (`sc * 0.05`).
  Top 3% brightest stars render as 5-cell `+` crosses. Twinkle clock wraps cleanly at `64.0s`.
- **Shooting Stars**: Engine-driven every 4–11s at full night (`dusk > 0.8`), bright head +
  4-neighbor glow + 1-cell tapering tail dissolving through the Bayer threshold.
- **Aurora Curtains**: Wavy lower hem (`hem = vhc * (uAurY + 0.1 * noise(...))`), asymmetric
  Gaussian sharpness (`h < 0 ? 0.0008 : 0.004`), leaning vertical rays, quantized on a
  dedicated 4-step green/teal accent ladder `uAur[4]`. Keep the 4th pale top color (`#B2C8F0`)
  sparse (sprinkled on tall tips only, never flooding a whole `6x9` glyph block) so the
  green-channel aurora detector in `GLYPHPASS` always keeps midnight background `ut = 0`!
- **Dawn & Dithered Horizon**: Dawn climbs from the bottom in curved bands catching cloud
  undersides; below `uHz`, a Bayer-dithered mist edge transitions into dark ground.

---

## 4. Content-Aware Spatial Choreography

### Text Legibility Thinning (`[data-dim]`)
Read up to 8 visible `[data-dim]` DOM rects (include eyebrows, headlines, subtitles, AND
subtle interaction hints!) at the start of the frame before any style writes:
```glsl
float dim = 0.0;
for (int k = 0; k < 8; k++) {
  if (k >= uDimN) break;
  vec4 r = uDim[k]; // left, top, right, bottom in CSS px
  vec2 a = max(max(r.xy - P, P - r.zw), 0.0);
  dim = max(dim, exp(-dot(a, a) * (1.0 / 3600.0)));
}
float knee = 0.28;
float vd = (v > knee ? knee + (v - knee) * 0.22 : v) - 0.04;
v = mix(v, vd, dim * (1.0 - smoothstep(0.25, 0.75, uDusk)));
```
Also attenuate `starVis *= 1.0 - 0.82 * dim`, `aurora *= 1.0 - 0.7 * dim`, and cap sun/dawn
glow behind `[data-dim]` (`min(glow, 5.2)`).

### Circular Dither Intro Reveal, Cloud Parting & Pointer Light
- **Reveal (`uRev`)**: `if (uRev.z >= 0.0 && length(P - uRev.xy) > uRev.z - 10.0 * uCell * th) { oc = vec4(0.0); return; }`
- **Cloud Parting (`uPart`)**: Elliptical clearing around a focal card/display with a
  cloud-shaped edge (`smoothstep(0.75, 1.25, pr + (dm - 0.1) * 0.45)`).
- **Pointer Light**: Eased toward pointer (`1 - exp(-dt * 9)`), adds Gaussian light that
  catches clouds more than open sky (`uPtr.z * pd * (0.10 + 0.14 * max(D, N))`).

---

## 5. Fast 2D Canvas Fallback Pattern

When WebGL2 is unavailable (always on a fresh cloned canvas if WebGL2 failed mid-init):
1. Precompute two seamless periodic FBM lookup tables (`512 x 512` `Float32Array`) at boot.
2. Render at `W x H` (`Math.ceil(vw / cell)`) into a single reused `ImageData` buffer.
3. Compute `[data-dim]` and pointer Gaussian weights **separably** (`exp(-(a² + b²)) = exp(-a²) * exp(-b²)`) into 1D `DX[W]` / `DY[H]` arrays — zero per-pixel `Math.exp()` calls!
4. Quantize through the identical 16-entry `BAYER` lookup and interpolate day -> night tones.
5. Support the ASCII lens and full-ASCII mode in 2D fallback by sampling `6x9` blocks and
   stamping the exact same `5x7` bitmap patterns into `ImageData`.
