const lobbyDiv = document.getElementById("lobby");
const gameDiv = document.getElementById("game");
const lobbyText = document.getElementById("lobbyText");
const gameText = document.getElementById("gameText");
const timerText = document.getElementById("timer");
const throwBtn = document.getElementById("throwBtn");
const playersContainer = document.getElementById("playersContainer");
const potato = document.getElementById("potato");

let myId = null;
let lastHolder = null;
let potatoInFlight = false;
let audioUnlocked = false;

const audio = new Audio("incoming.wav");

// Unlock audio for iOS
function unlockAudio() {
  if (!audioUnlocked) {
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audioUnlocked = true; }).catch(()=>{});
  }
}

document.body.addEventListener("click", unlockAudio, { once:true });
document.body.addEventListener("touchstart", unlockAudio, { once:true });

const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

let playerDivs = {};

function vibrate() {
  navigator.vibrate?.([200,100,200]);
}

function updatePlayers(players) {
  playersContainer.innerHTML = "";
  playerDivs = {};
  players.forEach((pid, idx) => {
    const div = document.createElement("div");
    div.classList.add("player");
    div.innerText = pid;
    div.dataset.pid = pid;
    div.style.left = `${idx * 80}px`;
    playerDivs[pid] = div;
    playersContainer.appendChild(div);
  });
}

// Animate potato fly
function movePotatoTo(newHolderId) {
  const target = playerDivs[newHolderId];
  if (!target) return;

  const containerRect = playersContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // Start at last holder
  if (lastHolder) {
    const lastRect = playerDivs[lastHolder].getBoundingClientRect();
    const startX = lastRect.left - containerRect.left + lastRect.width/2 - potato.offsetWidth/2;
    const startY = lastRect.top - containerRect.top + lastRect.height/2 - potato.offsetHeight/2;
    potato.style.transform = `translate(${startX}px, ${startY}px)`;
  }

  // Target coordinates
  const x = targetRect.left - containerRect.left + targetRect.width/2 - potato.offsetWidth/2;
  const y = targetRect.top - containerRect.top + targetRect.height/2 - potato.offsetHeight/2;

  // Animate
  requestAnimationFrame(() => {
    potato.style.transform = `translate(${x}px, ${y}px)`;
  });
}

ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  myId = msg.yourId;

  if (msg.type === "lobby") {
    lobbyDiv.style.display = "block";
    gameDiv.style.display = "none";
    lobbyText.innerText = `Waiting for players: ${msg.players.length}/${msg.minPlayers}`;
    return;
  }

  if (msg.type === "winner") {
    alert("🏆 You win!");
    return;
  }

  lobbyDiv.style.display = "none";
  gameDiv.style.display = "block";

  updatePlayers(msg.players);

  if (msg.timeRemaining != null) {
    timerText.innerText = `⏱ ${Math.ceil(msg.timeRemaining / 1000)}s`;
  }

  // Fly potato
  if (msg.potatoHolder && lastHolder !== msg.potatoHolder) {
    potatoInFlight = true;
    movePotatoTo(msg.potatoHolder);

    setTimeout(() => {
      potatoInFlight = false;

      if (msg.potatoHolder === myId) {
        gameText.innerText = "🔥 YOU HAVE THE POTATO!";
        throwBtn.disabled = false;
        if (audioUnlocked) audio.play().catch(()=>{});
        vibrate();
      } else {
        gameText.innerText = "🥔 Someone else has the potato";
        throwBtn.disabled = true;
      }

      lastHolder = msg.potatoHolder;
    }, 1000);
  }
};

// Throw button
throwBtn.onclick = () => {
  if (!potatoInFlight) {
    potatoInFlight = true;
    throwBtn.disabled = true;
    ws.send(JSON.stringify({ type: "throw" }));
  }
};
