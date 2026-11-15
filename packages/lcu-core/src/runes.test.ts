import { describe, expect, it } from "vitest";
import { buildRunePage, RUNE_PAGE_PREFIX, type RuneStyle } from "./runes";

const mk = (id: number, key: string): RuneStyle => ({ id, key, name: key, slots: [0, 1, 2, 3].map((r) => ({ runes: [0, 1, 2].map((i) => ({ id: id * 10 + r * 3 + i, name: "x" })) })) });
const styles = [mk(8000, "Precision"), mk(8100, "Domination"), mk(8200, "Sorcery"), mk(8300, "Inspiration"), mk(8400, "Resolve")];

describe("buildRunePage", () => {
  it("picks a tree by champion class and Inspiration as secondary", () => {
    const p = buildRunePage(styles, ["Mage"], "Ahri");
    expect([p.primaryStyleId, p.subStyleId]).toEqual([8200, 8300]);
    expect(p.name).toBe(`${RUNE_PAGE_PREFIX}Ahri`);
    expect(p.current).toBe(true);
  });
  it("returns 9 runes: 4 primary, 2 secondary from different rows, 3 shards", () => {
    const ids = buildRunePage(styles, ["Marksman"], "Jinx").selectedPerkIds;
    expect(ids).toHaveLength(9);
    expect(ids.slice(0, 4)).toEqual([80000, 80003, 80006, 80009]);
    expect(ids.slice(4, 6)).toEqual([83003, 83006]);
  });
  it("falls back to Precision for unknown classes", () => expect(buildRunePage(styles, [], "X").primaryStyleId).toBe(8000));
  it("keeps names within the client limit of 25 characters", () => expect(buildRunePage(styles, ["Mage"], "A".repeat(40)).name.length).toBeLessThanOrEqual(25));
  it("throws on incomplete rune data", () => expect(() => buildRunePage([{ ...mk(8000, "Precision"), slots: [] }, mk(8300, "Inspiration")], ["Fighter"], "Garen")).toThrow());
});
