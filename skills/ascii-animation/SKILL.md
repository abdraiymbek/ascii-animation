---
name: ascii-animation
description: >-
  Create crisp, GPU-accelerated ASCII, Bayer-dithered cell-grid, full-scale bright
  polychromatic illustrated worlds, live PDE simulations, 3D multi-material raymarched/Braille
  sculptures, and kinetic typographic animations for web pages, hero backdrops, interactive
  demos, and standalone canvases. Fuses Aria's glacier sky optical craft (joinariapp.com) with
  dusk.bot's vibrant sunlit pixel-scene & expressive procedural character artistry, plus
  advanced GPU reaction-diffusion, polychromatic 3D SDFs, and kinetic ASCII typography. Use
  whenever a user asks for ASCII animation, Bayer dithering, full-scale pixel/ASCII landscapes
  or cities, interactive characters, ASCII cursor lenses, 3D ASCII/Braille art, fluid or
  reaction-diffusion shaders, or dithered text reveals.
allowed-tools:
  - read
  - edit
  - write
  - grep
  - glob
  - exec
triggers:
  - user
  - model
---

# ASCII & Cell-Grid Animation Craft (v3)

Build bespoke, razor-sharp ASCII, ordered-dither, and full-scale polychromatic pixel-scene
animations that feel like living Japanese woodblock prints, optical instruments, vibrant
handcrafted pixel cinema (`dusk.bot`), or atmospheric worlds (`joinariapp.com`) — never
flickering terminal clutter or muddy AI gradient slop.

`<skill>` is this directory. Read the matching reference file(s) in `references/` before
writing code, and always verify every state and interaction with `scripts/verify-animation.mjs`.

---

## The 10 Non-Negotiable Laws

1. **One Unified Pixel-Locked Grid (Tuned to Your Archetype).** Every layer (sky, terrain,
   characters, ASCII glyphs, sprites, dither masks, reflections) locks to an **integer number
   of device pixels** (`cellDev = Math.max(1, Math.round(cellCss * dpr))`), rendered via
   WebGL2 `texelFetch` + `NEAREST` or 2D `image-rendering: pixelated`:
   - **Bayer Atmospheric & Full-Scale Illustrated Worlds (Archetypes A & F):**
     `cellCss = Math.max(3, Math.round(Math.max(vw, vh * 1.4) / 480))` (~480x300 crisp scene
     cells; `6x9` color ASCII lens tiles) — or `cellCss = vw < 760 ? 2 : 3` for rich
     illustrated dioramas with crisp pixel sprites.
   - **Full-Screen Procedural / PDE / 3D ASCII (Archetypes B & C):** Target **95–150 ASCII
     columns on desktop** and **48–68 ASCII columns on 390px mobile** (`cellCss = vw < 760 ? 1 : 2`
     with `6x9` GPU bitmap glyphs). Never render 3D or PDE ASCII as a chunky 20-column blob on mobile.

2. **Intentional Color Architecture — Monochromatic OKLab Ladders OR Curated Polychromatic Material Zones.**
   Pick the color system that matches the prompt — never muddy random rainbow soup:
   - **Monochromatic / Atmospheric Mode:** One 6–8 step OKLab-coherent tone ladder sharing a
     hue from midnight ground to highlight (plus at most one physical accent ladder like aurora).
     Never darken with `rgba(0,0,0,0.5)` grey overlays — walk down the ladder.
   - **Full-Scale Bright Polychromatic Mode (`dusk.bot` / Illustrated / Bauhaus / Bio PDE):**
     Assign **distinct, saturated semantic material palettes** to each physical zone (e.g.,
     electric cyan sky bands `#08B4FF -> #8CE0FF`, snow peaks `#FFFFFF/#A8D8FF`, lavender
     foothills `#CFC2F8`, emerald pines `#18D668`, sunlit lime meadow `#C6F447`, hot-pink /
     tangerine / violet / cobalt characters!). Join sky & water bands with **crisp 2–4 cell
     stepped pixel-dither seams** (never blurry gradients), add whisper-subtle tactile
     micro-weave grain, and preserve clear figure-ground contrast between every layer.

