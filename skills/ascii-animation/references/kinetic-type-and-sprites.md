# Reference: Kinetic ASCII Typography, Dither Reveals & Living Cell-Grid Sprites

This reference covers Aria's signature typographic/entity choreography (`site.js`,
`journey.js`, `pages.js`, `birds.js`) plus interactive ASCII text/emblem morphs.

---

## 1. Stepped 4x4 Bayer Mask Reveals (`--dz1..--dz7`)

Headings and hero displays condense out of the exact same 4x4 Bayer dots that compose the
background sky — zero fade-blur soup.

### Generate 7 Stepped Mask Tiles at Boot & Resize
```js
const BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5].map((v) => (v + 0.5) / 16);

function buildDitherTiles(cell) {
  const cSize = Math.max(2, Math.round(cell || 3));
  const u = cSize * Math.min(3, Math.ceil(devicePixelRatio || 1));
  const cv = document.createElement('canvas');
  cv.width = cv.height = u * 4;
  const g = cv.getContext('2d');
  const root = document.documentElement.style;
  g.fillStyle = '#fff';
  for (let k = 1; k <= 7; k++) {
    g.clearRect(0, 0, u * 4, u * 4);
    for (let i = 0; i < 16; i++) {
      if (BAYER[i] < k / 8) g.fillRect((i & 3) * u, (i >> 2) * u, u, u);
    }
    root.setProperty('--dz' + k, `url(${cv.toDataURL()})`);
  }
  root.setProperty('--dzs', cSize * 4 + 'px');
}
```

### CSS Keyframes (`step-end` + Per-Block Stagger Budget)
**Stagger Timing Rule:** Reset `--i` per text block (eyebrow, headline, subtitle each start
at `--i: 0` with `blockDelay` 0ms / 90ms / 180ms) and keep per-word stagger `35–55ms` so
the entire hero finishes condensing cleanly within **~950ms** (never trapped mid-reveal at
`t1 = 1200ms`!).

```css
@keyframes dz {
  0%   { opacity: 0; }
  5%   { opacity: 1; -webkit-mask-image: var(--dz1); mask-image: var(--dz1); }
  18%  { opacity: 1; -webkit-mask-image: var(--dz2); mask-image: var(--dz2); }
  31%  { opacity: 1; -webkit-mask-image: var(--dz3); mask-image: var(--dz3); }
  44%  { opacity: 1; -webkit-mask-image: var(--dz4); mask-image: var(--dz4); }
  57%  { opacity: 1; -webkit-mask-image: var(--dz5); mask-image: var(--dz5); }
  70%  { opacity: 1; -webkit-mask-image: var(--dz6); mask-image: var(--dz6); }
  83%  { opacity: 1; -webkit-mask-image: var(--dz7); mask-image: var(--dz7); }
  100% { opacity: 1; -webkit-mask-image: none; mask-image: none; }
}
.kin .w {
  display: inline-block; opacity: 0;
  padding-block: .22em; margin-block: -.22em; /* prevents clipping descenders */
  -webkit-mask-size: var(--dzs, 12px) var(--dzs, 12px);
  mask-size: var(--dzs, 12px) var(--dzs, 12px);
}
.kin.in .w {
  opacity: 1;
  animation: dz 520ms step-end both, dzr 760ms cubic-bezier(.16,1,.3,1) both;
  animation-delay: calc(var(--bd, 0ms) + var(--i) * 42ms);
}
@keyframes dzr { from { transform: translateY(.12em); } }
@media (prefers-reduced-motion: reduce) {
  .kin .w { opacity: 1; animation: none; -webkit-mask-image: none; mask-image: none; }
}
```

---

## 2. Passing Cloud-Wisp Mask Over Hero Wordmarks

Make a large display word feel *inside* the atmosphere by sliding a periodic Bayer-dithered
cloud-wisp mask across it at the near cloud deck's exact cell pace:
1. Draw a seamless periodic `384 x 96` cell canvas filled white (`#fff`), carving soft
   passing translucencies (`alpha 0.46` / `0.20`) wherever periodic FBM exceeds the Bayer
   threshold.
2. Apply as CSS `mask: var(--wisp) 0 0 / var(--wisp-w) var(--wisp-h) repeat;` animated with
   `animation: wisp 96s steps(384) infinite;` (stepping one crisp cell at a time!).
3. Pause with `IntersectionObserver` when off-screen, and disable under reduced motion.

---

## 3. Rasterized Dithered / ASCII Typography & Morphing Emblems

### A. Top-Down Lit Footer Signature (Aria `pages.js` Pattern)
1. Wait for `document.fonts.ready`.
2. Measure DOM text characters via `Range.getBoundingClientRect()` and rasterize each
   character onto a tiny offscreen canvas at `fontSize / cell` to get per-cell coverage
   `cov[y * w + x] ∈ [0..1]`.
