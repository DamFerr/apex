import { parseRateLimit, type RateLimiter } from "./rateLimiter";

export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const REGION: Record<string, string> = { euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe", me1: "europe", na1: "americas", br1: "americas", la1: "americas", la2: "americas",
  kr: "asia", jp1: "asia", oc1: "sea", ph2: "sea", sg2: "sea", th2: "sea", tw2: "sea", vn2: "sea" };
export const PLATFORM_IDS = Object.keys(REGION);
export const regionOf = (platform: string) => REGION[platform] ?? (() => { throw new HttpError(400, `Unknown platform "${platform}"`); })();

export interface RiotParticipant { puuid: string; riotIdGameName?: string; summonerName?: string; championName: string; teamId: number; teamPosition: string; win: boolean;
  kills: number; deaths: number; assists: number; totalMinionsKilled: number; neutralMinionsKilled: number; totalDamageDealtToChampions: number; goldEarned: number; visionScore: number;
  championId?: number; individualPosition?: string; item0?: number; item1?: number; item2?: number; item3?: number; item4?: number; item5?: number; item6?: number;
  summoner1Id?: number; summoner2Id?: number; perks?: { styles: { selections: { perk: number }[] }[] } }
export interface RiotMatch { metadata: { matchId: string }; info: { gameDuration: number; gameCreation: number; gameEndTimestamp?: number; queueId: number; gameVersion?: string; participants: RiotParticipant[];
  teams?: { teamId: number; bans: { championId: number }[] }[] } }
export interface LeagueEntry { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }
export interface LadderEntry { puuid?: string; tier: string; rank: string; leaguePoints: number }
export interface RiotMastery { championId: number; championLevel: number; championPoints: number }

/** Only what Apex needs. A fake implements this in tests. */
export interface RiotApi {
  account(name: string, tag: string, region: string): Promise<{ puuid: string; gameName: string; tagLine: string }>;
  summoner(puuid: string, platform: string): Promise<{ summonerLevel: number }>;
  league(puuid: string, platform: string): Promise<LeagueEntry[]>;
  /** low = background priority (collector). queue filters by queue id, e.g. 420 for Ranked Solo. */
  matchIds(puuid: string, region: string, start: number, count: number, queue?: number, low?: boolean): Promise<string[]>;
  match(id: string, region: string, low?: boolean): Promise<RiotMatch>;
  ladder(platform: string, tier: string, division: string, page: number, low?: boolean): Promise<LadderEntry[]>;
  mastery(puuid: string, platform: string, count: number): Promise<RiotMastery[]>;
}

export class HttpRiot implements RiotApi {
  constructor(private key: string, private limiters: { for(host: string): RateLimiter }, private fetchFn: typeof fetch = fetch,
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {}
  /** All requests go through the limiter; a 429 waits for Retry-After and retries. The key is only ever sent as a header, never logged. */
  private async get<T>(host: string, path: string, low = false): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const limiter = this.limiters.for(host);
      await limiter.acquire(low);
      const res = await this.fetchFn(`https://${host}.api.riotgames.com${path}`, { headers: { "X-Riot-Token": this.key } })
        .catch(() => { throw new HttpError(502, "Could not reach Riot's servers"); });
      // Riot reports the key's real limits on every response: adopt them (with a 10% safety margin), so a production key runs faster than a personal one.
      const hdr = res.headers.get("x-app-rate-limit"), tuned = parseRateLimit(hdr);
      if (hdr && tuned && hdr !== limiter.lastHeader) { limiter.lastHeader = hdr; limiter.setWindows(tuned.map((w) => ({ limit: Math.max(1, Math.floor(w.limit * 0.9)), ms: w.ms }))); }
      if (res.status === 429 && attempt < 2) { await this.sleep((Number(res.headers.get("retry-after") ?? 1) + 0.25) * 1000); continue; }
      if (res.ok) return (await res.json()) as T;
      if (res.status === 404) throw new HttpError(404, "Not found on Riot's servers");
      if (res.status === 401 || res.status === 403) throw new HttpError(502, "Riot rejected the API key (expired or invalid). Check RIOT_API_KEY in services/api/.env");
      if (res.status === 429) throw new HttpError(429, "Riot rate limit reached. Try again in a moment");
      throw new HttpError(502, `Riot returned status ${res.status}`);
    }
  }
  account = (n: string, t: string, r: string) => this.get<{ puuid: string; gameName: string; tagLine: string }>(r, `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(n)}/${encodeURIComponent(t)}`);
  summoner = (p: string, pf: string) => this.get<{ summonerLevel: number }>(pf, `/lol/summoner/v4/summoners/by-puuid/${p}`);
  league = (p: string, pf: string) => this.get<LeagueEntry[]>(pf, `/lol/league/v4/entries/by-puuid/${p}`).catch((e) => { if (e instanceof HttpError && e.status === 404) return []; throw e; });
  matchIds = (p: string, r: string, s: number, c: number, queue?: number, low = false) => this.get<string[]>(r, `/lol/match/v5/matches/by-puuid/${p}/ids?start=${s}&count=${c}${queue ? `&queue=${queue}` : ""}`, low);
  match = (id: string, r: string, low = false) => this.get<RiotMatch>(r, `/lol/match/v5/matches/${id}`, low);
  ladder = (pf: string, tier: string, division: string, page: number, low = false) => this.get<LadderEntry[]>(pf, `/lol/league-exp/v4/entries/RANKED_SOLO_5x5/${tier}/${division}?page=${page}`, low);
  mastery = (p: string, pf: string, c: number) => this.get<RiotMastery[]>(pf, `/lol/champion-mastery/v4/champion-masteries/by-puuid/${p}/top?count=${c}`);
}
