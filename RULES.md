# Rules the app uses

Source: the 1830: Railways & Robber Barons rulebook in this project (`Rules_1830-RE_EN.pdf`, 28 pages).
Section numbers and page numbers refer to that PDF. Where the app goes beyond the rulebook, it says so.

## Phases

| Rule | Value in the app | Rulebook |
|---|---|---|
| A phase starts with the purchase of the first train of a new type, immediately after that purchase | Tapping "Next" or adding a later train type starts the phase at once | §2.0 p.10, note p.10 |
| Phase 1 is the private auction; phase 2 starts when all privates are sold | App starts in phase 2 (auction out of scope) | §2.1, §2.2 p.10; p.27 |
| Phase 2: yellow tiles · limit 4 · companies can't buy privates · 1 OR per set · off-board lower | as stated | §2.2 p.10; p.27 |
| Phase 3 (first 3-train): + green · limit 4 · companies may buy privates · 2 ORs · off-board lower | as stated | §2.3 p.10; p.27 |
| Phase 4 (first 4-train): limit 3 · all 2-trains removed · 2 ORs · off-board lower | as stated | §2.4 p.10; p.27 |
| Phase 5 (first 5-train): + brown · limit 2 · all privates close · 3 ORs · off-board higher | as stated | §2.5 p.10; §3.2 p.11; p.27 |
| Phase 6 (first 6-train): limit 2 · all 3-trains removed · diesels may be bought · 3 ORs · off-board higher | as stated | §2.6 p.11; p.27 |
| Phase 7 (first diesel): limit 2 · all 4-trains removed · 3 ORs · off-board higher; lasts until the end | "Final phase", Next does nothing | §2.7 p.11; note p.23; p.27 |
| The new number of ORs starts after the stock round following the trigger (phases 3 and 5) | Shown as "from next SR" and in the phase-change view | §2.3, §2.5 p.10 |
| Everything else (tiles, limit, rusting, privates, off-board) applies immediately | Phase-change view lists it as "do this now" | note p.10; §6.5 p.22 ("after the first 5-train is purchased, use the greater values") |

## Trains

| Rule | Value in the app | Rulebook |
|---|---|---|
| Trains are bought from the bank in increasing size; a type only appears once the smaller ones are sold | Basis for auto-advance: a train's existence proves its phase has started | §6.6 p.23 |
| Diesels can be bought once the first 6-train is bought, alongside remaining 6-trains | Diesel price shown from phase 6 | §2.6 p.11; §6.6 p.23 |
| Diesel costs $1100, or $800 trading in a 4-, 5- or 6-train; the trade-in is legal even at 2 trains | Shown in "Now" from phase 6 and in the phase-6 view | §6.6 p.23 |
| Train limit 4 / 4 / 3 / 2 / 2 / 2 in phases 2–7 | "Train limit" in "Now" | §2.2–2.7 p.10–11; §6.6.1 p.23; p.27 |
| Excess trains: the president discards to the bank pool, no payment; highest share value decides first | Listed in the phase 4 and 5 views; the app does not choose which train | §6.6.1 p.23 |
| Obsolete trains are removed from play: 2-trains at phase 4, 3-trains at 6, 4-trains at 7 | Removed from every snapshot on the phase change; undo restores them | §2.4, §2.6, §2.7 p.10–11; p.27 |
| No company can ever hold more than 4 trains | Snapshot holds at most 4 trains | §2.2, §2.3 p.10 |

## Runs and revenue

| Rule | Value in the app | Rulebook |
|---|---|---|
| A train runs a route of 2 or more cities, at most its number; a diesel has no maximum | Cards hold 2..N cities; a 1-city run counts 0 and says so | §6.4, §6.4.1 p.21; §6.5 p.22 ("a minimum of 2") |
| Off-board red areas count as cities; they have a lower and a higher value | Entered as a city chip; the banker enters the value printed for the current phase | §6.4 note p.21; §6.5 p.22 |
| A train's revenue is the sum of the city values on its route | Run total on each card | §6.5 p.22 |
| A railroad's revenue is the total of all its runs | Company total, "Total revenue" | §6.5 p.22 |
| Withhold: the whole revenue goes to the treasury | "treasury gets this on withhold" | §6.5 p.22 |
| Pay out: each 10% share receives 10% of the revenue | Per-10% figure and 20%–60% ladder | §6.5 p.22 |
| Shares in the bank pool pay the company treasury; unsold initial-offering shares pay nothing | Static line under the ladder | §6.5 p.22 |

## Interpretations (where the app had to decide)

1. **Diesel availability.** The p.27 table lists Diesels under phase 7 as "new trains available", but §2.6 and §6.6 say diesels may be bought from the first 6-train on. The app follows §2.6/§6.6 (and your spec): diesel price shown from phase 6; the first diesel starts phase 7.
2. **"New" in phase 2.** Phase 1 has no tile, limit or OR values on p.27, so nothing is marked "new" in phase 2.
3. **Auto-advance can skip phases.** Adding a 5-train in phase 3 goes straight to phase 5 and applies phase 4's rusting too, because a 5-train cannot exist before every 4-train is sold (§6.6). A diesel added before phase 6 jumps to phase 7. It is one undo step.
4. **Diesel route cap.** The rules set no maximum (§6.4.1). The app caps a diesel at 21 cities so the screen can never overflow; that is far beyond any route on the 1830 map.
5. **Off-board values at phase 5.** The app does not change any snapshot when off-board values go up; the phase-5 view tells the banker to check runs that use a red area (snapshot principle).
6. **Private-company revenue** (paid to a company that owns a private, §6.5 note p.22) is not part of train revenue and is not shown.
