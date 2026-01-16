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
const throwBtn = document.getElementById("throwBtn");
const potato = document.getElementById("potato");

let myId = null;
let players = [];
let potatoHolder = null;

/* JOINED */
socket.on("joined", data => {
  myId = data.yourId;
});

/* NAME ENTRY */
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

/* JOIN LOBBY */
joinBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  status.textContent = "Waiting for players...";
};

/* LOBBY STATUS */
socket.on("lobbyUpdate", ({ waiting, required }) => {
  status.textContent =
    waiting === "?"
      ? "Waiting for host..."
      : `Waiting for ${waiting} more player(s) (of ${required})`;
};

/* GAME START */
socket.on("gameStart", data => {
  players = data.players;
  potatoHolder = data.potatoHolder;
  lobby.hidden = true;
  game.hidden = false;
  updateUI();
});

/* THROW POTATO */
throwBtn.onclick = () => {
  socket.emit("throwPotato");
};

/* POTATO MOVED */
socket.on("potatoThrown", ({ to }) => {
  potatoHolder = to;
  animatePotato();
  updateUI();
};

/* ✅ UPDATED HOLDER TEXT */
function updateUI() {
  const holder = players.find(p => p.id === potatoHolder);

  if (!holder) {
    holderEl.textContent = "🥔 Potato is in play...";
  } else if (holder.id === myId) {
    holderEl.textContent = "🥔 You have the potato!";
  } else {
    holderEl.textContent = `🥔 ${holder.name} has the potato`;
  }

  throwBtn.disabled = myId !== potatoHolder;
}

/* POTATO ANIMATION */
function animatePotato() {
  potato.classList.remove("fly");
  void potato.offsetWidth; // force reflow
  potato.classList.add("fly");
}
