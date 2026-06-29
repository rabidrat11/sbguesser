"use strict";

/* ---- elements ---- */
const menuEl = document.getElementById("menu");
const gameEl = document.getElementById("game");
const photoEl = document.getElementById("photo");
const inputEl = document.getElementById("guess-input");
const sugEl = document.getElementById("suggestions");
const formEl = document.getElementById("guess-form");
const resultEl = document.getElementById("result");
const nextBtn = document.getElementById("next-btn");
const skipBtn = document.getElementById("skip-btn");
const backBtn = document.getElementById("back-btn");
const scoreEl = document.getElementById("score");
const diffLabel = document.getElementById("diff-label");
const poolInfo = document.getElementById("pool-info");

const ROOMS = (GAME_DATA.rooms || []).slice();

/* ---- state ---- */
let difficulty = null;
let pool = [];          // shuffled queue of {src, answer} for the chosen difficulty
let current = null;     // current image being guessed
let answered = false;
let activeSug = -1;      // highlighted suggestion index
let score = { correct: 0, total: 0 };

/* ---- helpers ---- */
function norm(s) { return s.trim().toLowerCase().replace(/\s+/g, " "); }

function encodePath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---- autocomplete matching: leading prefix first, then word-prefix ---- */
function wordPrefixIndex(lower, q) {
  let offset = 0;
  for (const part of lower.split(" ")) {
    if (part.startsWith(q)) return offset;
    offset += part.length + 1;
  }
  return -1;
}

function matchRooms(query) {
  const q = norm(query);
  if (!q) return [];
  const out = [];
  for (const name of ROOMS) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) {
      out.push({ name, idx: 0, pr: 0 });
    } else {
      const idx = wordPrefixIndex(lower, q);
      if (idx >= 0) out.push({ name, idx, pr: 1 });
    }
  }
  out.sort((a, b) => a.pr - b.pr || a.name.localeCompare(b.name));
  return out.slice(0, 8);
}

function highlight(name, idx, qlen) {
  const a = escapeHtml(name.slice(0, idx));
  const b = escapeHtml(name.slice(idx, idx + qlen));
  const c = escapeHtml(name.slice(idx + qlen));
  return a + '<span class="match">' + b + "</span>" + c;
}

function renderSuggestions() {
  if (answered) { closeSuggestions(); return; }
  const q = norm(inputEl.value);
  const matches = matchRooms(q);
  if (matches.length === 0) { closeSuggestions(); return; }
  sugEl.innerHTML = "";
  matches.forEach((m, i) => {
    const li = document.createElement("li");
    li.innerHTML = highlight(m.name, m.idx, q.length);
    li.dataset.name = m.name;
    if (i === activeSug) li.classList.add("active");
    li.addEventListener("mousedown", e => {   // mousedown fires before input blur
      e.preventDefault();
      chooseSuggestion(m.name);
    });
    sugEl.appendChild(li);
  });
  sugEl.classList.remove("hidden");
}

function closeSuggestions() {
  sugEl.classList.add("hidden");
  sugEl.innerHTML = "";
  activeSug = -1;
}

function chooseSuggestion(name) {
  inputEl.value = name;
  closeSuggestions();
  inputEl.focus();
}

/* ---- game flow ---- */
function startGame(diff) {
  difficulty = diff;
  const all = (GAME_DATA.images && GAME_DATA.images[diff]) || [];
  if (all.length === 0) { alert("No images for " + diff + " yet."); return; }
  pool = shuffle(all);
  score = { correct: 0, total: 0 };
  diffLabel.textContent = diff;
  menuEl.classList.add("hidden");
  gameEl.classList.remove("hidden");
  updateScore();
  loadNext();
}

function loadNext() {
  if (pool.length === 0) pool = shuffle((GAME_DATA.images[difficulty]) || []);
  current = pool.pop();
  answered = false;
  photoEl.src = encodePath(current.src);
  inputEl.value = "";
  inputEl.disabled = false;
  resultEl.classList.add("hidden");
  resultEl.className = "result hidden";
  nextBtn.classList.add("hidden");
  closeSuggestions();
  inputEl.focus();
}

function submitGuess() {
  if (answered) return;
  const guess = inputEl.value;
  if (!norm(guess)) return;
  finish(norm(guess) === norm(current.answer), guess);
}

function finish(correct, guessText) {
  answered = true;
  inputEl.disabled = true;
  closeSuggestions();
  score.total++;
  if (correct) score.correct++;
  updateScore();

  resultEl.classList.remove("hidden");
  if (correct) {
    resultEl.className = "result correct";
    resultEl.innerHTML = "Correct &mdash; <strong>" + escapeHtml(current.answer) + "</strong>";
  } else {
    resultEl.className = "result wrong";
    const yours = guessText && guessText.trim()
      ? "You said &ldquo;" + escapeHtml(guessText.trim()) + "&rdquo;. "
      : "";
    resultEl.innerHTML = yours + "Answer: <strong>" + escapeHtml(current.answer) + "</strong>";
  }
  nextBtn.classList.remove("hidden");
  nextBtn.focus();
}

function updateScore() {
  scoreEl.textContent = score.correct + " / " + score.total;
}

/* ---- events ---- */
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => startGame(btn.dataset.diff));
});

backBtn.addEventListener("click", () => {
  gameEl.classList.add("hidden");
  menuEl.classList.remove("hidden");
});

formEl.addEventListener("submit", e => {
  e.preventDefault();
  submitGuess();
});

skipBtn.addEventListener("click", () => {
  if (!answered) finish(false, "");
});

nextBtn.addEventListener("click", loadNext);

inputEl.addEventListener("input", () => { activeSug = -1; renderSuggestions(); });

inputEl.addEventListener("keydown", e => {
  const open = !sugEl.classList.contains("hidden");
  const items = sugEl.querySelectorAll("li");
  if (e.key === "ArrowDown" && open) {
    e.preventDefault();
    activeSug = Math.min(activeSug + 1, items.length - 1);
    refreshActive(items);
  } else if (e.key === "ArrowUp" && open) {
    e.preventDefault();
    activeSug = Math.max(activeSug - 1, 0);
    refreshActive(items);
  } else if (e.key === "Enter") {
    if (open && activeSug >= 0 && items[activeSug]) {
      e.preventDefault();
      chooseSuggestion(items[activeSug].dataset.name);
    }
    // otherwise let the form submit
  } else if (e.key === "Escape" && open) {
    e.preventDefault();
    closeSuggestions();
  }
});

inputEl.addEventListener("blur", () => setTimeout(closeSuggestions, 100));

function refreshActive(items) {
  items.forEach((li, i) => li.classList.toggle("active", i === activeSug));
  if (activeSug >= 0 && items[activeSug]) {
    items[activeSug].scrollIntoView({ block: "nearest" });
  }
}

/* ---- init: show per-difficulty counts ---- */
(function init() {
  const img = GAME_DATA.images || {};
  ["easy", "medium", "hard"].forEach(d => {
    const el = document.getElementById("count-" + d);
    if (el) el.textContent = ((img[d] && img[d].length) || 0) + " images";
  });
  poolInfo.textContent = ROOMS.length + " rooms in the answer list";
})();
