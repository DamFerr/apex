import { describe, expect, it } from "vitest";
import { sampleBadge, shrink, wilson, zScore } from "./index";

describe("wilson", () => {
  it("returns the full range for zero games", () => expect(wilson(0, 0)).toEqual([0, 1]));
  it("matches known values for 50/100", () => {
    const [lo, hi] = wilson(50, 100);
    expect(lo).toBeCloseTo(0.4038, 3);
    expect(hi).toBeCloseTo(0.5962, 3);
  });
  it("does not trust 3/3: lower bound is far below 100%", () => {
    const [lo, hi] = wilson(3, 3);
    expect(lo).toBeCloseTo(0.4385, 3);
    expect(hi).toBe(1);
  });
  it("narrows as the sample grows", () => {
    const w = (n: number) => { const [l, h] = wilson(n / 2, n); return h - l; };
    expect(w(1000)).toBeLessThan(w(100));
  });
});

describe("shrink", () => {
  it("pulls 3/3 toward the baseline", () => expect(shrink(3, 3, 0.5, 20)).toBeCloseTo(13 / 23, 6));
  it("keeps large samples close to the raw rate", () => expect(shrink(600, 1000, 0.5, 20)).toBeCloseTo(0.598, 3));
  it("returns the baseline with no games", () => expect(shrink(0, 0, 0.52, 20)).toBeCloseTo(0.52, 6));
});

describe("zScore", () => {
  it("computes 60/100 vs 50% as z = 2", () => expect(zScore(60, 100, 0.5)).toBeCloseTo(2, 6));
  it("is 0 with no games", () => expect(zScore(0, 0)).toBe(0));
});

describe("sampleBadge", () => {
  it("buckets by games", () => {
    expect([sampleBadge(10), sampleBadge(100), sampleBadge(1000)]).toEqual(["low", "medium", "high"]);
  });
});

import { buildTierList, MIN_GRADED_GAMES, tierScore } from "./index";

describe("tierScore", () => {
  it("rewards a higher win rate", () => expect(tierScore(0.53, 0.5, 0.05, 0.02)).toBeGreaterThan(tierScore(0.51, 0.5, 0.05, 0.02)));
  it("rewards presence, but less than real strength", () => {
    expect(tierScore(0.5, 0.5, 0.2, 0.2)).toBeGreaterThan(tierScore(0.5, 0.5, 0.01, 0));
    expect(tierScore(0.5, 0.5, 0.2, 0.1)).toBeLessThan(tierScore(0.53, 0.5, 0.01, 0)); // a hugely popular average champion loses to a niche +3 pp one
  });
  it("is 0 for an average champion nobody plays or bans", () => expect(tierScore(0.5, 0.5, 0, 0)).toBe(0));
});

describe("buildTierList", () => {
  const champ = (id: string, games: number, wins: number, bans = 0) => ({ id, games, wins, bans });
  it("returns an empty list for no champions", () => expect(buildTierList([], 0)).toEqual([]));
  it("never grades tiny samples: 3/3 is listed last without a grade", () => {
    const list = buildTierList([champ("Lucky", 3, 3), champ("Solid", 2000, 1100), champ("Meh", 2000, 980)], 10000);
    expect(list.map((r) => r.id)).toEqual(["Solid", "Meh", "Lucky"]);
    expect(list[2].grade).toBeNull();
    expect(list[0].grade).not.toBeNull();
  });
  it("ranks the strongest first and grades by percentile", () => {
    const list = buildTierList(Array.from({ length: 20 }, (_, i) => champ(`C${i}`, 1000, 440 + i * 6)), 20000);
    expect(list[0].id).toBe("C19");
    const count = (g: string) => list.filter((r) => r.grade === g).length;
    expect([count("S+"), count("S"), count("A"), count("B"), count("C"), count("D")]).toEqual([1, 3, 5, 6, 3, 2]);
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
  });
  it("uses the list average as the baseline, so deltas sum to about zero", () => {
    const list = buildTierList([champ("A", 1000, 540), champ("B", 1000, 460)], 2000);
    expect(list[0].delta).toBeGreaterThan(0);
    expect(list[0].delta + list[1].delta).toBeCloseTo(0, 6);
  });
  it("computes pick and ban rates from the total", () => {
    const [r] = buildTierList([champ("A", 500, 250, 100)], 1000);
    expect([r.pickRate, r.banRate]).toEqual([0.5, 0.1]);
  });
  it("exposes the grading threshold", () => expect(MIN_GRADED_GAMES).toBe(50));
});

import { performanceScore, perfGrade } from "./index";
describe("performanceScore", () => {
  it("is 50 when you match the baseline exactly", () => expect(performanceScore([1, 1, 1, 1])).toBe(50));
  it("is null with nothing to compare", () => { expect(performanceScore([])).toBeNull(); expect(performanceScore([NaN, -1])).toBeNull(); });
  it("rises with better ratios and falls with worse ones", () => {
    expect(performanceScore([1.5, 1.5, 1.5, 1.5])).toBe(88);
    expect(performanceScore([1 / 1.5, 1 / 1.5])).toBe(12);
    expect(performanceScore([1.2, 1.1])).toBeGreaterThan(50);
  });
  it("lets a double and a half cancel out", () => expect(performanceScore([2, 0.5])).toBe(50));
  it("clamps absurd ratios, and a zero counts as terrible, not as missing", () => {
    expect(performanceScore([1000])).toBe(performanceScore([5]));
    expect(performanceScore([0])).toBe(performanceScore([0.2]));
  });
});
describe("perfGrade", () => { it("buckets the score", () => expect([90, 70, 55, 40, 10].map(perfGrade)).toEqual(["S", "A", "B", "C", "D"])); });
