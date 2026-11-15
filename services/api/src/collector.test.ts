import { DatabaseSync } from "./sqlite";
import { describe, expect, it } from "vitest";
import { Collector, type CollectorConfig } from "./collector";
import { HttpError } from "./riot";
import { fakeRiot } from "./testkit";
import { makeStore } from "./store";

const base: CollectorConfig = { platforms: ["euw1"], tiers: ["EMERALD"], pages: 1, matchesPerPlayer: 5, recrawlMs: 1000, concurrency: 1 };
function setup(over: Partial<CollectorConfig> = {}) {
  const riot = fakeRiot(), store = makeStore(new DatabaseSync(":memory:")); let t = 10_000;
  // The fake sleep advances the clock and yields to the event loop, so idle workers cannot spin forever.
  const c = new Collector(riot, store, { ...base, ...over }, () => t, async () => { t += 250; await new Promise((r) => setImmediate(r)); });
  return { riot, store, c, advance: (ms: number) => { t += ms; } };
}
const own = (riot: ReturnType<typeof fakeRiot>) => { riot.ladder = async (pf, tier, div) => [{ puuid: `${pf}-${tier}-${div}`, tier, rank: div, leaguePoints: 1 }]; }; // players are unique per ladder, like real life

describe("Collector", () => {
  it("covers every region x tier x division, with a single division for Master and above", () => {
    const { c } = setup({ platforms: ["euw1", "na1"], tiers: ["EMERALD", "MASTER"] });
    expect(c.ladders()).toHaveLength(2 * (4 + 1));
    expect(c.ladders().filter((l) => l.tier === "MASTER").map((l) => l.division)).toEqual(["I", "I"]);
  });
  it("reads every ladder and starts crawling players before all ladders are done", async () => {
    const { c, riot, store } = setup({ platforms: ["euw1", "na1"], tiers: ["EMERALD", "DIAMOND"] }); own(riot);
    const sizes: number[] = [];
    for (let i = 0; i < 40; i++) { await c.step(); sizes.push(store.counts().matches); }
    expect(c.progress()).toEqual({ seeded: 16, total: 16 });
    expect(sizes.findIndex((n) => n > 0)).toBeLessThan(6);        // matches appear long before the last ladder is read
  });
  it("crawls each player in their own region", async () => {
    const { c, riot } = setup({ platforms: ["euw1", "na1"], tiers: ["MASTER"] }); own(riot);
    const regions: string[] = [], orig = riot.matchIds; riot.matchIds = async (p, r, ...rest) => { regions.push(r); return orig(p, r, ...rest); };
    for (let i = 0; i < 8; i++) await c.step();
    expect(new Set(regions)).toEqual(new Set(["europe", "americas"]));
  });
  it("counts an empty ladder as read (a tiny region has no Challenger players)", async () => {
    const { c, riot } = setup({ tiers: ["CHALLENGER"] }); riot.ladder = async () => [];
    await c.step();
    expect(c.progress()).toEqual({ seeded: 1, total: 1 });
  });
  it("reports a ladder with players but no puuid field as an error and does not mark it read", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"] }); riot.ladder = async () => [{ tier: "MASTER", rank: "I", leaguePoints: 1 }];
    await expect(c.step()).rejects.toThrow(/puuid/);
    expect(c.progress().seeded).toBe(0);
  });
  it("skips a failing ladder for a while so it cannot block the others", async () => {
    const { c, riot } = setup({ platforms: ["na1", "euw1"], tiers: ["MASTER"] }); own(riot);
    const orig = riot.ladder; riot.ladder = async (pf, ...rest) => { if (pf === "na1") throw new HttpError(500, "boom"); return orig(pf, ...rest); };
    await expect(c.step()).rejects.toThrow("boom");
    await c.step();
    expect(c.progress().seeded).toBe(1);                           // euw1 was read even though na1 keeps failing
  });
  it("reads ladders again after a week", async () => {
    const { c, riot, advance } = setup({ tiers: ["MASTER"] }); own(riot);
    await c.step(); expect(riot.calls.ladder).toBeUndefined();     // own() replaced the counted fake, so count via progress instead
    expect(c.progress().seeded).toBe(1);
    advance(8 * 24 * 3600_000);
    expect(c.progress().seeded).toBe(0);                           // due again
  });
  it("stores new matches once and skips ones it already has", async () => {
    const { c, riot, store } = setup({ tiers: ["MASTER"] });
    for (let i = 0; i < 6; i++) await c.step();
    expect(store.counts().matches).toBe(5);                        // both fake players list the same 5 matches
    expect(riot.calls.match).toBe(5);
  });
  it("is idle once every ladder was read and every player crawled recently", async () => {
    const { c } = setup({ tiers: ["MASTER"] });
    await c.step(); await c.step(); await c.step();
    expect(await c.step()).toBe("idle");
  });
  it("only collects ranked solo games, at low priority", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"] }); const seen: unknown[] = [];
    const orig = riot.matchIds; riot.matchIds = async (...a) => { seen.push([a[4], a[5]]); return orig(...a); };
    await c.step(); await c.step();
    expect(seen[0]).toEqual([420, true]);
  });
  it("stops by itself when Riot rejects the key, and keeps the reason", async () => {
    const { c, riot } = setup();
    riot.ladder = async () => { throw new HttpError(502, "Riot rejected the API key (expired or invalid). Check RIOT_API_KEY"); };
    c.start(); await c.halt();
    expect(c.status.running).toBe(false);
    expect(c.status.lastError).toMatch(/API key/);
  });
  it("starts and halts cleanly with several workers, and never crawls one player twice at the same time", async () => {
    const { c, riot } = setup({ tiers: ["MASTER"], concurrency: 4 });
    riot.ladder = async () => Array.from({ length: 30 }, (_, i) => ({ puuid: `pl${i}`, tier: "MASTER", rank: "I", leaguePoints: 1 }));
    const active = new Set<string>(); let overlap = false, crawls = 0, orig = riot.matchIds;
    riot.matchIds = async (p, ...rest) => { if (active.has(p)) overlap = true; active.add(p); crawls++; await new Promise((r) => setImmediate(r)); active.delete(p); return orig(p, ...rest); };
    c.start(); expect(c.status.running).toBe(true);
    await new Promise((r) => setTimeout(r, 60)); await c.halt();
    expect(c.status.running).toBe(false);
    expect(crawls).toBeGreaterThan(4); expect(overlap).toBe(false);
  });
});
