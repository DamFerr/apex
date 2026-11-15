import { shrink } from "@apex/stats-core";
import type { Role } from "@apex/schema";
import { logit, type DraftData } from "./engine";

/**
 * Layer D: how much your own record on a champion moves its log-odds. Your win rate is shrunk toward the
 * population rate, so 3 games barely matter and 100 games matter a lot.
 */
export function personalZ(population: number, wins: number, games: number, strength = 15): number {
  if (games <= 0) return 0;
  return logit(shrink(wins, games, population, strength)) - logit(population);
}

export interface BanSuggestion { champion: number; score: number; pp: number; against?: number }
/**
 * Who to ban for `role`: champions that are strong in general and, above all, that beat the champions you
 * actually play (weighted by your games). Synthetic data for now, same interface for real data later.
 */
export function recommendBans(role: Role, candidates: number[], data: DraftData, pool: { champion: number; games: number }[],
  opts: { exclude?: Set<number>; limit?: number } = {}): BanSuggestion[] {
  const total = pool.reduce((s, p) => s + p.games, 0), out: BanSuggestion[] = [];
  for (const c of candidates) {
    if (opts.exclude?.has(c) || !data.roles(c).includes(role)) continue;
    let z = logit(data.strength(c)), best = 0, against: number | undefined;
    for (const p of pool) {
      const contribution = 2 * (p.games / total) * data.matchup(c, p.champion);
      z += contribution;
      if (contribution > best) { best = contribution; against = p.champion; }
    }
    out.push({ champion: c, score: z, pp: z * 25, against });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 5);
}
