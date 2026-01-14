const MIN_PLAYERS = 2; // must match server
const ws = new WebSocket(`ws://${location.host}`);

let playerId = null;
let lobbyId = null;

ws.onopen = () => console.log("Connected to server");

ws.onmessage = e => {
  const data = JSON.parse(e.data);
  console.log("Received:", data);

  if (data.type === "joinedLobby") {
    playerId = data.id;
    lobbyId = data.lobbyId;
    document.getElementById("status").innerText = `Joined lobby ${lobbyId}`;
  }

  if (data.type === "lobbyUpdate") {
    const playersCount = data.players.length;
    if (!data.gameStarted) {
      document.getElementById("status").innerText = `Players in lobby: ${playersCount} / ${MIN_PLAYERS} waiting...`;
    } else {
      document.getElementById("status").innerText = `Game in progress!`;
    }

    // Show all players and potato holder
    const html = data.players.map(p => {
      const hasPotato = (data.potato && data.potato.holder === p) ? "🥔" : "";
      return `${p} ${hasPotato}`;
    }).join("<br>");
    document.getElementById("lobby").innerHTML = html;
  }

  if (data.type === "gameStarted") {
    const holder = data.potatoHolder;
    if (holder === playerId) {
      document.getElementById("status").innerText = "You have the potato! Throw it!";
    } else {
      document.getElementById("status").innerText = `Player ${holder} has the potato!`;
    }
  }

  if (data.type === "update") {
    const holder = data.potato.holder;
    let statusText = holder === playerId ? "You have the potato!" :
                     holder ? `Player ${holder} has the potato!` :
                     "Potato in flight!";
    document.getElementById("status").innerText = statusText;

    const html = data.players.map(p => {
      const hasPotato = (holder === p) ? "🥔" : "";
      return `${p} ${hasPotato}`;
    }).join("<br>");
    document.getElementById("lobby").innerHTML = html;
  }

  if (data.type === "potatoNearby") {
    if (navigator.vibrate) navigator.vibrate(200);
  }

  if (data.type === "hit") {
    if (data.target === playerId) alert("Potato hit you!");
  }

  if (data.type === "winner") {
    if (data.player === playerId) alert("You win!");
    else alert(`Player ${data.player} won the game`);
  }
};

// Throw potato button
document.getElementById("throwBtn").onclick = () => {
  ws.send(JSON.stringify({
    type: "launch",
    vx: Math.random() * 10,
    vy: Math.random() * 10
  }));
};
