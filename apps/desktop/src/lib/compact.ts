import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useUi } from "./store";
import { isTauri } from "./tauri";

let prev: { w: number; h: number } | null = null; // size to restore after compact mode
/** Compact mode: a narrow always-usable window for champ select. Min width 1100 applies only outside compact mode. */
export async function applyCompact(on: boolean) {
  if (on && useUi.getState().compact) return;
  useUi.getState().patch({ compact: on });
  if (!isTauri) return;
  const w = getCurrentWindow();
  if (on) {
    const s = await w.innerSize(), f = await w.scaleFactor();
    prev = { w: s.width / f, h: s.height / f };
    await w.setMinSize(new LogicalSize(380, 520));
    await w.setSize(new LogicalSize(440, 760));
  } else {
    await w.setMinSize(new LogicalSize(1100, 680));
    const p = prev ?? { w: 1280, h: 800 };
    await w.setSize(new LogicalSize(Math.max(p.w, 1100), Math.max(p.h, 680)));
    prev = null;
  }
}
/** If the app was closed while compact, the saved window size would be tiny on the next launch. */
export async function ensureNormalSize() {
  if (!isTauri) return;
  const w = getCurrentWindow(), s = await w.innerSize(), f = await w.scaleFactor();
  if (s.width / f < 1000) await applyCompact(false);
}
