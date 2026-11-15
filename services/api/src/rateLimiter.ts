export interface Window { limit: number; ms: number }

/** Sliding-window limiter. Every Riot request goes through one, so the service stays under the key's limits. */
export class RateLimiter {
  private stamps: number[][];
  /** The last X-App-Rate-Limit header applied, so each change is only applied once. */
  lastHeader = "";
  constructor(private windows: Window[], private now = () => Date.now(),
    private sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), private lowShare = 0.5) { this.stamps = windows.map(() => []); }

  /** Replaces the limits (e.g. after Riot reports the real ones), keeping the requests already counted. */
  setWindows(w: Window[]) {
    const all = this.stamps.reduce((a, b) => (b.length > a.length ? b : a), [] as number[]), t = this.now();
    this.windows = w; this.stamps = w.map((x) => all.filter((s) => t - s < x.ms));
  }

  /** low = background work (the collector). It may only use `lowShare` of each window, so interactive requests always have room. */
  async acquire(low = false): Promise<void> {
    for (;;) {
      const t = this.now(); let wait = 0;
      this.windows.forEach((w, i) => {
        const s = this.stamps[i];
        while (s.length && t - s[0] >= w.ms) s.shift();
        const cap = low ? Math.max(1, Math.floor(w.limit * this.lowShare)) : w.limit;
        if (s.length >= cap) wait = Math.max(wait, w.ms - (t - s[0]));
      });
      if (!wait) { this.stamps.forEach((s) => s.push(t)); return; } // check and record happen together, so waiters cannot overshoot
      await this.sleep(wait);
    }
  }
}

/** Riot applies rate limits per region, so each host (europe, euw1, na1, ...) gets its own limiter. */
export class HostLimiters {
  private byHost = new Map<string, RateLimiter>();
  constructor(private defaults: Window[], private now?: () => number, private sleep?: (ms: number) => Promise<void>, private lowShare = 0.5) {}
  for(host: string): RateLimiter {
    let l = this.byHost.get(host);
    if (!l) { l = new RateLimiter(this.defaults.map((w) => ({ ...w })), this.now, this.sleep, this.lowShare); this.byHost.set(host, l); }
    return l;
  }
}

/** Parses Riot's "20:1,100:120" (requests:seconds) into windows. */
export function parseRateLimit(header: string | null): Window[] | null {
  if (!header) return null;
  const w = header.split(",").map((p) => p.split(":")).filter((p) => p.length === 2).map(([l, s]) => ({ limit: Number(l), ms: Number(s) * 1000 })).filter((x) => x.limit > 0 && x.ms > 0);
  return w.length ? w : null;
}
