// Rules and state logic. Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, memoryStorage } = require('../tools/load-core');

const C = loadCore();
const j = x => JSON.parse(JSON.stringify(x)); // values from the vm realm -> plain values

function storeWith(...actions) {
  const s = C.createStore(memoryStorage());
  actions.forEach(a => s.dispatch(a));
  return s;
}
const co = (s, c) => s.state.companies[c || s.state.selected];

test('payout ladder: per 10% and 20%–60% amounts', () => {
  assert.deepEqual(j(C.payout(270)), { total: 270, per10: 27, ladder: [
    { pct: 20, amount: 54 }, { pct: 30, amount: 81 }, { pct: 40, amount: 108 }, { pct: 50, amount: 135 }, { pct: 60, amount: 162 }] });
  assert.equal(C.payout(0).per10, 0);
  assert.deepEqual(j(C.payout(1270).ladder.map(r => r.amount)), [254, 381, 508, 635, 762]);
  assert.equal(C.payout(1270).per10, 127);
  // every possible total (multiples of 10) gives whole-dollar amounts
  for (let t = 0; t <= 3000; t += 10) C.payout(t).ladder.forEach(r => assert.ok(Number.isInteger(r.amount)));
});

test('run length rules: 2..N cities, Diesel unbounded, one city counts 0', () => {
  assert.equal(C.runValue({ type: '3', cities: [] }), 0);
  assert.equal(C.runValue({ type: '3', cities: [40] }), 0);
  assert.equal(C.runNote({ type: '3', cities: [40] }), '1 city · counts 0');
  assert.equal(C.runValue({ type: '3', cities: [40, 30] }), 70);
  assert.equal(C.runNote({ type: '3', cities: [40, 30] }), '');
  assert.equal(C.runValue({ type: '3', cities: [40, 30, 20] }), 90);
  for (const t of ['2', '3', '4', '5', '6']) assert.equal(C.maxCities(t), Number(t));
  assert.ok(C.maxCities('D') >= 15);

  // the store refuses a 4th city on a 3-train
  const s = storeWith({ type: 'addTrain', trainType: '2' });
  s.dispatch({ type: 'addCity', value: 20 });
  s.dispatch({ type: 'addCity', value: 30 });
  assert.equal(s.dispatch({ type: 'addCity', value: 40 }), false, 'full 2-train takes no third city');
  assert.deepEqual(j(co(s).trains[0].cities), [20, 30]);
});

test('diesel takes many cities (no maximum in the rules, app cap >= 21)', () => {
  const s = storeWith({ type: 'addTrain', trainType: 'D' }, { type: 'closeNotice' });
  for (let i = 0; i < 12; i++) s.dispatch({ type: 'addCity', value: 10 * ((i % 10) + 1) });
  assert.equal(co(s).trains[0].cities.length, 12);
  assert.equal(C.runValue(co(s).trains[0]), 550 + 10 + 20);
  for (let i = 0; i < 30; i++) s.dispatch({ type: 'addCity', value: 10 });
  assert.equal(co(s).trains[0].cities.length, C.DIESEL_MAX_CITIES);
});

test('phase table matches rulebook p.27', () => {
  const expect = {
    2: { tiles: ['yellow'], limit: 4, ors: 1, privates: 'cannot', offboard: 'lower', diesel: false, rusts: [] },
    3: { tiles: ['yellow', 'green'], limit: 4, ors: 2, privates: 'may', offboard: 'lower', diesel: false, rusts: [] },
    4: { tiles: ['yellow', 'green'], limit: 3, ors: 2, privates: 'may', offboard: 'lower', diesel: false, rusts: ['2'] },
    5: { tiles: ['yellow', 'green', 'brown'], limit: 2, ors: 3, privates: 'closed', offboard: 'higher', diesel: false, rusts: [] },
    6: { tiles: ['yellow', 'green', 'brown'], limit: 2, ors: 3, privates: 'closed', offboard: 'higher', diesel: true, rusts: ['3'] },
    7: { tiles: ['yellow', 'green', 'brown'], limit: 2, ors: 3, privates: 'closed', offboard: 'higher', diesel: true, rusts: ['4'] },
  };
  for (const p of Object.keys(expect)) {
    const { trigger, ...rest } = j(C.PHASES[p]);
    assert.deepEqual(rest, expect[p], 'phase ' + p);
  }
  assert.deepEqual(j(C.TRAIN_PHASE), { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, D: 7 });
  assert.equal(C.DIESEL_PRICE, 1100);
  assert.equal(C.DIESEL_TRADE_PRICE, 800);
});

