import { useQuery } from "@tanstack/react-query";
import type { ApexApi } from "@apex/schema";
import { createHttpApi } from "./http";
import { mockApi } from "./mock";
import { useUi } from "../store";

/** Swap this one line for an HttpProvider when the backend exists. UI code never changes. */
const http = createHttpApi(() => useUi.getState().backendUrl, mockApi);
const current = (): ApexApi => (useUi.getState().dataSource === "backend" ? http : mockApi);
/** Screens only ever use this. The Settings "Data source" switch decides which implementation answers. */
export const api: ApexApi = new Proxy(mockApi, { get: (_t, key) => (current() as never)[key as never] });

/** Part of every query key: mock and real data never share cached results. */
export const useScope = () => useUi((s) => s.dataSource);
export const DEMO_ID = "Demo Player#EUW";
export const useSummoner = (id = DEMO_ID) => useQuery({ queryKey: [useScope(), "summoner", id], queryFn: () => api.getSummoner(id) });
export const useMatches = (id = DEMO_ID, limit = 10) =>
  useQuery({ queryKey: [useScope(), "matches", id, limit], queryFn: () => api.getRecentMatches(id, limit) });

import type { Role } from "@apex/schema";
export const useChampions = (role?: Role) => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "champions", role ?? "all", f], queryFn: () => api.getChampions(role, f) }); };
export const useChampion = (id: string) => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "champion", id, f], queryFn: () => api.getChampion(id, f) }); };
export const useFilterOptions = () => useQuery({ queryKey: [useScope(), "filters"], queryFn: () => api.getFilterOptions(), enabled: useUi((s) => s.dataSource === "backend"), staleTime: 10_000 });
export const useMastery = (id: string) => useQuery({ queryKey: [useScope(), "mastery", id], queryFn: () => api.getMastery(id) });
export const useLpHistory = (id: string) => useQuery({ queryKey: [useScope(), "lp", id], queryFn: () => api.getLpHistory(id) });
export const usePool = (id = DEMO_ID) => useQuery({ queryKey: [useScope(), "pool", id], queryFn: () => api.getChampionPool(id) });
export const useDraftStats = () => { const f = useUi((s) => s.statsFilter); return useQuery({ queryKey: [useScope(), "draftstats", f], queryFn: () => api.getDraftStats(f), enabled: useUi((s) => s.dataSource === "backend"), staleTime: 60_000 }); };
