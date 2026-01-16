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

const forfeitScreen = document.createElement("div");
forfeitScreen.id = "forfeit";
forfeitScreen.style.display = "none";
forfeitScreen.innerHTML = `
  <h2>You made a right mash of things and deserve a roasting!!</h2>
  <p><strong>Here is your forfeit....chip away at it:</strong></p>
  <p id="challengeText"></p>
`;
document.body.appendChild(forfeitScreen);

const survivedScreen = document.createElement("div");
survivedScreen.id = "survived";
survivedScreen.style.display = "none";
survivedScreen.innerHTML = `
  <h2 id="surviveMsg"></h2>
`;
document.body.appendChild(survivedScreen);

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
socket.on("host", () => {
  hostControls.hidden = false;
});

startBtn.onclick = () => {
  socket.emit("setPlayerCount", Number(playerSelect.value));
  hostControls.hidden = true;
};

// Lobby updates
socket.on("lobbyUpdate", ({ waiting, required }) => {
  status.textContent =
    waiting > 0
      ? `Waiting for ${waiting} player(s) to join (out of ${required})...`
      : "Lobby full! Game will start soon...";
});

// Game start
socket.on("gameStart", data => {
  myId = socket.id;
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
    sound.play().catch(() => {});
    navigator.vibrate?.(200);
    startTimer(30);
  }
});

// ✅ UPDATED ELIMINATED MESSAGE
socket.on("playerEliminated", ({ challenge }) => {
  game.hidden = true;
  forfeitScreen.style.display = "block";
  document.getElementById("challengeText").textContent = challenge;
  stopTimer();
});

// Survivors message
socket.on("survivedMessage", ({ message }) => {
  game.hidden = true;
  survivedScreen.style.display = "block";
  document.getElementById("surviveMsg").textContent = message;
  stopTimer();
});

// Animation
function triggerAnimation() {
  potato.classList.remove("fly");
  void potato.offsetHeight;
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
  holderEl.textContent = `Potato is with: ${
    holder?.id === socket.id ? "You" : holder?.name || "Unknown"
  }`;
  throwBtn.disabled = socket.id !== potatoHolder;
}
