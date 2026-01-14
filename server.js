import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("."));

// --- Constants ---
const MIN_PLAYERS = 2;  // change to 10 for production

// --- Game state ---
let players = {}; // pid -> { ws, alive, holding, lobbyId, holdStartTime, lat, lon }
let lobbies = {}; // lobbyId -> { players: [], gameStarted, potato, interval }

// --- Utilities ---
function generateId(len = 5) {
  return Math.random().toString(36).substr(2, len);
}

function broadcast(lobbyId, data) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const msg = JSON.stringify(data);
  lobby.players.forEach(pid => {
    if (players[pid]) players[pid].ws.send(msg);
  });
}

// --- Lobby ---
function createLobby() {
  const id = generateId(6);
  lobbies[id] = {
    players: [],
    gameStarted: false,
    potato: { holder: null, inFlight: false, vx: 0, vy: 0, lastLauncher: null },
    interval: null
  };
  return lobbies[id];
}

function addPlayerToLobby(pid) {
  let lobby = Object.values(lobbies).find(l => !l.gameStarted && l.players.length < 100);
  if (!lobby) lobby = createLobby();

  lobby.players.push(pid);
  players[pid].lobbyId = lobby.id;

  // Broadcast lobby state (waiting or game)
  broadcastLobby(lobby.id);

  // Start game only if enough players
  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    startGame(lobby.id);
  }
}

function broadcastLobby(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const type = lobby.gameStarted ? "update" : "waiting";
  broadcast(lobbyId, {
    type,
    players: lobby.players,
    potato: lobby.potato,
    minPlayers: MIN_PLAYERS,
    gameStarted: lobby.gameStarted
  });
}

// --- Game ---
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  lobby.gameStarted = true;
  const idx = Math.floor(Math.random() * lobby.players.length);
  const firstHolder = lobby.players[idx];
  lobby.potato.holder = firstHolder;
  players[firstHolder].holding = true;
  players[firstHolder].holdStartTime = Date.now();

  broadcastLobby(lobbyId);

  lobby.interval = setInterval(() => gameLoop(lobbyId), 100);
}

function gameLoop(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const potato = lobby.potato;

  // Potato in flight
  if (potato.inFlight) {
    potato.lat += potato.vy;
    potato.lon += potato.vx;

    for (const pid of lobby.players) {
      const p = players[pid];
      if (!p.alive || p.holding) continue;
      const dx = (p.lon - potato.lon) * 111111;
      const dy = (p.lat - potato.lat) * 111111;
      if (Math.hypot(dx, dy) < 10) {
        potato.inFlight = false;
        potato.holder = pid;
        p.holding = true;
        p.holdStartTime = Date.now();
        broadcastLobby(lobbyId);
        break;
      }
    }
  }

  // Elimination after 5 minutes
  for (const pid of lobby.players) {
    const p = players[pid];
    if (!p.holding || !p.alive) continue;
    if (Date.now() - p.holdStartTime > 5 * 60 * 1000) {
      p.alive = false;
      p.holding = false;
      const returnTo = potato.lastLauncher;
      if (returnTo && players[returnTo]?.alive) {
        potato.holder = returnTo;
        players[returnTo].holding = true;
        players[returnTo].holdStartTime = Date.now();
      }
      broadcastLobby(lobbyId);
    }
  }

  // Winner detection
  const alive = lobby.players.filter(pid => players[pid]?.alive);
  if (alive.length === 1) {
    broadcast(lobbyId, { type: "winner", player: alive[0] });
    resetLobby(lobbyId);
    return;
  }

  // Potato nearby vibration
  for (const pid of lobby.players) {
    const p = players[pid];
    if (!p.alive || p.holding) continue;
    const dx = (p.lon - potato.lon) * 111111;
    const dy = (p.lat - potato.lat) * 111111;
    const distance = Math.hypot(dx, dy);
    if (distance < 50) p.ws.send(JSON.stringify({ type: "potatoNearby" }));
  }

  broadcastLobby(lobbyId);
}

function resetLobby(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  clearInterval(lobby.interval);
  lobby.interval = null;
  lobby.gameStarted = false;
  lobby.potato = { holder: null, inFlight: false, vx: 0, vy: 0, lastLauncher: null };
  lobby.players.forEach(pid => {
    const p = players[pid];
    if (p) {
      p.alive = true;
      p.holding = false;
      p.holdStartTime = null;
    }
  });
  broadcastLobby(lobbyId);
}

// --- WebSocket ---
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = generateId();
  players[pid] = { ws, lobbyId: null, holding: false, alive: true, lat: 0, lon: 0, holdStartTime: null };

  addPlayerToLobby(pid);

  ws.send(JSON.stringify({ type: "joinedLobby", playerId: pid }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    const lobbyId = players[pid].lobbyId;
    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    if (data.type === "launch" && lobby.potato.holder === pid) {
      lobby.potato.vx = data.vx * 0.00001;
      lobby.potato.vy = data.vy * 0.00001;
      lobby.potato.inFlight = true;
      lobby.potato.lastLauncher = pid;
      players[pid].holding = false;
      lobby.potato.holder = null;
      broadcastLobby(lobbyId);
    }

    if (data.type === "location") {
      players[pid].lat = data.lat;
      players[pid].lon = data.lon;
    }
  });

  ws.on("close", () => {
    const lobbyId = players[pid]?.lobbyId;
    delete players[pid];
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter(p => p !== pid);
      broadcastLobby(lobbyId);
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