test('rusting: 2-trains at 4, 3-trains at 6, 4-trains at 7; 5, 6, D never', () => {
  assert.equal(C.rustPhase('2'), 4);
  assert.equal(C.rustPhase('3'), 6);
  assert.equal(C.rustPhase('4'), 7);
  for (const t of ['5', '6', 'D']) assert.equal(C.rustPhase(t), Infinity);

  const s = C.createStore(memoryStorage());
  // phase 3 so 2- and 3-trains can be set up without auto-advance surprises
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' });
  s.dispatch({ type: 'addTrain', trainType: '2' }); s.dispatch({ type: 'addTrain', trainType: '3' });
  s.dispatch({ type: 'select', company: 'NYC' });
  s.dispatch({ type: 'addTrain', trainType: '2' }); s.dispatch({ type: 'addTrain', trainType: '2' });
  const types = c => j(s.state.companies[c].trains.map(t => t.type));
  s.dispatch({ type: 'advancePhase' }); // -> 4
  assert.equal(s.state.phase, 4);
  assert.deepEqual(types('PRR'), ['3']);
  assert.deepEqual(types('NYC'), []);
  assert.deepEqual(j(s.state.notice.removed), { 2: 3 });
  s.dispatch({ type: 'closeNotice' });
  s.dispatch({ type: 'addTrain', trainType: '4' });
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' }); // 5
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' }); // 6: 3-trains rust
  assert.deepEqual(types('PRR'), []);
  assert.deepEqual(types('NYC'), ['4']);
  s.dispatch({ type: 'advancePhase' }); // 7: 4-trains rust
  assert.deepEqual(types('NYC'), []);
  assert.equal(s.dispatch({ type: 'advancePhase' }), false, 'phase 7 is final');
});

test('"new" markers per phase', () => {
  const marks = p => j(C.nowItems(p).filter(i => i.isNew).map(i => i.key));
  assert.deepEqual(marks(2), []);
  assert.deepEqual(marks(3), ['tiles', 'ors', 'privates']);
  assert.deepEqual(marks(4), ['limit']);
  assert.deepEqual(marks(5), ['tiles', 'limit', 'ors', 'offboard', 'privates']);
  assert.deepEqual(marks(6), ['diesel']);
  assert.deepEqual(marks(7), []);
  // diesel price shown from phase 6 on only
  assert.ok(!C.nowItems(5).some(i => i.key === 'diesel'));
  assert.ok(C.nowItems(7).some(i => i.key === 'diesel'));
  // ORs note only while that change is new
  assert.equal(C.nowItems(3).find(i => i.key === 'ors').note, 'from next SR');
  assert.equal(C.nowItems(4).find(i => i.key === 'ors').note, undefined);
});

test('"Next" line per phase', () => {
  assert.equal(C.nextSummary(2).text, 'First 3-train → +green · companies may buy privates · 2 ORs');
  assert.equal(C.nextSummary(3).text, 'First 4-train → 2-trains rust · limit 3');
  assert.equal(C.nextSummary(4).text, 'First 5-train → +brown · limit 2 · all privates close · 3 ORs · off-board higher');
  assert.equal(C.nextSummary(5).text, 'First 6-train → 3-trains rust · diesels for sale');
  assert.equal(C.nextSummary(6).text, 'First diesel → 4-trains rust');
  assert.equal(C.nextSummary(7), null);
});

test('phase-change board actions', () => {
  const txt = p => C.boardActions(p).map(a => a.text).join(' | ');
  assert.match(txt(4), /Remove all 2-trains/);
  assert.match(txt(4), /more than 3 trains discard/);
  assert.match(txt(5), /higher value: check runs that use a red area/);
  assert.match(txt(5), /Close all private companies/);
  assert.match(txt(5), /more than 2 trains/);
  assert.match(txt(5), /from the next stock round/);
  assert.match(txt(3), /from the next stock round/);
  assert.match(txt(6), /Remove all 3-trains/);
  assert.match(C.boardActions(6).map(a => a.sub || '').join(' '), /\$1100, or \$800 trading in a 4-, 5- or 6-train \(legal even at the train limit\)/);
  assert.match(txt(7), /Remove all 4-trains/);
  assert.match(txt(7), /final phase/);
});

