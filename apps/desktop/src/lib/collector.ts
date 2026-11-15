import { useQuery } from "@tanstack/react-query";
import { useUi } from "./store";

export interface CollectorStatus { running: boolean; lastError: string | null; savedThisRun: number; matches: number; seeds: number; crawled: number; latestPatch: string | null; ladders: { seeded: number; total: number }; workers: number }

export const useCollector = () => {
  const on = useUi((s) => s.dataSource === "backend"), base = useUi((s) => s.backendUrl);
  return useQuery({ queryKey: ["collector", base], enabled: on, refetchInterval: 4000, retry: false,
    queryFn: async () => { const r = await fetch(`${base}/v1/collector`); if (!r.ok) throw new Error("Backend error"); return (await r.json()) as CollectorStatus; } });
};
/** POSTs carry a custom header so other websites cannot trigger them from your browser. */
export async function collectorCommand(base: string, cmd: "start" | "stop") {
  const r = await fetch(`${base}/v1/collector/${cmd}`, { method: "POST", headers: { "X-Apex": "1" } });
  if (!r.ok) throw new Error("Collector command failed");
}
