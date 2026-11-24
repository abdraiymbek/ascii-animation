# Reference: GPU 5x7 Bitmap ASCII Engine, True-Color ASCII & Ping-Pong PDEs

This reference covers:
1. **GPU-packed `5x7` bitmap ASCII** (monochrome ladder AND **True-Color Polychromatic RGB** mode)
2. **Real-Time WebGL2 Ping-Pong FBO PDEs** (Gray-Scott Reaction-Diffusion, Advected Fluid)
3. **High-DPI Tone-Bucketed 2D Canvas ASCII**
4. **Procedural Field Recipes Tuned for ASCII Readability**

---

## 1. Hand-Crafted 5x7 Bitmap Glyphs in GLSL (Zero Font-Atlas Blur)

Packing `5x7` pixel bitmaps directly into GLSL `uint` constants guarantees 100% crisp
geometry aligned to the exact cell grid (one `5x7` glyph per `6x9` cell tile, leaving a
1-cell right gutter and 2-cell bottom gutter).

Each `5x7` glyph has 35 bits packed MSB-first into two `uint`s:
- `word0`: rows `0..3` (20 bits, index `b ∈ [0..19]`, shift `19 - b`)
- `word1`: rows `4..6` (15 bits, index `b ∈ [20..34]`, shift `34 - b`)

