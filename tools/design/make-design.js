// Regenerates the three generated blocks inside index.html from the design tokens:
//   1. <style id="fonts">           embedded OFL fonts (tools/design/fonts/*.woff2)
//   2. ornament tokens in :root     page frame, guilloche bands, value cartouche (SVG data URIs)
//   3. the locomotive sprite         one engraved engine per train type (tools/design/locos.js)
// Colours come from the tokens in index.html (--rule, --ink, --paper, --paper-2), so changing a
// token and re-running this script restyles every ornament. Usage: node tools/design/make-design.js
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');

const token = name => {
  const m = html.match(new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})'));
  if (!m) throw new Error('token --' + name + ' not found');
  return m[1];
};
const RULE = token('rule'), INK = token('ink'), PAPER = token('paper'), PAPER2 = token('paper-2');

const enc = s => 'url("data:image/svg+xml,' + encodeURIComponent(s.replace(/\s*\n\s*/g, ' ')) + '")';
const f2 = n => n.toFixed(2);

// ---------- fonts ----------
const FONTS = [
  ['Bodoni Moda', 'bodoni-moda-latin-500-normal.woff2', 500, 'normal'],
  ['Bodoni Moda', 'bodoni-moda-latin-700-normal.woff2', 700, 'normal'],
  ['Bodoni Moda', 'bodoni-moda-latin-500-italic.woff2', 500, 'italic'],
  ['Barlow Condensed', 'barlow-condensed-latin-500-normal.woff2', 500, 'normal'],
  ['Barlow Condensed', 'barlow-condensed-latin-600-normal.woff2', 600, 'normal'],
  ['Barlow Condensed', 'barlow-condensed-latin-700-normal.woff2', 700, 'normal'],
].map(([family, file, weight, style]) =>
  `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, 'fonts', file)).toString('base64')}) format("woff2")}`).join('\n');

// ---------- ornaments ----------
function guilloche(opacity) {
  const W = 240, H = 18, paths = [];
  for (let k = 0; k < 6; k++) {
    let d = '';
    for (let x = 0; x <= W; x += 2) {
      const y = H / 2 + Math.sin((x / W) * Math.PI * 6 + k * Math.PI / 3) * (H / 2 - 1.5) * (0.55 + 0.45 * Math.cos((x / W) * Math.PI * 2 + k));
      d += (x ? 'L' : 'M') + x + ' ' + f2(y);
    }
    paths.push(`<path d="${d}" fill="none" stroke="${RULE}" stroke-width=".55" stroke-opacity="${opacity}"/>`);
  }
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${paths.join('')}</svg>`);
}
function rosette(x, y, r0, amp, lobes, curves, step) {
  let d = '';
  for (let k = 0; k < curves; k++) {
    for (let i = 0; i <= 360; i += step) { const t = i * Math.PI / 180, r = r0 + amp * Math.sin(lobes * t + k * Math.PI / curves); d += (i ? 'L' : 'M') + f2(x + r * Math.cos(t)) + ' ' + f2(y + r * Math.sin(t)); }
    d += 'Z';
  }
  return d;
}
function pageFrame() {
  const W = 1376, H = 1032;
  const ros = (x, y) => `<circle cx="${x}" cy="${y}" r="7.4" fill="${PAPER}" stroke="${RULE}" stroke-width=".8"/><path d="${rosette(x, y, 4.6, 1.3, 8, 3, 4)}" fill="none" stroke="${RULE}" stroke-width=".45"/><circle cx="${x}" cy="${y}" r="1.1" fill="${RULE}"/>`;
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect x="4.5" y="4.5" width="${W - 9}" height="${H - 9}" fill="none" stroke="${RULE}" stroke-width="1.2"/>
    <rect x="9.5" y="9.5" width="${W - 19}" height="${H - 19}" fill="none" stroke="${RULE}" stroke-width=".5"/>
    ${ros(7, 7)}${ros(W - 7, 7)}${ros(7, H - 7)}${ros(W - 7, H - 7)}</svg>`);
}
function cartouche(w, h, paper) {
  const r = 15, i = 5;
  const shape = (o, rr) => `M${o + rr} ${o} H${w - o - rr} A${rr} ${rr} 0 0 0 ${w - o} ${o + rr} V${h - o - rr} A${rr} ${rr} 0 0 0 ${w - o - rr} ${h - o} H${o + rr} A${rr} ${rr} 0 0 0 ${o} ${h - o - rr} V${o + rr} A${rr} ${rr} 0 0 0 ${o + rr} ${o} Z`;
  const fl = y => `<g transform="translate(${w / 2} ${y})"><rect x="-26" y="-4" width="52" height="8" fill="${paper}"/><path d="M-20 0 H-7 M7 0 H20" stroke="${RULE}" stroke-width=".8"/><path d="M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z" fill="${paper}" stroke="${RULE}" stroke-width=".9"/><circle r="1.2" fill="${RULE}"/></g>`;
  return enc(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${shape(1, r)}" fill="none" stroke="${RULE}" stroke-width="1.3"/><path d="${shape(i, r - 3)}" fill="none" stroke="${RULE}" stroke-width=".5"/>${fl(4)}${fl(h - 4)}</svg>`);
}
const ORNAMENTS = [
  `--orn-frame:${pageFrame()};`,
  `--orn-band:${guilloche(0.5)};`,
  `--orn-band-faint:${guilloche(0.16)};`,
  `--orn-cartouche:${cartouche(428, 198, PAPER2)};`,
  `--orn-notice-band:${guilloche(0.55)};`,
].map(s => '  ' + s).join('\n');

// ---------- locomotives ----------
const LOCOS = require('./locos.js')(INK, PAPER2);
const broken = LOCOS.check();
if (broken.length) throw new Error('locomotive rules broken:\n' + broken.join('\n'));
const SPRITE = `<svg id="sprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(LOCOS.types)
  .map(([k, v]) => `<symbol id="loco-${k}" viewBox="0 ${v.top} ${v.w} ${80 - v.top}">${v.svg.replace(/\s*\n\s*/g, ' ')}</symbol>`).join('')}</defs></svg>`;

// ---------- write the generated blocks ----------
function put(start, end, content) {
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a < 0 || b < a) throw new Error('marker missing: ' + start);
  html = html.slice(0, a + start.length) + '\n' + content + '\n' + html.slice(b);
}
put('/* @generated fonts start */', '/* @generated fonts end */', FONTS);
put('/* @generated ornaments start */', '/* @generated ornaments end */', ORNAMENTS);
put('<!-- @generated locos start -->', '<!-- @generated locos end -->', SPRITE);
fs.writeFileSync(FILE, html);
console.log('index.html regenerated:', Math.round(html.length / 1024) + ' KB');
