console.log("client.js loaded");

const status = document.getElementById("status");

// IMPORTANT: protocol-safe WebSocket
const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

ws.onopen = () => {
  console.log("WebSocket OPEN");
  status.innerText = "WebSocket connected";
};

ws.onerror = err => {
  console.error("WebSocket error", err);
  status.innerText = "WebSocket ERROR";
};

ws.onmessage = e => {
  console.log("Message from server:", e.data);
  const msg = JSON.parse(e.data);

  if (msg.type === "lobby") {
    status.innerText =
      `WAITING: ${msg.players.length}/${msg.minPlayers}`;
  }

  if (msg.type === "gameStarted") {
    status.innerText = "GAME STARTED";
  }
};
