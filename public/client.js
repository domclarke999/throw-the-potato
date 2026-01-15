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
const holderEl = document.getElementById("holder");
const sound = document.getElementById("incomingSound");

let myId;
let potatoHolder;
let timerInterval = null;

socket.on("connect", () => { myId = socket.id; });

// Host UI
socket.on("host", () => { hostControls.hidden = false; });
startBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  hostControls.hidden = true;
};

// Lobby updates
socket.on("lobbyUpdate", waiting => {
  if (!game.hidden) return;
  status.textContent = waiting > 0 ? `Waiting for ${waiting} player(s)...` : "Lobby full!";
});

// Game start
socket.on("gameStart", data => {
  lobby.hidden = true;
  game.hidden = false;
  potatoHolder = data.potatoHolder;
  updateUI();
  startTimer(30);
});

// Throw potato
throwBtn.onclick = () => {
  stopTimer();
  socket.emit("throwPotato");
};

// Potato thrown event
socket.on("potatoThrown", ({ to }) => {
  potatoHolder = to;
  updateUI();
  triggerAnimation();
  if (to === myId) {
    sound.play().catch(()=>{});
    navigator.vibrate?.(200);
    startTimer(30);
  }
});

// Animation
function triggerAnimation() {
  potato.classList.remove("fly");
  void potato.offsetHeight; // reflow
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
  throwBtn.disabled = myId !== potatoHolder;
  holderEl.textContent = `Potato is with: ${potatoHolder === myId ? "You" : potatoHolder}`;
}
