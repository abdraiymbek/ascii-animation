# Reference: Full-Scale Bright Polychromatic Illustrated Worlds & Expressive Characters

This reference fuses `dusk.bot`'s joyful, luminous multi-color pixel-world craft (stepped
sky bands, snow peaks, lavender hills, emerald treelines, wildflower meadows, chalk cliffs,
pastel sailboats, and expressive SDF pixel characters) with `joinariapp.com`'s crisp
cell-locked optical rendering and live `5x7` ASCII lens / full-color ASCII compositing.

---

## 1. Multi-Plane Scene Architecture (5 to 7 Depth Planes)

A convincing full-scale scene is NEVER a single noise pass — it is a **back-to-front painter's
stack of distinct semantic depth planes**, each locked to the exact same integer pixel grid
(`cellDev`) and parallaxing gently with pointer/scroll motion:

| Depth Plane | Parallax Factor | Visual Role & Material Language |
|---|---|---|
| **0. Sky Bands** | `0.02` | 3–4 saturated horizontal sky bands joined by **crisp 2–4 cell stepped pixel-dither seams** (never smooth blurry gradients!). |
| **1. Celestials & Drifting Clouds** | `0.06` | Bright golden pixel sun (2-tone core + halo rim) or crescent moon; 2-tone pixel clouds (bright cream top + pastel pink or lemon belly) drifting slowly. |
| **2. Far Horizon / Peaks / Skyline** | `0.12` | Crisp stepped alpine mountain silhouettes with snowy white caps + pale sky-blue shadow ridges, OR twilight pagoda/city roofs. |
| **3. Atmospheric Mid-Far Layer** | `0.22` | Soft pastel foothills (lavender `#CFC2F8` in daylight, muted plum at dusk) — warm/cool atmospheric separation makes foreground colors POP! |
| **4. Midground Landmarks** | `0.38` | Vivid emerald pine treeline, sunlit chalk cliffs + rotating lighthouse, glowing wooden canal bridge, or elevated train viaduct. |
| **5. Water / Foreground Ground** | `0.55` | Tiered azure sea with animated horizontal wave glints + **sinusoidal water reflections**, OR bright chartreuse sunlit meadow dotted with 5-cell pixel wildflowers swaying in wind waves. |
| **6. Living Characters, Vehicles & Weather** | `0.72–1.0` | Expressive procedural SDF pixel bots/creatures, tacking sailboats with Bayer-dissolving wakes, swaying lanterns, diagonal rain + puddle splashes, drifting petals/fireworks! |

### 2D Landscape Portrait Scaling Rule (CRITICAL for 390x844 Mobile!)
Never compute mountain, cliff, or building heights solely as fractions of `gh` while widths
scale with `gw` — on narrow `390x844` mobile screens that stretches slopes ~2.5× steeper
into skinny spikes! Always clamp vertical landform amplitude using horizontal scale:
```js
const landScale = vw < 760 ? Math.min(gh, gw * 1.15) : gh;
const peakH = Math.round(landScale * 0.28); // natural alpine/cliff slopes on both desktop & mobile!
```

### Fast Zero-Blur Archetype F Engine (`Uint32Array` `ImageData` + `matBuf` + `SCENE_24`)
For full-scale illustrated scenes with 6–7 depth planes + SDF characters + weather + Color
ASCII lens/full-mode, an ultra-clean, zero-shader-overhead engine is:
1. Render all depth planes, stepped seams, reflections, and SDF characters directly into a
   `gw x gh` pixel buffer (`Uint32Array` view over `ImageData`) plus parallel `Uint8Array`
   `matBuf` (semantic material ID) and `detBuf` (local shading/detail `0..255`).
2. Inside the Bayer-rimmed circular ASCII lens (or everywhere in Full-Color ASCII mode),
   sample `6x9` blocks of `(pixBuf, matBuf, detBuf)` and stamp packed `5x7` `SCENE_24`
   bitmaps directly into the output buffer with `ctx.imageSmoothingEnabled = false`.
3. Blit to the device-resolution canvas at exact integer `cellDev` scaling. Zero blur,
   instant 60fps, and 100% consistent across every browser and GPU!

---

## 2. Stepped Pixel-Dither Band Seams & Subtle Tactile Micro-Weave

What makes `dusk.bot`'s bright skies and seas look like handcrafted pixel art rather than
flat HTML color blocks?

