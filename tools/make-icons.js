// Draws the app icon and renders the PNG sizes: the app's own bank office stamp (the city-value
// stamp) inked in navy on ivory, slightly tilted, with "1830" in its heading and the classic
// American steam engine of the 4-train inside. Colours and fonts come from index.html.
// Usage: node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const tok = n => html.match(new RegExp('--' + n + ':\\s*(#[0-9a-fA-F]{6})'))[1];
const INK = tok('ink'), RULE = tok('rule'), PAPER = tok('paper'), PAPER2 = tok('paper-2');
const engine = require('./design/locos.js')(INK, PAPER).types['4'];
const FONTS = html.slice(html.indexOf('<style id="fonts">'), html.indexOf('</style>', html.indexOf('<style id="fonts">')) + 8);
const f = n => +n.toFixed(1);

const ros = (x, y, r0, amp, lobes, curves, sw) => { let d = ''; for (let k = 0; k < curves; k++) { for (let i = 0; i <= 360; i += 3) { const t = i * Math.PI / 180, r = r0 + amp * Math.sin(lobes * t + k * Math.PI / curves); d += (i ? 'L' : 'M') + (x + r * Math.cos(t)).toFixed(1) + ' ' + (y + r * Math.sin(t)).toFixed(1); } d += 'Z'; } return `<path d="${d}" fill="none" stroke="${RULE}" stroke-width="${sw}"/>`; };
const band = (x1, x2, y, amp, op) => { let out = ''; for (let k = 0; k < 4; k++) { let d = ''; for (let x = x1; x <= x2; x += 3) { const yy = y + Math.sin((x - x1) / (x2 - x1) * Math.PI * 12 + k * Math.PI / 2) * amp; d += (x === x1 ? 'M' : 'L') + x + ' ' + yy.toFixed(1); } out += `<path d="${d}" fill="none" stroke="${RULE}" stroke-width="2.2" stroke-opacity="${op}"/>`; } return out; };
const place = (cx, rail, width) => { const s = width / engine.w; return `<g transform="translate(${(cx - width / 2).toFixed(1)} ${(rail - 75 * s).toFixed(1)}) scale(${s.toFixed(4)})">${engine.svg}</g>`; };

// full icon: the stamp nearly fills the icon; its cut corners keep it clear of iOS's rounded mask
function stampIcon(a, tilt, withText) {
  const notched = (x0, y0, x1, y1, rc, d) => { const R = rc + d, k = Math.sqrt(R * R - d * d), ax = x0 + k, bx = x1 - k, ay = y0 + k, by = y1 - k;
    return `M${f(ax)} ${f(y0 + d)} H${f(bx)} A${f(R)} ${f(R)} 0 0 0 ${f(x1 - d)} ${f(ay)} V${f(by)} A${f(R)} ${f(R)} 0 0 0 ${f(bx)} ${f(y1 - d)} H${f(ax)} A${f(R)} ${f(R)} 0 0 0 ${f(x0 + d)} ${f(by)} V${f(ay)} A${f(R)} ${f(R)} 0 0 0 ${f(ax)} ${f(y0 + d)} Z`; };
  const b = 1024 - a, sc = (b - a) / 644, Y = y => f(a + (y - 190) * sc), X = x => f(512 + (x - 512) * sc);
  const diamond = (x, y, s) => `<path d="M${x} ${f(y - s)} L${f(x + s)} ${y} L${x} ${f(y + s)} L${f(x - s)} ${y} Z" fill="${INK}"/>`;
  // uneven ink on the frame only: soft lighter blots and a few ragged breaks (fixed, not random)
  let ink = '', seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 16; n++) { const side = Math.floor(rnd() * 4), t = a + 30 + rnd() * (b - a - 60), p = [[t, a + 12], [b - 12, t], [t, b - 12], [a + 12, t]][side]; ink += `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f((14 + rnd() * 26) * sc)}" ry="${f((8 + rnd() * 14) * sc)}" fill="black" fill-opacity="${f(.12 + rnd() * .18)}"/>`; }
  for (let n = 0; n < 3; n++) { const side = Math.floor(rnd() * 4), t = a + 70 + rnd() * (b - a - 140), p = [[t, a + 6], [b - 6, t], [t, b - 6], [a + 6, t]][side]; ink += `<rect x="${f(p[0] - 6)}" y="${f(p[1] - 6)}" width="${f(side % 2 ? 5 : 14 * sc)}" height="${f(side % 2 ? 14 * sc : 5)}" fill="black"/>`; }
  const heading = withText ? `${diamond(X(330), Y(296), f(12 * sc))}${diamond(X(694), Y(296), f(12 * sc))}<text x="512" y="${Y(297)}" fill="${INK}" font-family="'Barlow Condensed'" font-weight="700" font-size="${f(92 * sc)}" letter-spacing="${f(18 * sc)}" text-anchor="middle" dominant-baseline="central">1830</text>` : '';
  const width = 460 * sc, s = width / engine.w;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${PAPER}"/>
    <defs><mask id="ink"><rect width="1024" height="1024" fill="white"/>${ink}</mask></defs>
    <g transform="rotate(${tilt} 512 512)" mask="url(#ink)">
      <path d="${notched(a, a, b, b, 54 * sc, 0)}" fill="none" stroke="${INK}" stroke-width="${f(20 * sc)}"/>
      <path d="${notched(a, a, b, b, 54 * sc, 30 * sc)}" fill="none" stroke="${INK}" stroke-width="${f(7 * sc)}"/>
      <line x1="${X(262)}" y1="${Y(352)}" x2="${X(762)}" y2="${Y(352)}" stroke="${INK}" stroke-width="${f(6 * sc)}"/>${heading}
      <g transform="translate(${f(512 - width / 2)} ${f(Y(722) - 75 * s)}) scale(${s.toFixed(4)})">${engine.svg}</g>
      <line x1="${X(284)}" y1="${Y(736)}" x2="${X(740)}" y2="${Y(736)}" stroke="${INK}" stroke-width="${f(3 * sc)}"/>
    </g></svg>`;
}
const full = () => stampIcon(112, -3, true);
// maskable (Android): the same stamp, small enough to sit inside the central safe circle
const maskable = () => stampIcon(232, -3, true);
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
    await p.setContent(`${FONTS}<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, file) });
  }
  await b.close();
  console.log('icons written');
})();
