import { HttpError, PLATFORM_IDS, regionOf, type RiotApi } from "./riot";
import type { Store } from "./store";

export const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
const APEX_TIERS = ["MASTER", "GRANDMASTER", "CHALLENGER"]; // these ladders have a single division
const DIVISIONS = ["I", "II", "III", "IV"];
const RESEED_MS = 7 * 24 * 3600_000, RETRY_MS = 10 * 60_000;

export interface CollectorConfig { platforms: string[]; tiers: string[]; pages: number; matchesPerPlayer: number; recrawlMs: number; concurrency: number }
export interface Ladder { platform: string; tier: string; division: string }

/**
 * Background crawler that covers EVERY region and rank by default. It reads each ranked ladder (region x tier x division),
 * then keeps taking the least recently crawled player and storing their new Ranked Solo games. Several workers run in
 * parallel (Riot limits each region separately), all at low priority so interactive requests always have room.
 */
export class Collector {
  status = { running: false, lastError: null as string | null, savedThisRun: 0 };
  private stopping = false; private loops: Promise<void>[] = []; private tick = 0;
  private inFlight = new Set<string>(); private failedUntil = new Map<string, number>();
  constructor(private riot: RiotApi, private store: Store, public cfg: CollectorConfig, private now = () => Date.now(),
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {}

  ladders(): Ladder[] {
    return this.cfg.platforms.flatMap((platform) => this.cfg.tiers.flatMap((tier) => (APEX_TIERS.includes(tier) ? ["I"] : DIVISIONS).map((division) => ({ platform, tier, division }))));
  }
  progress() { const all = this.ladders(), since = this.now() - RESEED_MS; return { seeded: all.filter((l) => this.store.isSeeded(l.platform, l.tier, l.division, since)).length, total: all.length }; }
  get running() { return this.loops.length > 0; }

  start() {
    if (this.loops.length) return;
    this.stopping = false; this.status = { running: true, lastError: null, savedThisRun: 0 };
    const loops = Array.from({ length: Math.max(1, this.cfg.concurrency) }, () => this.run());
    this.loops = loops;
    void Promise.all(loops).finally(() => { if (this.loops === loops) { this.loops = []; this.status.running = false; } });
  }
  async halt() { this.stopping = true; await Promise.all(this.loops); }
  private async nap(ms: number) { for (let t = 0; t < ms && !this.stopping; t += 250) await this.sleep(250); }

  /** Reads one ladder that has not been read for a week. Returns false when none is due. */
  private async seedOne(): Promise<boolean> {
    const since = this.now() - RESEED_MS, t = this.now();
    const ladder = this.ladders().find((l) => { const k = key(l); return !this.inFlight.has(k) && (this.failedUntil.get(k) ?? 0) < t && !this.store.isSeeded(l.platform, l.tier, l.division, since); });
    if (!ladder) return false;
    const k = key(ladder); this.inFlight.add(k);
    try {
      for (let page = 1; page <= this.cfg.pages && !this.stopping; page++) {
        const entries = await this.riot.ladder(ladder.platform, ladder.tier, ladder.division, page, true);
        if (!entries.length) break;
        const ids = entries.map((e) => e.puuid).filter((p): p is string => !!p);
        if (!ids.length) throw new Error("Riot's ladder response has no puuid field, so players cannot be collected.");
        this.store.addSeeds(ids, ladder.tier, ladder.platform);
      }
      this.store.markSeeded(ladder.platform, ladder.tier, ladder.division, this.now()); // an empty ladder (tiny region) still counts as read
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) this.store.markSeeded(ladder.platform, ladder.tier, ladder.division, this.now());
      else { this.failedUntil.set(k, this.now() + RETRY_MS); throw e; } // skip a failing ladder for a while instead of blocking the others
    } finally { this.inFlight.delete(k); }
    return true;
  }

  /** Crawls the least recently crawled player. Returns false when everyone was crawled recently. */
  private async crawlOne(): Promise<boolean> {
    const seed = this.store.claimSeed(this.now() - this.cfg.recrawlMs, this.now());
    if (!seed) return false;
    const region = regionOf(seed.platform);
    for (const id of await this.riot.matchIds(seed.puuid, region, 0, this.cfg.matchesPerPlayer, 420, true)) {
      if (this.stopping) break;
      if (this.store.hasMatch(id)) continue;
      if (this.store.saveMatch(await this.riot.match(id, region, true), seed.tier, seed.platform)) this.status.savedThisRun++;
    }
    return true;
  }

  /** One unit of work: mostly crawling, with every third step reading a ladder first so new regions fill in early. */
  async step(): Promise<"worked" | "idle"> {
    const seedFirst = this.tick++ % 3 === 0;
    if (seedFirst && (await this.seedOne())) return "worked";
    if (await this.crawlOne()) return "worked";
    if (!seedFirst && (await this.seedOne())) return "worked";
    return "idle";
  }

  private async run() {
    while (!this.stopping) {
      try { if ((await this.step()) === "idle") await this.nap(30_000); }
      catch (e) {
        this.status.lastError = e instanceof Error ? e.message : String(e);
        if (e instanceof HttpError && /API key/.test(e.message)) return; // no point retrying with a bad key
        await this.nap(10_000);
      }
    }
  }
}
const key = (l: Ladder) => `${l.platform}:${l.tier}:${l.division}`;
/** Every region Riot has, the busiest first so they fill in earliest. */
const BUSIEST = ["euw1", "na1", "kr", "eun1", "br1", "tr1", "jp1", "la1", "la2", "oc1", "ru"];
export const ALL_PLATFORMS = [...BUSIEST, ...PLATFORM_IDS.filter((p) => !BUSIEST.includes(p))];
