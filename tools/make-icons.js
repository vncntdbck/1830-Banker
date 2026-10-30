// Draws the app icon (ivory certificate with the classic American steam engine from the 4-train,
// in navy engraving) and renders the PNG sizes. Colours come from the design tokens in index.html.
// Usage: node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tok = n => html.match(new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})'))[1];
const INK = tok('ink'), RULE = tok('rule'), PAPER = tok('paper'), PAPER2 = tok('paper-2');
const engine = require('./design/locos.js')(INK, PAPER).types['4'];

const ros = (x, y, r0, amp, lobes, curves, sw) => { let d = ''; for (let k = 0; k < curves; k++) { for (let i = 0; i <= 360; i += 3) { const t = i * Math.PI / 180, r = r0 + amp * Math.sin(lobes * t + k * Math.PI / curves); d += (i ? 'L' : 'M') + (x + r * Math.cos(t)).toFixed(1) + ' ' + (y + r * Math.sin(t)).toFixed(1); } d += 'Z'; } return `<path d="${d}" fill="none" stroke="${RULE}" stroke-width="${sw}"/>`; };
const band = (x1, x2, y, amp, op) => { let out = ''; for (let k = 0; k < 4; k++) { let d = ''; for (let x = x1; x <= x2; x += 3) { const yy = y + Math.sin((x - x1) / (x2 - x1) * Math.PI * 12 + k * Math.PI / 2) * amp; d += (x === x1 ? 'M' : 'L') + x + ' ' + yy.toFixed(1); } out += `<path d="${d}" fill="none" stroke="${RULE}" stroke-width="2.2" stroke-opacity="${op}"/>`; } return out; };
const place = (cx, rail, width) => { const s = width / engine.w; return `<g transform="translate(${(cx - width / 2).toFixed(1)} ${(rail - 75 * s).toFixed(1)}) scale(${s.toFixed(4)})">${engine.svg}</g>`; };

// full icon: frame inset so iOS's rounded mask never touches it
function full() {
  const i = 104, w = 1024 - 2 * i;
  const corner = (x, y) => `<circle cx="${x}" cy="${y}" r="24" fill="${PAPER}" stroke="${RULE}" stroke-width="5"/>${ros(x, y, 14, 4.5, 8, 3, 2.4)}<circle cx="${x}" cy="${y}" r="4.5" fill="${RULE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${PAPER}"/>
    <rect x="${i}" y="${i}" width="${w}" height="${w}" fill="none" stroke="${RULE}" stroke-width="11"/>
    <rect x="${i + 20}" y="${i + 20}" width="${w - 40}" height="${w - 40}" fill="none" stroke="${RULE}" stroke-width="3.5"/>
    ${corner(i, i)}${corner(1024 - i, i)}${corner(i, 1024 - i)}${corner(1024 - i, 1024 - i)}
    ${place(512, 700, 720)}${band(206, 818, 778, 8, 0.5)}</svg>`;
}
// maskable (Android): everything inside the central safe circle, no frame
function maskable() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${PAPER}"/>${place(512, 640, 600)}${band(262, 762, 700, 7, 0.5)}</svg>`;
}
// favicon: the engine alone, as large as possible
function small() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${PAPER}"/>${place(512, 790, 980)}</svg>`;
}

const out = path.join(__dirname, '..', 'icons');
fs.writeFileSync(path.join(__dirname, 'icon.svg'), full());
const jobs = [
  ['apple-touch-icon.png', 180, full()], ['icon-192.png', 192, full()], ['icon-512.png', 512, full()],
  ['icon-maskable-512.png', 512, maskable()], ['favicon-32.png', 32, small()],
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [file, size, svg] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await p.screenshot({ path: path.join(out, file) });
  }
  await b.close();
  console.log('icons written');
})();
