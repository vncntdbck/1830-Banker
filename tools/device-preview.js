// Shows the app as it sits on a 13" iPad Pro (Home Screen app, landscape): status bar (24 pt),
// home indicator (20 pt) and rounded screen corners (a generous 36 pt radius is assumed; Apple
// does not publish the exact value). Checks that the certificate frame stays clear of all three.
// Usage: node tools/device-preview.js <out.png>
const { chromium } = require('playwright');
const path = require('path');
const R = 36, TOP = 24, BOTTOM = 20, W = 1376, H = 1032;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, reducedMotion: 'reduce' });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.addStyleTag({ content: `#safe{top:${TOP}px!important;bottom:${BOTTOM}px!important}` });
  await p.evaluate(() => {
    const s = window.__banker.store, T = t => ({ type: 'addTrain', trainType: t }), c = v => ({ type: 'addCity', value: v }), sel = x => ({ type: 'select', company: x });
    [{ type: 'advancePhase' }, { type: 'closeNotice' }, { type: 'advancePhase' }, { type: 'closeNotice' }, sel('PRR'), T('3'), c(40), c(30), c(20), T('4'), c(50), c(40), c(20), c(10),
      sel('B&O'), T('3'), c(30), c(30), c(20), T('4'), c(50), c(30), c(20), c(30), sel('NYC'), T('3'), c(60), c(40), c(30), T('4'), c(70), c(50), c(40), c(30), T('4'), c(80), c(40)].forEach(a => s.dispatch(a));
    window.__banker.render(); window.__banker.fit();
  });
  await p.evaluate(() => document.fonts.ready);
  const m = await p.evaluate(({ R, TOP, BOTTOM, W, H }) => {
    const st = document.getElementById('stage'), r = st.getBoundingClientRect(), s = Number(st.dataset.scale);
    // outermost frame ink: the corner rosettes reach 14.4 design units into the stage
    const ext = 14.4 * s, pts = [[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]];
    const inside = ([x, y]) => { const cx = Math.min(Math.max(x, R), W - R), cy = Math.min(Math.max(y, R), H - R); return Math.hypot(x - cx, y - cy) <= R; };
    const corners = pts.every(([x, y]) => inside([x + (x < W / 2 ? 0 : 0), y]));
    return { scale: s, left: r.left, top: r.top, right: W - r.right, bottom: H - r.bottom, clearOfCorners: corners,
      clearOfStatusBar: r.top >= TOP + 8, clearOfHomeIndicator: H - r.bottom >= BOTTOM + 8, minEdge: Math.min(r.left, r.top, W - r.right, H - r.bottom), ext };
  }, { R, TOP, BOTTOM, W, H });
  // draw the device: rounded-corner mask, status bar, home indicator
  await p.evaluate(({ R, TOP, BOTTOM, W, H }) => {
    const o = document.createElement('div');
    o.innerHTML = `<svg width="${W}" height="${H}" style="position:fixed;inset:0;z-index:99;pointer-events:none"><defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/><rect width="${W}" height="${H}" rx="${R}" fill="black"/></mask></defs>
      <rect width="${W}" height="${H}" fill="#000" mask="url(#m)"/>
      <text x="${R}" y="17" font-family="Helvetica" font-weight="600" font-size="15" fill="#000">9:41</text><text x="${W - R}" y="17" text-anchor="end" font-family="Helvetica" font-weight="600" font-size="15" fill="#000">100% ▮</text>
      <rect x="${W / 2 - 160}" y="${H - 13}" width="320" height="5" rx="2.5" fill="#000"/>
      <rect x="0" y="0" width="${W}" height="${TOP}" fill="none" stroke="#c00" stroke-dasharray="4 4" stroke-opacity=".5"/><rect x="0" y="${H - BOTTOM}" width="${W}" height="${BOTTOM}" fill="none" stroke="#c00" stroke-dasharray="4 4" stroke-opacity=".5"/></svg>`;
    document.body.appendChild(o);
  }, { R, TOP, BOTTOM, W, H });
  await p.screenshot({ path: process.argv[2] || 'device-preview.png' });
  console.log(JSON.stringify(m));
  await b.close();
})();
