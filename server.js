import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];
let requiredPlayers = null;
let potatoHolder = null;
let gameStarted = false;

const challenges = [
  "Do 10 pushups",
  "Sing a song",
  "Drink a glass of water",
  "Dance for 10 seconds",
  "Say the alphabet backwards"
];

io.on("connection", (socket) => {
  console.log("Player joined", socket.id);

  players.push(socket.id);
  io.emit("playerCount", players.length);

  // First player chooses game size
  if (players.length === 1) {
    socket.emit("host");
  }

  socket.on("setPlayerCount", (count) => {
    if (requiredPlayers === null) {
      requiredPlayers = count;
      io.emit("lobbyUpdate", requiredPlayers);
      tryStartGame();
    }
  });

  socket.on("throwPotato", () => {
    if (socket.id !== potatoHolder) return;

    const others = players.filter(p => p !== potatoHolder);
    if (others.length === 0) return;

    const next = others[Math.floor(Math.random() * others.length)];
    potatoHolder = next;

    io.emit("potatoThrown", {
      from: socket.id,
      to: next
    });
  });

  socket.on("disconnect", () => {
    console.log("Player left", socket.id);

    players = players.filter(p => p !== socket.id);

    if (socket.id === potatoHolder && players.length > 0) {
      potatoHolder = players[0];
      io.emit("potatoAssigned", potatoHolder);
    }

    if (players.length === 0) {
      resetGame();
    }

    io.emit("playerCount", players.length);
  });

  function tryStartGame() {
    if (!gameStarted && requiredPlayers && players.length === requiredPlayers) {
      gameStarted = true;
      potatoHolder = players[Math.floor(Math.random() * players.length)];

      io.emit("gameStart", {
        potatoHolder
      });
    }
  }

  function resetGame() {
    players = [];
    requiredPlayers = null;
    potatoHolder = null;
    gameStarted = false;
  }
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
