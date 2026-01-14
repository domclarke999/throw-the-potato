// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Serve static files if needed (index.html, client.js)
app.use(express.static("."));

// --- Game state ---
let players = {}; // pid -> { ws, alive, holding, lat, lon, lobbyId, holdStartTime }
let lobbies = {}; // lobbyId -> { players: [], gameStarted, potato, interval }

// Utility
function generateId(len = 5) {
  return Math.random().toString(36).substring(2, 2 + len);
}

function broadcast(lobbyId, data) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const msg = JSON.stringify(data);
  lobby.players.forEach(pid => {
    const p = players[pid];
    if (p) p.ws.send(msg);
  });
}

// Create new lobby
function createLobby() {
  const id = generateId(6);
  lobbies[id] = {
    players: [],
    gameStarted: false,
    potato: { holder: null, inFlight: false, vx: 0, vy: 0, lastLauncher: null },
    interval: null
  };
  return id;
}

// Add player to first open lobby
function addPlayerToLobby(pid) {
  let lobbyId = null;
  for (const id in lobbies) {
    if (!lobbies[id].gameStarted && lobbies[id].players.length < 100) {
      lobbyId = id;
      break;
    }
  }
  if (!lobbyId) lobbyId = createLobby();

  lobbies[lobbyId].players.push(pid);
  players[pid].lobbyId = lobbyId;

  console.log(`Player ${pid} joined lobby ${lobbyId}. Total: ${lobbies[lobbyId].players.length}`);

  broadcast(lobbyId, { type: "lobbyUpdate", players: lobbies[lobbyId].players });

  // Auto-start game when 2+ players (for testing)
  if (!lobbies[lobbyId].gameStarted && lobbies[lobbyId].players.length >= 2) startGame(lobbyId);
}

// Start the game
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  lobby.gameStarted = true;

  const idx = Math.floor(Math.random() * lobby.players.length);
  const firstHolder = lobby.players[idx];
  lobby.potato.holder = firstHolder;
  players[firstHolder].holding = true;
  players[firstHolder].holdStartTime = Date.now();

  console.log(`Game started in lobby ${lobbyId}. First holder: ${firstHolder}`);
  broadcast(lobbyId, { type: "gameStarted", potatoHolder: firstHolder });

  lobby.interval = setInterval(() => gameLoop(lobbyId), 100);
}

// Main game loop
function gameLoop(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const potato = lobby.potato;

  // Potato flight
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
        broadcast(lobbyId, { type: "hit", target: pid, from: potato.lastLauncher });
        break;
      }
    }
  }

  // Elimination
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
      broadcast(lobbyId, { type: "eliminated", player: pid, potatoHolder: potato.holder });
    }
  }

  // Winner
  const alive = lobby.players.filter(pid => players[pid]?.alive);
  if (alive.length === 1) {
    broadcast(lobbyId, { type: "winner", player: alive[0] });
    resetLobby(lobbyId);
    return;
  }

  // Nearby vibration
  for (const pid of lobby.players) {
    const p = players[pid];
    if (!p.alive || p.holding) continue;
    const dx = (p.lon - potato.lon) * 111111;
    const dy = (p.lat - potato.lat) * 111111;
    const distance = Math.hypot(dx, dy);
    if (distance < 50) p.ws.send(JSON.stringify({ type: "potatoNearby" }));
  }

  broadcast(lobbyId, { type: "update", players: lobby.players, potato });
}

// Reset lobby
function resetLobby(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  clearInterval(lobby.interval);
  lobby.interval = null;
  lobby.gameStarted = false;
  lobby.potato = { holder: null, inFlight: false, vx: 0, vy: 0, lastLauncher: null };

  for (const pid of lobby.players) {
    const p = players[pid];
    if (p) {
      p.alive = true;
      p.holding = false;
      p.holdStartTime = null;
    }
  }

  broadcast(lobbyId, { type: "lobbyUpdate", players: lobby.players });
}

// WebSocket setup
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("New connection");
  const pid = generateId();
  players[pid] = { ws, alive: true, holding: false, lat: 0, lon: 0, lobbyId: null, holdStartTime: null };

  addPlayerToLobby(pid);

  ws.send(JSON.stringify({ type: "joinedLobby", id: pid }));

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
      lobbies[lobbyId].players = lobbies[lobbyId].players.filter(x => x !== pid);
      broadcast(lobbyId, { type: "lobbyUpdate", players: lobbies[lobbyId].players });
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
