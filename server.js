import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let lobby = {
  hostId: null,
  requiredPlayers: null,
  started: false,
  players: [] // {id, name}
};

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  socket.emit("joined", { yourId: socket.id });

  // FIRST PLAYER IS HOST
  if (!lobby.hostId) {
    lobby.hostId = socket.id;
    socket.emit("host");
  }

  socket.on("setName", name => {
    socket.name = name;
  });

  socket.on("setPlayerCount", count => {
    if (socket.id !== lobby.hostId) return;

    lobby.requiredPlayers = count;
    broadcastLobby();
  });

  socket.on("disconnect", () => {
    lobby.players = lobby.players.filter(p => p.id !== socket.id);

    if (socket.id === lobby.hostId) {
      lobby.hostId = lobby.players[0]?.id || null;
      if (lobby.hostId) io.to(lobby.hostId).emit("host");
    }

    broadcastLobby();
  });

  socket.on("joinLobby", () => {
    if (lobby.started) return;

    if (!lobby.players.find(p => p.id === socket.id)) {
      lobby.players.push({ id: socket.id, name: socket.name });
    }

    broadcastLobby();

    // ✅ THIS WAS MISSING
    if (
      lobby.requiredPlayers &&
      lobby.players.length === lobby.requiredPlayers
    ) {
      startGame();
    }
  });

  socket.on("throwPotato", () => {
    if (!lobby.started) return;
    movePotato();
  });
});

/* -------------------- */

let potatoHolder = null;

function startGame() {
  lobby.started = true;

  potatoHolder =
    lobby.players[Math.floor(Math.random() * lobby.players.length)].id;

  io.emit("gameStart", {
    players: lobby.players,
    potatoHolder
  });

  console.log("Game started");
}

function movePotato() {
  const others = lobby.players.filter(p => p.id !== potatoHolder);
  if (!others.length) return;

  potatoHolder = others[Math.floor(Math.random() * others.length)].id;
  io.emit("potatoThrown", { to: potatoHolder });
}

function broadcastLobby() {
  if (!lobby.requiredPlayers) {
    io.emit("lobbyUpdate", { waiting: "?", required: "?" });
    return;
  }

  const waiting = lobby.requiredPlayers - lobby.players.length;

  io.emit("lobbyUpdate", {
    waiting,
    required: lobby.requiredPlayers
  });
}

/* -------------------- */

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
