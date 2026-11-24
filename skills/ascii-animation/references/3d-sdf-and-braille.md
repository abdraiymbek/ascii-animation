# Reference: 3D Raymarched SDFs, Multi-Material Polychromatic 3D & Color GPU 2x4 Braille

For prompts involving 3D sculptures, black holes, planets, knots, Bauhaus architecture,
floating islands, or hardware emblems — supporting BOTH moody monochrome OKLab ladders AND
bright multi-material polychromatic gallery palettes on dark OR light grounds!

---

## 1. Cell Density, Aspect Ratio & Portrait-Safe Camera

Target **95–150 ASCII columns on desktop** and **50–68 on mobile** (`cellCss = vw < 760 ? 1 : 2`
with `6x9` glyphs), and always apply portrait distance compensation so wide 3D forms never
clip horizontally on `390x844` mobile:
```glsl
float aspect = uVW / max(uVH, 1.0);
vec2 uv = (P / vec2(uVW, uVH)) * 2.0 - 1.0;
vec2 p = vec2(uv.x * aspect, -uv.y);

float effDist = uDist * max(1.0, 1.15 / max(aspect, 0.42));
vec3 ro = effDist * vec3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw));
vec3 ww = normalize(-ro);
vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
vec3 vv = cross(uu, ww);
vec3 rd = normalize(p.x * uu + p.y * vv + 1.85 * ww);
```
Drive `(yaw, pitch)` with gentle auto-orbit blended with eased pointer drag (`touch-action: none`).
Freeze auto-orbit cleanly under `prefers-reduced-motion: reduce`.

---

## 2. Multi-Material Polychromatic 3D SDFs & Soft Floor Shadows

To build bright, vivid 3D sculptures (like Bauhaus kinetic mobiles, architectural arches,
planetary orreries, or colorful floating dioramas), return `vec2(dist, matId)` from `map(p)`:

```glsl
vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

// Material IDs:
// 1.0 = Vermilion Red (#F03A2F), 2.0 = Cobalt Blue (#1B5BFF),
// 3.0 = Cadmium Yellow (#F7C600), 4.0 = Matte Charcoal (#18181D),
// 5.0 = Warm Gallery Floor (#F6F1E7 with crisp coordinate grid + soft shadows)
```

### Soft Penumbra Cast Shadows (Grounding Floating Sculptures)
A 16-step soft shadow march from hit point `hp + n * 0.02` toward key light `L` adds instant
architectural weight on light or dark grounds:
```glsl
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0, t = mint;
  for (int i = 0; i < 18; i++) {
    float h = mapSculpture(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.04, 0.35);
    if (res < 0.02 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}
```
On a **Light Gallery Paper ground** (`#F6F1E7`), cast shadows shade the floor downward into
warm taupe `#C7BEB0` / `#8B8376` (rendered as delicate `. : -` Bayer shadow glyphs!), while
each colored 3D primitive shades cleanly from sunlit highlight to rich saturated shadow —
creating a tactile Bauhaus screenprint in live 3D!

### Classic Dark-Space Sculptures (Black Hole, Torus Knot, Ringed Exoplanet)
- **Singularity**: Gravitational ray-bending (`rd = normalize(rd - normalize(p) * (0.12 / (r2 + 0.08)) * stepSize)`),
  geodesic-locked outer photon ring (keeping event horizon interior pure void), seamless
  periodic Keplerian spiral harmonics, Doppler limb beaming, and single-texel cubemap star
  projection (zero `++` star pairs).
- **Chiaroscuro Shading**: Camera-coupled key light + sharp Fresnel rim (`pow(1.0 - max(dot(n, -rd), 0.0), 2.8)`)
  + specular glint + step-count AO.

---

## 3. G-Buffer Packing (Monochrome vs. Polychromatic 3D)

### A. Monochrome 3D (Single Tone Ladder)
Pass 1 writes `oc = vec4(L / 7.0, nx * 0.5 + 0.5, ny * 0.5 + 0.5, edgeStr)` into 1 `RGBA8` FBO.

