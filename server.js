import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;

// SINGLE LOBBY
const lobby = {
  players: [],
  gameStarted: false
};

const players = {};

function broadcast(data) {
  lobby.players.forEach(pid => {
    players[pid].ws.send(JSON.stringify(data));
  });
}

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = Math.random().toString(36).slice(2, 7);
  console.log("Player connected:", pid);

  players[pid] = { ws };
  lobby.players.push(pid);

  broadcast({
    type: "lobby",
    count: lobby.players.length,
    min: MIN_PLAYERS
  });

  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    lobby.gameStarted = true;
    broadcast({ type: "gameStarted" });
    console.log("GAME STARTED");
  }

  ws.on("close", () => {
    console.log("Player disconnected:", pid);
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];
    lobby.gameStarted = false;

    broadcast({
      type: "lobby",
      count: lobby.players.length,
      min: MIN_PLAYERS
    });
  });
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
