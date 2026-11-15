/** Mock League client. Speaks the same event frames as the real LCU WebSocket, minus auth/TLS. Dev only. */
import http from "node:http";
import { WebSocketServer } from "ws";
import { CHAMPION_KEYS, buildSession, type ChampSelectSession, type Sim } from "@apex/lcu-core";

const PORT = 8765, PHASE = "/lol-gameflow/v1/gameflow-phase", SESSION = "/lol-champ-select/v1/session";
let phase = "None", session: ChampSelectSession | null = null, run = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = (uri: string, eventType: string, data: unknown) => JSON.stringify([8, "OnJsonApiEvent", { uri, eventType, data }]);

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  const m = req.url?.match(/^\/scenario\/(normal|dodge|reset)$/);
  if (req.method === "POST" && m) {
    if (m[1] === "reset") { run++; setSession(null); setPhase("None"); } else void play(m[1] as "normal" | "dodge");
    res.writeHead(200).end("ok"); return;
  }
  if (req.url === PHASE) { res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(phase)); return; }
  if (req.url === SESSION) { res.writeHead(session ? 200 : 404, { "Content-Type": "application/json" }).end(JSON.stringify(session)); return; }
  res.writeHead(404).end();
});
const wss = new WebSocketServer({ server });
const broadcast = (f: string) => wss.clients.forEach((c) => c.readyState === 1 && c.send(f));
const setPhase = (p: string) => { phase = p; console.log("phase:", p); broadcast(frame(PHASE, "Update", p)); };
const setSession = (s: ChampSelectSession | null) => { session = s; broadcast(frame(SESSION, s ? "Update" : "Delete", s)); };
// Late joiners get the current state, like subscribing to a running client.
wss.on("connection", (ws) => { console.log("client connected"); ws.send(frame(PHASE, "Update", phase)); if (session) ws.send(frame(SESSION, "Update", session)); });

async function play(name: "normal" | "dodge") {
  const id = ++run, live = () => id === run, ids = Object.keys(CHAMPION_KEYS).map(Number);
  const sim: Sim = { bans: [[], []], hover: {}, locked: {} }, push = () => setSession(buildSession(sim));
  console.log("scenario:", name);
  setPhase("Lobby"); await sleep(800); if (!live()) return;
  setPhase("ReadyCheck"); await sleep(1000); if (!live()) return;
  setPhase("ChampSelect"); push(); await sleep(900);
  sim.banTurn = 2; push(); await sleep(7000); if (!live()) return; delete sim.banTurn; // your ban turn: lets the ban suggestions show
  for (let i = 0; i < 6; i++) { if (!live()) return; sim.bans[i % 2].push(ids[i]); push(); await sleep(450); }
  let n = 6;
  for (const cell of [0, 5, 6, 1, 2, 7, 8, 3, 4, 9]) {
    if (!live()) return;
    const champ = ids[n++]; sim.hover[cell] = champ; push(); await sleep(700);
    if (!live()) return;
    sim.locked[cell] = champ; push(); await sleep(900);
    if (name === "dodge" && cell === 2) { await sleep(600); if (!live()) return; setSession(null); setPhase("Lobby"); return; }
  }
  await sleep(1500); if (!live()) return;
  setPhase("InProgress"); setSession(null);
}
server.listen(PORT, "127.0.0.1", () => console.log(`Mock LCU running on ws://127.0.0.1:${PORT}. Start a scenario from the Draft page.`));
