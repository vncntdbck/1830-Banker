// Drives the real page: mouse clicks and touch taps, rapid tapping, reload persistence,
// then the hosted mode over http (service worker, offline reload, cache list vs folder).
// Usage: node tools/check-page.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures++; };

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const browser = await chromium.launch();

  // ---------- 1. As in claude.ai / opened from disk: no requests, real taps ----------
  const ctx = await browser.newContext({ viewport: { width: 1376, height: 1032 }, hasTouch: true });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  const url = 'file://' + path.join(ROOT, 'index.html');
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const per10 = () => page.textContent('#per10');
  const click = sel => page.click(sel);
  const tap = sel => page.tap(sel);

  ok((await page.getAttribute('html', 'data-hosted')) === 'no', 'not hosted on file:// (no manifest, no service worker)');

  // PRR: 2-train 20+30 by mouse
  await click('[data-act="addTrain"][data-type="2"]');
  await click('[data-act="addCity"][data-v="20"]');
  await click('[data-act="addCity"][data-v="30"]');
  ok(await per10() === '$5', 'mouse: PRR 2-train 20+30 shows $5 per 10%');
  // NYC by touch: two 2-trains
  await tap('[data-act="select"][data-co="NYC"]');
  await tap('[data-act="addTrain"][data-type="2"]');
  await tap('[data-act="addTrain"][data-type="2"]');
  for (const v of [40, 10, 30, 20]) await tap(`[data-act="addCity"][data-v="${v}"]`);
  ok(await per10() === '$10', 'touch: NYC two 2-trains show $10 per 10%');
  // one tap per unchanged company
  await tap('[data-act="select"][data-co="PRR"]');
  ok(await per10() === '$5', '1 tap: PRR unchanged shows $5');
  await tap('[data-act="select"][data-co="NYC"]');
  ok(await per10() === '$10', '1 tap: NYC unchanged shows $10');
  const ladder = await page.$$eval('.rung .a', els => els.map(e => e.textContent));
  ok(JSON.stringify(ladder) === JSON.stringify(['$10', '$20', '$30', '$40', '$50', '$60']), 'ladder 10–60% for $100 total');
  ok((await page.textContent('#total')) === '$100', 'total payout $100');

  // tap a city to remove it, one-city run says it counts 0
  await tap('.card:first-child .city:first-child');
  const note = await page.textContent('.card:first-child .rt span');
  ok(/1 city · counts 0/.test(note), 'one-city run shows "1 city · counts 0"');
  await tap('[data-act="addCity"][data-v="60"]');

  await tap('#next .txt');
  ok((await page.textContent('.phase .val')) === '2', 'tapping the Next text alone does not start the phase');
  // Start → phase 3 notice; closing tap does nothing else; undo restores
  await tap('#start');
  ok(await page.isVisible('#notice'), 'tapping Start phase opens the phase-change view');
  ok((await page.textContent('.nbox h2')) === 'Phase 3 begins', 'phase 3 title');
  // tap where the CPR button is (under the overlay): it must only close the view
  const cpr = await page.$eval('[data-act="select"][data-co="CPR"]', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.touchscreen.tap(cpr.x, cpr.y);
  ok(!(await page.isVisible('#notice')), 'tap outside closes the view');
  ok((await page.textContent('.co.sel .nm')) === 'NYC', 'the closing tap did not select CPR');
  ok((await page.textContent('.phase .val')) === '3', 'phase is 3');
  await tap('#undo');
  ok((await page.textContent('.phase .val')) === '2', 'Undo reverts the phase change');

  // Rapid tapping: diesel, 14 taps as fast as possible
  await tap('[data-act="select"][data-co="Erie"]');
  await tap('[data-act="addTrain"][data-type="D"]');
  await tap('.done');
  const chip = await page.$eval('[data-act="addCity"][data-v="10"]', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  for (let i = 0; i < 14; i++) await page.touchscreen.tap(chip.x, chip.y);
  const n = await page.$$eval('.card .city', els => els.length);
  ok(n === 14, '14 rapid taps add 14 cities (got ' + n + ')');
  for (let i = 0; i < 3; i++) await page.mouse.dblclick(chip.x, chip.y);
  const n2 = await page.$$eval('.card .city', els => els.length);
  ok(n2 === 20, '3 mouse double-clicks add 6 more cities (got ' + n2 + ')');
  const sel = await page.evaluate(() => String(window.getSelection()));
  ok(sel === '', 'no text selected after rapid tapping');
  const zoom = await page.evaluate(() => (window.visualViewport ? window.visualViewport.scale : 1));
  ok(zoom === 1, 'page not zoomed (visualViewport.scale = ' + zoom + ')');
  ok((await page.textContent('.phase .val')) === '7', 'diesel moved the game to phase 7');

  // persistence and undo across reload
  const before = await page.evaluate(() => JSON.stringify(window.__banker.store.state));
  await page.reload();
  const after = await page.evaluate(() => JSON.stringify(window.__banker.store.state));
  ok(before === after, 'state identical after reload');
  const undoLbl = await page.textContent('#undo span');
  ok(/Erie \+10/.test(undoLbl), 'undo label survives reload: ' + undoLbl);
  for (let i = 0; i < 21; i++) await tap('#undo');
  ok((await page.textContent('.phase .val')) === '2', '21 undos after reload go back to phase 2 (before the diesel)');

  // Feedback: the city just added gets its stamp, a new train rolls in, payouts rise
  await tap('[data-act="select"][data-co="B&M"]');
  await tap('[data-act="addTrain"][data-type="2"]');
  ok(await page.$('.card.roll') !== null, 'a new train rolls in');
  await tap('[data-act="addCity"][data-v="30"]');
  ok(await page.$('.city.stamp') !== null, 'the city just added gets its ink-stamp animation');
  await tap('[data-act="addCity"][data-v="40"]');
  ok(await page.$('#total.rise') !== null, 'the changed total rises into place');
  // Swipe on the payout panel: next / previous company; a swipe over the chips does nothing
  const payBox = await page.$eval('#pay', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const drag = async (x1, y, x2) => { await page.mouse.move(x1, y); await page.mouse.down(); await page.mouse.move((x1 + x2) / 2, y, { steps: 3 }); await page.mouse.move(x2, y, { steps: 3 }); await page.mouse.up(); };
  await drag(payBox.x + 120, payBox.y, payBox.x - 120);
  ok((await page.textContent('.co.sel .nm')) === 'PRR', 'swipe left on the payout panel goes to the next company (B&M → PRR, wrapping)');
  await drag(payBox.x - 120, payBox.y, payBox.x + 120);
  ok((await page.textContent('.co.sel .nm')) === 'B&M', 'swipe right goes back');
  const chipBox = await page.$eval('.chiprow', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const citiesBefore = await page.$$eval('.card .city', els => els.length);
  await drag(chipBox.x + 150, chipBox.y, chipBox.x - 150);
  ok((await page.textContent('.co.sel .nm')) === 'B&M', 'a swipe over the value chips does not change company');
  ok((await page.$$eval('.card .city', els => els.length)) <= citiesBefore + 1, 'a swipe over the chips adds at most the one value it ends on');

  // New game needs a second tap
  await tap('#newgame');
  ok((await page.textContent('#newgame')).includes('Tap again'), 'New game asks for a second tap');
  await tap('[data-act="select"][data-co="PRR"]');
  ok((await page.textContent('#newgame')) === 'New game', 'any other tap cancels New game');
  await tap('#newgame'); await tap('#newgame');
  ok((await page.textContent('.co.sel .tt')) === '—', 'New game cleared the snapshots');

  ok(reqs.every(u => u === url), 'no requests besides the page itself (' + reqs.length + ' total)');
  await ctx.close();

  // ---------- 2. Hosted on its own site ----------
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port + '/';
  const hctx = await browser.newContext({ viewport: { width: 1376, height: 1032 } });
  const hp = await hctx.newPage();
  const hreqs = [];
  hp.on('request', r => hreqs.push(r.url()));
  await hp.goto(base);
  ok((await hp.getAttribute('html', 'data-hosted')) === 'yes', 'hosted mode switches on over http');
  ok(await hp.$('link[rel="manifest"]') !== null && await hp.$('link[rel="apple-touch-icon"]') !== null, 'manifest and apple-touch-icon links added');
  await hp.evaluate(() => navigator.serviceWorker.ready);
  await hp.waitForTimeout(500);
  const cached = await hp.evaluate(async () => {
    const keys = await caches.keys();
    const c = await caches.open(keys[0]);
    return (await c.keys()).map(r => new URL(r.url).pathname);
  });
  ok(cached.length === 8, 'service worker cached ' + cached.length + ' files');
  ok(hreqs.every(u => u.startsWith(base)), 'hosted: every request is to its own site');
  // offline reload
  await hp.evaluate(() => { window.__banker.store.dispatch({ type: 'addTrain', trainType: '2' }); window.__banker.store.dispatch({ type: 'addCity', value: 50 }); window.__banker.store.dispatch({ type: 'addCity', value: 40 }); window.__banker.render(); });
  await hctx.setOffline(true);
  await hp.reload();
  ok((await hp.textContent('#per10')) === '$9', 'offline reload works and keeps the state ($9)');
  await hctx.close();
  srv.close();

  // ---------- 3. Service-worker list vs folder ----------
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const list = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const deployable = ['index.html', 'manifest.webmanifest', ...fs.readdirSync(path.join(ROOT, 'icons')).map(f => 'icons/' + f)].sort();
  const listed = list.filter(f => f !== './').sort();
  ok(JSON.stringify(listed) === JSON.stringify(deployable), 'sw.js FILES = index.html + manifest + every file in icons/ (' + listed.length + ')');
  ok(list.every(f => f === './' || fs.existsSync(path.join(ROOT, f))), 'every file in sw.js exists');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  ok(manifest.icons.every(i => fs.existsSync(path.join(ROOT, i.src))), 'every manifest icon exists');

  await browser.close();
  console.log(failures ? failures + ' FAILED' : 'all page checks passed');
  process.exit(failures ? 1 : 0);
})();
