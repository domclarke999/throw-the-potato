import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Serve static files (index.html, sounds, etc.)
app.use(express.static(__dirname));

// Use cloud-assigned port
const PORT = process.env.PORT || 3000;

// WebSocket server attached to same HTTP server
const wss = new WebSocketServer({ server });

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "hello", msg: "Connected to server" }));
  console.log("Client connected");

  ws.on("message", message => {
    console.log("Received:", message.toString());
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
