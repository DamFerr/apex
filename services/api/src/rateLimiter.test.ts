import { describe, expect, it } from "vitest";
import { RateLimiter, parseRateLimit } from "./rateLimiter";

function clock() { let t = 0; return { now: () => t, sleep: async (ms: number) => { t += ms; }, at: () => t }; }
describe("RateLimiter", () => {
  it("lets requests through while under the limit", async () => {
    const c = clock(), l = new RateLimiter([{ limit: 3, ms: 1000 }], c.now, c.sleep);
    for (let i = 0; i < 3; i++) await l.acquire();
    expect(c.at()).toBe(0);
  });
  it("makes the next request wait for the window to free up", async () => {
    const c = clock(), l = new RateLimiter([{ limit: 2, ms: 1000 }], c.now, c.sleep);
    await l.acquire(); await l.acquire(); await l.acquire();
    expect(c.at()).toBe(1000);
  });
  it("respects the slower window too (100 per 2 minutes)", async () => {
    const c = clock(), l = new RateLimiter([{ limit: 20, ms: 1000 }, { limit: 5, ms: 120_000 }], c.now, c.sleep);
    for (let i = 0; i < 6; i++) await l.acquire();
    expect(c.at()).toBe(120_000);
  });
  it("holds back concurrent callers (real timers: 12 callers at 4 per 60 ms need at least two windows)", async () => {
    const l = new RateLimiter([{ limit: 4, ms: 60 }]), start = Date.now();
    await Promise.all(Array.from({ length: 12 }, () => l.acquire()));
    expect(Date.now() - start).toBeGreaterThanOrEqual(110);
  });
});

describe("RateLimiter priorities", () => {
  it("low-priority work only gets its share of the window, leaving room for interactive requests", async () => {
    const c = clock(), l = new RateLimiter([{ limit: 10, ms: 1000 }], c.now, c.sleep, 0.5);
    for (let i = 0; i < 5; i++) await l.acquire(true);
    expect(c.at()).toBe(0);                 // 5 of 10 used by the collector
    await l.acquire(false);                 // interactive request goes straight through
    expect(c.at()).toBe(0);
    await l.acquire(true);                  // the 6th background request must wait for the window
    expect(c.at()).toBe(1000);
  });
});

describe("limits from Riot headers", () => {
  it("parses requests:seconds pairs", () => {
    expect(parseRateLimit("20:1,100:120")).toEqual([{ limit: 20, ms: 1000 }, { limit: 100, ms: 120_000 }]);
    expect(parseRateLimit("500:10,30000:600")?.[1]).toEqual({ limit: 30000, ms: 600_000 });
  });
  it("ignores missing or malformed headers", () => { expect(parseRateLimit(null)).toBeNull(); expect(parseRateLimit("nonsense")).toBeNull(); expect(parseRateLimit("0:0")).toBeNull(); });
  it("keeps already counted requests when the limits change", async () => {
    const c = clock(), l = new RateLimiter([{ limit: 5, ms: 1000 }], c.now, c.sleep);
    await l.acquire(); await l.acquire();
    l.setWindows([{ limit: 2, ms: 1000 }]);
    await l.acquire();                                   // 2 already used under the new cap of 2, so this waits
    expect(c.at()).toBe(1000);
  });
});
