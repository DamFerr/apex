import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import { champIndex } from "./ddragon";
import type { Role } from "@apex/schema";
import { importRunes, importSpells } from "./importer";
import { useUi } from "./store";
import { isTauri } from "./tauri";
import { initialDraft, parseLcuMessage, reduce, shouldImport, CHAMPION_KEYS, type DraftState, type LcuEvent } from "@apex/lcu-core";

export const MOCK_HOST = "127.0.0.1:8765";
/** Prefers the full Data Dragon list; falls back to the small built-in table when offline. */
export const champId = (key: number): string | undefined => champIndex.get(key)?.id ?? CHAMPION_KEYS[key];
export const champName = (key: number) => champIndex.get(key)?.name ?? (CHAMPION_KEYS[key] ?? `Champion ${key}`).replace(/([a-z])([A-Z])/g, "$1 $2");

interface DraftStore {
  draft: DraftState; autoImport: boolean; spells: boolean; setSpells: (v: boolean) => void; log: { id: number; text: string }[];
  setAutoImport: (v: boolean) => void; dispatch: (e: LcuEvent) => void;
}
const addLog = (text: string) => useDraft.setState((s) => ({ log: [{ id: Date.now() + Math.random(), text }, ...s.log].slice(0, 8) }));
/** Imports runes (and optionally summoner spells) and reports each outcome in the import log. */
export async function runImport(championKey: number, role: Role | null) {
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
  try { addLog(`Imported rune page "${await importRunes(championKey)}" (placeholder runes by champion class)`); }
  catch (e) { addLog(`Rune import failed: ${msg(e)}`); }
  if (!useDraft.getState().spells) return;
  try { addLog(`Set summoner spells: ${await importSpells(role)} (placeholder by role)`); }
  catch (e) { addLog(`Spell import failed: ${msg(e)}`); }
}
export const useDraft = create<DraftStore>((set, get) => ({
  draft: initialDraft, autoImport: false, spells: true, setSpells: (spells) => set({ spells }), log: [],
  setAutoImport: (autoImport) => set({ autoImport }),
  dispatch: (e) => {
    const prev = get().draft, next = reduce(prev, e), imp = shouldImport(prev, next, { autoImport: get().autoImport });
    const real = useUi.getState().lcuSource === "real" && isTauri;
    if (imp && real) void runImport(imp.championId, imp.role); // real write; the mock source only logs
    set((s) => ({ draft: next, log: imp && !real ? [{ id: Date.now(), text: `Auto-import (mock): ${champName(imp.championId)} · ${imp.role ?? "?"} → runes, items, spells` }, ...s.log].slice(0, 8) : s.log }));
  },
}));

/** Dev transport: connects to the mock LCU and retries every 3 s. The real Tauri transport replaces this later. */
export function startMockLcu(): () => void {
  let ws: WebSocket | null = null, stopped = false, timer = 0;
  const open = () => {
    ws = new WebSocket(`ws://${MOCK_HOST}`);
    ws.onopen = () => useDraft.getState().dispatch({ type: "connected" });
    ws.onmessage = (m) => { const ev = parseLcuMessage(String(m.data)); if (ev) useDraft.getState().dispatch(ev); };
    ws.onclose = () => { useDraft.getState().dispatch({ type: "disconnected" }); if (!stopped) timer = window.setTimeout(open, 3000); };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => { stopped = true; clearTimeout(timer); ws?.close(); };
}

/** Real transport: the Rust connector (src-tauri/src/lcu.rs) forwards raw LCU frames as Tauri events. */
export function startTauriLcu(): () => void {
  const off: (() => void)[] = []; let dead = false;
  const dispatch = (e: LcuEvent) => useDraft.getState().dispatch(e);
  const keep = (p: Promise<() => void>) => p.then((f) => { if (dead) f(); else off.push(f); });
  const l1 = keep(listen<string>("lcu-message", (e) => {
    if (!useDraft.getState().draft.connected) dispatch({ type: "connected" }); // a frame proves the client is there
    const ev = parseLcuMessage(e.payload); if (ev) dispatch(ev);
  }));
  const l2 = keep(listen<string>("lcu-status", (e) => dispatch({ type: e.payload === "connected" ? "connected" : "disconnected" })));
  // The Rust side may have connected before we were listening: ask it to re-send status and current state.
  Promise.all([l1, l2]).then(() => invoke<boolean>("lcu_sync")).then((ok) => { if (ok && !dead) dispatch({ type: "connected" }); }).catch(() => undefined);
  return () => { dead = true; off.forEach((f) => f()); dispatch({ type: "disconnected" }); };
}
