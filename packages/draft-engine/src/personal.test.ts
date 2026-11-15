import { describe, expect, it } from "vitest";
import { evaluate, logit, recommend, recommendBans, personalZ, type DraftData } from "./index";

describe("personalZ", () => {
  it("is 0 with no games", () => expect(personalZ(0.5, 0, 0)).toBe(0));
  it("rewards a strong record and punishes a weak one", () => { expect(personalZ(0.5, 16, 20)).toBeGreaterThan(0); expect(personalZ(0.5, 4, 20)).toBeLessThan(0); });
  it("trusts 100 games more than 3 games", () => expect(personalZ(0.5, 70, 100)).toBeGreaterThan(personalZ(0.5, 3, 3)));
  it("shrinks 3/3 to a modest effect, never an extreme one", () => expect(personalZ(0.5, 3, 3)).toBeLessThan(logit(0.75)));
});

// A tiny hand-made world: champion 99 crushes champion 1 (which you play a lot); everything else is neutral.
const world: DraftData = {
  strength: () => 0.5, tags: () => [], roles: () => ["MID"], synergy: () => 0,
  matchup: (a, b) => (a === 99 && b === 1 ? 0.5 : a === 1 && b === 99 ? -0.5 : 0),
};
describe("recommendBans", () => {
  const cands = [1, 2, 3, 99];
  it("bans what beats your most played champion, and says who it beats", () => {
    const r = recommendBans("MID", cands, world, [{ champion: 1, games: 40 }, { champion: 2, games: 2 }]);
    expect(r[0].champion).toBe(99);
    expect(r[0].against).toBe(1);
  });
  it("respects role, exclusions and the limit", () => {
    expect(recommendBans("TOP", cands, world, []).length).toBe(0);
    expect(recommendBans("MID", cands, world, [], { exclude: new Set([99]) }).some((b) => b.champion === 99)).toBe(false);
    expect(recommendBans("MID", cands, world, [], { limit: 2 }).length).toBe(2);
  });
});
describe("recommend with personalization", () => {
  it("ranks a champion you play well above an otherwise identical one", () => {
    const r = recommend([], [], "MID", [2, 3], world, { personal: (c) => (c === 3 ? { z: 0.2, note: "You: 70% in 30 games" } : null) });
    expect(r[0].champion).toBe(3);
    expect(r[0].note).toContain("70%");
    expect(r[0].why?.kind).toBe("personal");
    expect(evaluate([], [], world).winProb).toBeCloseTo(0.5, 6);
  });
});