1. **Stepped Pixel-Dither Band Transitions (2–4 Cells Tall):**
   Between band color `A` and band color `B` around row `ySeam`:
   ```js
   // t = 0 above seam, 1 below seam across a 4-cell band
   const t = clamp((cy - (ySeam - 2)) / 4, 0, 1);
   // Combine ordered 4x4 Bayer + mild horizontal wave jitter for playful organic pixel edges!
   const wave = Math.sin(cx * 0.23 + tShift) * 0.14 + Math.cos(cx * 0.61) * 0.1;
   const useB = (t + wave) > BAYER[((cy & 3) << 2) | (cx & 3)];
   ```
   This yields the unmistakable playful pixel-stepped horizontal horizon seams seen across
   `dusk.bot`'s skies, meadows, cliffs, and oceans!

2. **Whisper-Subtle Tactile Micro-Weave (Screenprint Grain):**
   Flat bright fills (like a sunlit lime meadow or cream cliff) come alive when modulated by
   a ultra-subtle `+-3%` lightness checkerboard/weave or sparse 1-cell texture ticks (e.g.,
   tiny darker grass blades on meadow cells where `hash(cx, cy) < 0.06`, or subtle horizontal
   cloud/water weave bars). Keep contrast low so it reads as print texture, never noise!

---

## 3. True-Color Polychromatic Rendering (Dual Mode: Pixel+Lens & Full-Color ASCII)

Every full-scale illustrated scene should shine in BOTH **Crisp Illustrated Pixel/Bayer +
Live Color 5x7 ASCII Lens** AND **Full-Screen Polychromatic ASCII Illustration**!

### How to Preserve Vibrant Multi-Color Scenes in ASCII
Do NOT collapse a polychromatic scene to a single monochrome 8-tone ladder! Instead, for
every `6x9` cell tile `(gcx, gcy)` (in WebGL2 `GLYPHPASS` OR high-DPI 2D Canvas):
1. Sample the scene RGB `(r, g, b)` AND semantic material ID `matId` across the covered tile.
2. Pick the **dominant tile RGB** (or vibrant peak RGB if a bright flower/lantern/bot pixel
   sits inside the tile — Law 5 highlight preservation!).
3. Select the **glyph** from **material-aware ASCII ramps** so every zone has tactile character:
   - Sky bands: `' '` / `'.'` / `':'` / `'-'` (keeps sky airy and joyous!)
   - Clouds: `'='` / `'+'` / `'o'` / `'#'`
   - Snow peaks & cliffs: `'/'` / `'\\'` / `'^'` / `'#'` / `'%'`
   - Treeline & meadow grass: `','` / `'`'` / `'^'` / `'"'` / `';'` / `'v'` (swaying phase shifts glyphs subtly!)
   - Wildflowers, lanterns, sun, sparks: `'*'` / `'+'` / `'o'` / `'@'`
   - Ocean & canal reflections: `'~'` / `'='` / `'-'` / `':'`
   - Boats, roofs, bridges, characters: `'#'` / `'%'` / `'@'` / `'['` / `']'` / `'|'` / `'_'`
4. **Foreground / Background Color Pairing per Tile (CRITICAL for Bright Scenes!):**
   - On **bright sunlit zones** (cyan sky, lime meadow, cream cliff), derive a crisp **slightly
     tinted/darker or brighter companion tone** on the SAME material hue — never drop black
     `#000` boxes behind sunny blue skies! Specifically:
     - Background fill = `mix(tileRgb, zoneBaseRgb, 0.72)` (or shifted `-14%` lightness on dark
       scenes / `+10%` lightness on sunlit skies so glyphs pop cleanly while preserving the
       full radiant sky/meadow color!).
     - Foreground glyph color = high-contrast crisp accent of that material (`+24%` lighter on
       dark/mid zones like pines/sea/night roofs, or `-28%` richer/deeper hue on ultra-bright
       zones like sunlit lime meadow or cream sails, OR pure `#FFFFFF` on cyan sky/clouds!).
   - Inside a **circular Color ASCII Lens** around the cursor (`LENS_R = 115–135px`), use the
     exact same Bayer-dithered circular rim (`r < 1.0 - (5.0 / uLensR) * th`) so moving the
     cursor over a pixel mountain, sailboat, lantern, or bot reveals living polychromatic ASCII
     characters seamlessly!
