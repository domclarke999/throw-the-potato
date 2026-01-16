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
  "Drink a glass of water upside down",
  "Tell your most embarrassing story"
];

let lobby = {
  players: [],
  started: false,
  requiredPlayers: 2,
  potatoHolder: null,
  gameStartTime: null,
  holdLimit: 60
};

function recalcHoldLimit() {
  const minutes = Math.floor((Date.now() - lobby.gameStartTime) / 120000);
  lobby.holdLimit = Math.max(20, 60 - minutes * 10);
}

io.on("connection", socket => {
  socket.player = {
    id: socket.id,
    name: "",
    totalHoldTime: 0,
    holdingSince: null
  };

  lobby.players.push(socket.player);

  if (lobby.players.length === 1) {
    socket.emit("host");
  }

  socket.emit("joined");

  socket.on("setName", name => {
    socket.player.name = name;
  });

  socket.on("setPlayerCount", count => {
    lobby.requiredPlayers = count;
    io.emit("lobbyUpdate", {
      waiting: lobby.requiredPlayers - lobby.players.length,
      required: lobby.requiredPlayers
    });
  });

  if (!lobby.started) {
    io.emit("lobbyUpdate", {
      waiting: lobby.requiredPlayers - lobby.players.length,
      required: lobby.requiredPlayers
    });
  }

  if (!lobby.started && lobby.players.length === lobby.requiredPlayers) {
    lobby.started = true;
    lobby.gameStartTime = Date.now();
    lobby.potatoHolder = lobby.players[Math.floor(Math.random() * lobby.players.length)].id;

    lobby.players.forEach(p => {
      if (p.id === lobby.potatoHolder) {
        p.holdingSince = Date.now();
      }
    });

    io.emit("gameStart", {
      players: lobby.players.map(p => ({ id: p.id, name: p.name })),
      potatoHolder: lobby.potatoHolder
    });
  }

  socket.on("throwPotato", () => {
    if (socket.id !== lobby.potatoHolder) return;

    const now = Date.now();
    socket.player.totalHoldTime += now - socket.player.holdingSince;

    const others = lobby.players.filter(p => p.id !== socket.id);
    const target = others[Math.floor(Math.random() * others.length)];

    lobby.potatoHolder = target.id;
    target.holdingSince = now;

    io.emit("potatoThrown", { to: target.id });
  });

  const interval = setInterval(() => {
    if (!lobby.started) return;

    recalcHoldLimit();

    const holder = lobby.players.find(p => p.id === lobby.potatoHolder);
    if (!holder) return;

    const heldFor = (Date.now() - holder.holdingSince) / 1000;

    if (heldFor > 30 && !holder.burningWarned) {
      holder.burningWarned = true;
      io.to(holder.id).emit("burning");
    }

    if (lobby.holdLimit - heldFor <= 30 && !holder.finalWarned) {
      holder.finalWarned = true;
      io.to(holder.id).emit("finalWarning");
    }

    if (heldFor >= lobby.holdLimit) {
      // ELIMINATION
      const challenge = challenges[Math.floor(Math.random() * challenges.length)];

      io.to(holder.id).emit("playerEliminated", { challenge });

      lobby.players
        .filter(p => p.id !== holder.id)
        .forEach(p =>
          io.to(p.id).emit("survivedMessage", {
            message: "You got lucky this time, Potato Head"
          })
        );

      lobby.players.sort((a, b) => a.totalHoldTime - b.totalHoldTime);
      lobby.players.push(lobby.players.splice(lobby.players.indexOf(holder), 1)[0]);

      io.emit("scoreboard", lobby.players);

      lobby.started = false;
      clearInterval(interval);
    }
  }, 1000);

  socket.on("disconnect", () => {
    lobby.players = lobby.players.filter(p => p.id !== socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
