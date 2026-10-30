// Design guard: every colour and face comes from the tokens in :root, and the token pairs
// used for text meet WCAG AA contrast. Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const styles = [...html.matchAll(/<style(?: id="(\w+)")?>([\s\S]*?)<\/style>/g)];
const main = styles.find(m => m[1] !== 'fonts')[2];
const rootStart = main.indexOf(':root {');
const rootEnd = main.indexOf('\n}', rootStart);
const root = main.slice(rootStart, rootEnd);
const rest = main.slice(0, rootStart) + main.slice(rootEnd + 2);
const app = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];

const tokens = {};
for (const m of root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[m[1]] = m[2];

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('no raw colours or font names outside the tokens', () => {
  assert.equal((rest.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length, 0, 'hex colour outside :root');
  assert.equal((rest.match(/rgba?\(/g) || []).length, 0, 'rgb() outside :root');
  for (const m of rest.matchAll(/font-family:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^(var\(--font-[a-z]+\)|inherit)$/, 'font-family must use a token: ' + m[1]);
  assert.equal((app.match(/#[0-9a-fA-F]{6}\b/g) || []).length, 0, 'hex colour in the screen code');
});

test('generated blocks are present (fonts, ornaments, locomotives)', () => {
  assert.match(html, /@generated fonts start \*\/\n@font-face\{font-family:"Bodoni Moda"/);
  assert.match(html, /@generated ornaments start \*\/\n\s+--orn-rosette:url\("data:image\/svg\+xml,/);
  for (const t of ['2', '3', '4', '5', '6', 'D']) assert.ok(html.includes('id="loco-' + t + '"'), 'locomotive ' + t);
  assert.equal((html.match(/https?:\/\/(?!www\.w3\.org)/g) || []).length, 0, 'no outside URLs');
});

test('text colour pairs meet WCAG AA (4.5:1)', () => {
  const pairs = [['ink', 'paper'], ['ink', 'paper-2'], ['ink', 'paper-3'], ['ink-2', 'paper'], ['ink-2', 'paper-2'], ['ink-2', 'paper-3'],
    ['accent', 'paper'], ['accent', 'paper-2'], ['accent', 'accent-wash'], ['accent-ink', 'accent'], ['paper-2', 'ink'],
    ...['prr', 'nyc', 'cpr', 'bo', 'co', 'erie', 'nnh', 'bm'].map(c => ['co-' + c + '-on', 'co-' + c])];
  for (const [fg, bg] of pairs) {
    assert.ok(tokens[fg] && tokens[bg], 'tokens ' + fg + '/' + bg);
    const r = contrast(tokens[fg], tokens[bg]);
    assert.ok(r >= 4.5, fg + ' on ' + bg + ' = ' + r.toFixed(2));
  }
});
