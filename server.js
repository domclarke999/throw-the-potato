import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;
const MAX_HOLD_TIME = 5 * 60 * 1000; // 5 minutes

let lobby = {
  players: [],
  gameStarted: false,
  potatoHolder: null,
  holdStart: null
};

const sockets = {}; // pid -> ws

function broadcast() {
  lobby.players.forEach(pid => {
    sockets[pid]?.send(JSON.stringify({
      type: lobby.gameStarted ? "game" : "lobby",
      yourId: pid,
      players: lobby.players,
      minPlayers: MIN_PLAYERS,
      potatoHolder: lobby.potatoHolder,
      timeRemaining: lobby.holdStart
        ? MAX_HOLD_TIME - (Date.now() - lobby.holdStart)
        : null
    }));
  });
}

function startGame() {
  lobby.gameStarted = true;
  lobby.potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)];
  lobby.holdStart = Date.now();
  broadcast();
}

function resetGame() {
  lobby.gameStarted = false;
  lobby.potatoHolder = null;
  lobby.holdStart = null;
  broadcast();
}

setInterval(() => {
  if (!lobby.gameStarted) return;
  if (Date.now() - lobby.holdStart > MAX_HOLD_TIME) {
    const eliminated = lobby.potatoHolder;
    lobby.players = lobby.players.filter(p => p !== eliminated);
    delete sockets[eliminated];

    if (lobby.players.length === 1) {
      sockets[lobby.players[0]]?.send(JSON.stringify({
        type: "winner"
      }));
      resetGame();
      return;
    }

    lobby.potatoHolder =
      lobby.players[Math.floor(Math.random() * lobby.players.length)];
    lobby.holdStart = Date.now();
    broadcast();
  }
}, 1000);

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = Math.random().toString(36).slice(2, 7);
  sockets[pid] = ws;
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
      lobby.potatoHolder =
        targets[Math.floor(Math.random() * targets.length)];
      lobby.holdStart = Date.now();
      broadcast();
    }
  });

  ws.on("close", () => {
    lobby.players = lobby.players.filter(p => p !== pid);
    delete sockets[pid];

    if (lobby.players.length < MIN_PLAYERS) {
      resetGame();
    } else if (lobby.potatoHolder === pid) {
      lobby.potatoHolder =
        lobby.players[Math.floor(Math.random() * lobby.players.length)];
      lobby.holdStart = Date.now();
    }

    broadcast();
  });
});

server.listen(PORT, () =>
  console.log("Server running on", PORT)
);
