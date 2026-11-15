import { AnimatePresence, motion } from "framer-motion";
import { useToasts } from "../lib/toast";
import { spring } from "./ui";

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="fixed bottom-10 right-6 z-[60] space-y-2" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
            transition={spring} className={`glass rounded-md px-4 py-2.5 text-sm border-l-2 ${t.kind === "error" ? "border-l-bad" : "border-l-accent"}`}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
