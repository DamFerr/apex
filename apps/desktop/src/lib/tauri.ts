import { getCurrentWindow } from "@tauri-apps/api/window";
/** True only inside the native Tauri window (false in the browser dev server). */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const win = {
  minimize: () => isTauri && getCurrentWindow().minimize(),
  toggleMax: () => isTauri && getCurrentWindow().toggleMaximize(),
  close: () => isTauri && getCurrentWindow().close(),
};
