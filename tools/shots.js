// Renders index.html in headless Chromium at three window sizes with the fullest cases,
// saves screenshots, and measures clipping, scrolling, touch-target sizes and outside requests.
// Usage: node tools/shots.js <outdir>
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(process.argv[2] || 'shots');
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SIZES = [
  { name: 'ipad-home', width: 1376, height: 1032 },
  { name: 'ipad-safari', width: 1376, height: 950 },
  { name: 'mac', width: 1440, height: 800 },
];

// Each case is a list of actions dispatched through the real store.
const T = t => ({ type: 'addTrain', trainType: t });
const c = v => ({ type: 'addCity', value: v });
const close = { type: 'closeNotice' };
const adv = { type: 'advancePhase' };
const CASES = {
  'empty': [],
  'four-trains-full': [adv, close, T('3'), c(100), c(90), c(80), T('3'), c(70), c(60), c(50), adv, close, T('4'), c(100), c(100), c(90), c(80), T('4'), c(70), c(60), c(50), c(40),
    { type: 'select', company: 'NYC' }, T('3'), c(40), c(30), { type: 'select', company: 'PRR' }],
  'two-diesels-12': [T('D'), close, ...[100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 100, 90].map(c), T('D'), ...[80, 70, 60, 50, 40, 30, 20, 10, 100, 90, 80, 70].map(c)],
  'two-diesels-max': [T('D'), close, ...Array(25).fill(100).map(c), T('D'), ...Array(25).fill(90).map(c)],
  'one-city-and-phase6': [T('6'), close, T('5'), c(60), T('6'), c(30), c(20), c(40)],
  'notice-phase5': [T('2'), c(20), c(30), adv, close, adv, close, T('4'), c(40), c(30), T('5')],
  'notice-jump-2-to-7': [T('2'), c(20), c(30), T('D')],
  'phase3-mixed-trains': [T('2'), c(20), c(30), T('3'), close, c(40), c(30), c(20), { type: 'select', company: 'B&M' }, T('2'), c(10), c(20)],
  'phase7-final': [T('D'), close, ...[60, 50, 40, 30, 20, 10, 100, 90, 80, 70, 60, 50].map(c), T('5'), c(30), c(20), c(40)],
  'new-game-armed': [T('2'), c(20), c(30), { ui: '#newgame' }],
  'undo-label-long': [{ type: 'select', company: 'Erie' }, T('6'), close, T('D')],
};

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, hasTouch: true, reducedMotion: 'reduce' });
    for (const [name, actions] of Object.entries(CASES)) {
      const page = await ctx.newPage();
      const outside = [];
      page.on('request', r => { const u = r.url(); if (!/^(file:|data:|about:)/.test(u)) outside.push(u); });
      await page.goto(FILE);
      await page.evaluate(actions => {
        localStorage.clear();
        const b = window.__banker;
        b.store.dispatch({ type: 'newGame' });
        while (b.store.undo()) {}
        actions.filter(a => !a.ui).forEach(a => b.store.dispatch(a));
        b.render(); b.fit();
      }, actions);
      for (const a of actions.filter(a => a.ui)) await page.click(a.ui);
      await page.waitForTimeout(50);
      const file = path.join(OUT, size.name + '--' + name + '.png');
      await page.screenshot({ path: file });
      const m = await page.evaluate(() => {
        const stage = document.getElementById('stage');
        const s = Number(stage.dataset.scale);
        const sr = stage.getBoundingClientRect();
        const clipped = [];
        const boxes = '#now, .terms, .term, #row2, #next, #cos, .co, #main, #snap, .snap-h, #cards, .card, .cities, .rt, .addrow, .add, .chiprow, .chip, #pay, .total, .ladder, .static, #notice, .nbox, .nfoot';
        stage.querySelectorAll(boxes).forEach(el => {
          if (el.closest('[hidden]') || !el.clientWidth) return;
          const dx = el.scrollWidth - el.clientWidth, dy = el.scrollHeight - el.clientHeight;
          // dy up to 8px is the Didone's tall line box (glyph ascent), not clipping; layout overflow is checked below
          if (dx > 1 || dy > 8) clipped.push((el.id || el.className) + ' +' + dx + 'x+' + dy);
        });
        // text cut off with an ellipsis
        stage.querySelectorAll('#next .txt, .undo span').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 1) clipped.push('truncated: ' + el.textContent.slice(0, 40));
        });
        // every element must sit inside its own row/panel
        ['#now', '#row2', '#cos', '#snap', '#pay', '.nbox'].forEach(sel => {
          const box = stage.querySelector(sel); if (!box || box.closest('[hidden]')) return;
          const br = box.getBoundingClientRect();
          box.querySelectorAll('*').forEach(el => {
            const r = el.getBoundingClientRect(); if (!r.width || el.closest('#sprite')) return;
            if (r.left < br.left - 0.5 || r.right > br.right + 0.5 || r.top < br.top - 0.5 || r.bottom > br.bottom + 0.5)
              clipped.push('outside ' + sel + ': ' + (el.id || el.className || el.tagName));
          });
        });
        // any element drawn outside its panel?
        const outsideStage = [];
        stage.querySelectorAll('button, .card, .item').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width && (r.left < sr.left - 0.5 || r.right > sr.right + 0.5 || r.top < sr.top - 0.5 || r.bottom > sr.bottom + 0.5)) outsideStage.push(el.className);
        });
        const small = [];
        let minTarget = Infinity;
        stage.querySelectorAll('button:not([disabled])').forEach(el => {
          if (el.closest('[hidden]')) return;
          const r = el.getBoundingClientRect();
          if (!r.width) return;
          // design units == iPad points at full size
          const w = r.width / s, h = r.height / s;
          minTarget = Math.min(minTarget, w, h);
          if (w < 55.5 || h < 55.5) small.push((el.className || el.id) + ' ' + w.toFixed(0) + 'x' + h.toFixed(0));
        });
        const totalFont = parseFloat(getComputedStyle(document.getElementById('total')).fontSize);
        const amountFont = parseFloat(getComputedStyle(document.getElementById('per10')).fontSize);
        const sizes = [...stage.querySelectorAll('.num, .co .nm, .rung .a, .phase .val, .term .val, .plate')].map(e => parseFloat(getComputedStyle(e).fontSize));
        return {
          scale: s,
          pageScrolls: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1,
          stageInside: sr.left >= -0.5 && sr.top >= -0.5 && sr.right <= innerWidth + 0.5 && sr.bottom <= innerHeight + 0.5,
          clipped, outsideStage, small, minTarget: +minTarget.toFixed(1),
          per10Text: document.getElementById('total').textContent,
          per10CapPx: +(totalFont * s * 0.72).toFixed(0) + '/' + (amountFont * s * 0.72).toFixed(0), // digit heights: total / each holding
          per10IsLargest: totalFont >= Math.max(...sizes),
        };
      });
      report.push({ size: size.name, case: name, ...m, outside });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  for (const r of report) {
    const bad = r.pageScrolls || !r.stageInside || r.clipped.length || r.outsideStage.length || r.small.length || r.outside.length || !r.per10IsLargest;
    console.log((bad ? 'FAIL ' : 'ok   ') + r.size.padEnd(12) + r.case.padEnd(22) + ' scale ' + r.scale.toFixed(3) + ' minTarget ' + r.minTarget + 'pt  total ' + r.per10Text + ' (digits ' + r.per10CapPx + 'px)' +
      (r.clipped.length ? '\n     clipped: ' + r.clipped.join(' | ') : '') + (r.small.length ? '\n     small: ' + r.small.join(' | ') : '') +
      (r.outsideStage.length ? '\n     outside stage: ' + r.outsideStage.join(' | ') : '') + (r.outside.length ? '\n     requests: ' + r.outside.join(' ') : '') +
      (r.pageScrolls ? '\n     page scrolls' : '') + (!r.per10IsLargest ? '\n     total not largest' : ''));
  }
})();
