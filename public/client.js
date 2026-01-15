const socket = io();
const btn = document.getElementById("throwBtn");
const potato = document.getElementById("potato");

let myTurn = false;

socket.on("start", holder => {
  myTurn = socket.id === holder;
  btn.disabled = !myTurn;
});

socket.on("thrown", holder => {
  potato.classList.add("fly");

  setTimeout(() => {
    potato.classList.remove("fly");
  }, 800);

  myTurn = socket.id === holder;
  btn.disabled = !myTurn;
});

btn.onclick = () => {
  socket.emit("throw");
};
