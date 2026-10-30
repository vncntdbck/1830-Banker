# 1830 Banker

A one-screen iPad tool for the banker in *1830: Railways & Robber Barons*: it does the payout
arithmetic so the table can focus on the game. Designed for a 13" iPad Pro in landscape.

- One web page (`index.html`), no server, no accounts, no tracking, no outside code.
- Works offline once opened from the Home Screen; the game is stored only on the iPad.

## Put it on the iPad
1. Open the site address in **Safari** on the iPad.
2. Tap the **Share** button (square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open **1830 Banker** from the Home Screen once while online. After that it also works offline.

Site address: https://vncntdbck.github.io/1830-Banker/

## Get an update
Open the app, swipe it away (swipe up, then away) and open it again: it fetches the new version
by itself. The Home Screen icon may stay the old one: delete the app from the Home Screen and
add it again from Safari to get the new icon. The game on the iPad is kept either way.

## What it does
- Phase rules always on screen; the next phase and what it changes; rusted trains disappear.
- Per company: its trains and the city values of each run, stamped in with rubber stamps.
- The total payout and what every holding of 10%–60% receives, readable across the table.
- A steam whistle when a new phase begins (a diesel horn for the first diesel); can be
  switched off in the phase-change view. All motion is off under iPad "Reduce Motion".

## For developers
See `CLAUDE.md` (goal, design rules, decisions) and `RULES.md` (every rule, with rulebook page).
Tests: `node --test`. Browser checks: `npm install && npx playwright install chromium && npm run check`.
