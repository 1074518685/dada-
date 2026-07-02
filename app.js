import { firebaseConfig } from "./firebase-config.js";

const TABLES = [
  { id: "A", name: "A桌" },
  { id: "B", name: "B桌" },
  { id: "C", name: "C桌" },
];

const SEATS_PER_TABLE = 8;
const LOCAL_STORAGE_KEY = "round-table-seat-locks-v2";
const LOCAL_OWNER_KEY = "round-table-seat-owner-token-v1";
const FIREBASE_VERSION = "10.12.5";

const guestNameInput = document.querySelector("#guestName");
const lockButton = document.querySelector("#lockButton");
const releaseButton = document.querySelector("#releaseButton");
const reloadButton = document.querySelector("#reloadButton");
const lockedCount = document.querySelector("#lockedCount");
const selectionText = document.querySelector("#selectionText");
const syncStatus = document.querySelector("#syncStatus");

let selectedSeatId = null;
let lockedSeats = {};
let mode = "local";
let modeLabel = "本机演示";
let currentOwnerId = getLocalOwnerId();
let firestoreApi = null;

function seatId(tableId, seatNumber) {
  return `${tableId}-${seatNumber}`;
}

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig?.apiKey &&
      firebaseConfig?.authDomain &&
      firebaseConfig?.projectId &&
      firebaseConfig?.appId,
  );
}

function getLocalOwnerId() {
  const existing = localStorage.getItem(LOCAL_OWNER_KEY);
  if (existing) return existing;

  const created =
    crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(LOCAL_OWNER_KEY, created);
  return created;
}

function loadLocalSeats() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocalSeats() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lockedSeats));
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

function canReleaseSeat(lock) {
  return Boolean(lock && lock.ownerId === currentOwnerId);
}

function getMySeatId() {
  return Object.values(lockedSeats).find((lock) => lock.ownerId === currentOwnerId)?.seatId || null;
}

async function lockSelectedSeat() {
  if (!selectedSeatId || lockedSeats[selectedSeatId]) return;

  const mySeatId = getMySeatId();
  if (mySeatId) {
    selectionText.textContent = `你已预选 ${getSeatLabel(mySeatId)}，每人只能选一个座位`;
    return;
  }

  const name = guestNameInput.value.trim();
  if (!name) {
    guestNameInput.focus();
    selectionText.textContent = "请先输入姓名";
    return;
  }

  lockButton.disabled = true;

  try {
    if (mode === "remote") {
      await lockRemoteSeat(selectedSeatId, name);
    } else {
      lockedSeats[selectedSeatId] = {
        seatId: selectedSeatId,
        name,
        ownerId: currentOwnerId,
        lockedAt: new Date().toISOString(),
      };
      saveLocalSeats();
      render();
    }
  } catch (error) {
    selectionText.textContent = error.message || "锁定失败，请重试";
    render();
  }
}

async function releaseSelectedSeat() {
  const currentLock = selectedSeatId ? lockedSeats[selectedSeatId] : null;
  if (!selectedSeatId || !canReleaseSeat(currentLock)) return;

  releaseButton.disabled = true;

  try {
    if (mode === "remote") {
      await releaseRemoteSeat(selectedSeatId);
    } else {
      delete lockedSeats[selectedSeatId];
      saveLocalSeats();
      render();
    }
  } catch (error) {
    selectionText.textContent = error.message || "释放失败，请重试";
    render();
  }
}

async function lockRemoteSeat(id, name) {
  const seatRef = firestoreApi.doc(firestoreApi.db, "seatLocks", id);
  const userRef = firestoreApi.doc(firestoreApi.db, "userSelections", currentOwnerId);

  await firestoreApi.runTransaction(firestoreApi.db, async (transaction) => {
    const seatSnapshot = await transaction.get(seatRef);
    const userSnapshot = await transaction.get(userRef);

    if (userSnapshot.exists()) {
      throw new Error(`你已预选 ${getSeatLabel(userSnapshot.data().seatId)}`);
    }

    if (seatSnapshot.exists()) {
      throw new Error("这个座位已经被锁定");
    }

    transaction.set(seatRef, {
      seatId: id,
      name,
      ownerUid: currentOwnerId,
      lockedAt: firestoreApi.serverTimestamp(),
    });

    transaction.set(userRef, {
      seatId: id,
      name,
      ownerUid: currentOwnerId,
      lockedAt: firestoreApi.serverTimestamp(),
    });
  });
}

