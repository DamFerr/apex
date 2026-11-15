import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useUi } from "../lib/store";

/** In-game overlay window (placeholder content). Transparent, always on top, click-through (set in Rust). */
export function Overlay() {
  const [opacity, setOpacity] = useState(() => useUi.getState().overlayOpacity);
  useEffect(() => {
    document.documentElement.dataset.overlay = "1";
    let off: (() => void) | undefined;
    listen<number>("overlay-opacity", (e) => setOpacity(e.payload)).then((f) => (off = f));
    return () => off?.();
  }, []);
  return (
    <div style={{ opacity }} className="m-2 glass rounded-xl p-4 text-sm">
      <div className="font-display font-semibold">Apex overlay</div>
      <div className="text-xs text-muted mt-1">Placeholder. Build and rune reminders arrive in Phase 2.</div>
    </div>
  );
}
