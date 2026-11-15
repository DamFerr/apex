import { createRequire } from "node:module";
// Loaded via require so test runners that do not know the built-in "node:sqlite" module cannot break it.
export const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
export type DatabaseSync = import("node:sqlite").DatabaseSync;
