const MIN_PLAYERS = 2;
const ws = new WebSocket(`ws://${location.host}`);

let playerId = null;
let lobbyId = null;

ws.onopen = () => console.log("Connected to server");

ws.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "joinedLobby") {
    playerId = data.id;
    lobbyId = data.lobbyId;
  }

  if (data.type === "lobbyUpdate") {
    let status = data.gameStarted ? "Game in progress!" :
      `Players in lobby: ${data.players.length} / ${MIN_PLAYERS} waiting...`;
    document.getElementById("status").innerText = status;

    // Show all players and potato holder
    const html = data.players.map(p => {
      const hasPotato = (data.potato && data.potato.holder === p) ? "🥔" : "";
      return `${p} ${hasPotato}`;
    }).join("<br>");
    document.getElementById("lobby").innerHTML = html;
  }

  if (data.type === "gameStarted") {
    const holder = data.potatoHolder;
    const status = holder === playerId ? "You have the potato! Throw it!" :
                   `Player ${holder} has the potato!`;
    document.getElementById("status").innerText = status;
  }

  if (data.type === "update") {
    const holder = data.potato.holder;
    const status = holder === playerId ? "You have the potato!" :
                   holder ? `Player ${holder} has the potato!` :
                   "Potato in flight!";
    document.getElementById("status").innerText = status;

    const html = data.players.map(p => {
      const hasPotato = holder === p ? "🥔" : "";
      return `${p} ${hasPotato}`;
    }).join("<br>");
    document.getElementById("lobby").innerHTML = html;
  }

  if (data.type === "potatoNearby") {
    if (navigator.vibrate) navigator.vibrate(200);
  }

  if (data.type === "hit" && data.target === playerId) alert("Potato hit you!");
  if (data.type === "winner") {
    if (data.player === playerId) alert("You win!");
    else alert(`Player ${data.player} won the game`);
  }
};

document.getElementById("throwBtn").onclick = () => {
  ws.send(JSON.stringify({
    type: "launch",
    vx: Math.random() * 10,
    vy: Math.random() * 10
  }));
};
