/** Riot regions (platform ids) and ranked tiers, shared by Settings and the stats filter bar. */
export const PLATFORMS: [string, string][] = [["euw1", "Europe West"], ["eun1", "Europe Nordic & East"], ["tr1", "Turkey"], ["ru", "Russia"], ["na1", "North America"], ["br1", "Brazil"],
  ["la1", "Latin America North"], ["la2", "Latin America South"], ["kr", "Korea"], ["jp1", "Japan"], ["oc1", "Oceania"],
  ["me1", "Middle East"], ["ph2", "Philippines"], ["sg2", "Singapore"], ["th2", "Thailand"], ["tw2", "Taiwan"], ["vn2", "Vietnam"]];
export const platformName = (id: string) => PLATFORMS.find((p) => p[0] === id)?.[1] ?? id.toUpperCase();
export const TIERS = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
export const tierName = (t: string) => t[0] + t.slice(1).toLowerCase();
/** Ranks are always cumulative: a tier means that tier and everything above it (Emerald = Emerald IV and up). */
export const rankLabel = (tier: string) => (tier === "CHALLENGER" ? "Challenger" : `${tierName(tier)}+`);
