# 1830 Banker

## Goal
A one-screen iPad web app that does the payout arithmetic for the banker in
*1830: Railways & Robber Barons* (Lookout edition), so the table can focus on strategy.
Zero friction: a company whose snapshot didn't change takes exactly **1 tap**
(select company → payouts on screen). The owner is not a developer.

Rules authority: the rulebook PDF in the claude.ai project. Every rule the app uses is in
`RULES.md` with its section and page.

## The snapshot principle (do not break this)
- Each company has one snapshot: its trains and the city values of each run.
- When a company operates, the banker compares the snapshot with the board and edits only
  what changed. If nothing changed, nothing is touched.
- The app keeps no other bookkeeping and records nothing between turns.
- It never derives warnings from a snapshot (it may be out of date). No per-company warnings.
- It only automates what is always true: the phase rules, and rusted trains disappearing.

Out of scope: map/route finding, player cash, share ownership, stock market, recording
pay-out/withhold, OR counting, private auction, end-game scoring, recording train purchases
as they happen.

## Files
- `index.html` — the whole app, one file. It holds the design tokens (`:root` in the main
  `<style>`), three generated blocks (embedded fonts, ornaments, locomotive drawings) and two scripts:
  - `<script id="core">` — pure rules + state logic (phase table, runs, payouts, rusting,
    auto-advance, undo, persistence). No DOM. Tests load it straight out of this file.
  - `<script id="app">` — the screen.
- `manifest.webmanifest`, `sw.js`, `icons/` — Home Screen + offline support. `index.html`
  only uses them when it is served from its own site (not inside claude.ai's frame, not from
  `file://`). There is one copy of the app code: never fork it.
- `test/` — `node --test` suites (rules, scripted game, design guard: tokens only + WCAG AA contrast).
- `tools/design/` — `make-design.js` regenerates the fonts, ornaments and locomotives inside
  `index.html` from the tokens; `locos.js` (the six engines); `fonts/` (OFL fonts + licences).
- `tools/` — `load-core.js` (test loader), `shots.js` (renders 3 window sizes and measures),
  `check-page.js` (real clicks/taps, reload, hosted mode, offline, SW list),
  `make-icons.js` + `icon.svg` (icon source).

## Commands
```
node --test                                   # rules and state (no install needed)
npm install                                   # once, for the browser checks
npx playwright install chromium               # once
node tools/check-page.js                      # drive the real page, hosting, offline
node tools/shots.js shots                     # screenshots + layout measurements
node tools/device-preview.js preview.png      # the app on an iPad Pro 13" (corners, status bar)
node tools/make-icons.js                      # redraw the app icon from the tokens + locomotive
node tools/design/make-design.js              # after changing a colour token or a locomotive
```

## Hosting (GitHub Pages)
Publish the folder root as-is (`index.html` at the root). Whenever any served file changes,
bump `VERSION` in `sw.js` and keep its `FILES` list equal to: `index.html`,
`manifest.webmanifest` and every file in `icons/` (`tools/check-page.js` checks this).
On the iPad: open the site in Safari → Share → Add to Home Screen.

