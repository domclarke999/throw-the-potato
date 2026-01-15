const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const lobbyText = document.getElementById("lobbyText");
const gameText = document.getElementById("gameText");
const timerText = document.getElementById("timer");
const throwBtn = document.getElementById("throwBtn");
const potato = document.getElementById("potato");

let myId = null;
let lastHolder = null;

const audio = new Audio("incoming.wav");

const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

function vibrate() {
  navigator.vibrate?.([200, 100, 200]);
}

function animateThrow() {
  potato.classList.add("throw");
  setTimeout(() => potato.classList.remove("throw"), 600);
}

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  myId = msg.yourId;

  if (msg.type === "lobby") {
    lobbyDiv.style.display = "block";
    gameDiv.style.display = "none";
    lobbyText.innerText =
      `Waiting for players: ${msg.players.length}/${msg.minPlayers}`;
    return;
  }

  if (msg.type === "winner") {
    alert("🏆 You win!");
    return;
  }

  lobbyDiv.style.display = "none";
  gameDiv.style.display = "block";

  if (msg.timeRemaining != null) {
    timerText.innerText =
      `⏱ ${Math.ceil(msg.timeRemaining / 1000)}s`;
  }

  if (msg.potatoHolder === myId && lastHolder !== myId) {
    audio.play().catch(() => {});
    vibrate();
  }

  if (msg.potatoHolder === myId) {
    gameText.innerText = "🔥 YOU HAVE THE POTATO!";
    throwBtn.disabled = false;
  } else {
    gameText.innerText = "🥔 Someone else has the potato";
    throwBtn.disabled = true;
  }

  lastHolder = msg.potatoHolder;
};

throwBtn.onclick = () => {
  animateThrow();
  ws.send(JSON.stringify({ type: "throw" }));
};
