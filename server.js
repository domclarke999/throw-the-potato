import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;

let lobby = {
  players: [],
  gameStarted: false,
  potatoHolder: null
};

const players = {}; // pid -> ws

function broadcast() {
  lobby.players.forEach(pid => {
    players[pid]?.send(JSON.stringify({
      type: lobby.gameStarted ? "game" : "lobby",
      players: lobby.players,
      minPlayers: MIN_PLAYERS,
      potatoHolder: lobby.potatoHolder,
      yourId: pid
    }));
  });
}

function startGame() {
  lobby.gameStarted = true;
  lobby.potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)];
  broadcast();
}

function resetGame() {
  lobby.gameStarted = false;
  lobby.potatoHolder = null;
  broadcast();
}

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = Math.random().toString(36).slice(2, 7);
  players[pid] = ws;
  lobby.players.push(pid);

  broadcast();

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
      const targets = lobby.players.filter(p => p !== pid);
      if (!targets.length) return;

      lobby.potatoHolder =
        targets[Math.floor(Math.random() * targets.length)];

      broadcast();
    }
  });

  ws.on("close", () => {
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];

    if (lobby.players.length < MIN_PLAYERS) {
      resetGame();
    } else if (lobby.potatoHolder === pid) {
      lobby.potatoHolder =
        lobby.players[Math.floor(Math.random() * lobby.players.length)];
    }

    broadcast();
  });
});

server.listen(PORT, () =>
  console.log("Server running on port", PORT)
);
