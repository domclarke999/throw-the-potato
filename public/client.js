const socket = io();

// ================= AUDIO (iOS SAFE) =================
let audioCtx = null;
let incomingBuffer = null;
let audioUnlocked = false;

async function initAudio() {
  if (audioUnlocked) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // REQUIRED for iOS
  await audioCtx.resume();

  const response = await fetch("incoming.wav");
  const arrayBuffer = await response.arrayBuffer();
  incomingBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  audioUnlocked = true;
  console.log("🔊 Audio unlocked (iOS safe)");
}

function playIncomingSound() {
  if (!audioUnlocked || !incomingBuffer) return;

  const source = audioCtx.createBufferSource();
  source.buffer = incomingBuffer;
  source.connect(audioCtx.destination);
  source.start(0);
}


/* DOM */
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
const incomingSound = document.getElementById("incomingSound");

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;

  incomingSound.play().then(() => {
    incomingSound.pause();
    incomingSound.currentTime = 0;
    audioUnlocked = true;
    console.log("🔊 Audio unlocked");
  }).catch(() => {
    // Safari sometimes needs a second tap
  });
}

/* STATE */
let myId = null;
let isHost = false;
let players = [];
let potatoHolder = null;
let maxHoldTime = 60;
let holdTimer = null;
let countdown = 0;

/* HELPERS */
function show(screen){
  nameScreen.style.display="none";
  lobbyScreen.style.display="none";
  gameScreen.style.display="none";
  screen.style.display="block";
}

function startCountdown(){
  clearInterval(holdTimer);
  countdown = maxHoldTime;
  timerText.textContent = countdown+"s";
  holdTimer = setInterval(()=>{
    countdown--;
    timerText.textContent = countdown+"s";
    if(countdown===30){
      messageEl.textContent="⚠️ Potato burning my mitts!";
      if(navigator.vibrate) navigator.vibrate(500);
    }
    if(countdown<=0){
      clearInterval(holdTimer);
      socket.emit("throwPotato");
    }
  },1000);
}

function stopCountdown(){
  clearInterval(holdTimer);
  timerText.textContent="";
}

/* SOCKET EVENTS */
socket.on("joined", data=>{
  myId=data.yourId;
  show(nameScreen);
});

socket.on("host", ()=>{
  isHost=true;
  document.getElementById("hostControls").style.display="block";
});

socket.on("lobbyUpdate", data=>{
  show(lobbyScreen);
  if(data.waiting==="?") lobbyText.textContent="Waiting for host to select player count…";
  else if(data.waiting>0) lobbyText.textContent=`Waiting for ${data.waiting} more player(s) (of ${data.required})`;
  else lobbyText.textContent="Starting game…";
});

socket.on("gameStart", data=>{
  show(gameScreen);
  players=data.players;
  potatoHolder=data.potatoHolder;
  maxHoldTime=data.maxHoldTime||60;
  renderPlayers();
  updatePotatoState();
  updateScoreboard(data.scores||{});
  messageEl.textContent="";
});

socket.on("potatoThrown", data=>{
  potatoHolder=data.to;
  animatePotato(data.from,data.to);
  updatePotatoState();
  if(potatoHolder===myId){
    incomingSound.play();
    if(navigator.vibrate) navigator.vibrate(500);
  }
});

socket.on("scoreboard", scores=>{
  updateScoreboard(scores);
});

socket.on("eliminated", data=>{
  if(data.player===myId) messageEl.textContent=data.message;
  else messageEl.textContent="You got lucky this time, Potato Head!";
  stopCountdown();
});

socket.on("gameEnd", data=>{
  stopCountdown();
  statusText.textContent="Game Over!";
  players=data.players;
  updateScoreboard(data.scores);
  messageEl.textContent="Thanks for playing!";
});

/* UI ACTIONS */
saveNameBtn.onclick=()=>{
  const name=nameInput.value.trim();
  if(!name) return;
  socket.emit("setName",name);
  show(lobbyScreen);
};

joinLobbyBtn.onclick = () => {
  unlockAudio(); // 👈 THIS IS THE KEY LINE

  if (isHost) {
    const count = Number(playerCountSelect.value);
    socket.emit("setPlayerCount", count);
    playerCountSelect.disabled = true;
  }

  socket.emit("joinLobby");
};


throwBtn.onclick=()=>{
  socket.emit("throwPotato");
  throwBtn.disabled=true;
  stopCountdown();
};

/* RENDER PLAYERS */
function renderPlayers(){
  playersContainer.innerHTML="";
  players.forEach((p,index)=>{
    const el=document.createElement("div");
    el.className="player";
    el.dataset.id=p.id;
    el.textContent=p.name;
    el.style.left=50+index*120+"px";
    el.style.top="80px";
    playersContainer.appendChild(el);
  });
}

function updatePotatoState(){
  const holder=players.find(p=>p.id===potatoHolder);
  if(!holder) return;

  statusText.textContent=potatoHolder===myId
    ? "🥔 You have the potato!"
    : `🥔 ${holder.name} has the potato`;

  if(potatoHolder===myId){
    throwBtn.disabled=false;
    startCountdown();
  }else{
    throwBtn.disabled=true;
    stopCountdown();
  }

  movePotatoTo(holder.id);
}

/* POTATO ANIMATION */
function movePotatoTo(playerId){
  const target=document.querySelector(`.player[data-id="${playerId}"]`);
  if(!target) return;
  const pRect=target.getBoundingClientRect();
  const cRect=playersContainer.getBoundingClientRect();
  const x=pRect.left-cRect.left+pRect.width/2;
  const y=pRect.top-cRect.top-30;
  potato.style.transform=`translate(${x}px,${y}px)`;
}

function animatePotato(fromId,toId){
  movePotatoTo(fromId);
  setTimeout(()=>movePotatoTo(toId),50);
}

/* SCOREBOARD */
function updateScoreboard(scores){
  scoreboardEl.innerHTML="";
  players.forEach(p=>{
    const li=document.createElement("li");
    li.textContent=`${p.name}: ${scores[p.id]||0}s`;
    scoreboardEl.appendChild(li);
  });
}



