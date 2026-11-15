/** Win-rate math (plan section 4.3). Pure functions, no dependencies. */

/** Wilson score interval for a win rate. Returns [lower, upper] in 0..1. */
export function wilson(wins: number, games: number, z = 1.96): [number, number] {
  if (games <= 0) return [0, 1];
  const p = wins / games, z2 = z * z;
  const denom = 1 + z2 / games;
  const center = (p + z2 / (2 * games)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/**
 * Bayesian shrinkage with a Beta prior: pulls small samples toward the baseline.
 * `strength` = how many "virtual games" the prior is worth.
 */
export function shrink(wins: number, games: number, baseline = 0.5, strength = 20): number {
  return (wins + baseline * strength) / (games + strength);
}

/** z-score of an observed win rate against a baseline rate. */
export function zScore(wins: number, games: number, baseline = 0.5): number {
  if (games <= 0 || baseline <= 0 || baseline >= 1) return 0;
  return (wins / games - baseline) / Math.sqrt((baseline * (1 - baseline)) / games);
}

export type SampleBadge = "low" | "medium" | "high";
/** Sample-size badge so tiny samples are never presented as meaningful. */
export function sampleBadge(games: number): SampleBadge {
  return games < 50 ? "low" : games < 300 ? "medium" : "high";
}
