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
    document.getElementById("status").innerText = `Joined lobby ${lobbyId} as ${playerId}`;
  }

  if (data.type === "lobbyUpdate") {
    document.getElementById("status").innerText = `Players in lobby: ${data.players.length}`;
  }

  if (data.type === "gameStarted") {
    const holder = data.potatoHolder;
    if (holder === playerId) {
      document.getElementById("status").innerText = "You have the potato! Throw it!";
    } else {
      document.getElementById("status").innerText = `Player ${holder} has the potato!`;
    }
  }

  if (data.type === "potatoNearby") {
    if (navigator.vibrate) navigator.vibrate(200);
  }

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
