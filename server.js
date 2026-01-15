import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;

let players = {};
let lobby = {
  players: [],
  gameStarted: false
};

function sendLobbyState() {
  lobby.players.forEach(pid => {
    players[pid].ws.send(JSON.stringify({
      type: lobby.gameStarted ? "gameStarted" : "lobby",
      players: lobby.players,
      minPlayers: MIN_PLAYERS
    }));
  });
}

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  console.log("WS connection");

  const pid = Math.random().toString(36).slice(2, 6);
  players[pid] = { ws };
  lobby.players.push(pid);

  sendLobbyState();

  if (!lobby.gameStarted && lobby.players.length >= MIN_PLAYERS) {
    lobby.gameStarted = true;
    sendLobbyState();
  }

  ws.on("close", () => {
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];
    lobby.gameStarted = false;
    sendLobbyState();
  });
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
