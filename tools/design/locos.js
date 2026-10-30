// Locomotive-only set, built from a spec per type so the layout is always logical:
// drivers start under the cab, small leading wheels sit under the cylinder at the front,
// the smokebox sits above the leading wheels, the cowcatcher starts in front of the last wheel.
// One common scale; rail at y = 74. Each engine spans x 0..w and y top..80 (top < 0 leaves room
// for the steam). Returns { types: { key: { w, top, svg } }, specs, check() }.
// The markup carries hooks for the app's motion: every wheel is a <g class="wh"> (turns about its
// own centre) and every steam puff a <circle class="pf" style="--i:n">, n counting from the chimney.
// Wheel system (same for every engine): driving wheels r 13, one more per type (1–5); small leading
// wheels r 5.5 in a pair under the cylinder (a single r 6 on the 2). The D has disc wheels.
module.exports = (N, P) => {
  const f = n => +n.toFixed(2);
  const wheel = (cx, r) => {
    const cy = 74 - r;
    let s = `<g class="wh"><circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="${N}"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * 0.74)}" fill="${P}"/>`;
    const n = r > 9 ? 10 : 6;
    for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; s += `<line x1="${f(cx)}" y1="${f(cy)}" x2="${f(cx + r * 0.74 * Math.cos(a))}" y2="${f(cy + r * 0.74 * Math.sin(a))}" stroke="${N}" stroke-width="${r > 9 ? 1.1 : .9}"/>`; }
    return s + `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1.6, r * 0.2))}" fill="${N}"/></g>`;
  };
  // Steam: a billowing, slightly irregular trail that drifts back and up. Puffs swell as they go,
  // wobble above and below the line, and from the third puff on carry a small side puff.
  const steam = (x, y, n, s) => {
    const wob = [0, -0.32, 0.26, -0.42, 0.18, -0.36, 0.3, -0.2], sz = [1, 0.88, 1.1, 0.9, 1.1, 0.94, 1.06, 1];
    const puffs = [], side = []; let cx = x, cy = y, r = 2.9 * s;
    for (let i = 0; i < n; i++) {
      const ri = r * sz[i], py = cy - ri * 0.8 + wob[i] * ri;
      puffs.push([cx, py, ri, i]);
      if (i >= 2 && i % 2 === 0) side.push([cx + ri * (i % 4 === 0 ? 0.3 : -0.35), py - ri * 0.9, ri * 0.55, i + 0.5]);
      cx -= r * 1.05; cy -= 1 + i * 0.6; r *= 1.14;
    }
    const c = ([a, b, cr, i]) => `<circle class="pf" style="--i:${i}" cx="${f(a)}" cy="${f(b)}" r="${f(cr)}"/>`;
    return { svg: '<g class="steam" fill="' + P + '" stroke="' + N + '" stroke-width="1.15">' + side.map(c).join('') + puffs.slice().reverse().map(c).join('') + '</g>', puffs: puffs.concat(side) };
  };

  // ---- one spec per type: everything else is derived from these numbers ----
  // Wheel system (same for every engine): driving wheels r 13, one more per type (1–5);
  // small leading wheels r 5.5 in a pair under the cylinder (one on the earliest engine).
  const SPECS = {
    '2': { target: 108, rd: 13, nd: 1, rl: 6, nl: 1, cabW: 20, cabExtra: 0, d: 14.5, frame: true, stack: { kind: 'thin', w: 5, h: 22 }, steam: [3, 2.1], domes: [[0.35, 9, 4]], lamp: 0, pilot: 7, windows: 1, roofOver: 2 },
    '3': { target: 130, rd: 13, nd: 2, rl: 5.5, nl: 2, cabW: 22, cabExtra: 1.5, d: 17.5, frame: true, stack: { kind: 'balloon', w: 16, h: 25 }, steam: [4, 2.3], domes: [[0.42, 11, 5]], lamp: 0.9, pilot: 9, windows: 1 },
    '4': { target: 152, rd: 13, nd: 3, rl: 5.5, nl: 2, cabW: 24.5, cabExtra: 3.5, d: 20.5, stack: { kind: 'diamond', w: 19, h: 28 }, steam: [5, 2.5], domes: [[0.3, 12, 6], [0.56, 9, 4]], lamp: 1.1, pilot: 11, windows: 1 },
    '5': { target: 174, rd: 13, nd: 4, rl: 5.5, nl: 2, cabW: 27, cabExtra: 6, d: 23.5, stack: { kind: 'straight', w: 14, h: 32 }, steam: [6, 2.72], domes: [[0.24, 13, 6], [0.5, 13, 6]], lamp: 1.3, pilot: 12, windows: 2 },
    '6': { target: 197, rd: 13, nd: 5, rl: 5.5, nl: 2, cabW: 31, cabExtra: 9, d: 28, stack: { kind: 'straight', w: 21, h: 35, lip: true }, steam: [7, 3.0], domes: [[0.18, 16, 6], [0.4, 12, 5], [0.62, 16, 6]], lamp: 1.5, pilot: 13, windows: 1, roofOver: 5 },
  };

  function build(spec, stretch) {
    stretch = stretch || 0;
    const x0 = 3, rd = spec.rd, rl = spec.rl;
    const fp = 74 - 2 * rd + 3;                       // footplate: just over the driver tops
    const gap = spec.gap === undefined ? 3 : spec.gap; // space between wheels
    const drivers = [...Array(spec.nd)].map((_, i) => x0 + spec.cabW * 0.55 + i * (2 * rd + gap) + (i === 0 ? Math.max(0, rd - spec.cabW * 0.55 + 2) : Math.max(0, rd - spec.cabW * 0.55 + 2)));
    const lastD = drivers[drivers.length - 1];
    const lg = spec.leadGap === undefined ? 3 : spec.leadGap;
    const leads = [...Array(spec.nl)].map((_, i) => lastD + rd + gap + lg + stretch + rl + i * (2 * rl + 1.5));
    const lastL = leads[leads.length - 1];
    const front = lastL + rl + 1;                     // front of the smokebox, over the last small wheel
    const boilerTop = fp - spec.d;
    const smokebox = [front - 7, front];
    const pilotX = lastL + rl + 4;
    const w = Math.ceil(spec.pilot ? pilotX + spec.pilot + 2 : front + 6);
    const cabX = x0, cabTop = boilerTop - (spec.cabW * 0.45 + 2) - (spec.cabExtra || 0);
    const parts = [];
    const add = s => parts.push(s);
    add(`<rect x="0" y="74" width="${w}" height="2.2" fill="${N}"/>`);

    // stack (centred a little behind the smokebox front)
    const st = spec.stack, sx = smokebox[0] - st.w / 2 + 2, stTop = boilerTop - st.h;
    let stackSvg = '';
    if (st.kind === 'thin') stackSvg = `<rect x="${f(sx + st.w / 2 - 2.8)}" y="${f(stTop + 3)}" width="5.6" height="${st.h - 3}" fill="${N}"/><rect x="${f(sx + st.w / 2 - 5.3)}" y="${f(stTop)}" width="10.6" height="4" rx="1" fill="${N}"/>`;
    if (st.kind === 'balloon') stackSvg = `<path d="M${f(sx - st.w / 2 + 2.5)} ${f(stTop)} H${f(sx + st.w * 1.5 - 2.5)} L${f(sx + st.w / 2 + 3)} ${f(stTop + 14)} H${f(sx + st.w / 2 - 3)} Z" fill="${N}"/><line x1="${f(sx - st.w / 2 + 4.5)}" y1="${f(stTop + 3)}" x2="${f(sx + st.w * 1.5 - 4.5)}" y2="${f(stTop + 3)}" stroke="${P}" stroke-width=".7"/><rect x="${f(sx + st.w / 2 - 3)}" y="${f(stTop + 13)}" width="6" height="${f(st.h - 12)}" fill="${N}"/>`;
    if (st.kind === 'diamond') stackSvg = `<path d="M${f(sx + st.w / 2)} ${f(stTop)} L${f(sx + st.w)} ${f(stTop + st.w / 2)} L${f(sx + st.w / 2)} ${f(stTop + st.w)} L${f(sx)} ${f(stTop + st.w / 2)} Z" fill="${N}"/><line x1="${f(sx + 2.5)}" y1="${f(stTop + st.w / 2)}" x2="${f(sx + st.w - 2.5)}" y2="${f(stTop + st.w / 2)}" stroke="${P}" stroke-width=".7"/><rect x="${f(sx + st.w / 2 - 3)}" y="${f(stTop + st.w - 1)}" width="6" height="${f(st.h - st.w + 1)}" fill="${N}"/>`;
    if (st.kind === 'straight' && !st.lip) stackSvg = `<rect x="${f(sx)}" y="${f(stTop + 4)}" width="${st.w}" height="${st.h - 4}" fill="${N}"/><path d="M${f(sx - 3)} ${f(stTop)} H${f(sx + st.w + 3)} L${f(sx + st.w + 1)} ${f(stTop + 5)} H${f(sx - 1)} Z" fill="${N}"/><line x1="${f(sx)}" y1="${f(stTop + 7)}" x2="${f(sx + st.w)}" y2="${f(stTop + 7)}" stroke="${P}" stroke-width=".7"/>`;
    if (st.kind === 'straight' && st.lip) stackSvg = `<path d="M${f(sx + 2)} ${f(stTop + 8)} L${f(sx)} ${f(stTop + st.h)} H${f(sx + st.w)} L${f(sx + st.w - 2)} ${f(stTop + 8)} Z" fill="${N}"/><path d="M${f(sx - 5)} ${f(stTop)} H${f(sx + st.w + 5)} L${f(sx + st.w + 1)} ${f(stTop + 6)} H${f(sx - 1)} Z" fill="${N}"/><rect x="${f(sx - 1)}" y="${f(stTop + 6)}" width="${st.w + 2}" height="3" fill="${N}"/><line x1="${f(sx - 3)}" y1="${f(stTop + 2.5)}" x2="${f(sx + st.w + 3)}" y2="${f(stTop + 2.5)}" stroke="${P}" stroke-width=".7"/><line x1="${f(sx + 1)}" y1="${f(stTop + 13)}" x2="${f(sx + st.w - 1)}" y2="${f(stTop + 13)}" stroke="${P}" stroke-width=".7"/>`;
    const plume = steam(sx + st.w / 2, stTop - 0.5, spec.steam[0], spec.steam[1]);
    add(plume.svg);
    add(stackSvg);

    // boiler with bands, smokebox, domes, bell
    const bx1 = cabX + spec.cabW - 1, bx2 = smokebox[0] + 1;
    add(`<rect x="${f(bx1)}" y="${f(boilerTop)}" width="${f(bx2 - bx1)}" height="${spec.d}" rx="${f(spec.d / 4)}" fill="${N}"/>`);
    const nb = Math.max(2, Math.round((bx2 - bx1) / 19));
    for (let i = 1; i <= nb; i++) { const x = bx1 + (bx2 - bx1) * i / (nb + 1); add(`<line x1="${f(x)}" y1="${f(boilerTop + 1)}" x2="${f(x)}" y2="${f(fp - 1)}" stroke="${P}" stroke-width=".9"/>`); }
    add(`<line x1="${f(bx1 + 2)}" y1="${f(boilerTop + 4)}" x2="${f(bx2 - 2)}" y2="${f(boilerTop + 4)}" stroke="${P}" stroke-width=".6" stroke-opacity=".8"/>`);
    add(`<rect x="${f(smokebox[0])}" y="${f(boilerTop - 2)}" width="7" height="${f(spec.d + 4)}" rx="1.5" fill="${N}"/>`);
    spec.domes.forEach(([t, dw, dh]) => { const x = bx1 + (bx2 - bx1) * t; add(`<path d="M${f(x)} ${f(boilerTop)} v-${dh} a${dw / 2} ${dw / 2} 0 0 1 ${dw} 0 v${dh} z" fill="${N}"/>`); });
    if (spec.bell) { const x = bx1 + (bx2 - bx1) * 0.72; add(`<path d="M${f(x)} ${f(boilerTop)} l1.5 -6 h4 l1.5 6 z" fill="${N}"/>`); }
    if (spec.deflector) add(`<rect x="${f(smokebox[0] - 12)}" y="${f(boilerTop - 1)}" width="10" height="${f(spec.d - 3)}" rx="1" fill="${P}" stroke="${N}" stroke-width="1.1"/><line x1="${f(smokebox[0] - 9.5)}" y1="${f(boilerTop + 3)}" x2="${f(smokebox[0] - 9.5)}" y2="${f(fp - 6)}" stroke="${N}" stroke-width=".5"/>`);
    if (spec.lamp) { const s = spec.lamp; const ly = boilerTop + 1.5; add(`<rect x="${f(front - 2)}" y="${f(ly)}" width="${f(6 * s)}" height="${f(6.5 * s)}" rx="1" fill="${N}"/><circle cx="${f(front - 2 + 4 * s)}" cy="${f(ly + 3.25 * s)}" r="${f(1.7 * s)}" fill="${P}"/>`); }
    if (false) add(`<line x1="${f(bx1 + 2)}" y1="${f(fp - 5.5)}" x2="${f(smokebox[0] - (spec.deflector ? 13 : 2))}" y2="${f(fp - 5.5)}" stroke="${P}" stroke-width="1"/>`);

    // cab (or the open footplate of the earliest engine)
    if (spec.open) {
      add(`<rect x="${f(cabX + 3)}" y="${f(boilerTop - 7)}" width="${spec.cabW - 2}" height="${f(fp - boilerTop + 7)}" rx="1" fill="${N}"/><line x1="${f(cabX + 5)}" y1="${f(boilerTop - 3)}" x2="${f(cabX + spec.cabW - 1)}" y2="${f(boilerTop - 3)}" stroke="${P}" stroke-width=".7"/>`);
      add(`<rect x="${f(cabX)}" y="${f(boilerTop - 12)}" width="3.5" height="${f(fp - boilerTop + 12)}" rx="1" fill="${N}"/>`);
    } else {
      const ro = spec.roofOver || 3;
      add(`<rect x="${f(cabX)}" y="${f(cabTop)}" width="${spec.cabW}" height="${f(fp - cabTop + 1)}" fill="${N}"/><rect x="${f(cabX - ro)}" y="${f(cabTop - 4.5)}" width="${spec.cabW + 2 * ro}" height="4.8" rx="1" fill="${N}"/>`);
      const ww = spec.windows === 2 ? (spec.cabW - 12) / 2 : spec.cabW - 10;
      for (let i = 0; i < spec.windows; i++) add(`<rect x="${f(cabX + 4 + i * (ww + 4))}" y="${f(cabTop + 4.5)}" width="${f(ww)}" height="${f(Math.min(spec.windows === 1 && spec.cabExtra ? 14 : 11, (fp - cabTop) * 0.32))}" fill="${P}"/>`);
    }
    // footplate
    add(`<rect x="${f(cabX)}" y="${f(fp)}" width="${f(front - cabX + (spec.pilot ? 1 : 3))}" height="3.2" fill="${N}"/>`);

    // the frame (chassis) between the wheels, so the boiler visibly rests on something
    if (spec.frame) {
      const fy = fp + 2.5, fh = 74 - rd + 2 - fy;
      add(`<rect x="${f(drivers[0])}" y="${f(fy)}" width="${f(lastL - drivers[0])}" height="${f(fh)}" rx="1.2" fill="${N}"/>`);
      add(`<line x1="${f(drivers[0] + rd + 2)}" y1="${f(fy + 2.2)}" x2="${f(lastL - rl - 2)}" y2="${f(fy + 2.2)}" stroke="${P}" stroke-width=".7"/>`);
    }
    // wheels: small leading wheels first, then the cylinder over them, then drivers and rods
    leads.forEach(x => add(wheel(x, rl)));
    const hasCyl = true;
    const cylX2 = lastL + rl - 0.5, cylX1 = Math.max(lastD + rd + 3, Math.min(leads[0] - rl - 1, cylX2 - 17)), cylY = fp + 1.5, cylH = 9.5;
    if (hasCyl) add(`<rect x="${f(cylX1)}" y="${f(cylY)}" width="${f(cylX2 - cylX1)}" height="${f(cylH)}" rx="1.5" fill="${N}"/><line x1="${f(cylX1 + 2)}" y1="${f(cylY + cylH / 2)}" x2="${f(cylX2 - 2)}" y2="${f(cylY + cylH / 2)}" stroke="${P}" stroke-width=".6"/>`);
    drivers.forEach(x => add(wheel(x, rd)));
    const crankY = 74 - rd + 3;
    if (drivers.length > 1) add(`<rect x="${f(drivers[0])}" y="${f(crankY - 1.4)}" width="${f(lastD - drivers[0])}" height="2.8" rx="1.4" fill="${N}" stroke="${P}" stroke-width=".6"/>`);
    add(`<rect x="${f(lastD)}" y="${f(Math.min(crankY, cylY + cylH / 2) - 1.1)}" width="${f(cylX1 - lastD + 1)}" height="2.2" rx="1.1" fill="${N}" stroke="${P}" stroke-width=".5"/>`);
    if (spec.pilot) {
      const px = pilotX, pw = spec.pilot, py = fp + 4, h = 72.5 - py;
      add(`<rect x="${f(front - 1)}" y="${f(fp)}" width="${f(px - front + 3)}" height="4.5" rx="1" fill="${N}"/>`);
      add(`<path d="M${f(px)} ${f(py)} L${f(px + pw)} 72.5 L${f(px)} 72.5 Z" fill="${N}"/>`);
      [0.3, 0.55, 0.8].forEach(t => add(`<line x1="${f(px + 0.6)}" y1="${f(py + h * t)}" x2="${f(px + pw * (1 - t))}" y2="72" stroke="${P}" stroke-width=".75"/>`));
    } else add(`<rect x="${f(front)}" y="${f(fp - 2)}" width="3.5" height="8" fill="${N}"/>`);
    const top = Math.floor(Math.min(...plume.puffs.map(([x, y, r]) => y - r - 1), stTop - 1, cabTop - 6));
    return { w, top, svg: parts.join(''), geo: { drivers, leads, rd, rl, fp, front, pilotX, pilotW: spec.pilot, boilerTop, d: spec.d, stTop, stack: st, plume: plume.puffs, cabW: spec.cabW, cylX1, cylX2 } };
  }

  const types = {};
  for (const k of Object.keys(SPECS)) { const first = build(SPECS[k], 0); types[k] = build(SPECS[k], Math.max(0, SPECS[k].target - first.w)); }
  // a streamlined diesel: a different configuration (two six-wheel trucks), the longest body
  // D: a streamlined diesel of the late 1930s: smooth carbody with a rounded "bulldog" nose,
  // high windshield, porthole windows, speed lines sweeping down the nose, two six-wheel trucks
  // with disc wheels (no spokes, no rods) and a smooth pilot: clearly a different technology.
  const L = 206;
  const disc = (x, r) => `<g class="wh"><circle cx="${f(x)}" cy="${f(74 - r)}" r="${r}" fill="${N}"/><circle cx="${f(x)}" cy="${f(74 - r)}" r="${f(r - 1.7)}" fill="none" stroke="${P}" stroke-width=".7"/><circle cx="${f(x)}" cy="${f(74 - r)}" r="1.5" fill="${P}"/></g>`;
  const truck = xs => xs.map(x => disc(x, 7)).join('') + `<rect x="${xs[0] - 9}" y="60.5" width="${xs[2] - xs[0] + 18}" height="5" rx="2" fill="${N}"/><line x1="${xs[0] - 6}" y1="63" x2="${xs[2] + 6}" y2="63" stroke="${P}" stroke-width=".6"/>`;
  const t1 = [24, 40, 56], t2 = [L - 70, L - 54, L - 38];
  types.D = { w: L, top: 15, svg: `<rect x="0" y="74" width="${L}" height="2.2" fill="${N}"/>
    ${truck(t1)}${truck(t2)}
    <rect x="${t1[2] + 12}" y="60" width="${t2[0] - t1[2] - 24}" height="7" rx="3" fill="${N}"/><line x1="${t1[2] + 15}" y1="63.5" x2="${t2[0] - 15}" y2="63.5" stroke="${P}" stroke-width=".6"/>
    <path d="M4 62 V27 Q4 20 11 20 H${L - 50} C${L - 30} 20 ${L - 16} 27 ${L - 8} 39 Q${L - 2} 47 ${L - 2} 56 Q${L - 2} 65 ${L - 7} 71.5 H${L - 24} V62 Z" fill="${N}"/>
    <line x1="${L - 21}" y1="66.5" x2="${L - 4.5}" y2="66.5" stroke="${P}" stroke-width=".7"/>
    <path d="M${L - 44} 23.5 C${L - 32} 23.5 ${L - 23} 27.5 ${L - 17} 33.5 H${L - 44} Z" fill="${P}"/><line x1="${L - 31}" y1="24.3" x2="${L - 31}" y2="33.5" stroke="${N}" stroke-width="1.6"/>
    <rect x="${L - 58}" y="25" width="9" height="8.5" rx="1.2" fill="${P}"/>
    <circle cx="${L - 13.5}" cy="38.5" r="2.4" fill="${P}"/><circle cx="${L - 13.5}" cy="38.5" r="1.1" fill="${N}"/>
    <path d="M8 46 H${L - 26} Q${L - 12} 46 ${L - 3.5} 54" fill="none" stroke="${P}" stroke-width="1.5"/>
    <path d="M8 50.5 H${L - 24} Q${L - 12} 50.5 ${L - 3} 58" fill="none" stroke="${P}" stroke-width=".7"/>
    ${[66, 92, 118].map(x => `<circle cx="${x}" cy="32" r="4" fill="${P}"/><circle cx="${x}" cy="32" r="2.6" fill="none" stroke="${N}" stroke-width=".7"/>`).join('')}
    <rect x="10" y="25" width="8" height="17" rx="1.2" fill="none" stroke="${P}" stroke-width=".8"/><rect x="${L - 72}" y="25" width="8" height="17" rx="1.2" fill="none" stroke="${P}" stroke-width=".8"/>
    <rect x="30" y="17.5" width="${L - 96}" height="3" rx="1.5" fill="${N}"/>`, geo: null };

  // ---- the rules every engine must follow ----
  function check() {
    const out = [];
    const keys = Object.keys(SPECS);
    keys.forEach((k, i) => {
      const g = types[k].geo;
      const all = g.drivers.map(x => [x, g.rd]).concat(g.leads.map(x => [x, g.rl])).sort((a, b) => a[0] - b[0]);
      for (let j = 1; j < all.length; j++) if (all[j][0] - all[j - 1][0] < all[j][1] + all[j - 1][1] + 1) out.push(k + ': wheels overlap');
      if (g.leads.some(x => x < g.drivers[g.drivers.length - 1])) out.push(k + ': a small wheel is behind the drivers');
      {
        if (g.leads.some(x => x < g.cylX1 - 2 || x > g.cylX2)) out.push(k + ': a small wheel is not under the cylinder');
        if (g.cylX2 - g.cylX1 < 13) out.push(k + ': cylinder too small (' + (g.cylX2 - g.cylX1).toFixed(1) + ')');
        if (g.cylX1 < g.drivers[g.drivers.length - 1] + g.rd) out.push(k + ': cylinder overlaps a driving wheel');
      }
      const open = g.leads[0] - g.rl - (g.drivers[g.drivers.length - 1] + g.rd);
      if (!SPECS[k].frame && open > 22) out.push(k + ': empty span between drivers and small wheels (' + open.toFixed(0) + ')');
      if (g.pilotW && g.pilotX < g.leads[g.leads.length - 1] + g.rl + 3.5) out.push(k + ': cowcatcher too close to the front wheel');
      if (g.leads[g.leads.length - 1] + g.rl > g.front + 1.5) out.push(k + ': front wheel sticks out past the smokebox');
      if (g.drivers[0] - g.rd < 2) out.push(k + ': rear driver past the cab');
      const top = Math.min(...g.plume.map(([x, y, r]) => y - r));
      if (top < -72) out.push(k + ': steam leaves the drawing');
      if (Math.min(...g.plume.map(([x, y, r]) => x - r)) < 0) out.push(k + ': steam leaves the drawing at the back');
      if (i > 0) {
        const p = types[keys[i - 1]].geo, ps = SPECS[keys[i - 1]], s = SPECS[k];
        if (s.nd <= ps.nd) out.push(k + ': not more driving wheels than ' + keys[i - 1]);
        const step = types[k].w - types[keys[i - 1]].w;
        if (step < 20 || step > 30) out.push(k + ': length step from ' + keys[i - 1] + ' is ' + step + ' (want 20–30)');
        if (g.d <= p.d) out.push(k + ': boiler not bigger than ' + keys[i - 1]);
        if (g.boilerTop > p.boilerTop - 1.5) out.push(k + ': boiler top not higher than ' + keys[i - 1]);
        if (g.rd < p.rd - 0.6) out.push(k + ': driving wheels shrink too much from ' + keys[i - 1]);
        if (s.stack.w * s.stack.h <= ps.stack.w * ps.stack.h && s.stack.kind === ps.stack.kind) out.push(k + ': stack not bigger than ' + keys[i - 1]);
        if (g.cabW <= p.cabW) out.push(k + ': cab not bigger than ' + keys[i - 1]);
        if (g.stTop >= p.stTop) out.push(k + ': stack top not higher than ' + keys[i - 1]);
        if (s.stack.w * s.stack.h <= ps.stack.w * ps.stack.h * 0.95 && s.stack.kind === ps.stack.kind) out.push(k + ': stack not bigger than ' + keys[i - 1]);
        if (s.steam[0] <= ps.steam[0] || s.steam[1] < ps.steam[1] * 1.07) out.push(k + ': steam not clearly bigger than ' + keys[i - 1]);
        if (g.boilerTop > p.boilerTop - 2.5) out.push(k + ': boiler not clearly taller than ' + keys[i - 1]);
      }
    });
    if (types.D.w < types['6'].w) out.push('D shorter than 6');
    return out;
  }
  return { types, specs: SPECS, check };
};