5. **Highlight Promotion Guardrails (Avoid Stray Boxes & Wrong Material Promotion!):**
   - Give tiny bright points (stars, fireflies, wildflowers, water glints, lantern sparks)
     their own dedicated `MAT_SPARK` ID — NEVER reuse `MAT_SUN`/`MAT_MOON` for star arms, or
     isolated stars will promote into Moon-colored `@` blocks in Full-Color ASCII!
   - When promoting a micro-highlight inside a `6x9` tile, compute the tile's unlit background
     color from the **dominant non-highlight material actually present in that tile** (not a
     hardcoded sky/meadow fallback) so sparks overlapping snow peaks, cliffs, or rooftops
     never leave dark cutout squares.

---

## 4. Expressive Procedural SDF Pixel Characters (`dusk.bot` `mascot.js` Pattern)

Instead of static sprites, synthesize adorable, expressive characters directly on the scene's
pixel grid using compact 2D geometric primitives + spring physics:

### A. SDF / Geometric Primitive Rasterizer (`N x N` Local Grid, e.g. `16x16`)
Compose any character from simple shape primitives with optional `cut: true` (boolean carve),
`mir: true` (horizontal mirror), and `piv` (articulated sway/twitch pivot):
- Circle: `(x - cx)^2 + (y - cy)^2 < r^2`
- Ellipse: `((x - cx)/rx)^2 + ((y - cy)/ry)^2 < 1`
- Superellipse (squircle body): `|((x - cx)/rx)|^p + |((y - cy)/ry)|^p < 1` (`p = 2.4..3.5`)
- Polygon (cat ears, star points, boat sails): ray-casting point-in-polygon
- Rounded rect & capsule (rabbit ears, limbs, antennae)

### B. Spring Physics, Eye Gaze & Interactive Pokes
Give every character its own compact state object:
- **Springs**: `sq` (squash/stretch, stiffness `k = 220`, damping `zeta = 0.45`), `lean` (tilt),
  `hopY` / `hopV` (gravity hop with pre-jump `crouch`), `dx` (wobble).
- **Cursor Gaze & Blinking**: Compute angle from character center to pointer `(px, py)`; clamp
  eye pixel offset `gx ∈ [-1, 1]`, `gy ∈ [-1, 1]`. Blink naturally every `2.6–5.2s` for `110ms`.
- **Moods & Eye Sprites** (drawn in crisp `#FFFFFF` or dark ink inside body bounds):
  - `open`: `2x3` or `2x4` crisp vertical pixels
  - `happy`: `^ ^` pixel arcs (`3x2`)
  - `heart`: `3x3` pixel hearts
  - `big`: `3x4` surprised eyes
  - `closed`: `2x1` flat sleeping line
- **Click / Poke Reactions & Social Glances**:
  - Clicking a character triggers a random reaction: **`boing`** (high hop + happy eyes),
    **`wobble`** (damped sinusoidal lean + squash), **`squish`** (deep crouch then pop!), or
    **`spin`** (quick yaw flip).
  - **Social awareness**: Any neighboring character within `260px` receives a delayed
    `glance(pokedX, pokedY, 900ms)` (`delay = 120 + dist * 1.4 ms`) so the whole crew looks
    over when you poke one of them!

---

## 5. Living Environmental Physics (Wind, Reflections & Weather)

- **Shared Wind Field**: `wind(x, t) = baseWind + Math.sin(x * 0.015 - t * 1.8) * gust + pointerWind(x, y)`.
  Grass blades, wildflowers, tree crowns, hanging lanterns, cloud drift, and sailboat heel
  all read the same wind function so the world moves cohesively!
- **Animated Water Reflections (Canals & Harbors)**:
  For every water cell `(x, y)` below waterline `y0`, mirror vertically to `srcY = y0 - (y - y0) * 0.85`
  and displace horizontally by `dx = Math.round(Math.sin(y * 0.55 - t * 3.4 + noise) * (1.2 + (y - y0) * 0.04))`!
  Darken reflection slightly, interleave horizontal wave specular glints (`~` / `-`), and
  modulate with pointer ripples — neon lanterns and pastel sails shimmer like liquid glass!
- **Crisp Pixel Weather**:
  - Diagonal rain streaks (3–5 cell angled lines snapping to the grid) terminating in tiny
    3-frame puddle splash rings (`·` -> `o` -> `v`) on horizontal ground/canal surfaces.
  - Pointer acts as a subtle umbrella/wind shield creating a calm pocket in the rain or
    swirling cherry/dandelion petals!