async function releaseRemoteSeat(id) {
  const seatRef = firestoreApi.doc(firestoreApi.db, "seatLocks", id);
  const userRef = firestoreApi.doc(firestoreApi.db, "userSelections", currentOwnerId);

  await firestoreApi.runTransaction(firestoreApi.db, async (transaction) => {
    const seatSnapshot = await transaction.get(seatRef);
    const userSnapshot = await transaction.get(userRef);

    if (!seatSnapshot.exists() || seatSnapshot.data().ownerUid !== currentOwnerId) {
      throw new Error("只能释放你本人预选的座位");
    }

    if (!userSnapshot.exists()) {
      transaction.delete(seatRef);
      return;
    }

    if (userSnapshot.data().seatId !== id) {
      throw new Error("座位状态不同步，请刷新后重试");
    }

    transaction.delete(seatRef);
    transaction.delete(userRef);
  });
}

async function startRemoteSync() {
  const [
    firebaseApp,
    firebaseAuth,
    firebaseFirestore,
  ] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  ]);

  const app = firebaseApp.initializeApp(firebaseConfig);
  const auth = firebaseAuth.getAuth(app);
  await firebaseAuth.signInAnonymously(auth);

  currentOwnerId = auth.currentUser.uid;
  mode = "remote";
  modeLabel = "实时同步";

  const db = firebaseFirestore.getFirestore(app);
  firestoreApi = {
    db,
    collection: firebaseFirestore.collection,
    deleteDoc: firebaseFirestore.deleteDoc,
    doc: firebaseFirestore.doc,
    onSnapshot: firebaseFirestore.onSnapshot,
    runTransaction: firebaseFirestore.runTransaction,
    serverTimestamp: firebaseFirestore.serverTimestamp,
  };

  const seatsCollection = firestoreApi.collection(db, "seatLocks");
  firestoreApi.onSnapshot(
    seatsCollection,
    (snapshot) => {
      lockedSeats = {};
      snapshot.forEach((item) => {
        const data = item.data();
        lockedSeats[item.id] = {
          seatId: data.seatId || item.id,
          name: data.name || "已占座",
          ownerId: data.ownerUid,
          lockedAt: data.lockedAt,
        };
      });
      render();
    },
    () => {
      modeLabel = "同步异常";
      syncStatus.textContent = modeLabel;
    },
  );
}

function startLocalMode() {
  mode = "local";
  modeLabel = "本机演示";
  lockedSeats = loadLocalSeats();
  render();
}

function render() {
  document.querySelectorAll(".seat").forEach((seat) => {
    const id = seat.dataset.seatId;
    const locked = lockedSeats[id];
    const mine = canReleaseSeat(locked);
    const name = seat.querySelector(".seat-name");

    seat.classList.toggle("is-selected", id === selectedSeatId);
    seat.classList.toggle("is-locked", Boolean(locked));
    seat.classList.toggle("is-mine", mine);
    seat.setAttribute("aria-pressed", id === selectedSeatId ? "true" : "false");
    name.textContent = locked?.name || "";
  });

  const currentLock = selectedSeatId ? lockedSeats[selectedSeatId] : null;
  const occupied = Object.keys(lockedSeats).length;
  const ownsSelectedSeat = canReleaseSeat(currentLock);

  lockedCount.textContent = occupied;
  syncStatus.textContent = modeLabel;
  const mySeatId = getMySeatId();
  const hasOtherSeat = Boolean(mySeatId && mySeatId !== selectedSeatId);

  lockButton.disabled = !selectedSeatId || Boolean(currentLock) || hasOtherSeat;
  releaseButton.disabled = !ownsSelectedSeat;

  if (!selectedSeatId) {
    selectionText.textContent = "请选择座位";
  } else if (ownsSelectedSeat) {
    selectionText.textContent = `${getSeatLabel(selectedSeatId)} · ${currentLock.name} · 可释放`;
  } else if (currentLock) {
    selectionText.textContent = `${getSeatLabel(selectedSeatId)} · ${currentLock.name} 已锁定`;
  } else if (hasOtherSeat) {
    selectionText.textContent = `你已预选 ${getSeatLabel(mySeatId)}，每人只能选一个座位`;
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
reloadButton.addEventListener("click", () => window.location.reload());

createSeats();

if (isFirebaseConfigured()) {
  syncStatus.textContent = "正在连接";
  startRemoteSync().catch(() => {
    modeLabel = "连接失败";
    startLocalMode();
  });
} else {
  startLocalMode();
}
