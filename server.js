import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];
let requiredPlayers = 2;
let potatoHolder = null;
let timer = null;

// Send lobby updates
function updateLobby() {
  const waiting = requiredPlayers - players.length;
  io.emit("lobbyUpdate", waiting > 0 ? waiting : 0);
}

// Start game
function startGame() {
  potatoHolder = players[Math.floor(Math.random() * players.length)];
  io.emit("gameStart", { potatoHolder });
  startTimer();
}

// Timer for current holder
function startTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log("Timer expired for", potatoHolder);
    // For now, just switch potato randomly
    const others = players.filter(p => p !== potatoHolder);
    if (others.length > 0) {
      potatoHolder = others[Math.floor(Math.random() * others.length)];
      io.emit("potatoThrown", { to: potatoHolder });
      startTimer();
    }
  }, 30000);
}

io.on("connection", socket => {
  console.log("Player connected", socket.id);
  players.push(socket.id);

  // First player is host
  if (players.length === 1) {
    socket.emit("host");
  }

  updateLobby();

  // Handle host setting number of players
  socket.on("setPlayerCount", count => {
    requiredPlayers = count;
    updateLobby();
  });

  // Handle throw
  socket.on("throwPotato", () => {
    if (socket.id !== potatoHolder) return;

    clearTimeout(timer);

    const others = players.filter(p => p !== socket.id);
    if (others.length === 0) return;

    potatoHolder = others[Math.floor(Math.random() * others.length)];
    io.emit("potatoThrown", { to: potatoHolder });
    startTimer();
  });

  // Check if game should start
  if (players.length >= requiredPlayers) startGame();

  socket.on("disconnect", () => {
    players = players.filter(p => p !== socket.id);
    updateLobby();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
