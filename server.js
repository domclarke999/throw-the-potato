// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Serve static files (index.html, sounds/)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// --- WebSocket ---
const wss = new WebSocketServer({ server });

// --- Game state ---
let players = {}; // pid -> { ws, alive, holding, lastLauncher, holdStartTime, lat, lon, currentLobbyId }
let lobbies = {}; // lobbyId -> { id, players: [], gameStarted, potato, interval }

// --- Utilities ---
function generateId(len = 5) {
  return Math.random().toString(36).substr(2, len);
}

function broadcastToLobby(lobbyId, data) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const msg = JSON.stringify(data);
  lobby.players.forEach(pid => {
    if (players[pid]) players[pid].ws.send(msg);
  });
}

// --- Lobby Management ---
function createLobby() {
  const lobbyId = generateId(6);
  lobbies[lobbyId] = {
    id: lobbyId,
    players: [],
    gameStarted: false,
    potato: { lat: 0, lon: 0, vx: 0, vy: 0, holder: null, inFlight: false, lastLauncher: null },
    interval: null
  };
  return lobbyId;
}

function addPlayerToLobby(pid, lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  lobby.players.push(pid);
  players[pid].currentLobbyId = lobbyId;

  broadcastToLobby(lobbyId, {
    type: "lobbyUpdate",
    lobbyId,
    players: lobby.players,
    gameStarted: lobby.gameStarted
  });

  // Auto-start game when 10 players join
  if (!lobby.gameStarted && lobby.players.length >= 2) startGame(lobbyId);
}

// --- Game Logic ---
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  lobby.gameStarted = true;
  const idx = Math.floor(Math.random() * lobby.players.length);
  const firstHolder = lobby.players[idx];
  lobby.potato.holder = firstHolder;
  players[firstHolder].holding = true;
  players[firstHolder].holdStartTime = Date.now();

  broadcastToLobby(lobbyId, { type: "gameStarted", potatoHolder: firstHolder });

  lobby.interval = setInterval(() => gameLoop(lobbyId), 100);
}

function gameLoop(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const potato = lobby.potato;

  // --- Move potato ---
  if (potato.inFlight) {
    potato.lat += potato.vy;
    potato.lon += potato.vx;

    for (let pid of lobby.players) {
      const p = players[pid];
      if (!p.alive || p.holding) continue;
      const dx = (p.lon - potato.lon) * 111111;
      const dy = (p.lat - potato.lat) * 111111;
      if (Math.hypot(dx, dy) < 10) {
        potato.inFlight = false;
        potato.holder = pid;
        p.holding = true;
        p.holdStartTime = Date.now();
        broadcastToLobby(lobbyId, { type: "hit", target: pid, from: potato.lastLauncher });
        break;
      }
    }
  }

  // --- Elimination timer ---
  for (let pid of lobby.players) {
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

      broadcastToLobby(lobbyId, { type: "eliminated", player: pid, potatoHolder: potato.holder });
    }
  }

  // --- Winner detection ---
  const alive = lobby.players.filter(pid => players[pid]?.alive);
  if (alive.length === 1) {
    broadcastToLobby(lobbyId, { type: "winner", player: alive[0] });
    resetLobby(lobbyId);
    return;
  }

  // --- Potato nearby vibration ---
  for (let pid of lobby.players) {
    const p = players[pid];
    if (!p.alive || p.holding) continue;
    const dx = (p.lon - potato.lon) * 111111;
    const dy = (p.lat - potato.lat) * 111111;
    const distance = Math.hypot(dx, dy);
    if (distance < 50) p.ws.send(JSON.stringify({ type: "potatoNearby" }));
  }

  broadcastToLobby(lobbyId, {
    type: "update",
    players: lobby.players.map(pid => ({ id: pid, ...players[pid] })),
    holder: potato.holder,
    potato
  });
}

function resetLobby(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  clearInterval(lobby.interval);
  lobby.interval = null;
  lobby.gameStarted = false;

  for (let pid of lobby.players) {
    const p = players[pid];
    if (p) {
      p.alive = true;
      p.holding = false;
      p.lastLauncher = null;
      p.holdStartTime = null;
    }
  }

  lobby.potato = { lat: 0, lon: 0, vx: 0, vy: 0, holder: null, inFlight: false, lastLauncher: null };
  broadcastToLobby(lobbyId, {
    type: "lobbyUpdate",
    lobbyId,
    players: lobby.players,
    gameStarted: false
  });
}

// --- WebSocket connections ---
wss.on("connection", ws => {
  const pid = generateId();
  players[pid] = { ws, alive: true, holding: false, lastLauncher: null, holdStartTime: null, lat:0, lon:0, currentLobbyId: null };

  // Assign to lobby
  let lobbyId = Object.values(lobbies).find(l => !l.gameStarted && l.players.length < 10)?.id;
  if (!lobbyId) lobbyId = createLobby();
  addPlayerToLobby(pid, lobbyId);

  ws.send(JSON.stringify({ type: "joinedLobby", id: pid, lobbyId }));

  ws.on("message", msg => {
    const data = JSON.parse(msg);
    const currentLobbyId = players[pid].currentLobbyId;
    const lobby = lobbies[currentLobbyId];
    if (!lobby) return;

    if (data.type === "location") {
      players[pid].lat = data.lat;
      players[pid].lon = data.lon;
    }

    if (data.type === "launch" && lobby.potato.holder === pid) {
      lobby.potato.vx = data.vx * 0.00001;
      lobby.potato.vy = data.vy * 0.00001;
      lobby.potato.inFlight = true;
      lobby.potato.lastLauncher = pid;
      players[pid].holding = false;
      lobby.potato.holder = null;
    }
  });

  ws.on("close", () => {
    const lobbyId = players[pid]?.currentLobbyId;
    delete players[pid];
    if (lobbies[lobbyId]) {
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter(x => x !== pid);
      broadcastToLobby(lobbyId, { type: "lobbyUpdate", lobbyId, players: lobbies[lobbyId].players, gameStarted: lobbies[lobbyId].gameStarted });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
