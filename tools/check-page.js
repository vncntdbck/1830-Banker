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
  ok((await page.getAttribute('.nrail svg.loco', 'data-type')) === '3', 'the 3-train steams onto the phase 3 sheet');
  ok(await page.evaluate(() => window.__banker.lastSound()) === 'whistle', 'a steam whistle sounds when the phase starts');
  await tap('.nfoot .snd');
  ok(await page.isVisible('#notice') && (await page.textContent('.nfoot .snd')) === 'Whistle off', 'the Whistle switch turns it off and keeps the view open');
  ok(await page.evaluate(() => localStorage.getItem('banker-sound')) === 'off', 'the Whistle setting is remembered');
  await tap('.nfoot .snd');
  ok((await page.textContent('.nfoot .snd')) === 'Whistle on', 'and back on');
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
  ok((await page.getAttribute('.nrail svg.loco', 'data-type')) === 'D', 'the diesel glides onto the phase 7 sheet');
  ok(await page.evaluate(() => window.__banker.lastSound()) === 'horn', 'the first diesel sounds a horn, not a whistle');
  ok((await page.$$eval('.rusted b', els => els.map(e => e.textContent).join())) === 'Rusted,Rusted,Rusted', 'the 2-, 3- and 4-trains each get a Rusted stamp');
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
  ok(await page.$('.card.roll svg.loco .wh') !== null && await page.$('.card.roll svg.loco .pf') !== null, 'the arriving engine has its own wheels and steam to move');
  ok(await page.$('.add.nudge svg.loco .wh') !== null, 'the Add-train button just used turns its wheels');
  await tap('[data-act="addCity"][data-v="30"]');
  ok(await page.$('.city.stamp') !== null, 'the city just added gets its ink-stamp animation');
  ok(await page.$('.chip.pressed') !== null, 'the rubber stamp used presses down');
  await page.waitForTimeout(200);
  ok(await page.$('.card.act .trail circle') !== null, 'the engine whose run changed lets off a puff of steam');
  {
    const breathe = ago => page.evaluate(ago => { window.__banker.setLastTap(Date.now() - ago); return window.__banker.breathe(); }, ago);
    ok(await breathe(1000) === false, 'no idle steam while values are being entered');
    ok(await breathe(70000) === false, 'no idle steam after a minute without a tap');
    ok(await breathe(5000) === true, 'a standing engine now and then lets off a little steam');
  }
  ok(await page.$$eval('.card .city', els => els.every(e => e.querySelector('.imp') && /(^| )ink-[1-6]( |$)/.test(e.className))), 'every value is an ink impression with one of the six inks');
  ok(await page.$$eval('.chip', els => els.every(e => e.querySelector('use[href="#st-handle"]') && e.querySelector('use[href="#st-face"]') && e.textContent === e.dataset.v)), 'every value button is a rubber stamp showing its value');
  {
    // each impression keeps its tilt, shift and ink through redraws, other removals and Undo
    const look = () => page.$$eval('.card .city', els => els.map(e => e.textContent + ' ' + e.getAttribute('style') + ' ' + e.className.match(/ink-\d/)[0]));
    const a = await look();
    await tap('[data-act="select"][data-co="PRR"]'); await tap('[data-act="select"][data-co="B&M"]');
    ok(JSON.stringify(a) === JSON.stringify(await look()), 'impressions do not move when the screen is redrawn');
    ok(await page.$$eval('.card .city', els => els.every(e => { const s = e.getAttribute('style'); const n = k => Math.abs(parseFloat(s.split(k + ':')[1])); return n('--tilt') <= 3 && n('--ox') <= 1.5 && n('--oy') <= 1.5; })), 'tilt stays within 3° and the shift within 1.5 px');
  }
  await tap('[data-act="addCity"][data-v="40"]');
  ok(await page.$('#total .odo') !== null && (await page.textContent('#total')) === '$70', 'a total that grows a figure rolls too ($0 → $70) and reads exactly $70');
  // a second B&M 2-train: one city counts 0, a second takes the total from $70 to $90 (same length)
  await tap('[data-act="addTrain"][data-type="2"]');
  await tap('[data-act="addCity"][data-v="10"]');
  await tap('[data-act="addCity"][data-v="10"]');
  ok(await page.$('#total .odo') !== null, 'a total of the same length rolls like a counter ($70 → $90)');
  ok((await page.textContent('#total')) === '$90', 'the rolling total still reads exactly $90');
  await page.waitForTimeout(700);
  ok(await page.$eval('#total .odo', e => getComputedStyle(e).color !== 'rgba(0, 0, 0, 0)'), 'after rolling, the digit is visible ink');
  // removing: the city lifts off, Undo plays it back
  await tap('.card:nth-child(2) .city:last-child');
  ok(await page.$('.ghost.wipe') !== null, 'a removed city is wiped away');
  ok(await page.$eval('.ghost.wipe', e => getComputedStyle(e).pointerEvents) === 'none', 'the wiped city cannot be tapped');
  await tap('#undo');
  ok(await page.$('.card:nth-child(2) .city.stamp') !== null, 'Undo stamps the city back in');
  await page.waitForTimeout(1000);
  ok(await page.$('.ghost') === null, 'nothing is left behind once the motion is over');
  await tap('.card:nth-child(2) [data-act="removeTrain"]');
  ok(await page.$('.ghost.leave') !== null, 'a removed train rolls away');
  await tap('#undo');
  ok(await page.$('.card.roll') !== null, 'Undo rolls the train back in');
  // every engine has an explicit pixel size and stands on its rail inside its button or badge
  await page.waitForTimeout(2000);   // let any arriving engine finish its drive
  const fits = await page.$$eval('svg.loco', els => els.every(e => {
    const w = e.getAttribute('width'), h = e.getAttribute('height'), box = e.closest('.add, .badge');
    if (!w || !h || !box) return false;
    const r = e.getBoundingClientRect(), b = box.getBoundingClientRect();
    return r.bottom <= b.bottom + 0.5 && r.left >= b.left - 0.5 && r.right <= b.right + 0.5;
  }));
  ok(fits, 'every engine has a fixed size and its wheels sit inside its button or badge');
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

  // ---------- 1b. Reduce Motion: every gesture is off, nothing is left half-drawn ----------
  {
    const c2 = await browser.newContext({ viewport: { width: 1376, height: 1032 }, hasTouch: true, reducedMotion: 'reduce' });
    const p2 = await c2.newPage();
    await p2.goto(url); await p2.evaluate(() => localStorage.clear()); await p2.reload();
    for (const sel of ['[data-act="addTrain"][data-type="2"]', '[data-act="addCity"][data-v="20"]', '[data-act="addCity"][data-v="30"]', '[data-act="addTrain"][data-type="2"]', '[data-act="addCity"][data-v="10"]', '[data-act="addCity"][data-v="10"]']) await p2.tap(sel);
    await p2.tap('.card:first-child .city');
    ok(await p2.$('.ghost, .odo, .roll, .nudge, .stamp') === null, 'Reduce Motion: no gesture is started');
    ok(await p2.evaluate(() => document.getAnimations().length) === 0, 'Reduce Motion: no animation runs');
    await p2.tap('[data-act="addTrain"][data-type="3"]');
    const st = await p2.$eval('.nrail svg', e => getComputedStyle(e).transform);
    ok(st === 'none', 'Reduce Motion: the phase sheet engine simply stands on its rail');
    await c2.close();
  }

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