## Decisions
- Screen designed once at 1376×1032 (13" iPad Pro M4, landscape) and scaled uniformly to fit
  any window. It keeps a small 10 pt breathing margin inside the safe area (status bar 24 pt,
  home indicator 20 pt): enough that the frame isn't cramped against the edge and clears the
  iPad's large rounded screen corners, small enough that nothing gets needlessly smaller
  (`tools/device-preview.js` shows and checks this).
- Touch targets are 56–64 units: ≥ 52 pt on the iPad Home Screen app, ≥ 50 pt in Safari.
  All above Apple's 44 pt minimum.
- App icon: ivory certificate with double frame and corner rosettes around the classic
  American steam engine (the 4-train engine) in navy; drawn by `tools/make-icons.js` from the
  same locomotive source and tokens. Tenders carry coal only (no wood), for simplicity.
- Payout panel: the total payout is the largest number on screen (it is also what the treasury
  gets on withhold); below it each holding 10%–60% with what it receives, in large type, so a
  player can read their amount from across the table.
- Phase rules get the full top row in large type; a rule that changed in this phase is red with NEW.
- The Next line shows what the next phase changes (rusting in red). Only its "Start phase N"
  button advances the phase; tapping the text does nothing. Undo sits next to it (it undoes
  anything: values, trains, a phase change, even New game); New game is at the far edge.
- Company cards: double frame + top band in the company colour on ivory. The selected company
  keeps exactly that double frame (outer line, ivory gap, inner line); everything inside the
  inner line fills with its colour.
- Train cards: number plate + an engraved locomotive per type (locomotive only, no tender).
  `tools/design/locos.js` builds each engine from a small spec and enforces rules
  (`check()`, run by make-design.js, which refuses to build if one breaks): every wheel on the
  rail; small wheels only at the front under the cylinder; cowcatcher clear of the front wheel;
  from 2 to 6 strictly more driving wheels (1–5), longer (+20 each), taller boiler, bigger cab,
  higher and bigger stack, more and bigger steam. 6 = flared stack, 3 domes, tall one-window cab.
  D = streamlined diesel locomotive (cab window, louvres, two six-wheel trucks).
- Swipe left/right on the payout panel = next/previous company (row order, wraps). Only there,
  so it cannot interfere with entering values. Tapping a company stays the main way.
- The screen is kept awake while the app is open (Screen Wake Lock, where the browser allows).
- The per-company panel is titled "<company> trains & runs" (the snapshot is the concept; the
  word is not used on screen).
- Train cards are sorted by size. New train = highlighted. City chips fill the highlighted
  train, then move to the next train with room. Tapping a city removes it and highlights that
  train, so changing one value is 2 taps.
- Undo: 50 steps, saved with the state in localStorage after every tap. Only edits are undo
  steps (selecting a company is not). Undo returns to the company that was changed.
- A phase change (manual or automatic) is one undo step; undo restores rusted trains.
- While the phase-change view is open, every tap except its Undo only closes it.
- New game: tap twice (second tap within 3.5 s); it is undoable.
- Add-train buttons show "starts phase N" for types that would advance the phase, and are
  disabled for rusted types or at 4 trains.
- Diesel capped at 21 cities (rules: no maximum) so the layout can't overflow.
- Company colours: PRR green, NYC black, CPR red, B&O blue, C&O light blue, Erie yellow,
  NNH orange, B&M light green; confirmed by the owner against his game.
- No real railroad logos or look-alikes: they are trademarks / the publisher's artwork. Companies
  are identified by colour + initials, as on the charters and tokens.

## Design rules ("the certificate")
The screen is set as one engraved 19th-century certificate: elegant, restrained, never costume.
Change the look only through the tokens in `:root`, then run `node tools/design/make-design.js`.
- **Palette:** ivory paper (`--paper`, `--paper-2`, `--paper-3`), one navy engraving ink
  (`--ink`, `--ink-2`, `--rule`), one vermilion accent (`--accent`) used only for state that
  needs attention: NEW, rusting, the train being filled, a one-city run, armed New game.
  Company colours are the functional code and appear only on company buttons, the snapshot
  title square and the selected fill. Tile colours appear only as phase swatches.
- **Type:** Bodoni Moda (Didone) for names, money and the phase number; Barlow Condensed for
  labels and rules; Bodoni italic for quiet phrases. All figures lining + tabular. Embedded,
  so nothing is downloaded. Hierarchy: total payout > holding amounts > phase number > rules.
- **Ornament:** only on frames and headers: the page frame with corner rosettes, double rules
  (`--double`), guilloche bands under headings, the cartouche around the total, dotted leaders
  in the ladder, the engraved locomotives. Never inside data (city values, chips, amounts).
- **Restraint:** flat colours only; no textures. One filled control at a time draws the eye
  (Start phase, Done, the selected company).
- **Motion:** small engraved-ink gestures, 0.2–0.55 s, never blocking a tap: a new city value
  lands like a stamp, changed amounts rise into place, a new train rolls in with a little chug,
  the selected company's colour pours in, the payout slides when the company changes, the
  phase-change sheet unfolds, buttons press in slightly. All off under "Reduce Motion".
- **Forbidden:** fake paper textures, stains, wood grain, Western/"Wanted poster" fonts, real
  railroad logos or look-alikes, more than one accent colour, ornament inside numbers.
- **Checks:** `node --test` fails on any raw colour or font outside the tokens, or a text
  colour pair below WCAG AA (4.5:1). `node tools/shots.js shots` checks layout at 3 sizes.
