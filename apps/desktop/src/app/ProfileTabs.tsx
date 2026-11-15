import { motion } from "framer-motion";
import { ChampIcon } from "../components/ChampIcon";
import { Skeleton } from "../components/ui";
import { useLpHistory, useMastery } from "../lib/api";
import { useUi } from "../lib/store";

export function MasteryTab({ id }: { id: string }) {
  const { data, isError, error } = useMastery(id);
  if (isError) return <div className="glass rounded-lg p-5 mt-4 text-sm text-bad">{(error as Error).message}</div>;
  if (!data) return <div className="space-y-2 mt-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>;
  const max = Math.max(...data.map((m) => m.points));
  return (
    <ul className="space-y-2 mt-4">
      {data.map((m) => (
        <li key={m.champion} className="glass rounded-lg h-14 px-4 flex items-center gap-4">
          <ChampIcon id={m.champion} name={m.name} size={36} />
          <span className="w-28 font-medium">{m.name}</span>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${m.level >= 7 ? "bg-gold/20 text-gold" : "bg-raised text-muted"}`}>M{m.level}</span>
          <div className="flex-1 h-1.5 rounded-full bg-line/10 overflow-hidden"><motion.div className="h-full bg-accent origin-left" style={{ width: "100%" }} initial={{ scaleX: 0 }} animate={{ scaleX: m.points / max }} transition={{ duration: 0.8, ease: "easeOut" }} /></div>
          <span className="w-24 text-right tabular-nums text-sm">{m.points.toLocaleString()}</span>
        </li>))}
    </ul>
  );
}

const W = 600, H = 200, PAD = 12;
export function LpTab({ id }: { id: string }) {
  const { data, isError, error } = useLpHistory(id), reduce = useUi((s) => s.reduceMotion);
  if (isError) return <div className="glass rounded-lg p-5 mt-4 text-sm text-muted">{(error as Error).message}</div>;
  if (!data) return <Skeleton className="h-56 mt-4" />;
  const lo = Math.min(...data.map((p) => p.lp)), hi = Math.max(...data.map((p) => p.lp));
  const pts = data.map((p, i) => [PAD + (i * (W - 2 * PAD)) / (data.length - 1), H - PAD - ((p.lp - lo) / (hi - lo || 1)) * (H - 2 * PAD)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = data[data.length - 1].lp, first = data[0].lp;
  return (
    <div className="glass rounded-lg p-5 mt-4">
      <div className="flex justify-between text-sm mb-3"><span className="font-medium">LP over the last {data.length} games</span>
        <span className={last >= first ? "text-good" : "text-bad"}>{last >= first ? "+" : ""}{last - first} LP</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-52" role="img" aria-label={`LP went from ${first} to ${last}, low ${lo}, high ${hi}`}>
        <defs><linearGradient id="lpfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity=".35" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></linearGradient></defs>
        <motion.path d={`${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`} fill="url(#lpfill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 0.8, duration: reduce ? 0 : 0.6 }} />
        <motion.path d={line} fill="none" stroke="rgb(var(--accent))" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.2, ease: "easeOut" }} />
        <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={4.5} fill="rgb(var(--gold))" />
      </svg>
      <div className="flex justify-between text-[11px] text-muted"><span>Low {lo} LP</span><span>High {hi} LP</span></div>
    </div>
  );
}
