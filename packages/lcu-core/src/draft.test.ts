import { describe, expect, it } from "vitest";
import { initialDraft, parseLcuMessage, reduce, shouldImport } from "./draft";
import { buildSession } from "./session-builder";

const frame = (uri: string, eventType: string, data: unknown) => JSON.stringify([8, "OnJsonApiEvent", { uri, eventType, data }]);
const empty = () => buildSession({ bans: [[], []], hover: {}, locked: {} });

describe("reduce", () => {
  it("tracks connection", () => expect(reduce(initialDraft, { type: "connected" }).connected).toBe(true));
  it("shows slots and roles once a session arrives", () => {
    const s = reduce(initialDraft, { type: "session", session: empty() });
    expect(s.active).toBe(true);
    expect(s.slots).toHaveLength(10);
    expect(s.slots.find((x) => x.isLocal)?.role).toBe("MID");
  });
  it("treats a hovered champion as hover, not a lock", () => {
    const s = reduce(initialDraft, { type: "session", session: buildSession({ bans: [[], []], hover: { 2: 103 }, locked: {} }) });
    const me = s.slots.find((x) => x.isLocal)!;
    expect([me.hoverId, me.locked, s.localLocked]).toEqual([103, false, null]);
  });
  it("records the local lock and ignores unset bans (0)", () => {
    const s = reduce(initialDraft, { type: "session", session: buildSession({ bans: [[1, 0], [2]], hover: {}, locked: { 2: 103 } }) });
    expect(s.localLocked).toEqual({ championId: 103, role: "MID" });
    expect(s.bans.ally).toEqual([1]);
  });
  it("resets when champ select ends or the client leaves the phase", () => {
    const active = reduce({ ...initialDraft, connected: true }, { type: "session", session: empty() });
    expect(reduce(active, { type: "sessionEnded" }).active).toBe(false);
    expect(reduce(active, { type: "gameflow", phase: "InProgress" }).slots).toEqual([]);
    expect(reduce(active, { type: "disconnected" }).connected).toBe(false);
  });
});

describe("bans", () => {
  const withActions = () => {
    const sess = buildSession({ bans: [[], []], hover: {}, locked: {} });
    sess.actions.push([
      { id: 90, actorCellId: 0, championId: 11, completed: true, isAllyAction: true, type: "ban" },
      { id: 91, actorCellId: 5, championId: 22, completed: true, isAllyAction: false, type: "ban" },
      { id: 92, actorCellId: 1, championId: 33, completed: false, isAllyAction: true, type: "ban" },
    ]);
    return sess;
  };
  it("reads bans from completed ban actions when the ban lists are empty", () => {
    const s = reduce(initialDraft, { type: "session", session: withActions() });
    expect(s.bans).toEqual({ ally: [11], enemy: [22] }); // the unfinished (hovered) ban is not shown
  });
  it("merges both sources without duplicates", () => {
    const sess = withActions(); sess.bans.myTeamBans = [11, 44];
    expect(reduce(initialDraft, { type: "session", session: sess }).bans.ally).toEqual([11, 44]);
  });
});

describe("banning flag", () => {
  const st = (banTurn?: number) => reduce(initialDraft, { type: "session", session: buildSession({ bans: [[], []], hover: {}, locked: {}, banTurn }) });
  it("is true only while the local player has an unfinished ban action", () => {
    expect(st(2).banning).toBe(true);   // cell 2 is the local player
    expect(st(0).banning).toBe(false);  // someone else's turn
    expect(st().banning).toBe(false);
  });
});

describe("shouldImport", () => {
  const locked = (c: number) => reduce(initialDraft, { type: "session", session: buildSession({ bans: [[], []], hover: {}, locked: { 2: c } }) });
  it("is off by default behaviour: nothing when disabled", () => expect(shouldImport(initialDraft, locked(103), { autoImport: false })).toBeNull());
  it("fires once when the local player locks in", () => {
    const next = locked(103);
    expect(shouldImport(initialDraft, next, { autoImport: true })).toEqual({ championId: 103, role: "MID" });
    expect(shouldImport(next, next, { autoImport: true })).toBeNull();
  });
  it("fires again if the locked champion changes", () => expect(shouldImport(locked(103), locked(61), { autoImport: true })?.championId).toBe(61));
  it("does nothing before locking", () => expect(shouldImport(initialDraft, reduce(initialDraft, { type: "session", session: empty() }), { autoImport: true })).toBeNull());
});

describe("parseLcuMessage", () => {
  it("parses gameflow and session frames", () => {
    expect(parseLcuMessage(frame("/lol-gameflow/v1/gameflow-phase", "Update", "ChampSelect"))).toEqual({ type: "gameflow", phase: "ChampSelect" });
    expect(parseLcuMessage(frame("/lol-champ-select/v1/session", "Update", empty()))?.type).toBe("session");
    expect(parseLcuMessage(frame("/lol-champ-select/v1/session", "Delete", null))).toEqual({ type: "sessionEnded" });
  });
  it("ignores unrelated or malformed frames", () => {
    expect(parseLcuMessage(frame("/lol-chat/v1/me", "Update", {}))).toBeNull();
    expect(parseLcuMessage("not json")).toBeNull();
    expect(parseLcuMessage("[1,2]")).toBeNull();
  });
});
