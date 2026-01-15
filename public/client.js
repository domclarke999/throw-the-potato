console.log("client loaded");

const status = document.getElementById("status");

const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

ws.onopen = () => {
  status.innerText = "Connected. Waiting for players...";
};

ws.onmessage = e => {
  console.log("Server:", e.data);
  const msg = JSON.parse(e.data);

  if (msg.type === "lobby") {
    status.innerText = `Waiting: ${msg.count}/${msg.min}`;
  }

  if (msg.type === "gameStarted") {
    status.innerText = "🎉 GAME STARTED!";
  }
};
