const socket = io();

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");
const status = document.getElementById("status");
const hostControls = document.getElementById("hostControls");
const playerSelect = document.getElementById("playerSelect");
const startBtn = document.getElementById("startBtn");

const arena = document.getElementById("arena");
const playersDiv = document.getElementById("players");
const potato = document.getElementById("potato");
const throwBtn = document.getElementById("throwBtn");
const timerEl = document.getElementById("timer");

const sound = document.getElementById("incomingSound");

let myId;
let potatoHolder;
let players = [];
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

  players = data.players || [];
  potatoHolder = data.potatoHolder;

  renderPlayers();
  placePotato(potatoHolder);
  updateUI();
  startTimer(30);
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
    sound.play().catch(() => {});
    navigator.vibrate?.(200);
    startTimer(30);
  }
});

// RENDER PLAYERS
function renderPlayers() {
  playersDiv.innerHTML = "";

  const positions = [
    { x: 20, y: 75 },
    { x: 250, y: 75 },
    { x: 135, y: 10 },
    { x: 135, y: 140 }
  ];

  players.forEach((id, i) => {
    const p = document.createElement("div");
    p.className = "player";
    p.textContent = "🙂";
    p.style.left = positions[i].x + "px";
    p.style.top = positions[i].y + "px";
    p.dataset.id = id;
    playersDiv.appendChild(p);
  });
}

// POTATO POSITION
function placePotato(holder) {
  const player = document.querySelector(`.player[data-id="${holder}"]`);
  if (!player) return;

  const pr = player.getBoundingClientRect();
  const ar = arena.getBoundingClientRect();

  potato.style.transform =
    `translate(${pr.left - ar.left}px, ${pr.top - ar.top}px)`;
}

// ANIMATE POTATO
function animatePotato(from, to) {
  const fromEl = document.querySelector(`.player[data-id="${from}"]`);
  const toEl = document.querySelector(`.player[data-id="${to}"]`);
  if (!fromEl || !toEl) return;

  const ar = arena.getBoundingClientRect();
  const fr = fromEl.getBoundingClientRect();
  const tr = toEl.getBoundingClientRect();

  const startX = fr.left - ar.left;
  const startY = fr.top - ar.top;
  const endX = tr.left - ar.left;
  const endY = tr.top - ar.top;

  potato.style.transform = `translate(${startX}px, ${startY}px)`;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      potato.style.transform = `translate(${endX}px, ${endY}px)`;
    });
  });
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
