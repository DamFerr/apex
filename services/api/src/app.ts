import cors from "@fastify/cors";
import Fastify from "fastify";
import type { ChampionDetail, ChampionList, FilterOptions, PoolEntry, ChampionSummary, MatchPage, Role, StatLine, Summoner } from "@apex/schema";
import type { Cache } from "./db";
import type { DD } from "./ddragon";
import type { Collector } from "./collector";
import type { Store } from "./store";
import { toMastery, toMatchDetail, toMatchSummary, toSummoner } from "./mapping";
import { HttpError, PLATFORM_IDS, regionOf, type RiotApi, type RiotMatch } from "./riot";
import { TIERS } from "./collector";
import type { Filter } from "./store";

export interface Deps { riot: RiotApi; cache: Cache; dd: () => Promise<DD>; store: Store; collector: Collector; defaultPlatform: string; hasKey?: boolean; now?: () => number }
const MIN = 60_000, DAY = 24 * 60 * MIN;

export async function buildApp(deps: Deps) {
  const { riot, cache, store, collector } = deps,
    dd = async () => { try { return await deps.dd(); } catch { throw new HttpError(502, "Could not load game data from Riot's Data Dragon (offline?)"); } }, now = deps.now ?? (() => Date.now());
  const app = Fastify({ logger: false });
  // Only the app itself (browser dev server or the Tauri window) may call this service.
  await app.register(cors, { origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^(https?|tauri):\/\/tauri\.localhost$/, "tauri://localhost"] });

  async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttl) return JSON.parse(hit.value) as T;
    const value = await fn(); cache.set(key, JSON.stringify(value), now()); return value;
  }
  const REGIONS = ["europe", "americas", "asia", "sea"];
  function parseRiotId(raw: string): [string, string] {
    const i = raw.lastIndexOf("#");
    if (i < 1 || i === raw.length - 1) throw new HttpError(400, "Riot ID must look like Name#TAG");
    return [raw.slice(0, i), raw.slice(i + 1)];
  }
  /** Resolves a Riot ID to a puuid. Riot IDs are global, so no region is needed (cached for a day). */
  async function identity(raw: string) {
    const [name, tag] = parseRiotId(raw);
    return cached(`acct:${name.toLowerCase()}#${tag.toLowerCase()}`, DAY, () => riot.account(name, tag, regionOf(deps.defaultPlatform)));
  }
  /**
   * Finds which region a player plays on, so searches need no region. Match ids start with the platform ("EUW1_..."), so
   * asking each regional cluster for one recent match is enough (1 to 4 requests). Players without recent matches fall back
   * to asking each platform for their summoner. Cached for a week.
   */
  async function homePlatform(puuid: string): Promise<string> {
    return cached(`home:${puuid}`, 7 * DAY, async () => {
      const first = regionOf(deps.defaultPlatform);
      for (const region of [first, ...REGIONS.filter((r) => r !== first)]) {
        const [id] = await riot.matchIds(puuid, region, 0, 1);
        const platform = id?.split("_")[0]?.toLowerCase();
        if (platform && PLATFORM_IDS.includes(platform)) return platform;
      }
      for (const platform of [deps.defaultPlatform, ...PLATFORM_IDS.filter((p) => p !== deps.defaultPlatform)]) {
        try { await riot.summoner(puuid, platform); return platform; } catch (e) { if (!(e instanceof HttpError && e.status === 404)) throw e; }
      }
      throw new HttpError(404, "Could not find this player in any region");
    });
  }
  const matchOf = (id: string, region: string) => cached<RiotMatch>(`match:${id}`, Infinity, () => riot.match(id, region)); // matches never change

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    console.error("Unexpected error:", err instanceof Error ? err.message : err);
    return reply.code(500).send({ error: "Unexpected server error" });
  });

  app.get("/health", async () => ({ ok: true, hasKey: deps.hasKey ?? true }));

  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId", async (req) => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    return cached<Summoner>(`profile:${platform}:${acct.puuid}`, 5 * MIN, async () => {
      const [s, entries] = await Promise.all([riot.summoner(acct.puuid, platform), riot.league(acct.puuid, platform)]);
      return { ...toSummoner(`${acct.gameName}#${acct.tagLine}`, s.summonerLevel, entries), platform };
    });
  });

  app.get<{ Params: { riotId: string }; Querystring: { cursor?: string; limit?: string } }>("/v1/players/:riotId/matches", async (req): Promise<MatchPage> => {
    const acct = await identity(req.params.riotId), region = regionOf(await homePlatform(acct.puuid));
    const cursor = Math.max(0, Number(req.query.cursor ?? 0) || 0), limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 10) || 10));
    const ids = await cached<string[]>(`ids:${acct.puuid}:${cursor}:${limit}`, 2 * MIN, () => riot.matchIds(acct.puuid, region, cursor, limit));
    const items = (await Promise.all(ids.map(async (id) => toMatchSummary(await matchOf(id, region), acct.puuid)))).filter((m) => m !== null);
    return { items, nextCursor: ids.length === limit ? cursor + limit : null };
  });

  app.get<{ Params: { id: string }; Querystring: { riotId?: string } }>("/v1/matches/:id", async (req) => {
    const prefix = req.params.id.split("_")[0]?.toLowerCase() ?? "";
    if (!PLATFORM_IDS.includes(prefix)) throw new HttpError(400, "Unknown match id");
    const match = await matchOf(req.params.id, regionOf(prefix));
    const puuid = req.query.riotId ? (await identity(req.query.riotId)).puuid : undefined;
    return toMatchDetail(match, puuid);
  });

  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId/mastery", async (req) => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid);
    const list = await cached(`mastery:${platform}:${acct.puuid}`, 10 * MIN, () => riot.mastery(acct.puuid, platform, 8));
    return toMastery(list, (await dd()).champs);
  });

  // ---- Champion statistics, computed from the games the collector has stored ----
  const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  /** patch: latest (default) | all | 16.22. region: all | euw1 ... rank: all | EMERALD. A rank always means that tier AND ABOVE ("EMERALD+" is accepted too). */
  function filterOf(q: { patch?: string; region?: string; rank?: string }): Filter {
    const patch = q.patch === "all" ? undefined : q.patch && q.patch !== "latest" ? q.patch : store.latestPatch();
    const platform = q.region && q.region !== "all" ? q.region.toLowerCase() : undefined;
    let brackets: string[] | undefined;
    if (q.rank && q.rank !== "all") {
      const tier = q.rank.replace("+", "").toUpperCase(), i = TIERS.indexOf(tier);
      if (i < 0) throw new HttpError(400, `Unknown rank "${q.rank}"`);
      brackets = TIERS.slice(i); // Emerald means Emerald IV and everything above it
    }
    return { patch, platform, brackets };
  }
  const roleOfQuery = (r?: string) => (r && ROLES.includes(r) ? (r as Role) : undefined);

  async function summaries(f: ReturnType<typeof filterOf>, role?: Role): Promise<{ list: ChampionSummary[]; total: number }> {
    const { champs } = await dd(), byId = new Map([...champs].map(([key, c]) => [c.id, { key, ...c }])), bans = new Map(store.bans(f).map((b) => [b.k, b.n]));
    const per = new Map<string, { games: number; wins: number; roles: { role: Role; games: number }[] }>();
    for (const r of store.championRows(f, role)) {
      const e = per.get(r.champion) ?? { games: 0, wins: 0, roles: [] };
      e.games += r.games; e.wins += r.wins; if (r.role) e.roles.push({ role: r.role as Role, games: r.games }); per.set(r.champion, e);
    }
    const list = [...per].flatMap(([id, e]) => {
      const c = byId.get(id); if (!c) return [];
      return [{ id, name: c.name, tags: c.tags ?? [], games: e.games, wins: e.wins, bans: bans.get(c.key) ?? 0,
        roles: e.roles.filter((x) => x.games >= Math.max(2, e.games * 0.1)).sort((a, b) => b.games - a.games).map((x) => x.role) }];
    });
    return { list, total: store.matchCount(f) };
  }

  app.get<{ Querystring: { role?: string; patch?: string; region?: string; rank?: string } }>("/v1/champions", async (req): Promise<ChampionList> => {
    const f = filterOf(req.query), { list, total } = await summaries(f, roleOfQuery(req.query.role));
    return { patch: f.patch ?? "all", totalGames: total, champions: list };
  });

  app.get<{ Params: { id: string }; Querystring: { patch?: string; region?: string; rank?: string } }>("/v1/champions/:id", async (req): Promise<ChampionDetail> => {
    const f = filterOf(req.query), { list, total } = await summaries(f), me = list.find((c) => c.id === req.params.id);
    if (!me) throw new HttpError(404, "No collected games for this champion with these filters");
    const data = await dd(), line = (name: string, r: { games: number; wins: number }): StatLine => ({ name, games: r.games, wins: r.wins });
    const nameOf = (id: string) => [...data.champs.values()].find((c) => c.id === id)?.name ?? id;
    const completed = store.items(req.params.id, f).filter((i) => { const it = data.items.get(i.id); return it && it.total >= 2000 && !it.hasUpgrade; }); // finished items only
    return { ...me, totalGames: total,
      builds: completed.slice(0, 6).map((i) => line(data.items.get(i.id)!.name, i)),
      runes: store.keystones(req.params.id, f).map((k) => line(data.runes.get(k.id) ?? `Rune ${k.id}`, k)),
      skillOrder: [], // needs match timelines, which the collector does not fetch yet
      matchups: store.matchups(req.params.id, f).map((m) => line(nameOf(m.name), m)) };
  });

  /** Every region and rank is always offered (counts may be zero while the collector fills in). Ranks are cumulative: Emerald = Emerald and above. */
  app.get("/v1/filters", async (): Promise<FilterOptions> => {
    const f = store.facets(), count = (list: { id: string; matches: number }[], id: string) => list.find((x) => x.id === id)?.matches ?? 0;
    return { platforms: PLATFORM_IDS.map((id) => ({ id, matches: count(f.platforms, id) })), patches: f.patches,
      ranks: TIERS.map((id, i) => ({ id, matches: TIERS.slice(i).reduce((s, t) => s + count(f.ranks, t), 0) })) };
  });
  app.get<{ Querystring: { patch?: string; region?: string; rank?: string } }>("/v1/draft/data", async (req) => {
    const f = filterOf(req.query);
    return cached(`draft:${JSON.stringify(f)}`, 10 * MIN, async () => ({ ...store.draftStats(f), patch: f.patch ?? "all" }));
  });
  /** Your own recent champion pool (last 20 games) plus top mastery, for personalised draft suggestions. */
  app.get<{ Params: { riotId: string } }>("/v1/players/:riotId/pool", async (req): Promise<PoolEntry[]> => {
    const acct = await identity(req.params.riotId), platform = await homePlatform(acct.puuid), region = regionOf(platform), data = await dd();
    const ids = await cached<string[]>(`ids:${acct.puuid}:0:20`, 2 * MIN, () => riot.matchIds(acct.puuid, region, 0, 20));
    const pool = new Map<string, PoolEntry>();
    for (const id of ids) {
      const s = toMatchSummary(await matchOf(id, region), acct.puuid); if (!s) continue;
      const e = pool.get(s.champion) ?? { champion: s.champion, games: 0, wins: 0, points: 0 }; e.games++; if (s.win) e.wins++; pool.set(s.champion, e);
    }
    for (const m of toMastery(await cached(`mastery:${platform}:${acct.puuid}`, 10 * MIN, () => riot.mastery(acct.puuid, platform, 8)), data.champs)) {
      const e = pool.get(m.champion) ?? { champion: m.champion, games: 0, wins: 0, points: 0 }; e.points = m.points; pool.set(m.champion, e);
    }
    return [...pool.values()].sort((x, y) => y.games - x.games || y.points - x.points);
  });

  // ---- Collector control (POSTs need a custom header, so other websites cannot trigger them from your browser) ----
  const guard = (req: { headers: Record<string, unknown> }) => { if (req.headers["x-apex"] !== "1") throw new HttpError(403, "Missing X-Apex header"); };
  const collectorStatus = () => ({ ...collector.status, ...store.counts(), latestPatch: store.latestPatch() ?? null, ladders: collector.progress(), workers: collector.cfg.concurrency });
  app.get("/v1/collector", async () => collectorStatus());
  app.post("/v1/collector/start", async (req) => { guard(req); collector.start(); return collectorStatus(); });
  app.post("/v1/collector/stop", async (req) => { guard(req); await collector.halt(); return collectorStatus(); });
  return app;
}