test('auto phase advance when a later train type is added, with notice and one-step undo', () => {
  const s = C.createStore(memoryStorage());
  s.dispatch({ type: 'addTrain', trainType: '2' });
  s.dispatch({ type: 'addCity', value: 20 }); s.dispatch({ type: 'addCity', value: 30 });
  s.dispatch({ type: 'select', company: 'NYC' });
  s.dispatch({ type: 'addTrain', trainType: '3' }); // first 3-train -> phase 3
  assert.equal(s.state.phase, 3);
  assert.equal(s.state.notice.auto, true);
  assert.equal(s.state.notice.trainType, '3');
  assert.equal(s.state.notice.company, 'NYC');
  assert.match(C.noticeContent(s.state.notice).why, /automatically because a 3-train was added to NYC/);
  // while the notice is open, other taps do nothing
  assert.equal(s.dispatch({ type: 'select', company: 'PRR' }), false);
  assert.equal(s.dispatch({ type: 'addCity', value: 10 }), false);
  // closing does nothing else
  const before = j(s.state);
  s.dispatch({ type: 'closeNotice' });
  assert.deepEqual({ ...j(s.state), notice: null }, { ...before, notice: null });
  // jump: adding a 5-train in phase 3 goes straight to 5, rusting 2-trains on the way
  s.dispatch({ type: 'addTrain', trainType: '5' });
  assert.equal(s.state.phase, 5);
  assert.equal(s.state.notice.from, 3);
  assert.deepEqual(j(s.state.companies.PRR.trains), []);
  const nc = C.noticeContent(s.state.notice);
  assert.match(nc.actions.map(a => a.text).join(' '), /Remove all 2-trains.*Close all private/);
  // one undo restores phase 3, the PRR 2-train and removes the 5-train
  s.undo();
  assert.equal(s.state.phase, 3);
  assert.equal(s.state.notice, null);
  assert.deepEqual(j(s.state.companies.PRR.trains[0].cities), [20, 30]);
  assert.deepEqual(j(s.state.companies.NYC.trains.map(t => t.type)), ['3']);
  // diesel in phase 3 means phase 7
  s.dispatch({ type: 'addTrain', trainType: 'D' });
  assert.equal(s.state.phase, 7);
  s.undo();
  assert.equal(s.state.phase, 3);
  // trains of the current or earlier phase never advance
  s.dispatch({ type: 'addTrain', trainType: '2' });
  assert.equal(s.state.phase, 3);
  assert.equal(s.state.notice, null);
});

test('add-train options: rusted types and the 4-train maximum are disabled', () => {
  const s = C.createStore(memoryStorage());
  let o = j(C.addTrainOptions(s.state));
  assert.deepEqual(o.map(x => x.advancesTo), [null, 3, 4, 5, 6, 7]);
  assert.ok(o.every(x => !x.disabled));
  ['2', '2', '2', '2'].forEach(t => s.dispatch({ type: 'addTrain', trainType: t }));
  assert.equal(co(s).trains.length, 4);
  assert.equal(s.dispatch({ type: 'addTrain', trainType: '2' }), false);
  assert.ok(j(C.addTrainOptions(s.state)).every(x => x.disabled && x.reason === 'max 4'));
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' });
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' }); // 4: 2s gone
  o = j(C.addTrainOptions(s.state));
  assert.deepEqual(o.find(x => x.type === '2'), { type: '2', disabled: true, reason: 'rusted', advancesTo: null });
  assert.equal(s.dispatch({ type: 'addTrain', trainType: '2' }), false);
});

test('city entry: fills the highlighted train, then moves on; tap city removes it', () => {
  const s = storeWith({ type: 'addTrain', trainType: '2' }, { type: 'addTrain', trainType: '2' });
  // new train is highlighted -> it is the second one; then fill moves to the next with room
  [10, 20, 30, 40].forEach(v => s.dispatch({ type: 'addCity', value: v }));
  const [a, b] = co(s).trains;
  assert.deepEqual(j([a.cities, b.cities]), [[30, 40], [10, 20]]);
  assert.equal(s.dispatch({ type: 'addCity', value: 50 }), false, 'all full');
  // fix a value: tap city 20 on train b, then tap 60 -> lands on b
  s.dispatch({ type: 'removeCity', trainId: b.id, index: 1 });
  s.dispatch({ type: 'addCity', value: 60 });
  assert.deepEqual(j(co(s).trains[1].cities), [10, 60]);
  assert.equal(C.companyTotal(co(s)), 140);
  // trains stay sorted by size
  s.dispatch({ type: 'select', company: 'CPR' });
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' });
  s.dispatch({ type: 'addTrain', trainType: '3' }); s.dispatch({ type: 'addTrain', trainType: '2' });
  assert.deepEqual(j(co(s).trains.map(t => t.type)), ['2', '3']);
  // remove a train
  s.dispatch({ type: 'removeTrain', trainId: co(s).trains[0].id });
  assert.deepEqual(j(co(s).trains.map(t => t.type)), ['3']);
});