3. **Ordered 4x4 Bayer Dithering Everywhere (With Clean Void/Ground Floors).** Quantize
   continuous gradients, sky-band seams, halos, shadows, reveal rims, wakes, and ASCII glyph
   thresholds through the deterministic 4x4 Bayer matrix:
   ```glsl
   const int BAYER[16] = int[16](0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5);
   float th = (float(BAYER[((ic.y & 3) << 2) | (ic.x & 3)]) + 0.5) / 16.0;
   ```
   In dark-ground `GLYPHPASS`, gate Bayer dithering on `m > 0.08` so empty obsidian space
   never leaks repeating `.` stipples. Never use per-frame `Math.random()` dithering.

4. **No DOM `<span>` Grids for Real-Time ASCII.** Render real-time ASCII using:
   - **WebGL2 packed `5x7` bitmap glyphs** (zero font blur, 60fps at 4K, supports both
     monochrome ladders AND **True-Color Polychromatic RGB** tiles, localized circular ASCII
     lenses, and **Zero-Readback Monochrome or True-Color GPU 2x4 Braille**), OR
   - **High-DPI 2D Canvas** with tone/palette-bucketed `fillText` or pre-baked glyph atlases.
   Reserve `<pre>` strictly for small (<100x35) copyable TUI widgets.

5. **Preserve Micro-Highlights & Material Semantics in Glyph Selection.** When downsampling
   cells into `6x9` ASCII tiles, track mean brightness `m`, peak brightness `mx`, AND (in
   polychromatic scenes) the dominant tile RGB / material class:
   - Isolated bright points (stars, water glints, lantern cores, wildflowers: `mx - m > 1.8`)
     resolve to `*`, `+`, or `o` instead of averaging away.
   - Generate stars/sparkles from single-texel integer hashes so they never clump into `+++++`.
   - In illustrated scenes, pair **material-aware glyphs** (foliage `^,"'`, water `~=-`,
     mountains `/\^`, architecture `|-_#[]`, clouds `=+#`) with true vibrant foreground/ground
     color pairs!

6. **Always Correct Aspect Ratio & Mobile Portrait Framing.** Evaluate spatial fields,
   emblems, lenses, reflections, and 3D rays in isotropic pixel coordinates (`uv.x *= aspect`).
   For 3D cameras on portrait viewports, scale distance by
   `effDist = baseDist * Math.max(1.0, 1.15 / Math.max(0.42, aspect))` so wide subjects never
   clip horizontally on 390px mobile.

7. **Content-Aware Legibility (`[data-dim]`) & Safe Zones.** Read `[data-dim]` DOM rects
   once per frame before writes to thin clouds/patterns behind foreground copy. Include subtle
   hints in `[data-dim]`, add soft legible contrast shadows on bright skies (`0 1px 10px rgba(...)`),
   and keep bright suns, moons, tall roofs, or mascots out of hero text safe zones on mobile.

8. **Aperiodic Noise, Real Physics & Top-Down FBO Convention.** Use integer-hashed `pcg2`
   noise, rotated FBM octaves (`mat2(1.62, 1.18, -1.18, 1.62)`), genuine multi-pass ping-pong
   PDEs when building reaction-diffusion/fluid abstracts, critically damped springs for
   characters/flocks/particles, and exponential pointer easing (`1 - exp(-dt * 9)`). Keep
   offscreen WebGL2 FBOs strictly **top-down** (`y = 0` at viewport top) and flip `y` once in `BLIT`.

9. **Bulletproof WebGL2 -> 2D Fallback, Performance & Accessibility.**
   - **Canvas Lock Gotcha:** If `canvas.getContext('webgl2')` succeeds and shader compilation
     later fails, `canvas.getContext('2d')` on the *same* `<canvas>` permanently returns `null`.
     Always `console.error` shader failures and **clone/replace the `<canvas>` node** before
     initializing the 2D fallback!
   - Honor `prefers-reduced-motion: reduce`: immediately render one complete, vibrant, fully
     revealed static frame and halt ambient drift, auto-orbit, rain/meteors, and PDE stepping.
   - Pause on `document.hidden`, recover on `webglcontextlost`/`restored`, cap backing store
     at `3840 * 2400`, and keep float/twinkle clocks cleanly wrapped.

