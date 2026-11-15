import { describe, expect, it } from "vitest";
import { queueName, toMastery, toMatchDetail, toMatchSummary, toRank } from "./mapping";
import { matchFixture, participant } from "./testkit";

describe("mapping", () => {
  it("picks the solo queue entry as the rank and returns null when unranked", () => {
    expect(toRank([{ queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 64, wins: 87, losses: 79 }])).toEqual({ tier: "EMERALD", division: "II", lp: 64, wins: 87, losses: 79 });
    expect(toRank([{ queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 1, wins: 1, losses: 1 }])).toBeNull();
    expect(toRank([])).toBeNull();
  });
  it("summarises a match from the player's point of view", () => {
    const s = toMatchSummary(matchFixture("EUW1_1"), "p2")!;
    expect(s).toMatchObject({ id: "EUW1_1", champion: "Thresh", role: "MID", win: true, kills: 2, cs: 112, durationSec: 1800, queue: "Ranked Solo" });
    expect(s.playedAt).toBe(new Date(1_700_001_800_000).toISOString());
    expect(toMatchSummary(matchFixture("EUW1_1"), "someone-else")).toBeNull();
  });
  it("maps roles and handles modes without roles (ARAM)", () => {
    const m = matchFixture("x", { queueId: 450, participants: [participant(0, { teamPosition: "" }), participant(1, { teamPosition: "UTILITY" })] });
    expect(toMatchSummary(m, "p0")?.role).toBeNull();
    expect(toMatchSummary(m, "p1")?.role).toBe("SUPPORT");
    expect(queueName(450)).toBe("ARAM");
    expect(queueName(9999)).toBe("Queue 9999");
  });
  it("builds a scoreboard with teams, the winner, you, and unique names", () => {
    const d = toMatchDetail(matchFixture("EUW1_1", { participants: [participant(0, { riotIdGameName: "Dup" }), participant(1, { riotIdGameName: "Dup" }), ...Array.from({ length: 8 }, (_, i) => participant(i + 2))] }), "p0");
    expect(d.participants).toHaveLength(10);
    expect(d.blueWon).toBe(true);
    expect(d.participants.filter((p) => p.team === "blue")).toHaveLength(5);
    expect(d.participants.filter((p) => p.isYou).map((p) => p.name)).toEqual(["Dup"]);
    expect(new Set(d.participants.map((p) => p.name)).size).toBe(10);
  });
  it("names mastery champions and skips unknown ones", () => {
    const champs = new Map([[103, { id: "Ahri", name: "Ahri" }]]);
    expect(toMastery([{ championId: 103, championLevel: 7, championPoints: 5 }, { championId: 1, championLevel: 1, championPoints: 1 }], champs)).toEqual([{ champion: "Ahri", name: "Ahri", level: 7, points: 5 }]);
  });
});
