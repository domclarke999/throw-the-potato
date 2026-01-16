import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const challenges = [
  "Do 10 star jumps",
  "Sing a song chosen by the group",
  "Speak in an accent for 2 minutes",
  "Tell an embarrassing story"
];

let lobby = {
  players: [],
  requiredPlayers: null,
  started: false,
  potatoHolder: null
};

function tryStartGame() {
  if (
    !lobby.started &&
    lobby.requiredPlayers &&
    lobby.players.length === lobby.requiredPlayers
  ) {
    lobby.started = true;

    const holder =
      lobby.players[Math.floor(Math.random() * lobby.players.length)];

    lobby.potatoHolder = holder.id;

    holder.holdingSince = Date.now();

    io.emit("gameStart", {
      players: lobby.players.map(p => ({ id: p.id, name: p.name })),
      potatoHolder: lobby.potatoHolder
    });
  }
}

io.on("connection", socket => {
  const player = {
    id: socket.id,
    name: "",
    holdingSince: null
  };

  lobby.players.push(player);

  // Host = first player
  if (lobby.players.length === 1) {
    socket.emit("host");
  }

  socket.emit("joined", { yourId: socket.id });

  io.emit("lobbyUpdate", {
    waiting:
      lobby.requiredPlayers
        ? lobby.requiredPlayers - lobby.players.length
        : "?",
    required: lobby.requiredPlayers
  });

  socket.on("setName", name => {
    player.name = name;
  });

  socket.on("setPlayerCount", count => {
    if (lobby.requiredPlayers === null) {
      lobby.requiredPlayers = count;
      io.emit("lobbyUpdate", {
        waiting: count - lobby.players.length,
        required: count
      });
      tryStartGame();
    }
  });

  socket.on("throwPotato", () => {
    if (socket.id !== lobby.potatoHolder) return;

    const others = lobby.players.filter(p => p.id !== socket.id);
    if (!others.length) return;

    const target = others[Math.floor(Math.random() * others.length)];
    lobby.potatoHolder = target.id;

    io.emit("potatoThrown", { to: target.id });
  });

  socket.on("disconnect", () => {
    lobby.players = lobby.players.filter(p => p.id !== socket.id);
  });
});

server.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
