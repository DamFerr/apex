import { describe, expect, it } from "vitest";
import { RateLimiter, HostLimiters } from "./rateLimiter";
import { HttpError, HttpRiot, regionOf } from "./riot";

const limiter = () => { const l = new RateLimiter([{ limit: 1000, ms: 1000 }]); return { for: () => l }; };
const res = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

describe("HttpRiot", () => {
  it("sends the key as a header only, never in the URL", async () => {
    let url = "", headers: HeadersInit | undefined;
    const r = new HttpRiot("SECRET", limiter(), (async (u: string, init?: RequestInit) => { url = u; headers = init?.headers; return res(200, { puuid: "p" }); }) as never);
    await r.account("A b", "EUW", "europe");
    expect(url).toBe("https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/A%20b/EUW");
    expect(url).not.toContain("SECRET");
    expect((headers as Record<string, string>)["X-Riot-Token"]).toBe("SECRET");
  });
  it("waits and retries when Riot answers 429", async () => {
    let n = 0, slept = 0;
    const r = new HttpRiot("k", limiter(), (async () => (++n === 1 ? res(429, {}, { "retry-after": "2" }) : res(200, ["EUW1_1"]))) as never, async (ms) => { slept = ms; });
    expect(await r.matchIds("p", "europe", 0, 1)).toEqual(["EUW1_1"]);
    expect(n).toBe(2); expect(slept).toBeGreaterThanOrEqual(2000);
  });
  it("turns Riot errors into clear messages", async () => {
    const mk = (s: number) => new HttpRiot("k", limiter(), (async () => res(s)) as never, async () => {});
    await expect(mk(404).account("a", "b", "europe")).rejects.toMatchObject({ status: 404 });
    await expect(mk(403).account("a", "b", "europe")).rejects.toThrow(/API key/);
    await expect(mk(500).account("a", "b", "europe")).rejects.toBeInstanceOf(HttpError);
  });
  it("treats a missing ranked entry list as unranked", async () => {
    expect(await new HttpRiot("k", limiter(), (async () => res(404)) as never).league("p", "euw1")).toEqual([]);
  });
  it("routes platforms to regions and rejects unknown ones", () => {
    expect([regionOf("euw1"), regionOf("na1"), regionOf("kr")]).toEqual(["europe", "americas", "asia"]);
    expect(() => regionOf("zz9")).toThrow(/Unknown platform/);
  });
});

describe("HttpRiot rate limits", () => {
  it("adopts the key's real limits from Riot's response header, with a 10% margin", async () => {
    let t = 0; const l = new RateLimiter([{ limit: 1000, ms: 1000 }], () => t, async (ms) => { t += ms; });
    const riot = new HttpRiot("k", { for: () => l }, (async () => res(200, [], { "x-app-rate-limit": "10:1,500:120" })) as never);
    await riot.matchIds("p", "europe", 0, 1);                 // first call learns the limits: 9 per second
    for (let i = 0; i < 9; i++) await riot.matchIds("p", "europe", 0, 1);
    expect(t).toBeGreaterThanOrEqual(1000);                    // the 10th request in a second had to wait
    expect(l.lastHeader).toBe("10:1,500:120");
  });
  it("keeps separate limits per region", async () => {
    let t = 0; const hl = new HostLimiters([{ limit: 1, ms: 1000 }], () => t, async (ms) => { t += ms; });
    await hl.for("europe").acquire(); await hl.for("americas").acquire();   // different hosts: no waiting
    expect(t).toBe(0);
    await hl.for("europe").acquire();                                       // same host again: must wait
    expect(t).toBe(1000);
  });
});
