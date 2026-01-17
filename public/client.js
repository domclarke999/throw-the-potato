const socket = io();

/* ================= AUDIO (iOS SAFE – SINGLE SYSTEM) ================= */
let audioCtx;
let incomingBuffer;
let audioUnlocked = false;

async function initAudio() {
  if (audioUnlocked) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  await audioCtx.resume();

  const res = await fetch("incoming.wav");
  const buf = await res.arrayBuffer();
  incomingBuffer = await audioCtx.decodeAudioData(buf);

  audioUnlocked = true;
  console.log("🔊 Audio unlocked");
}

function playIncomingSound() {
  if (!audioUnlocked || !incomingBuffer) return;

  const src = audioCtx.createBufferSource();
  src.buffer = incomingBuffer;
  src.connect(audioCtx.destination);
  src.start();
}

/* ================= DOM ================= */
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
const messageEl = document.getElementById("message");

const playersContainer = document.getElementById("players");
const potato = document.getElementById("potato");
const scoreboardEl = document.getElementById("scoreboard");

/* ================= STATE ================= */
let myId = null;
let isHost = false;
let players = [];
let potatoHolder = null;
let lastHolder = null;

let maxHoldTime = 60;
let countdown = 0;
let holdTimer = null;

/* ================= HELPERS ================= */
function show(screen) {
  [nameScreen, lobbyScreen, gameScreen].forEach(s => s.style.display = "none");
  screen.style.display = "block";
}

/* ================= TIMER ================= */
function startCountdown() {
  clearInterval(holdTimer);
  countdown = maxHoldTime;
  timerText.textContent = `${countdown}s`;

  holdTimer = setInterval(() => {
    countdown--;
    timerText.textContent = `${countdown}s`;

    if (countdown === 30) {
      messageEl.textContent = "🔥 This potato is burning my poor little mitts :-(";
      navigator.vibrate?.(500);
    }

    if (countdown <= 0) {
      clearInterval(holdTimer);
      // ❌ DO NOT auto-throw
      // Server will eliminate holder
    }
  }, 1000);
}

function stopCountdown() {
  clearInterval(holdTimer);
  timerText.textContent = "";
}

/* ================= SOCKET EVENTS ================= */
socket.on("joined", data => {
  myId = data.yourId;
  show(nameScreen);
});

socket.on("host", () => {
  isHost = true;
  document.getElementById("hostControls").style.display = "block";
});

socket.on("lobbyUpdate", data => {
  show(lobbyScreen);

  if (data.waiting === "?")
    lobbyText.textContent = "Waiting for host to select player count…";
  else if (data.waiting > 0)
    lobbyText.textContent = `Waiting for ${data.waiting} more player(s) (of ${data.required})`;
  else
    lobbyText.textContent = "Starting game…";
});

socket.on("gameStart", data => {
  show(gameScreen);
  players = data.players;
  potatoHolder = data.potatoHolder;
  maxHoldTime = data.maxHoldTime || 60;

  renderPlayers();
  updatePotatoState(true);
  updateScoreboard(data.scores || {});
  messageEl.textContent = "";
});

socket.on("potatoThrown", data => {
  potatoHolder = data.to;
  animatePotato(data.from, data.to);
  updatePotatoState(true);
});

socket.on("eliminated", data => {
  stopCountdown();

  if (data.player === myId) {
    messageEl.textContent =
      "😵 You made a right mash of things, here is your forfeit!";
  } else {
    messageEl.textContent =
      "😏 You got lucky this time, Potato Head";
  }
});

socket.on("gameEnd", data => {
  stopCountdown();
  statusText.textContent = "🏁 Game Over!";
  players = data.players;
  updateScoreboard(data.scores);
});

/* ================= UI ACTIONS ================= */
saveNameBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit("setName", name);
  show(lobbyScreen);
};

joinLobbyBtn.onclick = async () => {
  await initAudio();

  if (isHost) {
    const count = Number(playerCountSelect.value);
    socket.emit("setPlayerCount", count);
    playerCountSelect.disabled = true;
  }

  socket.emit("joinLobby");
};

throwBtn.onclick = () => {
  socket.emit("throwPotato");
  throwBtn.disabled = true;
  stopCountdown();
};

/* ================= RENDER ================= */
function renderPlayers() {
  playersContainer.innerHTML = "";
  players.forEach((p, i) => {
    const el = document.createElement("div");
    el.className = "player";
    el.dataset.id = p.id;
    el.textContent = p.name;
    el.style.left = `${60 + i * 120}px`;
    el.style.top = "80px";
    playersContainer.appendChild(el);
  });
}

/* ================= POTATO STATE ================= */
function updatePotatoState(playSound = false) {
  const holder = players.find(p => p.id === potatoHolder);
  if (!holder) return;

  statusText.textContent =
    potatoHolder === myId
      ? "🥔 You have the potato!"
      : `🥔 ${holder.name} has the potato`;

  if (potatoHolder === myId) {
    throwBtn.disabled = false;
    startCountdown();

    if (lastHolder !== myId && playSound) {
      playIncomingSound();
      navigator.vibrate?.(500);
    }
  } else {
    throwBtn.disabled = true;
    stopCountdown();
  }

  lastHolder = potatoHolder;
  movePotatoTo(holder.id);
}

/* ================= POTATO ANIMATION ================= */
function movePotatoTo(playerId) {
  const target = document.querySelector(`.player[data-id="${playerId}"]`);
  if (!target) return;

  const p = target.getBoundingClientRect();
  const c = playersContainer.getBoundingClientRect();

  potato.style.transform = `translate(
    ${p.left - c.left + p.width / 2}px,
    ${p.top - c.top - 40}px
  )`;
}

function animatePotato(fromId, toId) {
  movePotatoTo(fromId);
  setTimeout(() => movePotatoTo(toId), 300);
}

/* ================= SCOREBOARD ================= */
function updateScoreboard(scores) {
  scoreboardEl.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${scores[p.id] || 0}s`;
    scoreboardEl.appendChild(li);
  });
}
