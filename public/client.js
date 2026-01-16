const socket = io();

/* ---------------- DOM ---------------- */
const nameScreen = document.getElementById("nameScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");

const nameInput = document.getElementById("playerName");
const saveNameBtn = document.getElementById("saveName");

const playerCountSelect = document.getElementById("playerCount");
const joinLobbyBtn = document.getElementById("joinLobby");

const lobbyText = document.getElementById("lobbyText");

const statusText = document.getElementById("status");
const throwBtn = document.getElementById("throwBtn");
const timerText = document.getElementById("timer");

const playersContainer = document.getElementById("players");
const potato = document.getElementById("potato");

/* ---------------- STATE ---------------- */
let myId = null;
let isHost = false;
let players = [];
let potatoHolder = null;
let holdTimer = null;
let holdSeconds = 0;

/* ---------------- HELPERS ---------------- */
function show(screen) {
  nameScreen.style.display = "none";
  lobbyScreen.style.display = "none";
  gameScreen.style.display = "none";
  screen.style.display = "block";
}

function startTimer() {
  clearInterval(holdTimer);
  holdSeconds = 0;
  timerText.textContent = "0s";
  holdTimer = setInterval(() => {
    holdSeconds++;
    timerText.textContent = holdSeconds + "s";
  }, 1000);
}

function stopTimer() {
  clearInterval(holdTimer);
  timerText.textContent = "";
}

/* ---------------- SOCKET EVENTS ---------------- */
socket.on("joined", data => {
  myId = data.yourId;
  show(nameScreen);
});

socket.on("host", () => {
  isHost = true;
  document.getElementById("hostControls").style.display = "block"; // only host sees dropdown
});

socket.on("lobbyUpdate", data => {
  show(lobbyScreen);

  if (data.waiting === "?") {
    lobbyText.textContent = "Waiting for host to select player count…";
    return;
  }

  if (data.waiting > 0) {
    lobbyText.textContent =
      `Waiting for ${data.waiting} more player(s) (of ${data.required})`;
  } else {
    lobbyText.textContent = "Starting game…";
  }
});

socket.on("gameStart", data => {
  show(gameScreen);
  players = data.players;
  potatoHolder = data.potatoHolder;
  renderPlayers();
  updatePotatoState();
});

socket.on("potatoThrown", data => {
  animatePotato(potatoHolder, data.to);
  potatoHolder = data.to;
  updatePotatoState();
});

/* ---------------- UI ACTIONS ---------------- */
saveNameBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit("setName", name);
  show(lobbyScreen);
};

joinLobbyBtn.onclick = () => {
  if (isHost) {
    const count = Number(playerCountSelect.value);
    socket.emit("setPlayerCount", count);
    playerCountSelect.disabled = true; // disable host selector after sending
  }
  socket.emit("joinLobby");
};

throwBtn.onclick = () => {
  socket.emit("throwPotato");
  throwBtn.disabled = true;
  stopTimer();
};

/* ---------------- RENDER ---------------- */
function renderPlayers() {
  playersContainer.innerHTML = "";
  players.forEach((p, index) => {
    const el = document.createElement("div");
    el.className = "player";
    el.dataset.id = p.id;
    el.textContent = p.name;
    el.style.left = 50 + index * 120 + "px";
    el.style.top = "80px";
    playersContainer.appendChild(el);
  });
}

function updatePotatoState() {
  const holder = players.find(p => p.id === potatoHolder);
  if (!holder) return;

  statusText.textContent =
    potatoHolder === myId
      ? "🥔 You have the potato!"
      : `🥔 ${holder.name} has the potato`;

  if (potatoHolder === myId) {
    throwBtn.disabled = false; // enable for holder
    startTimer();
  } else {
    throwBtn.disabled = true; // disable for others
    stopTimer();
  }

  movePotatoTo(holder.id);
}

/* ---------------- POTATO ANIMATION ---------------- */
function movePotatoTo(playerId) {
  const target = document.querySelector(`.player[data-id="${playerId}"]`);
  if (!target) return;
  const pRect = target.getBoundingClientRect();
  const cRect = playersContainer.getBoundingClientRect();
  const x = pRect.left - cRect.left + pRect.width / 2;
  const y = pRect.top - cRect.top - 30;
  potato.style.transform = `translate(${x}px, ${y}px)`;
}

function animatePotato(fromId, toId) {
  movePotatoTo(fromId);
  setTimeout(() => movePotatoTo(toId), 50);
}
