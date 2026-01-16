import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

/* ---------------- STATE ---------------- */
let lobbies = {}; 
const INITIAL_HOLD_TIME = 60;

function createLobby() {
  const id = Math.random().toString(36).substring(2, 8);
  lobbies[id] = {
    id,
    players: [],
    hostId: null,
    requiredPlayers: null,
    started: false,
    potatoHolder: null,
    scores: {},
    maxHoldTime: INITIAL_HOLD_TIME,
    holdInterval: null,
  };
  return lobbies[id];
}

function broadcastLobby(lobby) {
  const waiting = lobby.requiredPlayers
    ? Math.max(0, lobby.requiredPlayers - lobby.players.length)
    : "?";
  io.to(lobby.id).emit("lobbyUpdate", { waiting, required: lobby.requiredPlayers || "?" });
}

function startGame(lobby) {
  lobby.started = true;
  const idx = Math.floor(Math.random() * lobby.players.length);
  lobby.potatoHolder = lobby.players[idx].id;
  lobby.players.forEach(p => (lobby.scores[p.id] = 0));

  io.to(lobby.id).emit("gameStart", {
    players: lobby.players,
    potatoHolder: lobby.potatoHolder,
    maxHoldTime: lobby.maxHoldTime,
    scores: lobby.scores,
  });

  startHoldTimer(lobby);
}

function startHoldTimer(lobby) {
  clearInterval(lobby.holdInterval);
  let countdown = lobby.maxHoldTime;

  lobby.holdInterval = setInterval(() => {
    countdown--;
    lobby.scores[lobby.potatoHolder] += 1;
    io.to(lobby.id).emit("scoreboard", lobby.scores);

    if (countdown <= 30 && countdown > 0) {
      io.to(lobby.id).emit("warning", {
        holder: lobby.potatoHolder,
        message: "⚠️ Potato burning your mitts!",
      });
    }

    if (countdown <= 0) {
      clearInterval(lobby.holdInterval);

      // ELIMINATION
      const eliminated = lobby.potatoHolder;
      io.to(lobby.id).emit("eliminated", {
        player: eliminated,
        message: "You made a right mash of things, here is your forfeit",
      });

      endGame(lobby);
    }
  }, 1000);
}

function endGame(lobby) {
  lobby.started = false;

  // Sort scoreboard: eliminated player last
  const sorted = [...lobby.players].sort((a, b) => {
    if (a.id === lobby.potatoHolder) return 1; // eliminated last
    if (b.id === lobby.potatoHolder) return -1;
    return lobby.scores[a.id] - lobby.scores[b.id];
  });

  io.to(lobby.id).emit("gameEnd", {
    players: sorted,
    scores: lobby.scores,
  });
}

/* ---------------- SOCKET.IO ---------------- */
io.on("connection", socket => {
  let currentLobby = null;
  let player = { id: socket.id, name: "", lobbyId: null };

  socket.on("setName", name => {
    player.name = name;

    const openLobby = Object.values(lobbies).find(l => !l.started && l.players.length < 20);
    if (openLobby) currentLobby = openLobby;
    else currentLobby = createLobby();

    player.lobbyId = currentLobby.id;
    socket.join(currentLobby.id);

    if (!currentLobby.hostId) currentLobby.hostId = socket.id;

    currentLobby.players.push(player);

    socket.emit("joined", { yourId: socket.id });
    if (socket.id === currentLobby.hostId) socket.emit("host");

    broadcastLobby(currentLobby);
  });

  socket.on("setPlayerCount", count => {
    if (!currentLobby || socket.id !== currentLobby.hostId) return;
    currentLobby.requiredPlayers = count;
    broadcastLobby(currentLobby);
  });

  socket.on("joinLobby", () => {
    if (!currentLobby) return;
    broadcastLobby(currentLobby);

    if (currentLobby.requiredPlayers &&
        currentLobby.players.length === currentLobby.requiredPlayers &&
        !currentLobby.started) {
      startGame(currentLobby);
    }
  });

  socket.on("throwPotato", () => {
    if (!currentLobby || !currentLobby.started) return;

    const others = currentLobby.players.filter(p => p.id !== currentLobby.potatoHolder);
    if (others.length === 0) return;

    const idx = Math.floor(Math.random() * others.length);
    const newHolder = others[idx].id;

    const fromHolder = currentLobby.potatoHolder;
    currentLobby.potatoHolder = newHolder;

    io.to(currentLobby.id).emit("potatoThrown", {
      from: fromHolder,
      to: newHolder,
    });

    startHoldTimer(currentLobby); // reset timer for new holder
  });

  socket.on("disconnect", () => {
    if (!currentLobby) return;
    currentLobby.players = currentLobby.players.filter(p => p.id !== socket.id);
    broadcastLobby(currentLobby);
  });
});

server.listen(3000, () => console.log("Server running on http://localhost:3000"));
