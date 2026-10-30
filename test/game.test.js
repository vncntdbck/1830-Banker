// A scripted game across several operating rounds, crossing phases 3, 4 and 5.
// Every banker tap is one dispatch (or undo); the test counts them.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, memoryStorage } = require('../tools/load-core');

const C = loadCore();
const j = x => JSON.parse(JSON.stringify(x));

function banker(storage) {
  const store = C.createStore(storage || memoryStorage());
  let taps = 0;
  const tap = a => { taps++; return a === 'undo' ? store.undo() : store.dispatch(a); };
  const view = () => {
    const st = store.state;
    return { company: st.selected, ...j(C.payout(C.companyTotal(st.companies[st.selected]))) };
  };
  // One company's operating turn: select it, then make only the edits that the board shows changed.
  function operate(company, edits) {
    const t0 = taps;
    tap({ type: 'select', company });
    (edits || []).forEach(e => tap(e));
    return { taps: taps - t0, ...view() };
  }
  const trains = c => j(store.state.companies[c].trains.map(t => [t.type, t.cities]));
  return { store, tap, operate, trains, view, get taps() { return taps; } };
}

const city = v => ({ type: 'addCity', value: v });
const train = t => ({ type: 'addTrain', trainType: t });

test('scripted game: phases 2 → 5, unchanged companies take exactly 1 tap', () => {
  const mem = memoryStorage();
  const b = banker(mem);
  const s = b.store;
  assert.equal(s.state.phase, 2);

  // ---- OR 1 (phase 2): nobody has trains yet. One tap shows $0.
  let r = b.operate('PRR');
  assert.deepEqual([r.taps, r.per10], [1, 0]);

  // ---- OR 2 (phase 2): PRR now has a 2-train; NYC two 2-trains.
  r = b.operate('PRR', [train('2'), city(20), city(30)]);
  assert.deepEqual([r.taps, r.total, r.per10], [4, 50, 5]);
  r = b.operate('NYC', [train('2'), train('2'), city(40), city(10), city(30), city(20)]);
  assert.deepEqual([r.total, r.per10], [100, 10]);
  assert.deepEqual(b.trains('NYC'), [['2', [30, 20]], ['2', [40, 10]]]);

  // ---- OR 3 (phase 2): nothing changed for PRR or NYC.
  r = b.operate('PRR');
  assert.deepEqual([r.taps, r.total, r.per10], [1, 50, 5]);
  r = b.operate('NYC');
  assert.deepEqual([r.taps, r.total, r.per10], [1, 100, 10]);
  assert.deepEqual(r.ladder.map(x => x.amount), [20, 30, 40, 50, 60]);
  // NYC buys the first 3-train: banker taps Next.
  b.tap({ type: 'advancePhase' });
  assert.equal(s.state.phase, 3);
  assert.equal(s.state.notice.auto, false);
  assert.match(C.noticeContent(s.state.notice).actions.map(a => a.text).join(' '), /ORs per set become 2 from the next stock round/);
  b.tap({ type: 'closeNotice' });
  assert.deepEqual(j(C.nowItems(3).filter(i => i.isNew).map(i => i.key)), ['tiles', 'ors', 'privates']);

  // ---- OR 4 (phase 3)
  r = b.operate('PRR');
  assert.deepEqual([r.taps, r.per10], [1, 5]);
  r = b.operate('NYC', [train('3'), city(30), city(40), city(20)]);
  assert.deepEqual([r.taps, r.total, r.per10], [5, 190, 19]);
  r = b.operate('B&O', [train('3'), city(30), city(30), city(20)]);
  assert.deepEqual([r.total, r.per10], [80, 8]);

  // B&O buys the first 4-train: banker taps Next -> phase 4, every 2-train rusts.
  b.tap({ type: 'advancePhase' });
  assert.equal(s.state.phase, 4);
  assert.deepEqual(b.trains('PRR'), []);
  assert.deepEqual(b.trains('NYC'), [['3', [30, 40, 20]]]);
  assert.deepEqual(b.trains('B&O'), [['3', [30, 30, 20]]]);
  assert.deepEqual(j(s.state.notice.removed), { 2: 3 });
  const nc4 = C.noticeContent(s.state.notice);
  assert.equal(nc4.title, 'Phase 4 begins');
  assert.match(nc4.actions[0].text, /Remove all 2-trains/);
  assert.match(nc4.actions[1].text, /more than 3 trains discard down to 3/);
  b.tap({ type: 'closeNotice' });
  assert.equal(C.nextSummary(4).text, 'First 5-train → +brown · limit 2 · all privates close · 3 ORs · off-board higher');

  // ---- OR 5 (phase 4)
  r = b.operate('PRR', [train('3'), city(20), city(30), city(40)]);
  assert.deepEqual([r.total, r.per10], [90, 9]);
  r = b.operate('NYC'); // its 3-train run is unchanged
  assert.deepEqual([r.taps, r.total, r.per10], [1, 90, 9]);
  r = b.operate('B&O', [train('4'), city(50), city(30), city(20), city(30)]);
  assert.deepEqual([r.total, r.per10], [210, 21]);

  // ---- OR 6: banker forgot to tap Next when NYC bought the first 5-train.
  // Adding the 5-train to NYC's snapshot advances to phase 5 automatically.
  const tapsBefore = b.taps;
  b.tap({ type: 'select', company: 'NYC' });
  b.tap(train('5'));
  assert.equal(s.state.phase, 5);
  assert.equal(s.state.notice.auto, true);
  const nc5 = C.noticeContent(s.state.notice);
  assert.match(nc5.why, /automatically because a 5-train was added to NYC/);
  assert.ok(nc5.actions.some(a => /higher value: check runs that use a red area/.test(a.text)));
  // the closing tap does nothing else
  const snapshotBeforeClose = j({ ...s.state, notice: null });
  b.tap({ type: 'closeNotice' });
  assert.deepEqual(j(s.state), snapshotBeforeClose);
  // off-board is now higher: NYC's 3-train run used a red area worth 40 -> now 70
  b.tap({ type: 'removeCity', trainId: s.state.companies.NYC.trains[0].id, index: 1 });
  b.tap(city(70));
  [60, 30, 20, 30, 40].forEach(v => b.tap(city(v)));
  assert.equal(b.taps - tapsBefore, 10);
  assert.deepEqual(b.trains('NYC'), [['3', [30, 20, 70]], ['5', [60, 30, 20, 30, 40]]]);
  r = b.view();
  assert.deepEqual([r.total, r.per10], [300, 30]);
  assert.deepEqual(r.ladder.map(x => x.amount), [60, 90, 120, 150, 180]);
  assert.deepEqual(j(C.nowItems(5).filter(i => i.isNew).map(i => i.key)), ['tiles', 'limit', 'ors', 'offboard', 'privates']);

  // ---- OR 7 (phase 5): PRR and B&O unchanged.
  r = b.operate('PRR');
  assert.deepEqual([r.taps, r.total, r.per10], [1, 90, 9]);
  r = b.operate('B&O');
  assert.deepEqual([r.taps, r.total, r.per10], [1, 210, 21]);
  r = b.operate('NYC');
  assert.deepEqual([r.taps, r.total], [1, 300]);

  // Accidental tap on Next: phase 6 would rust every 3-train. One undo restores everything.
  const before = j(s.state);
  b.tap({ type: 'advancePhase' });
  assert.equal(s.state.phase, 6);
  assert.deepEqual(b.trains('PRR'), []);
  b.tap('undo');
  assert.deepEqual(j(s.state), before);

  // ...and the whole game survives a reload.
  const again = C.createStore(mem);
  assert.deepEqual(j(again.state), before);
  assert.equal(C.companyTotal(again.state.companies['B&O']), 210);
});
