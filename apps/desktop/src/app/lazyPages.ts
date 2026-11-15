import { lazy } from "react";
/** Screens load on demand (faster cold start). Hovering or focusing a nav item preloads its chunk. */
const imp = {
  draft: () => import("./Draft"), champions: () => import("./Champions"), champion: () => import("./ChampionPage"),
  profile: () => import("./Profile"), settings: () => import("./Settings"),
};
export const Draft = lazy(() => imp.draft().then((m) => ({ default: m.Draft })));
export const Champions = lazy(() => imp.champions().then((m) => ({ default: m.Champions })));
export const ChampionPage = lazy(() => imp.champion().then((m) => ({ default: m.ChampionPage })));
export const Profile = lazy(() => imp.profile().then((m) => ({ default: m.Profile })));
export const Settings = lazy(() => imp.settings().then((m) => ({ default: m.Settings })));
export const preload: Record<string, () => Promise<unknown>> = {
  "/draft": imp.draft, "/champions": () => Promise.all([imp.champions(), imp.champion()]), "/profile": imp.profile, "/settings": imp.settings,
};
