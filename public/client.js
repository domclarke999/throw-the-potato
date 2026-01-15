const socket = io();

const status = document.getElementById("status");
const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const throwBtn = document.getElementById("throwBtn");
const potato = document.getElementById("potato");
const sound = document.getElementById("incomingSound");

const hostControls = document.getElementById("hostControls");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");

let myId = null;
let potatoHolder = null;

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
socket.on("playerCount", (count) => {
  status.textContent = `Players joined: ${count}`;
});

socket.on("lobbyUpdate", (required) => {
  status.textContent = `Waiting for ${required} players...`;
});

// GAME START
socket.on("gameStart", (data) => {
  lobby.hidden = true;
  game.hidden = false;

  potatoHolder = data.potatoHolder;
  updateUI();
});

// THROW
throwBtn.onclick = () => {
  socket.emit("throwPotato");
};

socket.on("potatoThrown", ({ from, to }) => {
  animatePotato(from, to);
  potatoHolder = to;
  updateUI();

  if (to === myId) {
    playSound();
  }
});

function updateUI() {
  throwBtn.disabled = myId !== potatoHolder;
}

// ANIMATION
function animatePotato(from, to) {
  potato.classList.remove("fly");
  void potato.offsetWidth;
  potato.classList.add("fly");
}

// SOUND (mobile-safe)
function playSound() {
  sound.currentTime = 0;
  sound.play().catch(() => {});
}
