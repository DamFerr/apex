import { guessRoles as rolesFor } from "@apex/draft-engine";
import { fetchDdChampions } from "../ddragon";
import type { ApexApi, PostGameRecap, LiveGame, LivePlayer, ChampionDetail, ChampionSummary, MatchDetail, MatchSummary, Participant, Role, Summoner } from "@apex/schema";

const delay = <T,>(v: T, ms = 350) => new Promise<T>((r) => setTimeout(() => r(v), ms));
export const RIOT_ID_RE = /^.{3,16}#[A-Za-z0-9]{2,5}$/;

/** Small seeded PRNG so mock data is identical on every launch. */
function rng(seed: number) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CHAMPS = ["Ahri", "Orianna", "Viktor", "Syndra", "Ezreal", "Jinx", "Lee Sin", "Thresh", "Garen", "Ornn", "Lux", "Yasuo"];
const ROLES: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
const QUEUES = ["Ranked Solo", "Ranked Solo", "Ranked Solo", "Ranked Flex", "Normal Draft"];
const TOTAL = 45;

const matches: MatchSummary[] = Array.from({ length: TOTAL }, (_, i) => {
  const r = rng(i + 1), pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  return {
    id: `MOCK_${1000 + i}`, champion: pick(CHAMPS.slice(0, 5)), role: pick(ROLES), win: r() < 0.54,
    kills: Math.floor(r() * 12), deaths: 1 + Math.floor(r() * 9), assists: 2 + Math.floor(r() * 14),
    cs: 120 + Math.floor(r() * 140), durationSec: 1300 + Math.floor(r() * 1000), queue: pick(QUEUES),
    playedAt: new Date(Date.UTC(2026, 10, 12, 20, 0) - i * 5 * 3600_000).toISOString(),
  };
});

function detail(id: string): MatchDetail {
  const idx = matches.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error("Match not found");
  const m = matches[idx], r = rng(900 + idx), n = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo));
  const participants: Participant[] = Array.from({ length: 10 }, (_, i) => {
    const you = i === 0;
    return {
      name: you ? "You" : `Player ${i + 1}`, champion: you ? m.champion : CHAMPS[n(0, CHAMPS.length)],
      team: i < 5 ? "blue" : "red", isYou: you,
      kills: you ? m.kills : n(0, 12), deaths: you ? m.deaths : n(1, 10), assists: you ? m.assists : n(1, 16),
      cs: you ? m.cs : n(20, 280), damage: n(8000, 38000), gold: n(7000, 18000), vision: n(8, 60),
    };
  });
  return { id, blueWon: m.win, participants };
}