10. **Multi-State & Chromatic Visual Verification Is Mandatory.** Run
    `scripts/verify-animation.mjs` covering EVERY preset, render mode (`--click`), canvas
    poke/seed coordinate (`--click-pos`), and drag gesture (`--drag`), then visually inspect
    EVERY captured PNG with `read` before shipping.

---

## Prompt-to-Architecture Router

Choose the primary archetype(s) before writing code and read the listed reference file(s):

| User Prompt / Subject | Primary Archetype | Read Reference(s) |
|---|---|---|
| Full-scale bright scenes: sunlit meadow, pixel bots/characters, coastal harbor/sailboats, rainy neon city, cozy diorama (`dusk.bot` vibrancy × ASCII/Bayer) | **F. Full-Scale Polychromatic Illustrated World** | `references/illustrated-scenes.md`, `references/ascii-glyph-engine.md` |
| Sky, clouds, day/night scroll, sun/moon/aurora/stars, atmospheric hero backdrop, hover ASCII lens (`joinariapp.com` style) | **A. Bayer Atmospheric Field + ASCII Lens** | `references/bayer-dither-atmosphere.md`, `references/ascii-glyph-engine.md` |
| Curl-noise fluid, **live GPU Gray-Scott reaction-diffusion**, fire, contours, wave caustics, full-screen procedural ASCII | **B. Procedural & Ping-Pong PDE ASCII Shader** | `references/ascii-glyph-engine.md`, `references/prompt-recipes.md` |
| Black hole, planet, torus knot, **polychromatic multi-material 3D architecture/Bauhaus**, rotating sculptures, directional contours, mono or **Color GPU 2x4 Braille** | **C. 3D Raymarched SDF + Directional/Color Braille** | `references/3d-sdf-and-braille.md`, `references/ascii-glyph-engine.md` |
| Hero wordmark, Bayer dither text reveal, cloud-wisp mask, morphing ASCII words/emblems, risograph kinetic type | **D. Kinetic ASCII Typography & Morphs** | `references/kinetic-type-and-sprites.md`, `references/ascii-glyph-engine.md` |
| Expressive pixel characters (`mascot.js` style), bird flocks, fish schools, sailboats, trains, fireworks, contrails | **E. Living Cell-Grid Entities & Characters** | `references/illustrated-scenes.md`, `references/kinetic-type-and-sprites.md` |

Always read `references/prompt-recipes.md` for curated palettes, prompt mapping, and the
anti-slop audit rubric.

---

## Curated Palette Cheat Sheet

### Bright Polychromatic World Palettes (Archetype F / Bright Abstracts)
- **Sunlit Alpine Meadow (`dusk.bot` flagship):**
  - Sky bands: `['#08B4FF', '#39C9FF', '#8CE0FF', '#C5EEFF']`
  - Peaks: `['#A8D8FF', '#D6EEFF', '#FFFFFF']` · Foothills: `['#CFC2F8', '#BEB0F0']`
  - Pines: `['#14B858', '#1EE06E']` · Sunlit Meadow: `['#B8EC3B', '#C8F74A']`
  - Wildflowers & Sun: `['#FFE44D', '#FFB8D6', '#FFFFFF']`
  - Crew Characters: Violet `#8A42FF`, Cobalt `#1F64FF`, Hot Pink `#FF2D95`, Tangerine `#FF6B00`, Gold `#F0A500`, Emerald `#14C38E`
- **Painted Coastal Harbor:**
  - Sky: `['#0EB6FF', '#47CEFF', '#9BE5FF', '#D5F4FF']` · Sun: `['#FFE042', '#FFF49C']`
  - Cliffs: `['#EAE2D3', '#F8F4EA', '#FFFFFF']` + Lime cap `#C2F249`
  - Sea bands: `['#7BE6F7', '#48B9F5', '#2795E6']` · Sand: `#FFF099` · Sails/Hulls: `#FFF6DF`, `#FFB3D1`, `#FFE24A`, `#FF5247`
