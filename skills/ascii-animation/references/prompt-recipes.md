# Reference: Prompt Recipes, Polychromatic Discipline & Multi-State Audit Rubric

Use this guide to translate any prompt — from bright illustrated worlds (`dusk.bot`) and
atmospheric skies (`joinariapp.com`) to live PDEs, polychromatic 3D architecture, and kinetic
typography — into cohesive art direction with zero AI slop.

---

## 1. Prompt-to-Design Translation Matrix

| If the user asks for... | Archetype | Color Mode & Palette | Render Mode(s) | Signature Motion & Interaction |
|---|---|---|---|---|
| "Bright meadow / sunlit landscape / pixel bots" (`dusk.bot` style) | **F + E** | Bright Polychromatic (*Sunlit Alpine Meadow*) | Crisp Pixel/Bayer World + Color 5x7 ASCII Lens + Full-Color ASCII | Stepped dither sky bands, swaying wildflowers, cursor-tracking SDF pixel crew, click pokes (`boing`/`squish`) + neighbor glances, time-of-day moods |
| "Coastal harbor / ocean cliffs / sailboats / lighthouse" | **F + E** | Bright Polychromatic (*Painted Coastal Harbor*) | Full-Color ASCII Harbor + Bayer Pixel/Lens toggle | Spinning lighthouse beam, bobbing sailboats with Bayer wakes, live cursor wind-steering, water reflections, click wave crests |
| "Rainy neon city / cyberpunk alley / pixel Kyoto / night canal" | **F + B** | Luminous Night Polychromatic (*Kyoto Neon Rain*) | Full-Color ASCII + Color 2x4 Braille + Bayer Lens | Swaying vermilion lanterns, scanline-distorted colorful canal reflections, diagonal rain + splashes, gliding elevated train, click fireworks |
| "Aria / joinariapp sky / day-to-night clouds" | **A + E** | Monochrome OKLab (*Glacier Sky + Aurora*) | Bayer 4x4 + 5x7 ASCII Lens + Full-ASCII | 3-deck parallax, sun/moon/Milky Way/aurora/shooting stars, bird V-flocks + contrail, `[data-dim]` |
| "Reaction-diffusion / coral / living cells / organic bio abstract" | **B (PDE)** | Bright Polychromatic (*Reef Coral & Teal*) | WebGL2 Ping-Pong Gray-Scott -> Color ASCII / Bayer / Color Braille | Pre-warmed living mitosis, cursor brush painting new chemical blooms, 4 PDE presets |
| "Bauhaus 3D / colorful architecture / geometric mobile / gallery sculpture" | **C + D** | Light-Ground Polychromatic (*Bauhaus Primary Paper*) | Multi-Material 3D SDF + Soft Floor Shadows -> Color ASCII / Blueprint Contours / Color 2x4 Braille | Orbital drag camera, soft cast shadows on warm cream grid floor, 3 sculptures, Paper vs Blueprint flip |
| "Black hole / planet / 3D space torus" | **C** | Monochrome OKLab (*Obsidian & Solar Amber*) | 3D Raymarching -> Luminance / Contour / GPU 2x4 Braille | Geodesic lensing, photon ring, Doppler beaming, orbital drag, portrait distance compensation |
| "Ocean fluid / topographic map / waves" | **B + E** | Monochrome OKLab (*Abyssal Bioluminescence* / *Alpine Pine*) | GPU 5x7 ASCII + Bayer Lens | Curl-noise filaments, gradient-normalized contours, cursor vortex, click shockwaves, swimming schools |
| "Kinetic hero title / morphing ASCII wordmark / risograph poster" | **D** | *Editorial Paper & Ink* (switchable palettes) | Stepped `--dz1..--dz7` + Tone-Bucketed Spring ASCII Grid | Wave-sweep morphs, live custom text input, cursor turbulence scramble, ASCII vs Bayer blocks |

---

## 2. Polychromatic & Abstract Anti-Slop Rules