// ---- Champions (mock aggregates; the real ones come from the backend in Phase 2) ----
const DEFS: [string, string, Role[], string[]][] = [
  ["Ahri", "Ahri", ["MID"], ["Mage", "Assassin"]], ["Orianna", "Orianna", ["MID"], ["Mage"]],
  ["Viktor", "Viktor", ["MID"], ["Mage"]], ["Syndra", "Syndra", ["MID"], ["Mage"]],
  ["Ezreal", "Ezreal", ["ADC"], ["Marksman", "Mage"]], ["Jinx", "Jinx", ["ADC"], ["Marksman"]],
  ["Ashe", "Ashe", ["ADC", "SUPPORT"], ["Marksman"]], ["LeeSin", "Lee Sin", ["JUNGLE"], ["Fighter", "Assassin"]],
  ["Khazix", "Kha'Zix", ["JUNGLE"], ["Assassin"]], ["Thresh", "Thresh", ["SUPPORT"], ["Support", "Tank"]],
  ["Leona", "Leona", ["SUPPORT"], ["Tank", "Support"]], ["Lulu", "Lulu", ["SUPPORT"], ["Support", "Mage"]],
  ["Garen", "Garen", ["TOP"], ["Fighter", "Tank"]], ["Ornn", "Ornn", ["TOP"], ["Tank", "Fighter"]],
  ["Darius", "Darius", ["TOP"], ["Fighter", "Tank"]], ["Lux", "Lux", ["MID", "SUPPORT"], ["Mage", "Support"]],
  ["Yasuo", "Yasuo", ["MID", "TOP"], ["Fighter", "Assassin"]], ["Zed", "Zed", ["MID"], ["Assassin"]],
  ["Aurora", "Aurora", ["MID", "TOP"], ["Mage", "Assassin"]],
];
const TOTAL_GAMES = 60000;
const base: ChampionSummary[] = DEFS.map(([id, name, roles, tags], i) => {
  const r = rng(5000 + i);
  // The last entry is deliberately tiny (22 games, 18 wins) to demo the "low data" badge and shrinkage.
  if (i === DEFS.length - 1) return { id, name, roles, tags, games: 22, wins: 18, bans: 40 };
  const games = 900 + Math.floor(r() * 9000);
  return { id, name, roles, tags, games, wins: Math.round(games * (0.46 + r() * 0.1)), bans: Math.floor(games * r() * 0.9) };
});
// Once Data Dragon loads, every champion gets mock stats (deterministic per champion). Offline, the 19 above remain.
let champs: ChampionSummary[] = base;
const ready = fetchDdChampions().then((list) => {
  champs = list.map((d) => {
    const r = rng(5000 + d.key), roles = rolesFor(d.tags), rare = r() < 0.03;
    const games = rare ? 15 + Math.floor(r() * 30) : 400 + Math.floor(r() * 9000);
    return { id: d.id, name: d.name, roles, tags: d.tags, games, wins: Math.round(games * (rare ? 0.7 : 0.46 + r() * 0.1)), bans: Math.floor(games * r() * 0.9) };
  });
}).catch(() => undefined);
const ITEMS = ["Luden's Companion", "Shadowflame", "Rabadon's Deathcap", "Zhonya's Hourglass", "Kraken Slayer", "Infinity Edge", "Sunfire Aegis", "Trinity Force", "Void Staff"];
const RUNES = ["Electrocute", "Arcane Comet", "Phase Rush", "Conqueror", "Fleet Footwork", "Press the Attack", "Aftershock"];
function champDetail(id: string): ChampionDetail {
  const c = champs.find((x) => x.id === id);
  if (!c) throw new Error("Champion not found");
  const r = rng(7000 + champs.indexOf(c)), line = (name: string, base: number): { name: string; games: number; wins: number } => {
    const games = Math.max(5, Math.floor(c.games * base * (0.5 + r() * 0.5)));
    return { name, games, wins: Math.round(games * (0.44 + r() * 0.14)) };
  };
  const keys = ["Q", "W", "E"].sort(() => r() - 0.5);
  return {
    ...c, totalGames: TOTAL_GAMES,
    builds: [0, 1, 2].map((i) => line(`${ITEMS[(i * 3) % 9]} > ${ITEMS[(i * 3 + 1) % 9]} > ${ITEMS[(i * 3 + 2) % 9]}`, [0.5, 0.3, 0.12][i])),
    runes: [0, 1, 2].map((i) => line(RUNES[(champs.indexOf(c) + i) % RUNES.length], [0.55, 0.3, 0.1][i])),
    skillOrder: ["R", ...keys],
    matchups: champs.filter((o) => o.id !== id).slice(0, 10).map((o) => line(o.name, 0.04)),
  };
}

const mastery = DEFS.slice(0, 8).map(([champion, name], i) => {
  const points = Math.round(310000 / (1 + i * 0.7) + rng(300 + i)() * 8000);
  return { champion, name, points, level: Math.min(10, 4 + Math.floor(points / 30000)) };
});
const lpHistory = (() => { const r = rng(77); let lp = 40; return Array.from({ length: 30 }, (_, i) => ({ label: `Game ${i + 1}`, lp: (lp = Math.max(0, Math.min(99, lp + Math.round((r() - 0.45) * 40)))) })); })();

const pool = mastery.map((m, i) => { const r = rng(400 + i)(), games = Math.round(m.points / 9000) + 3; return { champion: m.champion, games, wins: Math.round(games * (0.44 + r * 0.22)), points: m.points }; });

