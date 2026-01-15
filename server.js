import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔥 THIS IS THE CRITICAL LINE
app.use(express.static("public"));

let players = [];
let potatoHolder = null;

io.on("connection", socket => {
  console.log("Connected:", socket.id);

  players.push(socket.id);
  io.emit("players", players.length);

  if (players.length === 2) {
    potatoHolder = players[0];
    io.emit("start", potatoHolder);
  }

  socket.on("throw", () => {
    if (socket.id !== potatoHolder) return;
    potatoHolder = players.find(p => p !== socket.id);
    io.emit("thrown", potatoHolder);
  });

  socket.on("disconnect", () => {
    players = players.filter(p => p !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Listening on", PORT);
});
