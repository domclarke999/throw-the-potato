import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔥 THIS FIXES YOUR MIME ERROR
app.use(express.static("public"));

let players = [];
let requiredPlayers = 2;
let potatoHolder = null;
let timer = null;

// SOCKETS
io.on("connection", socket => {
  console.log("Player joined:", socket.id);

  players.push(socket.id);

  if (players.length === 1) {
    socket.emit("host");
  }

  io.emit("playerCount", players.length);

  socket.on("setPlayerCount", count => {
    requiredPlayers = count;
    io.emit("lobbyUpdate", requiredPlayers);
  });

  if (players.length === requiredPlayers) {
    startGame();
  }

  socket.on("throwPotato", () => {
    if (socket.id !== potatoHolder) return;

    stopTimer();

    const others = players.filter(p => p !== socket.id);
    potatoHolder = others[Math.floor(Math.random() * others.length)];

    io.emit("potatoThrown", { to: potatoHolder });
    startTimer();
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p !== socket.id);
    io.emit("playerCount", players.length);
  });
});

function startGame() {
  potatoHolder = players[Math.floor(Math.random() * players.length)];
  io.emit("gameStart", { potatoHolder });
  startTimer();
}

function startTimer() {
  stopTimer();
  timer = setTimeout(() => {
    console.log("Timer expired");
  }, 30000);
}

function stopTimer() {
  if (timer) clearTimeout(timer);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
