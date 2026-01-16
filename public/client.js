const socket = io();

const nameScreen = document.getElementById("nameScreen");
const nameInput = document.getElementById("nameInput");
const nameBtn = document.getElementById("nameBtn");

const lobby = document.getElementById("lobby");
const status = document.getElementById("status");
const hostControls = document.getElementById("hostControls");
const playerSelect = document.getElementById("playerSelect");
const joinBtn = document.getElementById("joinBtn");

const game = document.getElementById("game");
const holderEl = document.getElementById("holder");
const timerEl = document.getElementById("timer");
const throwBtn = document.getElementById("throwBtn");
const potato = document.getElementById("potato");
const sound = document.getElementById("incomingSound");

let myId;
let potatoHolder;
let players = [];
let timer = null;

/* NAME */
nameBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit("setName", name);
  nameScreen.hidden = true;
  lobby.hidden = false;
};

/* HOST */
socket.on("host", () => {
  hostControls.hidden = false;
});

/* JOIN */
joinBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  status.textContent = "Waiting for players...";
};

/* LOBBY */
socket.on("lobbyUpdate", ({ waiting, required }) => {
  status.textContent =
    waiting > 0
      ? `Waiting for ${waiting} more players (of ${required})`
      : "Game starting...";
});

/* GAME START */
socket.on("gameStart", data => {
  myId = socket.id;
  players = data.players;
  potatoHolder = data.potatoHolder;
  lobby.hidden = true;
  game.hidden = false;
  updateUI();
  startTimer(60);
});

/* THROW */
throwBtn.onclick = () => {
  socket.emit("throwPotato");
  stopTimer();
};

/* POTATO MOVED */
socket.on("potatoThrown", ({ to }) => {
  potatoHolder = to;
  animatePotato();

  if (to === myId) {
    sound.play().catch(() => {});
    navigator.vibrate?.(200);
    startTimer(60);
  }

  updateUI();
});

/* WARNINGS */
socket.on("burning", () => {
  status.textContent = "🔥 This potato is burning my poor little mitts :-(";
});

socket.on("finalWarning", () => {
  status.textContent = "⚠️ 30 seconds left!";
  navigator.vibrate?.(300);
});

/* ELIMINATION */
socket.on("playerEliminated", ({ challenge }) => {
  alert(
    "You made a right mash of things, here is your forfeit:\n\n" + challenge
  );
});

socket.on("survivedMessage", ({ message }) => {
  alert(message);
});

/* UI */
function updateUI() {
  const holder = players.find(p => p.id === potatoHolder);
  holderEl.textContent =
    holder?.id === myId
      ? "You have the potato!"
      : `${holder?.name} has the potato`;
  throwBtn.disabled = myId !== potatoHolder;
}

function startTimer(sec) {
  stopTimer();
  let s = sec;
  timerEl.textContent = s;
  timer = setInterval(() => {
    s--;
    timerEl.textContent = s;
  }, 1000);
}

function stopTimer() {
  if (timer) clearInterval(timer);
}

function animatePotato() {
  potato.classList.remove("fly");
  void potato.offsetWidth; // force reflow
  potato.classList.add("fly");
}
