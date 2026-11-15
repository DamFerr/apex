/** Shared contract between the UI, the mock API and the future backend. */
export type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
export type Tier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";

export interface RankInfo { tier: Tier; division: "I" | "II" | "III" | "IV"; lp: number; wins: number; losses: number }
/** rank is null for players who are unranked in Ranked Solo/Duo. */
export interface Summoner { riotId: string; level: number; rank: RankInfo | null; /** Region the player plays on, found automatically (e.g. "euw1"). */ platform?: string }
export interface MatchSummary {
  id: string; champion: string; role: Role | null; win: boolean;
  kills: number; deaths: number; assists: number; cs: number;
  durationSec: number; queue: string; playedAt: string; // ISO date
}
export interface Participant {
  name: string; champion: string; team: "blue" | "red"; kills: number; deaths: number; assists: number;
  cs: number; damage: number; gold: number; vision: number; isYou?: boolean;
}
export interface MatchDetail { id: string; blueWon: boolean; participants: Participant[] }
export interface MatchPage { items: MatchSummary[]; nextCursor: number | null }

export interface StatLine { name: string; games: number; wins: number }
export interface ChampionSummary { id: string; name: string; roles: Role[]; tags: string[]; games: number; wins: number; bans: number }
export interface ChampionList { patch: string; totalGames: number; champions: ChampionSummary[] }
export interface ChampionDetail extends ChampionSummary {
  totalGames: number; builds: StatLine[]; runes: StatLine[]; skillOrder: string[]; matchups: StatLine[];
}

export interface MasteryEntry { champion: string; name: string; level: number; points: number }
export interface LpPoint { label: string; lp: number }

export interface PoolEntry { champion: string; games: number; wins: number; points: number }

/** Collected statistics for the draft engine: pairs are [champion, champion, games, winsOfFirst], first id alphabetically first. */
export interface DraftStats {
  games: number; patch?: string;
  champions: { id: string; games: number; wins: number; roles: string[] }[];
  matchups: [string, string, number, number][];   // lane opponents: same role, opposite teams
  synergies: [string, string, number, number][];  // same team
}
/** Filters shared by every stats screen. platform: "all" or a region id; patch: "latest", "all" or e.g. "16.22"; rank: "all" or a tier such as "EMERALD", which always means that tier AND ABOVE (Emerald IV and up). */
export interface StatsFilter { platform: string; patch: string; rank: string }
export interface FilterOption { id: string; matches: number }
/** What the collected data actually contains, so the UI only offers filters that have data. */
export interface FilterOptions { platforms: FilterOption[]; ranks: FilterOption[]; patches: FilterOption[] }

/** Every screen talks to this interface only. Mock now, HTTP backend later. */
export interface ApexApi {
  getSummoner(riotId: string): Promise<Summoner>;
  getRecentMatches(riotId: string, limit?: number): Promise<MatchSummary[]>;
  getMatchPage(riotId: string, cursor: number, limit: number): Promise<MatchPage>;
  /** riotId marks which participant is "you" in the scoreboard (real backend only). */
  getMatchDetail(matchId: string, riotId?: string): Promise<MatchDetail>;
  getChampionPool(riotId: string): Promise<PoolEntry[]>;
  getMastery(riotId: string): Promise<MasteryEntry[]>;
  getLpHistory(riotId: string): Promise<LpPoint[]>;
  getChampions(role?: Role, filter?: StatsFilter): Promise<ChampionList>;
  getChampion(id: string, filter?: StatsFilter): Promise<ChampionDetail>;
  getFilterOptions(): Promise<FilterOptions>;
  /** null when there is no collected data (mock source). */
  getDraftStats(filter?: StatsFilter): Promise<DraftStats | null>;
}
