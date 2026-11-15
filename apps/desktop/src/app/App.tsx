import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { useUi } from "../lib/store";
import { ComingSoon } from "./pages";
import { Champions, ChampionPage, Draft, Profile, Settings } from "./lazyPages";
import { Home } from "./Home";
import { startMockLcu, startTauriLcu } from "../lib/lcu";
import { isTauri } from "../lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import { applyCompact, ensureNormalSize } from "../lib/compact";
import { combo } from "../lib/hotkeys";
import { Shell } from "./Shell";

export const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function App() {
  const { theme, reduceMotion } = useUi();
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [reduceMotion]);
  const src = useUi((s) => s.lcuSource);
  useEffect(() => (src === "real" ? (isTauri ? startTauriLcu() : undefined) : import.meta.env.DEV ? startMockLcu() : undefined), [src]);
  const overlayEnabled = useUi((s) => s.overlayEnabled);
  useEffect(() => { void ensureNormalSize(); }, []);
  useEffect(() => { if (isTauri) invoke("set_overlay", { visible: overlayEnabled }).catch(() => undefined); }, [overlayEnabled]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const c = combo(e), { hotkeys, compact, overlayEnabled: ov, patch } = useUi.getState();
      if (c && c === hotkeys.compactToggle) { e.preventDefault(); void applyCompact(!compact); }
      else if (c && c === hotkeys.overlayToggle) { e.preventDefault(); patch({ overlayEnabled: !ov }); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="profile/:riotId?" element={<Profile />} />
              <Route path="champions" element={<Champions />} />
              <Route path="champions/:id" element={<ChampionPage />} />
              <Route path="draft" element={<Draft />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<ComingSoon />} />
            </Route>
          </Routes>
        </HashRouter>
      </MotionConfig>
    </QueryClientProvider>
  );
}
