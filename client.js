const ws = new WebSocket(`ws://${location.host}`);

let playerId = null;

const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const lobbyStatus = document.getElementById("lobbyStatus");
const gameStatus = document.getElementById("gameStatus");

ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "joined") {
    playerId = msg.playerId;
  }

  if (msg.type === "lobby") {
    lobbyDiv.style.display = "block";
    gameDiv.style.display = "none";

    lobbyStatus.innerText =
      `Waiting for players: ${msg.players.length}/${msg.minPlayers}`;
  }

  if (msg.type === "gameStarted") {
    lobbyDiv.style.display = "none";
    gameDiv.style.display = "block";

    gameStatus.innerText =
      msg.potatoHolder === playerId
        ? "🔥 You have the potato!"
        : "🥔 Someone else has the potato!";
  }
};
