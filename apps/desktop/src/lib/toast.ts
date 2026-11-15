import { create } from "zustand";
export interface ToastItem { id: number; msg: string; kind: "info" | "error" }
export const useToasts = create<{ items: ToastItem[]; dismiss: (id: number) => void }>((set) => ({
  items: [], dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
let next = 1;
export function toast(msg: string, kind: ToastItem["kind"] = "info") {
  const id = next++;
  useToasts.setState((s) => ({ items: [...s.items, { id, msg, kind }] }));
  setTimeout(() => useToasts.getState().dismiss(id), 3500);
}
