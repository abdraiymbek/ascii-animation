#!/usr/bin/env node
/**
 * Pack 5x7 ASCII glyph bitmaps into GLSL uint[N*2] constants (20 bits rows 0..3, 15 bits rows 4..6).
 * Usage:
 *   node pack-glyphs.mjs               # prints ARIA_10, EXTENDED_17, and SCENE_24 GLSL arrays
 *   node pack-glyphs.mjs glyphs.json   # packs a JSON array of 7-row x 5-col strings using '#' and '.'
 */
import { readFileSync } from 'node:fs';

export const ARIA_10 = [
  { ch: ' ', rows: ['.....', '.....', '.....', '.....', '.....', '.....', '.....'] },
  { ch: '.', rows: ['.....', '.....', '.....', '.....', '.....', '..#..', '.....'] },
  { ch: ',', rows: ['.....', '.....', '.....', '.....', '..#..', '..#..', '.#...'] },
  { ch: ':', rows: ['.....', '.....', '..#..', '.....', '.....', '..#..', '.....'] },
  { ch: '-', rows: ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'] },
  { ch: '=', rows: ['.....', '.....', '#####', '.....', '#####', '.....', '.....'] },
  { ch: '+', rows: ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'] },
  { ch: '*', rows: ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'] },
  { ch: '#', rows: ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'] },
  { ch: '%', rows: ['##..#', '##.##', '..##.', '.##..', '##.##', '#..##', '.....'] },
];

export const EXTENDED_17 = [
  ...ARIA_10.slice(0, 4),
  { ch: '~', rows: ['.....', '.....', '.#..#', '#.##.', '.....', '.....', '.....'] },
  ...ARIA_10.slice(4, 10),
  { ch: '@', rows: ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'] },
  { ch: '/', rows: ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'] },
  { ch: '\\', rows: ['#....', '.#...', '.#...', '..#..', '...#.', '...#.', '....#'] },
  { ch: '|', rows: ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'] },
  { ch: '_', rows: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'] },
  { ch: '█', rows: ['#####', '#####', '#####', '#####', '#####', '#####', '#####'] },
];

export const SCENE_24 = [
  ...EXTENDED_17,
  { ch: '^', rows: ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'] },
  { ch: 'v', rows: ['.....', '.....', '.....', '#...#', '.#.#.', '..#..', '.....'] },
  { ch: 'o', rows: ['.....', '.....', '.###.', '#...#', '#...#', '.###.', '.....'] },
  { ch: '"', rows: ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'] },
  { ch: ';', rows: ['.....', '.....', '..#..', '.....', '..#..', '..#..', '.#...'] },
  { ch: '[', rows: ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'] },
  { ch: ']', rows: ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'] },
];

export function packGlyph(rows, idx = 0) {
  if (!Array.isArray(rows) || rows.length !== 7 || rows.some((r) => typeof r !== 'string' || r.length !== 5)) {
    throw new Error(`Glyph #${idx} must be an array of 7 strings of length 5.`);
  }
  const s = rows.join('');
  const word = (a, b) => {
    let n = 0;
    for (let i = a; i < b; i++) n = n * 2 + (s[i] === '#' ? 1 : 0);
    return n;
  };
  return [word(0, 20), word(20, 35)];
}

export function formatGlsl(glyphs, name = 'GLYPH') {
  const packed = glyphs.map((g, i) => {
    const rows = Array.isArray(g) ? g : g.rows;
    const [w0, w1] = packGlyph(rows, i);
    const label = Array.isArray(g) ? `#${i}` : JSON.stringify(g.ch);
    return `  ${w0}u, ${w1}u /* ${label} */`;
  });
  return `const uint ${name}[${glyphs.length * 2}] = uint[${glyphs.length * 2}](\n${packed.join(',\n')}\n);`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (arg) {
    const raw = JSON.parse(readFileSync(arg, 'utf8'));
    console.log(formatGlsl(raw));
  } else {
    console.log('// Aria 10-step ramp: " .,:=-+*#%"');
    console.log(formatGlsl(ARIA_10, 'GLYPH_10'));
    console.log('\n// Extended 17-glyph set (adds ~ @ / \\ | _ █)');
    console.log(formatGlsl(EXTENDED_17, 'GLYPH_17'));
    console.log('\n// Illustrated Scene 24-glyph set (adds ^ v o " ; [ ])');
    console.log(formatGlsl(SCENE_24, 'GLYPH_24'));
  }
}