Run `node <skill>/scripts/pack-glyphs.mjs` to emit pre-packed GLSL constants for `GLYPH_10`
(` .,:=-+*#%`) and `GLYPH_17` (adds `~`, `@`, `/`, `\`, `|`, `_`, `█`), or pass a custom JSON
file to pack domain glyphs (such as `^`, `o`, `v`, `"`, `;`, `[`, `]`).

### Cell Sizing Regimes
- **Localized ASCII Lens over Bayer/Illustrated World (Archetypes A & F):** `cellCss = Math.max(3, Math.round(Math.max(vw, vh * 1.4) / 480))` (~480x300 crisp scene cells).
- **Full-Screen Procedural / PDE / 3D ASCII (Archetypes B & C):** `cellCss = vw < 760 ? 1 : 2` (~120x50 crisp glyphs on 1440x900 desktop AND ~65x93 crisp glyphs on 390x844 mobile).

---

## 2. Monochrome vs. True-Color Polychromatic `GLYPHPASS` & `BLIT`

### A. Monochrome Ladder Mode (Aria Sky / Single-Hue Fields)
Pass 1 writes `oc = vec4(quantizedColor, (1.0 + Ls * 36.0) / 255.0)`.
`GLYPHPASS` reads all `6x9` cells, computes mean `m` and peak `mx`, gates Bayer offset on
`m > 0.08` so obsidian void stays clean (`ut = 0` on dark grounds, `max(T - 1, 0)` on bright
daytime skies), preserves isolated highlights (`mx - m > 1.8 && mx > 3.4 -> '*' / '+'`), and
packs `(gi, lt, ut, at) / 255.0`.

### B. True-Color Polychromatic RGB Mode (`dusk.bot` Scenes, Bio PDEs, Bauhaus 3D)
When your scene has **multiple vivid colors** (cyan sky, lime meadow, coral reefs, vermilion
lanterns, Bauhaus primaries), do NOT discard RGB in `GLYPHPASS`! Use this zero-loss
**True-Color GPU ASCII Pattern** (no extra render target needed!):

- **Pass 1 (`SCENE` -> FBO `uScene`, `RGBA8`, `gw x gh`):**
  Write `rgb = true vibrant scene pixel color`, `a = semantic detail/density value ∈ [0..1]`
  (e.g., luminance, PDE concentration, SDF contour strength, or material texture density).
- **Pass 2 (`BLIT` -> Screen `dw x dh` directly, OR optional `GLYPHPASS` FBO `uGly` storing `(rgb, glyphIdx/255.0)`):**
  With `uGly` storing `(tileRgb.r, tileRgb.g, tileRgb.b, float(gi) / 255.0)`:
  1. In `GLYPHPASS`, average `rgb` (weighted toward vibrant high-chroma/bright pixels so tiny
     wildflowers, lanterns, or sparks never wash out!) AND pick `gi` from `m` + Bayer offset
     (gated on `m > 0.08` on dark grounds).
  2. In `BLIT`, unpack `gi = int(g.a * 255.0 + 0.5)` from `GLYPH[]`.
     - **Dark-ground polychromatic (Neon Kyoto, Coral PDE):**
       Lit pixel = `g.rgb` (boosted cleanly toward peak vibrancy), Unlit pixel = `mix(uGroundRgb, g.rgb * 0.22, 0.35)` (or pure `uGroundRgb` for crisp floating ASCII!).
     - **Bright-ground polychromatic (Sunlit Meadow, Painted Harbor, Gallery Cream):**
       Determine luma `Y = dot(g.rgb, vec3(0.299, 0.587, 0.114))`.
       On high-luma zones (`Y > 0.72`, e.g., lime meadow, cream cliffs, gallery paper), set
       Unlit = `g.rgb` and Lit glyph = `g.rgb * vec3(0.62, 0.66, 0.70)` (rich tinted ink of
       the same hue!). On rich mid-luma zones (electric cyan sky, emerald pines, violet bots),
       set Unlit = `g.rgb * 0.88` and Lit glyph = `mix(g.rgb, vec3(1.0), 0.42)` so every zone
       stays bright, joyful, and unmistakably legible!

---

## 3. Real-Time WebGL2 Ping-Pong PDEs (Gray-Scott Reaction-Diffusion)

Elevate abstract prompts beyond static FBM by running genuine real-time PDE simulations on
the GPU at 60fps:

### Architecture (Zero Float-Texture Extension Hazards!)
Check `gl.getExtension('EXT_color_buffer_float')` AND verify
`gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE` before trusting
`RGBA16F` render targets. Whenever float FBOs are unsupported, automatically fall back to
**two 16-bit-packed `RGBA8` ping-pong FBOs** (`R,G = U`, `B,A = V`, `simW x simH` ~`320 x 200`):
- **CRITICAL Filtering Rule:** Packed 16-bit `RGBA8` textures **MUST use `gl.NEAREST`**
  (never hardware `gl.LINEAR`, which corrupts split high/low bytes whenever the low byte
  wraps `255 -> 0`!). Perform manual 4-tap `unpackUV` bilinear interpolation in `SCENE`!
- **GLSL ES 3.00 Reserved Words:** Avoid reserved identifiers like `active`, `input`,
  `output`, `filter`, or `sample` as variable/uniform names in shaders.
- Run **6 to 10 simulation substeps per animation frame** (tiny ~320x200 FBO takes <0.3ms!).

### Gray-Scott Update Kernel
```glsl
// 9-point isotropic Laplacian weights: center -1.0, cardinal 0.2, diagonal 0.05
vec2 lap = -c
  + 0.20 * (sampleUV(p + ivec2(1,0)) + sampleUV(p + ivec2(-1,0)) + sampleUV(p + ivec2(0,1)) + sampleUV(p + ivec2(0,-1)))
  + 0.05 * (sampleUV(p + ivec2(1,1)) + sampleUV(p + ivec2(-1,1)) + sampleUV(p + ivec2(1,-1)) + sampleUV(p + ivec2(-1,-1)));

float uvv = c.x * c.y * c.y;
float uNext = clamp(c.x + (Du * lap.x - uvv + F * (1.0 - c.x)) * dt, 0.0, 1.0);
float vNext = clamp(c.y + (Dv * lap.y + uvv - (F + k) * c.y) * dt, 0.0, 1.0);
```
- **Calibrated Biological Presets** (`Du = 1.0`, `Dv = 0.5`, `dt = 1.0`):
  - **Coral Branching:** `F = 0.0545, k = 0.0620`
  - **Cell Mitosis:** `F = 0.0367, k = 0.0649` *(seed with a cleanly spaced hexagonal lattice so dividing nuclei don't starve reagent `U` in over-dense clusters!)*
  - **Labyrinth Maze:** `F = 0.0290, k = 0.0570`
  - **Soliton Pulse Waves:** `F = 0.0180, k = 0.0510`
- **Pre-warm at Boot (CRITICAL!):** Run `320–500` substeps synchronously during `init()` from
  a full-composition constellation seed (multi-node rings / lattice spanning the viewport)
  so the VERY FIRST rendered frame (and `prefers-reduced-motion` static frame!) opens with
  lush, full-bleed organic coral / cellular artistry — never a tiny sparse ring in empty space!
- **Interactive Cursor Brush:** In the update shader, whenever `uBrush.z > 0.0` (pointer hover
  or drag/click), inject `vNext = max(vNext, 0.62)` and `uNext = min(uNext, 0.35)` inside a
  soft circular radius around `uBrush.xy` so the user literally paints living organic blooms!
- **Polychromatic Mapping:** Map `V` concentration + Laplacian ridge gradient `|∇V|` across a
  curated 6-stop polychromatic palette (e.g., Abyssal Indigo -> Deep Teal -> Electric
  Turquoise -> Coral Pink -> Solar Peach -> Ivory) and feed directly into `GLYPHPASS` (True-Color
  ASCII), `BLIT` (Bayer 4x4), or `GPU 2x4 Color Braille`!

---

## 4. High-DPI 2D Canvas ASCII Engine (Zero Style-Thrashing)

1. Measure true glyph metrics once on resize (`charW = Math.ceil(ctx.measureText('M').width)`,
   `charH = Math.ceil(fontSize * 1.18)`, `cellAspect = charW / charH`).
2. Bucket cells into palette arrays (e.g., 8–16 curated colors) so `ctx.fillStyle` switches
   at most 8–16 times per frame instead of 6,000 times.
3. Map grid coordinates isotropically (`px = (col + 0.5 - cols * 0.5) * cellAspect / (rows * 0.5)`).

---

## 5. Procedural Field Recipes Tuned for ASCII Readability

- **Curl-Noise Fluid:** Finite-difference curl of 3-octave rotated FBM advecting ridge
  filaments `pow(smoothstep(0.35, 0.96, 1.0 - abs(fbm(...))), 1.8)` + rotational cursor wake.
- **Topographic Contours:** Gradient-normalized iso-lines `abs(fract(h * 10.0) - 0.5) / fwidth(h * 10.0)`
  so lines stay uniform thickness on both steep cliffs and gentle valleys!
- **Wave Interference:** 3 slowly orbiting harmonic emitters + expanding click shockwave rings.
