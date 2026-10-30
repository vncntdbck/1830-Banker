# 1830 Banker

A one-screen iPad tool for the banker in *1830: Railways & Robber Barons*: it does the payout
arithmetic so the table can focus on the game. Designed for a 13" iPad Pro in landscape.

- One web page (`index.html`), no server, no accounts, no tracking, no outside code.
- Works offline once opened from the Home Screen; the game is stored only on the iPad.

## Put it on the iPad
1. Open the site address in **Safari** on the iPad.
2. Tap the **Share** button (square with an arrow), then **Add to Home Screen**, then **Add**.
3. Open **1830 Banker** from the Home Screen once while online. After that it also works offline.

## For developers
See `CLAUDE.md` (goal, design rules, decisions) and `RULES.md` (every rule, with rulebook page).
Tests: `node --test`. Browser checks: `npm install && npx playwright install chromium && npm run check`.