### B. Polychromatic Multi-Material 3D (Dual-Attachment MRT in WebGL2!)
WebGL2 natively supports Multiple Render Targets (`gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])`)
with ZERO extra raymarching cost!
- **Attachment 0 (`uColorTex`, `RGBA8`):** `rgb = shaded vibrant pigment color`, `a = inkDensity ∈ [0..1]`
  (on dark ground: brightness; on light gallery paper: darkness/ink weight = `1.0 - luma` + pigment boost!).
- **Attachment 1 (`uNormTex`, `RGBA8`):** `rg = screenNormal * 0.5 + 0.5`, `b = edgeStrength`, `a = isObject (1.0 vs 0.0 bg)`.

---

## 4. Three Crisp Rendering Modes (Supporting Both Dark & Light Polychromatic Grounds)

### Mode 0: Bayer-Dithered Luminance / Pigment ASCII
Sample `6x9` blocks from `uColorTex`. Pick glyph from calibrated `GLYPH_17` (` .,:=-+*#%@`)
using ink density `d` + Bayer threshold (gated on `d > 0.06` so void/paper stays completely
spotless!). Draw lit glyph pixels in the tile's vibrant pigment color `tileRgb` and unlit
pixels in `uPaperOrVoidRgb`!

### Mode 1: Directional Architectural Contour ASCII (Blueprint / Drafting Mode)
Read `(nx, ny, edgeStr)` from `uNormTex`. On silhouettes or sharp material boundaries
(`maxEdge > 0.40`), quantize silhouette tangent `atan(-sumNx, sumNy)` into crisp directional
glyphs (`-`, `_`, `|`, `/`, `\`) drawn in bold ink or pigment; interior surfaces use lighter
hatching (`.,:=+*#%`).

### Mode 2: Zero-Readback GPU 2x4 Braille (Monochrome OR Full Polychromatic RGB!)
In `BLIT`, inside each `5x9` tile (`q.x == 1 || q.x == 3`, `q.y ∈ {1, 3, 5, 7}`):
```glsl
ivec2 tile = ivec2(5, 9);
ivec2 bc = c / tile, q = c - bc * tile;
bool isDot = ((q.x == 1 || q.x == 3) && (q.y == 1 || q.y == 3 || q.y == 5 || q.y == 7));
if (!isDot) {
  oc = vec4(uBgColor, 1.0); // pure obsidian or warm gallery cream paper
} else {
  int bx = q.x == 1 ? 0 : 1, by = (q.y - 1) / 2;
  ivec2 subOrigin = bc * tile + ivec2(bx * 2 + 1, by * 2 + 1);
  float val = 0.0, pk = 0.0;
  vec3 colSum = vec3(0.0); float colW = 0.0;
  for (int dy = 0; dy < 2; dy++) for (int dx = 0; dx < 2; dx++) {
    vec4 s = texelFetch(uColorTex, min(subOrigin + ivec2(dx, dy), uGrid - 1), 0);
    val += s.a; pk = max(pk, s.a);
    colSum += s.rgb * (s.a + 0.01); colW += (s.a + 0.01);
  }
  val = max(val * 0.25, pk * 0.65);
  ivec2 gSub = ivec2(bc.x * 2 + bx, bc.y * 4 + by);
  float th = (float(BAYER[((gSub.y & 3) << 2) | (gSub.x & 3)]) + 0.5) / 16.0;
  bool lit = (val > 0.04) && (pow(val, 0.72) > th * 0.80);
  vec3 dotRgb = colSum / max(colW, 0.001);
  // Dot-area luminance compensation: 8 dots cover ~18% of a 5x9 tile, so boost dark-ground
  // dots (~1.22x) or deepen light-paper pigment dots so Color Braille matches ASCII visual punch!
  dotRgb = uIsLightBg > 0.5 ? dotRgb * 0.90 : clamp(dotRgb * 1.22 + 0.04, 0.0, 1.0);
  oc = vec4(lit ? dotRgb : uBgColor, 1.0);
}
```
Notice how clean that is: **each individual 2x4 Braille dot carries its own true shaded RGB
pigment** at effortless 60fps — and works identically on BOTH obsidian night and warm gallery
cream paper! In the cloned-canvas 2D fallback, emit native Unicode `String.fromCharCode(0x2800 | bits)`
bucketed by material color!
