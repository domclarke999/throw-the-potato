const ws = new WebSocket(`ws://${location.host}`);

let playerId = null;
let lobbyId = null;

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "joined") {
    playerId = data.playerId;
  }

  if (data.type === "lobbyUpdate") {
    document.getElementById("status").innerText =
      `Waiting for players: ${data.players.length} / ${data.minPlayers}`;
    document.getElementById("throwBtn").style.display = "none";
    renderLobby(data.players, data.potato);
  }

  if (data.type === "gameUpdate") {
    const holder = data.potato.holder;
    const status = holder === playerId ? "You have the potato!" :
                   holder ? `Player ${holder} has the potato!` : "Potato in flight!";
    document.getElementById("status").innerText = status;
    document.getElementById("throwBtn").style.display = "block";
    renderLobby(data.players, data.potato);
  }

  if (data.type === "winner") {
    alert(data.player === playerId ? "You win!" : `Player ${data.player} won the game`);
  }

  if (data.type === "potatoNearby" && navigator.vibrate) {
    navigator.vibrate(200);
  }
};

function renderLobby(players, potato) {
  const html = players.map(p => {
    const hasPotato = potato?.holder === p ? "🥔" : "";
    return `${p} ${hasPotato}`;
  }).join("<br>");
  document.getElementById("lobby").innerHTML = html;
}

document.getElementById("throwBtn").onclick = () => {
  ws.send(JSON.stringify({
    type: "launch",
    vx: Math.random() * 10,
    vy: Math.random() * 10
  }));
};
