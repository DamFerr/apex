/** Turns a keydown into a combo string like "Ctrl+Shift+O". Returns "" for a bare modifier press. */
export function combo(e: KeyboardEvent): string {
  if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return "";
  const p: string[] = [];
  if (e.ctrlKey || e.metaKey) p.push("Ctrl");
  if (e.altKey) p.push("Alt");
  if (e.shiftKey) p.push("Shift");
  p.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return p.join("+");
}
