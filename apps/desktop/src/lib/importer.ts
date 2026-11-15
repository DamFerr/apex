import { invoke } from "@tauri-apps/api/core";
import type { Role } from "@apex/schema";
import { buildRunePage, recommendSpells, RUNE_PAGE_PREFIX, SPELL_NAMES } from "@apex/lcu-core";
import { champIndex, fetchDdChampions, fetchRunes } from "./ddragon";

const lcu = <T,>(method: string, path: string, body?: unknown) => invoke<T>("lcu_request", { method, path, body });

/**
 * Writes a rune page to the real League client. Safety rules: only ever creates or overwrites a page whose name
 * starts with "Apex: ", never touches your own pages, and is only called after an explicit click or opt-in.
 */
export async function importRunes(championKey: number): Promise<string> {
  if (!champIndex.size) await fetchDdChampions();
  const champ = champIndex.get(championKey);
  if (!champ) throw new Error("Unknown champion");
  const page = buildRunePage(await fetchRunes(), champ.tags, champ.name);
  const pages = await lcu<{ id: number; name: string; isEditable: boolean }[]>("GET", "/lol-perks/v1/pages");
  const mine = pages.find((p) => p.isEditable && p.name.startsWith(RUNE_PAGE_PREFIX));
  if (mine) await lcu("PUT", `/lol-perks/v1/pages/${mine.id}`, { ...page, id: mine.id });
  else await lcu("POST", "/lol-perks/v1/pages", page); // fails with a clear message if every rune page slot is used
  return page.name;
}

/** Sets your two summoner spells during champ select. Only possible while a champ select session exists. */
export async function importSpells(role: Role | null): Promise<string> {
  const [spell1Id, spell2Id] = recommendSpells(role);
  await lcu("PATCH", "/lol-champ-select/v1/session/my-selection", { spell1Id, spell2Id });
  return `${SPELL_NAMES[spell1Id]} + ${SPELL_NAMES[spell2Id]}`;
}
