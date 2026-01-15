import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;

const lobby = {
  players: [],
  gameStarted: false,
  potatoHolder: null
};

const players = {}; // pid -> { ws }

function sendStateTo(pid) {
  players[pid].ws.send(JSON.stringify({
    type: lobby.gameStarted ? "game" : "lobby",
    yourId: pid,
    players: lobby.players,
    minPlayers: MIN_PLAYERS,
    potatoHolder: lobby.potatoHolder
  }));
}

function broadcastState() {
  lobby.players.forEach(sendStateTo);
}

function startGame() {
  lobby.gameStarted = true;
  lobby.potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)];
  broadcastState();
}

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = Math.random().toString(36).slice(2, 7);
  players[pid] = { ws };
  lobby.players.push(pid);

  broadcastState();

  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    startGame();
  }

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    // ✅ SAFE POTATO TRANSFER
    if (
      data.type === "throw" &&
      lobby.gameStarted &&
      lobby.potatoHolder === pid
    ) {
      const candidates = lobby.players.filter(p => p !== pid);

      // Safety guard (should never fail if MIN_PLAYERS >= 2)
      if (candidates.length === 0) return;

      lobby.potatoHolder =
        candidates[Math.floor(Math.random() * candidates.length)];

      broadcastState();
    }
  });

  ws.on("close", () => {
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];

    if (!lobby.gameStarted) {
      broadcastState();
      return;
    }

    // If holder disconnected, reassign
    if (lobby.potatoHolder === pid && lobby.players.length > 0) {
      lobby.potatoHolder =
        lobby.players[Math.floor(Math.random() * lobby.players.length)];
    }

    if (lobby.players.length < MIN_PLAYERS) {
      lobby.gameStarted = false;
      lobby.potatoHolder = null;
    }

    broadcastState();
  });
});

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