/** A fixed demo lobby. Any Riot ID starting with "Offline" is reported as not in a game, to demo that state. */
function liveDemo(riotId: string): LiveGame {
  const picks = DEFS.slice(0, 10), r = rng(31337), tiers = ["GOLD", "PLATINUM", "EMERALD", "EMERALD", "DIAMOND"] as const;
  const players: LivePlayer[] = picks.map(([id, name], i) => {
    const wins = 40 + Math.floor(r() * 120), losses = 40 + Math.floor(r() * 110), games = 200 + Math.floor(r() * 8000);
    return { riotId: i === 0 ? riotId : `Player ${i + 1}#EUW`, champion: id, championName: name, team: i < 5 ? "blue" : "red", isYou: i === 0, jungle: id === "LeeSin" || id === "Khazix",
      hotStreak: i === 3, rank: i === 7 ? null : { tier: tiers[Math.floor(r() * tiers.length)], division: (["I", "II", "III", "IV"] as const)[Math.floor(r() * 4)], lp: Math.floor(r() * 99), wins, losses },
      champGames: games, champWins: Math.round(games * (0.46 + r() * 0.08)) };
  });
  return { inGame: true, queue: "Ranked Solo", mode: "CLASSIC", lengthSec: 372, players,
    bans: [["Zed", "Zed", "blue"], ["Yasuo", "Yasuo", "blue"], ["Aurora", "Aurora", "red"]].map(([champion, championName, team]) => ({ champion, championName, team: team as "blue" | "red" })) };
}

/** Demo recap for a mock match: you play a bit above the demo averages. */
function recapDemo(matchId?: string): PostGameRecap {
  const m = matches.find((x) => x.id === matchId) ?? matches[0], r = rng(4242 + matches.indexOf(m)), min = m.durationSec / 60;
  const kda = (m.kills + m.assists) / Math.max(1, m.deaths), cs = m.cs / min, damage = 380 + r() * 200, gold = 330 + r() * 120;
  const mk = (id: "kda" | "cs" | "damage" | "gold", label: string, unit: string, you: number, avg: number) => ({ id, label, unit, you, vsRank: avg, vsYou: avg * (0.9 + r() * 0.2), lobbyRank: 1 + Math.floor(r() * 10) });
  return { matchId: m.id, queue: m.queue, win: m.win, durationSec: m.durationSec, playedAt: m.playedAt, champion: m.champion, championName: m.champion, role: m.role,
    kills: m.kills, deaths: m.deaths, assists: m.assists, killParticipation: 0.35 + r() * 0.35, damageShare: 0.15 + r() * 0.2,
    metrics: [mk("kda", "KDA", "", kda, 2.6), mk("cs", "CS per minute", "/min", cs, 6.4), mk("damage", "Damage per minute", "/min", damage, 460), mk("gold", "Gold per minute", "/min", gold, 380)],
    baseline: { label: `Demo ${m.champion} averages (mock data)`, games: 1234 }, personal: { games: 8 } };
}

export const mockApi: ApexApi = {
  getRecap: async (_id, matchId) => { await delay(null, 450); if (matchId && !matches.some((x) => x.id === matchId)) throw new Error("Match not found"); return recapDemo(matchId); },
  getLiveGame: async (riotId) => { await delay(null, 500); if (!RIOT_ID_RE.test(riotId)) throw new Error("Riot ID must look like Name#TAG");
    return riotId.toLowerCase().startsWith("offline") ? { inGame: false } : liveDemo(riotId); },
  getDraftStats: async () => null,
  getFilterOptions: () => delay({ platforms: [], ranks: [], patches: [] }, 50),
  getChampionPool: () => delay(pool, 300),
  getMastery: () => delay(mastery, 400),
  getLpHistory: () => delay(lpHistory, 450),
  getChampions: async (role) => { await ready; return delay({ patch: "mock", totalGames: TOTAL_GAMES,
    champions: role ? champs.filter((c) => c.roles.includes(role)) : champs }, 400); },
  getChampion: async (id) => { await ready; return delay(champDetail(id), 350); },
  getSummoner: async (riotId): Promise<Summoner> => {
    await delay(null, 300);
    if (!RIOT_ID_RE.test(riotId)) throw new Error("Riot ID must look like Name#TAG");
    return { riotId, level: 412, rank: { tier: "EMERALD", division: "II", lp: 64, wins: 87, losses: 79 } };
  },
  getRecentMatches: (_id, limit = 10) => delay(matches.slice(0, limit), 500),
  getMatchPage: (_id, cursor, limit) => delay({
    items: matches.slice(cursor, cursor + limit), nextCursor: cursor + limit < TOTAL ? cursor + limit : null }, 450),
  getMatchDetail: (id) => delay(detail(id), 250),
};