3. Light each cell from the crown downward with a misty value-noise dissolution at the base:
   ```js
   let u = clamp((y + 0.5 - g.top) / (end - g.top));
   u = clamp(u + (vnoise(gx / 9, gy / 6) - 0.5) * 0.22 * Math.sin(Math.PI * u));
   val[i] = cov[i] * (6.55 * Math.pow(1 - u, 1.45));
   ```
4. Animate reveal top-to-bottom (`fill = clamp(p * 1.8 - u * 0.8)`), quantized through the
   4x4 Bayer matrix onto the shared 8-step tone ladder!

### B. Interactive Morphing ASCII Typography & Brand Emblems
For kinetic brand/wordmark showcases where words or geometric emblems morph smoothly and
react to pointer physics:
1. **Offscreen Target Sampler**: Render the target word (auto-fitted to 78% of canvas width,
   handling multi-line wrapping on mobile!) or geometric emblem path onto an offscreen canvas
   at exact ASCII grid resolution `(cols x rows)`. Extract `targetDensity[i]`, vertical
   crown shading `crown[i]` (top bright -> bottom misty), and horizontal/vertical edge
   flags so outlines can accent cleanly.
2. **Stateful Per-Cell Spring & Wave-Sweep Physics** (zero-GC `Float32Array` buffers):
   - `density[i]` approaches `targetDensity[i]` on a staggered left-to-right (or center-out)
     wave front so word morphs cascade like liquid ink!
   - `dx[i], dy[i], vx[i], vy[i]`: critically damped spring (`a = -28 * d - 7.5 * v`) driven
     by cursor repulsion/vortex swirl AND click shockwave rings!
   - `energy[i]`: spikes during word morph transitions, shockwaves, and cursor wake; while
     `energy[i] > 0.12`, the glyph scrambles briskly through structural characters
     `/:=+*#%` before locking into its crisp settled Bayer-dithered tone glyph!
   - **Subtle Living Ground**: Behind the wordmark, render a quiet architectural grid of
     faint drifting wave ticks / crosshairs (`·` / `:` / `+` on tone `1..2`) that also
     react to cursor proximity and shockwaves, keeping ambient motion alive (`diffRatio > 0.005`)
     even between word morphs!
3. **Interactive Controls**: Compact floating dock with word/emblem presets, inline live
   custom text input, palette switcher (e.g., Editorial Paper & Ink, Glacier Night, Obsidian
   Amber, Phosphor Instrument), render style toggle (ASCII Glyphs vs Bayer Pixel Blocks),
   and `prefers-reduced-motion` freeze (renders the crisp fully-condensed wordmark at rest).

---

## 4. Living Cell-Grid Entities (Birds, Schools, Contrails, Fireflies)

From Aria's `birds.js` — tiny animated pixel/glyph creatures moving on the EXACT same cell
grid give an atmospheric canvas unmistakable life:

### Zero-GC Typed Pools & Spring Formations
- Pre-allocate flat `Float32Array` pools (`MAX_ENTITIES = 28..64`): position `x, y`,
  velocity `vx, vy`, formation slot offset `ox, oy`, phase `ph`, age `age`.
- **Flock Anchor**: Moves along a gentle sinusoidal arc (`y = y0 + sin(t * freq + ph) * amp`).
  Keep spawn lanes clear of hero headlines (mid-lower sky bands `0.42–0.76 * vh`).
- **V-Formations**: Two arms of slightly unequal length trailing behind the leader
  (`ox = -dir * rank * gap * 1.05`, `oy = ±rank * gap * 0.62`), held on a soft critically
  damped spring (`ax = (tx - x) * 3.2 - vx * 2.6 + anchorVx * 2.6`) so the V breathes!
- **Calm Pointer Veer**: Within `R = 130px`, apply gentle radial steering
  (`w = 1 - d/R; ax += (qx/d) * w * 260`).
- **Interactive Click Burst**: Clicking empty sky spawns a cluster climbing upward on
  exponentially decaying lift (`rise * exp(-t * 0.75)`) before settling into level flight.
- **12 FPS Sprite Clock**: Positions update smoothly every frame and snap to integer cells
  at draw time; wing-flap / swim frames advance on a crisp `1000 / 12` ms accumulator
  (`FLAP = [0, 1, 2, 1]`):
  ```js
  const GULL_7 = [
    ['X.....X', '.X...X.', '..XXX..'],
    ['.XX.XX.', 'X..X..X', '.......'],
    ['.......', 'X.XXX.X', '.X...X.'],
  ];
  const GULL_5 = [
    ['X...X', '.X.X.', '..X..'],
    ['.X.X.', 'X.X.X', '.....'],
    ['.....', 'X.X.X', '.X.X.'],
  ];
  ```
- **Bayer-Dissolving Contrails / Wakes**: Behind a plane (or gliding fish/ray), compute age
  `0..1` and `keep = (1 - age) * rampIn`; draw cell `(cx, cy)` only when
  `keep > BAYER[((cy & 3) << 2) | (cx & 3)]`. Past `age > 0.3`, spread a second row
  `cy + 1` at `keep * 0.7` so the wake widens and evaporates through the ordered dither.
