/** TEST ONLY: the real API with a fake Riot behind it, so end-to-end tests can run without a key or internet. Port 8788. */
import { buildApp } from "./app";
import { HttpError } from "./riot";
import { fakeDD, fakeRiot, idleCollector, memoryCache, diverseStore } from "./testkit";

const riot = fakeRiot(), account = riot.account;
riot.account = async (n, t, r) => {
  if (n === "Na Player") return { puuid: "na-p", gameName: n, tagLine: t };           // a player who lives on another region
  try { return await account(n, t, r); } catch { throw new HttpError(404, "Not found on Riot's servers"); }
};
const ids = riot.matchIds, sm = riot.summoner;
riot.matchIds = async (p, region, ...rest) => (p === "na-p" ? (region === "americas" ? ["NA1_9"] : []) : ids(p, region, ...rest)); // only the americas cluster has her games
riot.summoner = async (p, pf) => (p === "na-p" ? { summonerLevel: 77 } : sm(p, pf));
const store = diverseStore();
const app = await buildApp({ riot, cache: memoryCache(), dd: fakeDD, store, collector: idleCollector(riot, store), defaultPlatform: "euw1" });
await app.listen({ host: "127.0.0.1", port: 8788 });
console.log("Fake-Riot test API on 8788");