test('persistence: state and undo history survive a reload', () => {
  const mem = memoryStorage();
  const s1 = C.createStore(mem);
  s1.dispatch({ type: 'addTrain', trainType: '2' });
  s1.dispatch({ type: 'addCity', value: 30 });
  s1.dispatch({ type: 'addCity', value: 40 });
  s1.dispatch({ type: 'select', company: 'B&O' });
  const s2 = C.createStore(mem);
  assert.deepEqual(j(s2.state), j(s1.state));
  assert.equal(s2.history.length, 3);
  assert.equal(s2.undoLabel(), 'PRR +40');
  s2.undo();
  const s3 = C.createStore(mem);
  assert.deepEqual(j(s3.state.companies.PRR.trains[0].cities), [30]);
  assert.equal(s3.state.selected, 'PRR', 'undo returns to the company that was changed');
  // corrupt storage falls back to a fresh game instead of crashing
  const bad = memoryStorage({ [C.STORAGE_KEY]: '{not json' });
  assert.equal(C.createStore(bad).state.phase, 2);
  const worse = memoryStorage({ [C.STORAGE_KEY]: JSON.stringify({ state: { phase: 99 } }) });
  assert.equal(C.createStore(worse).state.phase, 2);
  // no storage at all (private mode) still works
  const none = C.createStore(null);
  assert.equal(none.dispatch({ type: 'addTrain', trainType: '2' }), true);
  // throwing storage still works
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const t = C.createStore(throwing);
  assert.equal(t.dispatch({ type: 'addTrain', trainType: '2' }), true);
});

test('undo: at least 20 steps, phase advance undoes completely, and it works after reload', () => {
  const mem = memoryStorage();
  const s = C.createStore(mem);
  s.dispatch({ type: 'advancePhase' }); s.dispatch({ type: 'closeNotice' }); // 3
  s.dispatch({ type: 'addTrain', trainType: '2' });
  s.dispatch({ type: 'addCity', value: 50 }); s.dispatch({ type: 'addCity', value: 40 });
  s.dispatch({ type: 'select', company: 'NYC' });
  s.dispatch({ type: 'addTrain', trainType: '2' });
  s.dispatch({ type: 'addCity', value: 20 }); s.dispatch({ type: 'addCity', value: 20 });
  const beforeAdvance = j(s.state);
  s.dispatch({ type: 'advancePhase' }); // accidental 3 -> 4, rusts both 2-trains
  assert.equal(s.state.phase, 4);
  assert.equal(C.companyTotal(s.state.companies.PRR), 0);
  s.dispatch({ type: 'closeNotice' });
  // reload, then undo
  const r = C.createStore(mem);
  assert.equal(r.undoLabel(), 'Phase 3 → 4');
  r.undo();
  assert.deepEqual(j(r.state), beforeAdvance);
  assert.equal(C.companyTotal(r.state.companies.PRR), 90);

  // 30 recorded edits, then 25 undos all work
  const deep = C.createStore(memoryStorage());
  deep.dispatch({ type: 'addTrain', trainType: 'D' }); deep.dispatch({ type: 'closeNotice' });
  for (let i = 0; i < 15; i++) deep.dispatch({ type: 'addCity', value: 10 * ((i % 10) + 1) });
  for (let i = 0; i < 15; i++) deep.dispatch({ type: 'removeCity', trainId: co(deep).trains[0].id, index: 0 });
  assert.equal(co(deep).trains[0].cities.length, 0);
  let undone = 0;
  for (let i = 0; i < 25; i++) if (deep.undo()) undone++;
  assert.equal(undone, 25);
  assert.equal(co(deep).trains[0].cities.length, 5);
  assert.ok(C.HISTORY_LIMIT >= 20);
});

test('new game resets everything and is itself undoable', () => {
  const s = storeWith({ type: 'addTrain', trainType: '3' }, { type: 'closeNotice' }, { type: 'addCity', value: 40 }, { type: 'addCity', value: 40 });
  assert.equal(s.state.phase, 3);
  s.dispatch({ type: 'newGame' });
  assert.equal(s.state.phase, 2);
  assert.ok(C.COMPANIES.every(c => s.state.companies[c].trains.length === 0));
  s.undo();
  assert.equal(s.state.phase, 3);
  assert.equal(C.companyTotal(co(s)), 80);
});