1. **Bright Color Discipline (Joyful ≠ Muddy Rainbow):**
   - When using bright colors (`dusk.bot` / Bauhaus / Coral / Neon Rain), give every **distinct
     semantic material or depth zone** its own intentional hue and crisp boundary (stepped
     pixel-dither seams or clean silhouettes). Never smear arbitrary rainbow gradients across
     one noisy field!
   - Maintain clear **value separation** between adjacent depth planes (e.g., bright sky ->
     white peaks -> soft lavender foothills -> deep emerald pines -> sunlit lime foreground).
2. **NO Muddy Mid-Tone Noise or Dark Void Stippling:** Gate Bayer glyph dithering on
   `m > 0.08` (dark grounds) or `ink > 0.06` (light gallery paper) so empty space stays spotless.
3. **NO Dark Boxes Behind Sunlit ASCII:** On bright skies/meadows/paper, NEVER draw black
   cell backgrounds (`#000`) behind bright ASCII glyphs! Derive harmonious tinted companion
   colors on each zone's own hue (or use warm gallery paper `#F6F1E7` as the unlit background).
4. **NO Slow Wait-to-Grow PDEs:** Pre-warm reaction-diffusion / cellular automata for 140–220
   substeps during boot so frame 0 and `prefers-reduced-motion` open immediately on rich art.
5. **NO Chunky Mobile Grids or Clipped 3D Subjects:** Drop full-screen procedural/PDE/3D
   ASCII to `cellCss = 1` on mobile (`vw < 760`) and scale 3D camera distance by
   `max(1.0, 1.15 / aspect)`.
6. **NO Squished Circles or Clumpy Stars:** Keep isotropic coordinates everywhere and use
   single-texel integer hashes for stars/sparkles.
7. **NO Unreadable Text or Celestial-Text Collisions:** Put `[data-dim]` on all text blocks
   (including hints), add subtle contrast shadow on bright scenes, and respect mobile safe zones.
8. **NO Heavy Dashboard Chrome:** Whisper-quiet translucent floating dock(s) leaving >=85%
   of the viewport as uninterrupted living artwork.
9. **NO Silent Broken Fallbacks:** Clone/replace `<canvas>` before acquiring 2D fallback
   after a WebGL2 error, and log shader errors with `console.error`.
10. **NO Broken `prefers-reduced-motion`:** Immediately render one complete, vibrant, fully
    revealed hero frame and halt ambient motion / PDE stepping / auto-orbit.

---

## 3. Multi-State & Chromatic Audit Rubric

Run `verify-animation.mjs` covering default load, live motion, hover, drag, every mode/preset
button (`--click`), AND direct canvas pokes/seeds (`--click-pos`). Note that `--click` steps
are cumulative in order, and appending `@x,y` parks the pointer at `(x, y)` (useful for
lens-mode captures; default parks at `8,8`):
```bash
node <skill>/scripts/verify-animation.mjs <file.html> --out <audit-dir> \
  --click "<sel1>:<label1>" --click "<lens-sel>:lens@720,450" --click-pos "720,560:poke" --drag
```
Inspect `report.json` AND view EVERY generated PNG with `read`:
- **Runtime Integrity:** `consoleErrors === 0`, `pageErrors === 0`, `allClickedStatesFound === true`.
- **Chromatic Richness (for Polychromatic Scenes):** Verify `visuals.avgSaturation` and
  `visuals.hueBins` reflect intentional bright multi-zone color (e.g., `hueBins >= 4`, bright
  crisp separation) rather than washed-out monochrome.
- **Verified Live Motion & Interactivity:** `motion.diffRatio >= 0.002`, `hoverDelta` /
  `dragDelta` / `clickPos` captures visibly prove real interactive physics (lens, poked bot,
  painted coral bloom, wind wake, orbital camera).
- **Verified Reduced Motion:** `reducedMotion.diffRatio <= 0.005` with a complete, fully
  revealed static frame (no blank PDE canvas or half-masked title).
- **Responsive Mobile (`390x844`):** `mobileOverflowX <= 2`, crisp density, zero text/object
  collisions, clean non-obstructive floating dock.