- **Kyoto Neon Rain (Luminous Night Scene):**
  - Twilight Sky: `['#0B0E24', '#161B3F', '#292252', '#4D2B63']`
  - Architecture: `['#090C1C', '#141933', '#232C4D']`
  - Vermilion Lanterns: `['#A61C28', '#FF3B30', '#FF8E53', '#FFF2B2']`
  - Electric Cyan Signs & Canal Glints: `['#0B4F6C', '#14C8D8', '#7AF7FF', '#E8FFFF']`
  - Warm Amber Windows: `['#C96A1B', '#FFB647', '#FFF3C4']`
- **Bauhaus Primary Gallery (Light-Ground Polychromatic 3D):**
  - Gallery Cream Paper: `#F6F1E7` · Grid & Soft Shadows: `#E4DDD0`, `#C7BEB0`, `#8B8376`
  - Primary Pigments: Vermilion `#F03A2F`, Cobalt `#1B5BFF`, Cadmium `#F7C600`, Charcoal `#18181D`
- **Reef Coral & Electric Teal (Polychromatic Bio PDE):**
  - Abyssal Ground: `#06111C` -> Deep Teal `#0D3B4C` -> Electric Turquoise `#1AD1C9` -> Coral Pink `#FF5E7E` -> Solar Peach `#FFB36B` -> Luminous Ivory `#FFF6E5`

### Monochromatic OKLab Tone Ladders (Index `0` -> `7`)
- **Glacier Sky (Aria):** `['#05070D','#0C1A36','#1A2E59','#2A4A8C','#3F6CC9','#6F98E8','#A9C4F4','#F4F8FF']` *(Aurora: `['#1E5E63','#3FB8A8','#7FD49A','#B2C8F0']`)*
- **Obsidian & Solar Amber:** `['#070608','#16110E','#2C1D14','#52311B','#874B20','#C4732B','#EDA958','#FFF3DC']`
- **Abyssal Bioluminescence:** `['#040A10','#081A26','#0D3242','#135263','#1B7A85','#38A9A8','#7CD8CC','#E2FFF9']`
- **Editorial Paper & Ink:** `['#F4F1EA','#E4DFD3','#C9C2B2','#9F9786','#6E675A','#443F36','#23201B','#0E0D0B']`
- **Alpine Pine & Fog:** `['#070C0A','#111F1A','#1D362D','#2F5445','#4B7A65','#76A48D','#ADCBB9','#EDF5F0']`
- **Phosphor Instrument:** `['#050A07','#0B1C11','#13331E','#1E5430','#2D8249','#4CB86E','#8BE3A2','#E4FFEB']`

---

## Standard Build & Verification Workflow

1. **Plan in 5 lines:** Archetype(s) & color mode (monochrome OKLab vs bright polychromatic),
   grid density for desktop & mobile, simulation/layer choreography, interactive gestures
   (hover, click-poke/seed, drag, mode switches), and legibility/reduced-motion plan.
2. **Build Clean, Self-Contained Code:** Zero external CDNs; whisper-quiet translucent dock
   leaving >=85% viewport as living artwork; safe cloned-canvas 2D fallback on WebGL2 builds.
3. **Verify Automatically & Visually Across Every State:**
   ```bash
   node <skill>/scripts/verify-animation.mjs <file.html> --out <audit-dir> \
     --click "<sel1>:<label1>" --click-pos "720,520:poke" --drag
   ```
   Inspect EVERY PNG (`desktop-t1.png`, `desktop-t2.png`, `desktop-hover.png`,
   `desktop-drag.png`, `state-*.png`, `mobile.png`, `reduced-motion.png`) with `read`,
   checking color vibrancy, crispness, circularity, legibility, and zero runtime errors.
4. **Iterate Until Gallery-Grade:** Fix any artifact caught visually or in `report.json` and
   re-verify until every check passes cleanly.
