const socket = io();

const status = document.getElementById("status");
const holderEl = document.getElementById("holder");
const throwBtn = document.getElementById("throwBtn");
const timerEl = document.getElementById("timer");
const potato = document.getElementById("potato");
const sound = document.getElementById("incomingSound");

let myId;
let potatoHolder;
let players = [];
let timer = null;

socket.on("joined", () => {
  myId = socket.id;
});

socket.on("lobbyUpdate", ({ waiting }) => {
  status.textContent =
    waiting > 0
      ? `Waiting for ${waiting} player(s)...`
      : "Game starting...";
});

socket.on("gameStart", data => {
  players = data.players;
  potatoHolder = data.potatoHolder;
  updateUI();
  startTimer(60);
});

socket.on("potatoThrown", ({ to }) => {
  potatoHolder = to;
  triggerAnimation();

  if (to === myId) {
    sound.play().catch(() => {});
    navigator.vibrate?.(200);
    startTimer(60);
  }

  updateUI();
});

socket.on("burning", () => {
  status.textContent = "🔥 This potato is burning my poor little mitts :-(";
});

socket.on("finalWarning", () => {
  status.textContent = "⚠️ Hurry! 30 seconds left!";
  navigator.vibrate?.(300);
});

socket.on("playerEliminated", ({ challenge }) => {
  alert(
    "You made a right mash of things, here is your forfeit:\n\n" + challenge
  );
});

socket.on("survivedMessage", ({ message }) => {
  alert(message);
});

throwBtn.onclick = () => {
  socket.emit("throwPotato");
  stopTimer();
};

function updateUI() {
  const holder = players.find(p => p.id === potatoHolder);
  holderEl.textContent =
    holder?.id === myId ? "You have the potato!" : `${holder?.name} has the potato`;
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

function triggerAnimation() {
  potato.classList.remove("fly");
  void potato.offsetWidth;
  potato.classList.add("fly");
}
