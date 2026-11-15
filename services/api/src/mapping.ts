import type { MasteryEntry, MatchDetail, MatchSummary, Participant, RankInfo, Role, Summoner, Tier } from "@apex/schema";
import type { LeagueEntry, RiotMastery, RiotMatch } from "./riot";

const ROLES: Record<string, Role> = { TOP: "TOP", JUNGLE: "JUNGLE", MIDDLE: "MID", BOTTOM: "ADC", UTILITY: "SUPPORT" };
const QUEUES: Record<number, string> = { 420: "Ranked Solo", 440: "Ranked Flex", 400: "Normal Draft", 430: "Normal Blind", 450: "ARAM", 480: "Swiftplay", 490: "Quickplay", 1700: "Arena", 1710: "Arena" };
export const roleOf = (pos: string | undefined): Role | null => ROLES[pos ?? ""] ?? null;
export const queueName = (id: number) => QUEUES[id] ?? `Queue ${id}`;

export function toRank(entries: LeagueEntry[]): RankInfo | null {
  const e = entries.find((x) => x.queueType === "RANKED_SOLO_5x5");
  return e ? { tier: e.tier as Tier, division: e.rank as RankInfo["division"], lp: e.leaguePoints, wins: e.wins, losses: e.losses } : null;
}
export const toSummoner = (riotId: string, level: number, entries: LeagueEntry[]): Summoner => ({ riotId, level, rank: toRank(entries) });

function endTime(m: RiotMatch) { const i = m.info; return i.gameEndTimestamp ?? i.gameCreation + i.gameDuration * 1000; }
export function toMatchSummary(m: RiotMatch, puuid: string): MatchSummary | null {
  const p = m.info.participants.find((x) => x.puuid === puuid);
  if (!p) return null;
  return { id: m.metadata.matchId, champion: p.championName, role: ROLES[p.teamPosition] ?? null, win: p.win, kills: p.kills, deaths: p.deaths, assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled, durationSec: m.info.gameDuration, queue: queueName(m.info.queueId), playedAt: new Date(endTime(m)).toISOString() };
}
export function toMatchDetail(m: RiotMatch, puuid?: string): MatchDetail {
  const participants: Participant[] = m.info.participants.map((p, i) => ({
    name: p.riotIdGameName || p.summonerName || `Player ${i + 1}`, champion: p.championName, team: p.teamId === 100 ? "blue" : "red",
    kills: p.kills, deaths: p.deaths, assists: p.assists, cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    damage: p.totalDamageDealtToChampions, gold: p.goldEarned, vision: p.visionScore, isYou: !!puuid && p.puuid === puuid }));
  const names = new Set<string>(); // names are React keys in the UI, so make them unique
  participants.forEach((p, i) => { if (names.has(p.name)) p.name = `${p.name} (${i + 1})`; names.add(p.name); });
  return { id: m.metadata.matchId, blueWon: m.info.participants.find((p) => p.teamId === 100)?.win ?? false, participants };
}
export function toMastery(list: RiotMastery[], champs: Map<number, { id: string; name: string }>): MasteryEntry[] {
  return list.flatMap((m) => { const c = champs.get(m.championId); return c ? [{ champion: c.id, name: c.name, level: m.championLevel, points: m.championPoints }] : []; });
}
