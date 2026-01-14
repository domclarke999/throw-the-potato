import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("."));

// --- Constants ---
const MIN_PLAYERS = 2;
const MAX_PLAYERS_PER_LOBBY = 100;

// --- Game state ---
let players = {}; // pid -> { ws, lobbyId, holding, alive, lat, lon, holdStartTime }
let lobbies = {}; // lobbyId -> { id, players: [], gameStarted, potato, interval }

// --- Utilities ---
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

// --- Lobby Management ---
function createLobby() {
  const id = generateId(6);
  lobbies[id] = {
    id,
    players: [],
    gameStarted: false,
    potato: { holder: null, inFlight: false, vx: 0, vy: 0, lastLauncher: null },
    interval: null
  };
  console.log(`Created lobby ${id}`);
  return lobbies[id];
}

function getOpenLobby() {
  return Object.values(lobbies).find(l => !l.gameStarted && l.players.length < MAX_PLAYERS_PER_LOBBY);
}

function addPlayerToLobby(pid) {
  let lobby = getOpenLobby();
  if (!lobby) lobby = createLobby();

  lobby.players.push(pid);
  players[pid].lobbyId = lobby.id;
  console.log(`Player ${pid} joined lobby ${lobby.id}. Total: ${lobby.players.length}`);

  sendLobbyUpdate(lobby.id);

  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    startGame(lobby.id);
  }
}

function sendLobbyUpdate(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const type = lobby.gameStarted ? "gameUpdate" : "lobbyUpdate";
  broadcast(lobbyId, {
    type,
    lobbyId: lobby.id,
    players: lobby.players,
    potato: lobby.potato,
    minPlayers: MIN_PLAYERS,
    gameStarted: lobby.gameStarted
  });
}

// --- Game Management ---
function startGame(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;

  lobby.gameStarted = true;
  const idx = Math.floor(Math.random() * lobby.players.length);
  const firstHolder = lobby.players[idx];
  lobby.potato.holder = firstHolder;
  players[firstHolder].holding = true;
  players[firstHolder].holdStartTime = Date.now();

  sendLobbyUpdate(lobbyId);

  lobby.interval = setInterval(() => gameLoop(lobbyId), 100);
}

function gameLoop(lobbyId) {
  const lobby = lobbies[lobbyId];
  if (!lobby) return;
  const potato = lobby.potato;

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
        sendLobbyUpdate(lobbyId);
        break;
      }
    }
  }

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
      sendLobbyUpdate(lobbyId);
    }
  }

  const alive = lobby.players.filter(pid => players[pid]?.alive);
  if (alive.length === 1) {
    broadcast(lobbyId, { type: "winner", player: alive[0] });
    resetLobby(lobbyId);
    return;
  }

  for (const pid of lobby.players) {
    const p = players[pid];
    if (!p.alive || p.holding) continue;
    const dx = (p.lon - potato.lon) * 111111;
    const dy = (p.lat - potato.lat) * 111111;
    if (Math.hypot(dx, dy) < 50) p.ws.send(JSON.stringify({ type: "potatoNearby" }));
  }

  sendLobbyUpdate(lobbyId);
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
  sendLobbyUpdate(lobbyId);
}

// --- WebSocket ---
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = generateId();
  players[pid] = { ws, lobbyId: null, holding: false, alive: true, lat: 0, lon: 0, holdStartTime: null };

  addPlayerToLobby(pid);

  ws.send(JSON.stringify({ type: "joined", playerId: pid }));

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
      sendLobbyUpdate(lobbyId);
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
      sendLobbyUpdate(lobbyId);
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
