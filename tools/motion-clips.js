// Records the app's motion as short clips, so a person can judge the gestures, not just stills.
// Each clip plays a scripted bit of a game with real taps, at the iPad size.
// Usage: node tools/motion-clips.js <out-dir>     (needs ffmpeg for .mp4; keeps .webm otherwise)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.resolve(process.argv[2] || 'clips');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const SIZE = { width: 1376, height: 1032 };

const CLIPS = {
  // Every engine type driving onto its card, puffing a trail that stays behind.
  'arrivals': async (page, tap, wait) => {
    await page.evaluate(() => { const s = window.__banker.store; s.dispatch({ type: 'select', company: 'CPR' }); s.dispatch({ type: 'addTrain', trainType: '3' }); s.dispatch({ type: 'closeNotice' }); s.dispatch({ type: 'select', company: 'PRR' }); window.__banker.render(); });
    await wait(700);
    await tap('[data-act="addTrain"][data-type="2"]'); await wait(1900);
    await tap('[data-act="addTrain"][data-type="3"]'); await wait(1900);
    await page.evaluate(() => { const s = window.__banker.store; s.dispatch({ type: 'select', company: 'CPR' }); s.dispatch({ type: 'addTrain', trainType: '6' }); s.dispatch({ type: 'closeNotice' }); s.dispatch({ type: 'select', company: 'NYC' }); window.__banker.render(); });
    await wait(700);
    for (const t of ['4', '5', '6']) { await tap(`[data-act="addTrain"][data-type="${t}"]`); await wait(2000); }
  },
  // Values are stamped onto the train with the rubber stamps; one is wiped off and
  // Undo puts it back; then a quick burst of taps.
  'stamps': async (page, tap, wait) => {
    await page.evaluate(() => { const s = window.__banker.store; s.dispatch({ type: 'select', company: 'CPR' }); s.dispatch({ type: 'addTrain', trainType: '3' }); s.dispatch({ type: 'closeNotice' }); s.dispatch({ type: 'select', company: 'PRR' }); s.dispatch({ type: 'addTrain', trainType: '3' }); s.dispatch({ type: 'addTrain', trainType: '3' }); window.__banker.render(); });
    await wait(800);
    for (const v of [40, 30, 60]) { await tap(`[data-act="addCity"][data-v="${v}"]`); await wait(900); }
    await tap('.card .city:nth-child(2)'); await wait(900);
    await tap('#undo'); await wait(1000);
    for (const v of [20, 10, 100]) { await tap(`[data-act="addCity"][data-v="${v}"]`); await wait(260); }
    await wait(1400);
  },
  // A train arrives (wheels roll, steam blooms, the Add button turns its wheels), values are
  // stamped in and the total rolls, a city is tapped off (its ink is wiped away), Undo puts it back.
  'trains-and-payout': async (page, tap, wait) => {
    await tap('[data-act="addTrain"][data-type="2"]'); await wait(1100);
    for (const v of [30, 40]) { await tap(`[data-act="addCity"][data-v="${v}"]`); await wait(800); }
    await tap('[data-act="addTrain"][data-type="2"]'); await wait(1000);
    for (const v of [50, 60]) { await tap(`[data-act="addCity"][data-v="${v}"]`); await wait(800); }
    await tap('.card:first-child .city:first-child'); await wait(1000);
    await tap('#undo'); await wait(1000);
    await tap('.card:nth-child(2) [data-act="removeTrain"]'); await wait(1000);
    await tap('#undo'); await wait(1300);
  },
  // Phase changes: the new phase's engine steams in; rusting trains get the red stamp; Undo
  // brings the rusted trains back; the diesel glides in with no steam at all.
  'phase-changes': async (page, tap, wait) => {
    await page.evaluate(() => { const s = window.__banker.store; s.dispatch({ type: 'addTrain', trainType: '2' }); s.dispatch({ type: 'addCity', value: 20 }); s.dispatch({ type: 'addCity', value: 30 }); window.__banker.render(); });
    await wait(500);
    await tap('[data-act="addTrain"][data-type="3"]'); await wait(2200);
    await tap('.done'); await wait(700);
    await tap('[data-act="addTrain"][data-type="4"]'); await wait(2600);
    await tap('.done'); await wait(700);
    await tap('#undo'); await wait(1600);
    await tap('[data-act="addTrain"][data-type="4"]'); await wait(1200);
    await tap('.done'); await wait(500);
    await page.evaluate(() => { const s = window.__banker.store; ['5', '6'].forEach(t => { s.dispatch({ type: 'addTrain', trainType: t }); s.dispatch({ type: 'closeNotice' }); }); window.__banker.render(); });
    await wait(600);
    await tap('[data-act="addTrain"][data-type="D"]'); await wait(2600);
  },
  // Swiping between companies, then the colour pouring into a tapped company.
  'companies': async (page, tap, wait) => {
    await page.evaluate(() => {
      const s = window.__banker.store;
      [['PRR', '2', [20, 30]], ['NYC', '2', [40, 30]], ['CPR', '2', [10, 20]]].forEach(([c, t, vs]) => {
        s.dispatch({ type: 'select', company: c }); s.dispatch({ type: 'addTrain', trainType: t }); vs.forEach(v => s.dispatch({ type: 'addCity', value: v }));
      });
      s.dispatch({ type: 'select', company: 'PRR' }); window.__banker.render();
    });
    await wait(600);
    const pay = await page.$eval('#pay', e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    for (const dx of [-220, -220, 220]) {
      await page.mouse.move(pay.x, pay.y); await page.mouse.down(); await page.mouse.move(pay.x + dx / 2, pay.y, { steps: 4 }); await page.mouse.move(pay.x + dx, pay.y, { steps: 4 }); await page.mouse.up();
      await wait(900);
    }
    await tap('[data-act="select"][data-co="Erie"]'); await wait(900);
    await tap('[data-act="select"][data-co="CPR"]'); await wait(1100);
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const only = process.argv[3];
  for (const [name, play] of Object.entries(CLIPS)) {
    if (only && only !== name) continue;
    const ctx = await browser.newContext({ viewport: SIZE, hasTouch: true, recordVideo: { dir: OUT, size: SIZE } });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(600);
    const wait = ms => page.waitForTimeout(ms);
    const tap = sel => page.tap(sel);
    await play(page, tap, wait);
    const video = page.video();
    await ctx.close();
    const webm = path.join(OUT, name + '.webm');
    fs.renameSync(await video.path(), webm);
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'scale=1032:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, name + '.mp4')]);
      fs.unlinkSync(webm);
      console.log('clip', path.join(OUT, name + '.mp4'));
    } catch (e) { console.log('clip', webm, '(no ffmpeg: kept webm)'); }
  }
  await browser.close();
})();
