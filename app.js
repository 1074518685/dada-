const TABLES = [
  { id: "A", name: "山茶桌" },
  { id: "B", name: "青柠桌" },
  { id: "C", name: "番茄桌" },
];

const SEATS_PER_TABLE = 8;
const STORAGE_KEY = "round-table-seat-locks-v1";

const guestNameInput = document.querySelector("#guestName");
const lockButton = document.querySelector("#lockButton");
const releaseButton = document.querySelector("#releaseButton");
const resetButton = document.querySelector("#resetButton");
const lockedCount = document.querySelector("#lockedCount");
const selectionText = document.querySelector("#selectionText");

let selectedSeatId = null;
let lockedSeats = loadSeats();

function seatId(tableId, seatNumber) {
  return `${tableId}-${seatNumber}`;
}

function loadSeats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSeats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lockedSeats));
}

function getSeatLabel(id) {
  const [tableId, seatNumber] = id.split("-");
  const table = TABLES.find((item) => item.id === tableId);
  return `${table?.name || tableId} ${seatNumber}号`;
}

function createSeats() {
  TABLES.forEach((table) => {
    const ring = document.querySelector(`[data-ring="${table.id}"]`);
    ring.innerHTML = "";

    for (let seatNumber = 1; seatNumber <= SEATS_PER_TABLE; seatNumber += 1) {
      const angle = -90 + (360 / SEATS_PER_TABLE) * (seatNumber - 1);
      const radians = (Math.PI / 180) * angle;
      const radius = 48;
      const x = 50 + Math.cos(radians) * radius;
      const y = 50 + Math.sin(radians) * radius;
      const id = seatId(table.id, seatNumber);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat";
      button.dataset.seatId = id;
      button.style.setProperty("--x", `${x}%`);
      button.style.setProperty("--y", `${y}%`);
      button.setAttribute("aria-label", `${table.name} ${seatNumber}号座位`);
      button.innerHTML = `
        <span class="seat-number">${seatNumber}</span>
        <span class="seat-name"></span>
      `;
      button.addEventListener("click", () => selectSeat(id));
      ring.appendChild(button);
    }
  });
}

function selectSeat(id) {
  selectedSeatId = id;
  render();
}

function lockSelectedSeat() {
  if (!selectedSeatId) return;

  const name = guestNameInput.value.trim() || "已占座";
  lockedSeats[selectedSeatId] = {
    name,
    lockedAt: new Date().toISOString(),
  };
  saveSeats();
  render();
}

function releaseSelectedSeat() {
  if (!selectedSeatId || !lockedSeats[selectedSeatId]) return;

  delete lockedSeats[selectedSeatId];
  saveSeats();
  render();
}

function resetSeats() {
  const hasLockedSeats = Object.keys(lockedSeats).length > 0;
  if (!hasLockedSeats) return;

  const confirmed = window.confirm("清空全部已锁定座位？");
  if (!confirmed) return;

  lockedSeats = {};
  selectedSeatId = null;
  saveSeats();
  render();
}

function render() {
  document.querySelectorAll(".seat").forEach((seat) => {
    const id = seat.dataset.seatId;
    const locked = lockedSeats[id];
    const name = seat.querySelector(".seat-name");

    seat.classList.toggle("is-selected", id === selectedSeatId);
    seat.classList.toggle("is-locked", Boolean(locked));
    seat.setAttribute("aria-pressed", id === selectedSeatId ? "true" : "false");
    name.textContent = locked?.name || "";
  });

  const currentLock = selectedSeatId ? lockedSeats[selectedSeatId] : null;
  const hasSelection = Boolean(selectedSeatId);
  const occupied = Object.keys(lockedSeats).length;

  lockedCount.textContent = occupied;
  lockButton.disabled = !hasSelection;
  releaseButton.disabled = !currentLock;
  resetButton.disabled = occupied === 0;

  if (!selectedSeatId) {
    selectionText.textContent = "请选择座位";
  } else if (currentLock) {
    selectionText.textContent = `${getSeatLabel(selectedSeatId)} · ${currentLock.name}`;
  } else {
    selectionText.textContent = `${getSeatLabel(selectedSeatId)} · 待锁定`;
  }
}

guestNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && selectedSeatId) {
    lockSelectedSeat();
  }
});

lockButton.addEventListener("click", lockSelectedSeat);
releaseButton.addEventListener("click", releaseSelectedSeat);
resetButton.addEventListener("click", resetSeats);

createSeats();
render();
