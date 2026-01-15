import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;
const HOLD_LIMIT_MS = 60_000;

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

function sendState() {
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
  sendState();
}

setInterval(() => {
  if (!lobby.gameStarted) return;
  const holder = players[lobby.potatoHolder];
  if (!holder) return;

  if (Date.now() - holder.holdingSince > HOLD_LIMIT_MS) {
    holder.alive = false;
    lobby.players = lobby.players.filter(p => p !== lobby.potatoHolder);

    if (lobby.players.length === 1) {
      broadcast({ type: "winner", player: lobby.players[0] });
      lobby.gameStarted = false;
      lobby.potatoHolder = null;
      sendState();
      return;
    }

    lobby.potatoHolder =
      lobby.players[Math.floor(Math.random() * lobby.players.length)];
    players[lobby.potatoHolder].holdingSince = Date.now();
    sendState();
  }
}, 1000);

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

  // ✅ SEND PLAYER ID
  ws.send(JSON.stringify({
    type: "welcome",
    playerId: pid
  }));

  sendState();

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
      sendState();
    }
  });

  ws.on("close", () => {
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];
    lobby.gameStarted = false;
    lobby.potatoHolder = null;
    sendState();
  });
});

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
