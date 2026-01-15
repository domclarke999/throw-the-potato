import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = []; // {id, name}
let requiredPlayers = 2;
let potatoHolder = null;
let timer = null;
let gameActive = false;

// Random challenges
const challenges = [
  "Do 10 jumping jacks!",
  "Sing a song for 30 seconds!",
  "Speak in an accent until your next turn!",
  "Do a funny dance move!",
  "Make a silly face for 10 seconds!",
  "Tell a joke!",
  "Hop on one leg for 10 seconds!",
  "Act like a chicken for 5 seconds!"
];

// Send lobby updates
function updateLobby() {
  const waiting = requiredPlayers - players.length;
  io.emit("lobbyUpdate", { waiting: waiting > 0 ? waiting : 0, required: requiredPlayers });
}

// Start game
function startGame() {
  if (players.length < requiredPlayers) return;
  gameActive = true;
  potatoHolder = players[Math.floor(Math.random() * players.length)].id;
  io.emit("gameStart", { potatoHolder, players });
  startTimer();
}

// Timer for current holder
function startTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    // First player eliminated
    const eliminated = players.find(p => p.id === potatoHolder);
    if (!eliminated) return;

    gameActive = false; // Stop the game

    // Pick random challenge
    const challenge = challenges[Math.floor(Math.random() * challenges.length)];

    // Notify eliminated player
    io.to(eliminated.id).emit("playerEliminated", { challenge });

    // Notify remaining players
    players.forEach(p => {
      if (p.id !== eliminated.id) {
        io.to(p.id).emit("survivedMessage", { message: "You got lucky this time, Potato Head!" });
      }
    });

  }, 30000); // 30s per throw
}

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  // Player submits name
  socket.on("setName", name => {
    players.push({ id: socket.id, name });
    
    // First player is host
    if (players.length === 1) socket.emit("host");

    updateLobby();

    // Auto-start if enough players
    if (!gameActive && players.length >= requiredPlayers) startGame();
  });

  socket.on("setPlayerCount", count => {
    requiredPlayers = count;
    updateLobby();
  });

  socket.on("throwPotato", () => {
    if (!gameActive) return;
    if (socket.id !== potatoHolder) return;

    clearTimeout(timer);

    const others = players.filter(p => p.id !== socket.id);
    if (others.length === 0) return;

    potatoHolder = others[Math.floor(Math.random() * others.length)].id;
    io.emit("potatoThrown", { to: potatoHolder });
    startTimer();
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p.id !== socket.id);
    updateLobby();
    if (potatoHolder === socket.id && gameActive && players.length > 0) {
      potatoHolder = players[Math.floor(Math.random() * players.length)].id;
      io.emit("potatoThrown", { to: potatoHolder });
      startTimer();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
