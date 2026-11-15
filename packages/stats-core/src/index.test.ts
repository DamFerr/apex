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
