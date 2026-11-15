# Apex status (handoff file, updated in every step)

## Current state (Phase 1 complete, Phase 2 data engine in progress)
- Desktop app (Tauri 2, React, TS, Vite, Tailwind, Zustand, TanStack Query): shell, design system, Home, Profile + match detail, Champions, Champion page, Tier List, Live Game, Post-game recap, Draft (mock LCU + real connector), Settings.
- Local backend `services/api` (Fastify + Node SQLite): Riot client with rate limiter, retries and cache; data collector (all regions x ranks); stats endpoints; draft data; live game; recap.
- Mock data source still exists in the app (Settings > Data > Mock). **Removal is the next step** (see below).

## How to run
`copy services\api\.env.example services\api\.env`, put your key in `RIOT_API_KEY`, then `pnpm install`, `pnpm api`, `pnpm tauri dev` (Settings > Data > Local backend).

## Decisions
- Ranks are cumulative: "Emerald+" = Emerald IV and above. Collector reads every division ladder (I-IV) of every tier. A match is filed under the tier of the seed player it was found through.
- Riot limits are per routing host. Match-v5 uses 4 clusters (europe, americas, asia, sea), ladders/league use platform hosts. The collector picks its next player from the cluster with the fewest busy workers so all four limits stay in use.
- Network errors and Riot 5xx are retried (3 and 2 times, growing pause) inside `HttpRiot`; the final message names the real cause (ECONNRESET, ENOTFOUND, timed out ...).
- Collector status only shows an error while it is recent (3 min) or fatal (bad key).
- Tier list hides champions with too few games in a role: under max(50, 0.5% of the role's games). A champion only counts in a role when that role is >= 10% of its games.
- Champion display names come from Data Dragon on the client (`useChampName`), never the raw id.

## Known issues / limits
- A development key caps collection at roughly 3 games/s total (100 req / 2 min per cluster). Only a production key raises it.
- A player stays filed under the tier they were first seeded at (rank changes are not re-read until the weekly ladder refresh).
- LP history, skill orders: not collected yet (need timelines / snapshots). Draft engine falls back to synthetic data without collected games.

## Next steps
1. Remove the Mock data source and sample data from the app (keep the mock LCU for champ select testing); make Local backend the only source; rewrite the e2e tests onto the fake-Riot test API (`services/api/src/fake-server.ts`).
2. Item sets and real rune pages from collected data; skill order from timelines.
3. Roadmap P2: matchup/synergy tables, patch deltas, overlay v1.
