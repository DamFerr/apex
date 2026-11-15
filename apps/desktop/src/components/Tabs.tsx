import { motion } from "framer-motion";
import { spring } from "./ui";

/** Accessible tabs: role=tablist, arrow-key navigation, animated underline. */
export function Tabs<T extends string>({ tabs, value, onChange, id }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void; id: string }) {
  const move = (d: number) => { const i = tabs.findIndex((t) => t.key === value); onChange(tabs[(i + d + tabs.length) % tabs.length].key); };
  return (
    <div role="tablist" className="flex gap-1 border-b border-line/10"
      onKeyDown={(e) => { if (e.key === "ArrowRight") move(1); if (e.key === "ArrowLeft") move(-1); }}>
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} tabIndex={value === t.key ? 0 : -1} onClick={() => onChange(t.key)}
          className={`focus-ring relative px-4 h-10 text-sm rounded-t-md transition-colors ${value === t.key ? "text-text" : "text-muted hover:text-text"}`}>
          {t.label}
          {value === t.key && <motion.span layoutId={`tab-${id}`} transition={spring} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
        </button>))}
    </div>
  );
}
