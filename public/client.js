const socket = io();

const nameEntry = document.getElementById("nameEntry");
const nameInput = document.getElementById("nameInput");
const nameBtn = document.getElementById("nameBtn");

const lobby = document.getElementById("lobby");
const status = document.getElementById("status");
const hostControls = document.getElementById("hostControls");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");

const game = document.getElementById("game");
const holderEl = document.getElementById("holder");
const potato = document.getElementById("potato");
const throwBtn = document.getElementById("throwBtn");
const timerEl = document.getElementById("timer");
const sound = document.getElementById("incomingSound");

let myId;
let myName;
let potatoHolder;
let players = [];
let timerInterval = null;

// Submit name
nameBtn.onclick = () => {
  const val = nameInput.value.trim();
  if (!val) return;
  myName = val;
  nameEntry.hidden = true;
  lobby.hidden = false;
  socket.emit("setName", myName);
};

// Host controls
socket.on("host", () => { hostControls.hidden = false; });
startBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  hostControls.hidden = true;
};

// Lobby updates
socket.on("lobbyUpdate", ({waiting, required}) => {
  status.textContent = waiting > 0 
    ? `Waiting for ${waiting} player(s) to join (out of ${required})...` 
    : "Lobby full! Game will start soon...";
});

// Game start
socket.on("gameStart", data => {
  players = data.players;
  potatoHolder = data.potatoHolder;
  lobby.hidden = true;
  game.hidden = false;
  updateUI();
  startTimer(30);
});

// Throw potato
throwBtn.onclick = () => {
  stopTimer();
  socket.emit("throwPotato");
};

// Potato thrown
socket.on("potatoThrown", ({ to }) => {
  potatoHolder = to;
  updateUI();
  triggerAnimation();
  if (to === socket.id) {
    sound.play().catch(()=>{});
    navigator.vibrate?.(200);
    startTimer(30);
  }
});

// Animation
function triggerAnimation() {
  potato.classList.remove("fly");
  void potato.offsetHeight; // force reflow
  potato.classList.add("fly");
}

// Timer
function startTimer(seconds) {
  stopTimer();
  let remaining = seconds;
  timerEl.textContent = `Time: ${remaining}`;
  timerInterval = setInterval(() => {
    remaining--;
    timerEl.textContent = `Time: ${remaining}`;
    if (remaining <= 0) stopTimer();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

// Update UI
function updateUI() {
  const holder = players.find(p => p.id === potatoHolder);
  holderEl.textContent = `Potato is with: ${holder?.id === socket.id ? "You" : holder?.name || potatoHolder}`;
  throwBtn.disabled = socket.id !== potatoHolder;
}
