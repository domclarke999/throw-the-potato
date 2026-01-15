const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const lobbyText = document.getElementById("lobbyText");
const gameText = document.getElementById("gameText");
const throwBtn = document.getElementById("throwBtn");

let playerId = null;

const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "lobby") {
    lobbyDiv.style.display = "block";
    gameDiv.style.display = "none";
    lobbyText.innerText =
      `Waiting for players: ${msg.players.length}/${msg.minPlayers}`;
  }

  if (msg.type === "game") {
    lobbyDiv.style.display = "none";
    gameDiv.style.display = "block";

    if (msg.potatoHolder === playerId) {
      gameText.innerText = "🔥 YOU HAVE THE POTATO!";
      throwBtn.disabled = false;
    } else {
      gameText.innerText = "🥔 Someone else has the potato";
      throwBtn.disabled = true;
    }
  }

  if (msg.type === "winner") {
    alert(msg.player === playerId ? "YOU WIN!" : "You lost!");
  }
};

throwBtn.onclick = () => {
  ws.send(JSON.stringify({ type: "throw" }));
};
