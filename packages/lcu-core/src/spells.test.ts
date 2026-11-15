import { describe, expect, it } from "vitest";
import type { Role } from "@apex/schema";
import { SPELLS, SPELL_NAMES, recommendSpells } from "./spells";

describe("recommendSpells", () => {
  const roles: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  it("always returns two different spells with Flash second", () => {
    for (const r of roles) { const [a, b] = recommendSpells(r); expect(a).not.toBe(b); expect(b).toBe(SPELLS.Flash); }
  });
  it("gives junglers Smite and toplaners Teleport", () => {
    expect(recommendSpells("JUNGLE")[0]).toBe(SPELLS.Smite);
    expect(recommendSpells("TOP")[0]).toBe(SPELLS.Teleport);
  });
  it("falls back to a sensible default when the role is unknown", () => expect(recommendSpells(null)).toEqual([SPELLS.Ignite, SPELLS.Flash]));
  it("can name every spell", () => expect(SPELL_NAMES[SPELLS.Flash]).toBe("Flash"));
});
