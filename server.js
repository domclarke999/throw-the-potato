import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;
const HOLD_LIMIT_MS = 60_000; // 1 minute for demo

const lobby = {
  players: [],
  gameStarted: false,
  potatoHolder: null
};

const players = {}; // pid -> { ws, alive, holdingSince }

function broadcast(data) {
  lobby.players.forEach(pid => {
    players[pid]?.ws.send(JSON.stringify(data));
  });
}

function sendLobbyState() {
  broadcast({
    type: lobby.gameStarted ? "game" : "lobby",
    players: lobby.players,
    minPlayers: MIN_PLAYERS,
    potatoHolder: lobby.potatoHolder
  });
}

function startGame() {
  lobby.gameStarted = true;
  lobby.potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)];
  players[lobby.potatoHolder].holdingSince = Date.now();

  sendLobbyState();
}

function checkElimination() {
  if (!lobby.potatoHolder) return;

  const holder = players[lobby.potatoHolder];
  if (Date.now() - holder.holdingSince > HOLD_LIMIT_MS) {
    holder.alive = false;

    lobby.players = lobby.players.filter(p => p !== lobby.potatoHolder);

    if (lobby.players.length === 1) {
      broadcast({ type: "winner", player: lobby.players[0] });
      resetGame();
      return;
    }

    lobby.potatoHolder =
      lobby.players[Math.floor(Math.random() * lobby.players.length)];
    players[lobby.potatoHolder].holdingSince = Date.now();
    sendLobbyState();
  }
}

function resetGame() {
  lobby.players.forEach(pid => {
    players[pid].alive = true;
    players[pid].holdingSince = null;
  });

  lobby.gameStarted = false;
  lobby.potatoHolder = null;
  sendLobbyState();
}

setInterval(checkElimination, 1000);

// --- WebSocket ---
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = Math.random().toString(36).slice(2, 7);

  players[pid] = {
    ws,
    alive: true,
    holdingSince: null
  };

  lobby.players.push(pid);
  console.log("Player joined:", pid);

  sendLobbyState();

  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    startGame();
  }

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (
      data.type === "throw" &&
      lobby.gameStarted &&
      lobby.potatoHolder === pid
    ) {
      const others = lobby.players.filter(p => p !== pid);
      lobby.potatoHolder =
        others[Math.floor(Math.random() * others.length)];
      players[lobby.potatoHolder].holdingSince = Date.now();
      sendLobbyState();
    }
  });

  ws.on("close", () => {
    console.log("Player left:", pid);
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];

    if (lobby.players.length < MIN_PLAYERS) {
      lobby.gameStarted = false;
      lobby.potatoHolder = null;
    }

    sendLobbyState();
  });
});

server.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
