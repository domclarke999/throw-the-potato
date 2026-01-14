import express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const MIN_PLAYERS = 2;

let players = {};
let lobbies = {};

function id() {
  return Math.random().toString(36).slice(2, 7);
}

function createLobby() {
  const lobbyId = id();
  lobbies[lobbyId] = {
    id: lobbyId,
    players: [],
    gameStarted: false,
    potatoHolder: null
  };
  return lobbies[lobbyId];
}

function sendLobbyState(lobby) {
  lobby.players.forEach(pid => {
    players[pid].ws.send(JSON.stringify({
      type: lobby.gameStarted ? "gameStarted" : "lobby",
      players: lobby.players,
      minPlayers: MIN_PLAYERS,
      potatoHolder: lobby.potatoHolder
    }));
  });
}

function tryStartGame(lobby) {
  if (lobby.gameStarted) return;
  if (lobby.players.length < MIN_PLAYERS) return;

  lobby.gameStarted = true;
  lobby.potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)];

  sendLobbyState(lobby);
}

const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  const pid = id();
  players[pid] = { ws, lobbyId: null };

  let lobby = Object.values(lobbies).find(
    l => !l.gameStarted
  );

  if (!lobby) lobby = createLobby();

  lobby.players.push(pid);
  players[pid].lobbyId = lobby.id;

  ws.send(JSON.stringify({ type: "joined", playerId: pid }));
  sendLobbyState(lobby);
  tryStartGame(lobby);

  ws.on("close", () => {
    const lobby = lobbies[players[pid]?.lobbyId];
    if (!lobby) return;
    lobby.players = lobby.players.filter(p => p !== pid);
    delete players[pid];
    sendLobbyState(lobby);
  });
});

server.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
