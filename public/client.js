const socket = io();

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const status = document.getElementById("status");
const hostControls = document.getElementById("hostControls");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");

const potato = document.getElementById("potato");
const throwBtn = document.getElementById("throwBtn");
const timerEl = document.getElementById("timer");
const sound = document.getElementById("incomingSound");

let myId;
let potatoHolder;
let timerInterval;

socket.on("connect", () => {
  myId = socket.id;
});

// HOST
socket.on("host", () => {
  hostControls.hidden = false;
});

startBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  hostControls.hidden = true;
};

// LOBBY
socket.on("playerCount", count => {
  status.textContent = `Players joined: ${count}`;
});

socket.on("lobbyUpdate", req => {
  status.textContent = `Waiting for ${req} players…`;
});

// GAME START
socket.on("gameStart", data => {
  lobby.hidden = true;
  game.hidden = false;

  potatoHolder = data.potatoHolder;
  updateUI();
  startTimer(30);
});

// THROW
throwBtn.onclick = () => {
  socket.emit("throwPotato");
};

// POTATO MOVED
socket.on("potatoThrown", ({ to }) => {
  triggerAnimation();
  potatoHolder = to;
  updateUI();

  if (to === myId) {
    sound.play().catch(() => {});
    navigator.vibrate?.(200);
    startTimer(30);
  }
});

// 🔥 ANIMATION — THIS WILL ALWAYS BE VISIBLE
function triggerAnimation() {
  potato.classList.remove("fly");
  void potato.offsetWidth; // force reflow
  potato.classList.add("fly");
}

// TIMER
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  timerEl.textContent = `Time: ${remaining}`;

  timerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = `Time: ${remaining}`;
    if (remaining <= 0) clearInterval(timerInterval);
  }, 1000);
}

// UI
function updateUI() {
  throwBtn.disabled = myId !== potatoHolder;
}
