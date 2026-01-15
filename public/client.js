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
let countdownInterval = null;

const audio = new Audio("incoming.wav");

// Unlock audio for iOS Safari
function unlockAudio() {
  if (!audioUnlocked) {
    audio.play().then(() => { 
      audio.pause(); 
      audio.currentTime = 0; 
      audioUnlocked = true; 
    }).catch(()=>{});
  }
}

document.body.addEventListener("click", unlockAudio, { once:true });
document.body.addEventListener("touchstart", unlockAudio, { once:true });

const protocol = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${protocol}://${location.host}`);

let playerDivs = {};

// vibration helper
function vibrate() { navigator.vibrate?.([200,100,200]); }

// Update players as circles
function updatePlayers(players) {
  playersContainer.innerHTML = "";
  playerDivs = {};
  const spacing = playersContainer.clientWidth / (players.length + 1);
  players.forEach((pid, idx) => {
    const div = document.createElement("div");
    div.classList.add("player");
    // Optionally show index or emoji
    div.innerText = "🙂";
    div.style.position = "absolute";
    div.style.left = `${spacing * (idx + 1) - 30}px`; // center circle
    div.style.top = `70px`;
    playerDivs[pid] = div;
    playersContainer.appendChild(div);
  });
}

// Initialize potato at current holder
function initPotatoPosition(holderId) {
  const target = playerDivs[holderId];
  if (!target) return;

  const containerRect = playersContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const x = targetRect.left - containerRect.left + targetRect.width/2 - potato.offsetWidth/2;
  const y = targetRect.top - containerRect.top + targetRect.height/2 - potato.offsetHeight/2;

  potato.style.transform = `translate(${x}px, ${y}px)`;
}

// Animate potato fly
function movePotatoTo(newHolderId) {
  const target = playerDivs[newHolderId];
  if (!target) return;

  const containerRect = playersContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  // start from last holder if exists
  if (lastHolder) {
    const lastRect = playerDivs[lastHolder].getBoundingClientRect();
    const startX = lastRect.left - containerRect.left + lastRect.width/2 - potato.offsetWidth/2;
    const startY = lastRect.top - containerRect.top + lastRect.height/2 - potato.offsetHeight/2;
    potato.style.transform = `translate(${startX}px, ${startY}px)`;
  }

  const x = targetRect.left - containerRect.left + targetRect.width/2 - potato.offsetWidth/2;
  const y = targetRect.top - containerRect.top + targetRect.height/2 - potato.offsetHeight/2;

  // Double requestAnimationFrame ensures animation triggers
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      potato.style.transform = `translate(${x}px, ${y}px)`;
    });
  });
}

// Start countdown timer
function startCountdown(duration) {
  clearInterval(countdownInterval);
  let remaining = duration;
  timerText.innerText = `${remaining}s`;
  countdownInterval = setInterval(() => {
    remaining--;
    timerText.innerText = `${remaining}s`;
    if (remaining <= 0) clearInterval(countdownInterval);
  }, 1000);
}

// WebSocket messages
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

  if (msg.timeRemaining != null) startCountdown(Math.ceil(msg.timeRemaining / 1000));

  // Animate potato fly
  if (msg.potatoHolder && lastHolder !== msg.potatoHolder) {
    potatoInFlight = true;
    movePotatoTo(msg.potatoHolder);

    setTimeout(() => {
      potatoInFlight = false;
      lastHolder = msg.potatoHolder;

      if (msg.potatoHolder === myId) {
        gameText.innerText = "🔥 YOU HAVE THE POTATO!";
        throwBtn.disabled = false;
        if (audioUnlocked) audio.play().catch(()=>{});
        vibrate();
      } else {
        gameText.innerText = "🥔 Someone else has the potato";
        throwBtn.disabled = true;
      }
    }, 1000); // match CSS transition duration
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
