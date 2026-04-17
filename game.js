// Infinilink — Core game logic
// Uses the Datamuse API for connection validation (free, CORS-enabled).

// ── Configuration ─────────────────────────────────────────────────────────────

const DATAMUSE = "https://api.datamuse.com/words";
const SITE_URL = "https://orangejuiceplz.github.io/infinilink";
const MAX_CHAIN = 50;

// ── API cache (simple Map so we never hit the same URL twice per session) ─────

const _cache = new Map();

async function apiFetch(url) {
  if (_cache.has(url)) return _cache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    _cache.set(url, json);
    return json;
  } catch (err) {
    console.warn("[Infinilink] API error:", err);
    return [];
  }
}

// ── Connection validation ──────────────────────────────────────────────────────

/**
 * Check whether `newWord` is semantically connected to `prevWord`.
 *
 * Strategy: run 7 Datamuse queries in parallel —
 *   forward:  synonyms, means-like, triggers of prevWord → look for newWord
 *   reverse:  synonyms, means-like, triggers of newWord  → look for prevWord
 *   existence: sp=newWord with definitions
 *
 * Returns { valid, type?, definition?, reason? }
 */
async function validateConnection(prevWord, newWord) {
  const w1 = prevWord.toLowerCase().trim();
  const w2 = newWord.toLowerCase().trim();

  if (!w2) return { valid: false, reason: "Please enter a word." };
  if (w1 === w2) return { valid: false, reason: "That word is already in your chain!" };
  if (/\s/.test(w2)) return { valid: false, reason: "Please enter a single word — no spaces." };

  // All 7 requests fire simultaneously
  const [synFwd, mlFwd, trgFwd, synRev, mlRev, trgRev, spell] = await Promise.all([
    apiFetch(`${DATAMUSE}?rel_syn=${enc(w1)}&max=300`),
    apiFetch(`${DATAMUSE}?ml=${enc(w1)}&max=500`),
    apiFetch(`${DATAMUSE}?rel_trg=${enc(w1)}&max=300`),
    apiFetch(`${DATAMUSE}?rel_syn=${enc(w2)}&max=300`),
    apiFetch(`${DATAMUSE}?ml=${enc(w2)}&max=500`),
    apiFetch(`${DATAMUSE}?rel_trg=${enc(w2)}&max=300`),
    apiFetch(`${DATAMUSE}?sp=${enc(w2)}&md=d&max=5`),
  ]);

  // Word must exist
  const existsEntry = spell.find((r) => r.word.toLowerCase() === w2);
  if (!existsEntry) {
    return { valid: false, reason: `"${newWord}" doesn't look like a recognised English word.` };
  }

  const definition = extractDef(existsEntry);

  // Check connections in priority order (synonyms → similar meaning → associations)
  const checks = [
    { fwd: synFwd, rev: synRev, type: "synonym of" },
    { fwd: mlFwd,  rev: mlRev,  type: "similar in meaning to" },
    { fwd: trgFwd, rev: trgRev, type: "associated with" },
  ];

  for (const { fwd, rev, type } of checks) {
    if (fwd.some((r) => r.word.toLowerCase() === w2) ||
        rev.some((r) => r.word.toLowerCase() === w1)) {
      return { valid: true, type, definition };
    }
  }

  return {
    valid: false,
    reason: `"${newWord}" doesn't connect to "${prevWord}". Try a synonym or closely related word.`,
  };
}

function enc(w) { return encodeURIComponent(w); }

/** Pull the first definition string out of a Datamuse entry. */
function extractDef(entry) {
  if (!entry || !entry.defs || entry.defs.length === 0) return null;
  // Format: "pos\tdefinition text"
  const parts = entry.defs[0].split("\t");
  return parts.length > 1 ? parts[1] : parts[0];
}

// ── Hint ──────────────────────────────────────────────────────────────────────

async function computeHint(currentWord, targetWord, usedWords) {
  const [relCurrent, relTarget] = await Promise.all([
    apiFetch(`${DATAMUSE}?ml=${enc(currentWord)}&max=500`),
    apiFetch(`${DATAMUSE}?ml=${enc(targetWord)}&max=500`),
  ]);

  const targetSet = new Set(relTarget.map((r) => r.word.toLowerCase()));
  const used = new Set(usedWords.map((w) => w.toLowerCase()));

  // Bridge word: related to both current and target
  const bridge = relCurrent.find(
    (r) => targetSet.has(r.word.toLowerCase()) && !used.has(r.word.toLowerCase())
  );
  if (bridge) return bridge.word;

  // Fallback: first word related to current that's not already used
  const next = relCurrent.find((r) => !used.has(r.word.toLowerCase()));
  return next ? next.word : null;
}

// ── Local storage helpers ─────────────────────────────────────────────────────

const DAILY_KEY = () => `infinilink_daily_${getDailyDate()}`;
const STATS_KEY = "infinilink_stats";

function saveDailyResult(state) {
  localStorage.setItem(
    DAILY_KEY(),
    JSON.stringify({
      startWord:   state.startWord,
      endWord:     state.endWord,
      chain:       state.chain,
      connections: state.connections,
      definitions: state.definitions,
      completed:   true,
      ts:          Date.now(),
    })
  );
}

function loadDailyResult() {
  try {
    const raw = localStorage.getItem(DAILY_KEY());
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : { totalGames: 0, dailyStreak: 0, lastDailyDate: null };
  } catch (_) { return { totalGames: 0, dailyStreak: 0, lastDailyDate: null }; }
}

function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function recordWin(mode) {
  const stats = loadStats();
  stats.totalGames = (stats.totalGames || 0) + 1;

  if (mode === "daily") {
    const today = getDailyDate();
    if (stats.lastDailyDate) {
      const prev = new Date(stats.lastDailyDate);
      const now  = new Date(today);
      const diff = Math.round((now - prev) / 86_400_000);
      stats.dailyStreak = diff === 1 ? (stats.dailyStreak || 0) + 1 : 1;
    } else {
      stats.dailyStreak = 1;
    }
    stats.lastDailyDate = today;
  }

  saveStats(stats);
  return stats;
}

// ── Game state ────────────────────────────────────────────────────────────────

const state = {
  mode:           "daily",   // "daily" | "infinite"
  startWord:      "",
  endWord:        "",
  chain:          [],        // words submitted so far (incl. start)
  connections:    [],        // connection-type strings between chain words
  definitions:    {},        // { word: "def text" }
  status:         "idle",    // "idle" | "playing" | "won"
  loading:        false,
  dailyCompleted: false,
};

// ── Game logic ────────────────────────────────────────────────────────────────

function initGame(mode, pair) {
  state.mode        = mode;
  state.status      = "playing";
  state.chain       = [];
  state.connections = [];
  state.definitions = {};
  state.loading     = false;

  const [start, end] = pair;
  state.startWord = start;
  state.endWord   = end;
  state.chain     = [start];

  // Prefetch start/end definitions in background
  _prefetchDef(start);
  _prefetchDef(end);

  render();
  setInputEnabled(true);
  clearInput();
  showFeedback("", "");
}

async function _prefetchDef(word) {
  const w = word.toLowerCase();
  if (state.definitions[w]) return;
  const results = await apiFetch(`${DATAMUSE}?sp=${enc(w)}&md=d&max=5`);
  const entry = results.find((r) => r.word.toLowerCase() === w);
  if (entry) {
    const d = extractDef(entry);
    if (d) { state.definitions[w] = d; renderChain(); }
  }
}

async function submitWord(raw) {
  if (state.loading || state.status !== "playing") return;

  const word = raw.trim().toLowerCase();
  if (!word) { showFeedback("Please enter a word.", "error"); return; }

  if (state.chain.map((w) => w.toLowerCase()).includes(word)) {
    showFeedback(`"${word}" is already in your chain!`, "error");
    return;
  }

  if (state.chain.length >= MAX_CHAIN) {
    showFeedback("Chain is very long — try a more direct path!", "error");
    return;
  }

  state.loading = true;
  setInputEnabled(false);
  showFeedback("Checking connection…", "loading");

  const prev   = state.chain[state.chain.length - 1];
  const result = await validateConnection(prev, word);

  state.loading = false;

  if (!result.valid) {
    setInputEnabled(true);
    showFeedback(result.reason, "error");
    return;
  }

  // Accept the word
  state.chain.push(word);
  state.connections.push(result.type);
  if (result.definition) state.definitions[word] = result.definition;

  // Win?
  if (word === state.endWord.toLowerCase()) {
    state.status = "won";

    if (state.mode === "daily") {
      state.dailyCompleted = true;
      saveDailyResult(state);
    }

    const stats = recordWin(state.mode);
    render();
    renderWinState(stats);
    celebrate();
  } else {
    clearInput();
    showFeedback("", "");
    renderChain();
    setInputEnabled(true);
  }
}

// ── Sharing ───────────────────────────────────────────────────────────────────

function buildShareText() {
  const steps = state.chain.length - 1;
  const label = state.mode === "daily"
    ? `Daily #${getDailyNumber()}`
    : "Infinite";
  const emoji = steps <= 3 ? "🌟" : steps <= 6 ? "🎉" : "✅";
  const chain  = state.chain.join(" → ");
  return (
    `🔗 Infinilink ${label}\n` +
    `${state.startWord} ➜ ${state.endWord}\n\n` +
    `${chain}\n\n` +
    `${emoji} ${steps} step${steps !== 1 ? "s" : ""}\n` +
    `${SITE_URL}`
  );
}

async function copyShare() {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    const ta = Object.assign(document.createElement("textarea"), {
      value: text,
      style: "position:fixed;opacity:0",
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  showToast("Copied to clipboard!");
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function render() {
  // Mode tabs
  $("dailyTab").classList.toggle("active", state.mode === "daily");
  $("infiniteTab").classList.toggle("active", state.mode === "infinite");

  // Word endpoints
  $("startWordDisplay").textContent = state.startWord || "—";
  $("endWordDisplay").textContent   = state.endWord   || "—";

  // Chain
  renderChain();

  // Input vs win panel
  const won = state.status === "won";
  $("inputSection").classList.toggle("hidden", won);
  $("winSection").classList.toggle("hidden", !won);
}

function renderChain() {
  const container = $("chainDisplay");
  if (!container) return;

  // Update steps counter
  const steps = state.chain.length - 1;
  const sc = $("stepsCounter");
  if (sc) sc.textContent = `${steps} step${steps !== 1 ? "s" : ""}`;

  if (state.chain.length === 0) {
    container.innerHTML = '<p class="chain-empty">Your word chain will appear here.</p>';
    return;
  }

  let html = "";

  for (let i = 0; i < state.chain.length; i++) {
    const word  = state.chain[i];
    const def   = state.definitions[word.toLowerCase()];
    const isFirst  = i === 0;
    const isLast   = i === state.chain.length - 1;
    const isWon    = state.status === "won" && isLast;
    const isCurrent = isLast && state.status === "playing";

    let pillCls = "chain-pill";
    if (isFirst)   pillCls += " pill-start";
    if (isWon)     pillCls += " pill-won";
    else if (isCurrent) pillCls += " pill-current";

    html += `<div class="chain-item">`;
    html += `  <div class="chain-word-row">`;
    html += `    <span class="${pillCls}">${esc(word)}</span>`;
    if (isFirst) html += `    <span class="chain-badge">start</span>`;
    if (isWon)   html += `    <span class="chain-badge badge-won">reached!</span>`;
    html += `  </div>`;
    if (def) html += `  <p class="chain-def">${esc(def)}</p>`;
    html += `</div>`;

    // Connector between words (not after the last)
    if (i < state.chain.length - 1) {
      const ctype = state.connections[i] || "";
      html += `<div class="chain-connector">`;
      html += `  <div class="conn-line"></div>`;
      html += `  <span class="conn-label">${esc(ctype)}</span>`;
      html += `  <div class="conn-line"></div>`;
      html += `</div>`;
    }

    // "Enter next word" prompt after current (playing state)
    if (isCurrent) {
      html += `<div class="chain-connector chain-connector--next">`;
      html += `  <div class="conn-line conn-line--dashed"></div>`;
      html += `  <span class="conn-label conn-label--next">↓ your next word</span>`;
      html += `  <div class="conn-line conn-line--dashed"></div>`;
      html += `</div>`;
    }
  }

  container.innerHTML = html;
  // Scroll to bottom so the most recent word is visible
  container.scrollTop = container.scrollHeight;
}

function renderWinState(stats) {
  const steps = state.chain.length - 1;
  const s = stats || loadStats();

  // Title & subtitle based on performance
  $("winTitle").textContent = steps <= 3 ? "🌟 Brilliant!" : steps <= 6 ? "🎉 Connected!" : "✅ You did it!";
  $("winSubtitle").textContent =
    steps <= 3
      ? "Incredibly short chain!"
      : steps <= 6
      ? "Nice bridging!"
      : "You found a path!";

  $("winSteps").textContent    = steps;
  $("winWords").textContent    = state.chain.length;
  $("winStreak").textContent   = s.dailyStreak || 0;

  // Show "Play Infinite" button only after daily win
  $("playInfiniteBtn").classList.toggle("hidden", state.mode !== "daily");
  // Show "New Puzzle" button only in infinite mode
  $("newGameBtn").classList.toggle("hidden", state.mode !== "infinite");
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function showFeedback(msg, type) {
  const el = $("feedback");
  if (!el) return;
  el.className = "feedback";
  el.innerHTML = "";
  if (!msg) return;

  if (type === "loading") {
    el.classList.add("feedback--loading");
    el.innerHTML = `<span class="spinner"></span><span>${esc(msg)}</span>`;
  } else if (type === "error") {
    el.classList.add("feedback--error");
    el.textContent = msg;
  } else if (type === "hint") {
    el.classList.add("feedback--hint");
    el.textContent = msg;
  }
}

function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

function setInputEnabled(on) {
  const inp = $("wordInput");
  const btn = $("submitBtn");
  const hnt = $("hintBtn");
  if (inp) inp.disabled = !on;
  if (btn) btn.disabled = !on;
  if (hnt) hnt.disabled = !on;
  if (on && inp) inp.focus();
}

function clearInput() {
  const inp = $("wordInput");
  if (inp) inp.value = "";
}

function celebrate() {
  document.body.classList.add("celebrating");
  setTimeout(() => document.body.classList.remove("celebrating"), 1800);
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function $(id) { return document.getElementById(id); }

// ── Event handlers ────────────────────────────────────────────────────────────

function handleSubmit() {
  const inp = $("wordInput");
  if (inp && inp.value.trim()) submitWord(inp.value);
}

async function handleHint() {
  if (state.loading || state.status !== "playing") return;
  showFeedback("Finding a hint…", "loading");
  const hint = await computeHint(
    state.chain[state.chain.length - 1],
    state.endWord,
    state.chain
  );
  if (hint) {
    showFeedback(`💡 Hint: try "${hint}"`, "hint");
  } else {
    showFeedback("No hint found — try a synonym of your current word.", "hint");
  }
}

function switchMode(mode) {
  if (state.mode === mode && state.status === "playing") return;

  if (mode === "infinite") {
    const daily = loadDailyResult();
    if (!daily && !state.dailyCompleted) {
      showToast("Complete today's Daily Challenge first!");
      return;
    }
    const dailyPair = getDailyPair();
    initGame("infinite", getRandomPair(dailyPair));
  } else {
    // Switch back to daily
    const daily = loadDailyResult();
    if (daily && daily.completed) {
      // Restore completed daily
      Object.assign(state, {
        mode:           "daily",
        startWord:      daily.startWord,
        endWord:        daily.endWord,
        chain:          daily.chain,
        connections:    daily.connections,
        definitions:    daily.definitions || {},
        status:         "won",
        dailyCompleted: true,
      });
      render();
      renderWinState();
    } else {
      initGame("daily", getDailyPair());
    }
  }
}

// ── Initialisation ────────────────────────────────────────────────────────────

function init() {
  // Wire up static event listeners
  $("wordInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
  });
  $("submitBtn")?.addEventListener("click", handleSubmit);
  $("hintBtn")?.addEventListener("click", handleHint);
  $("dailyTab")?.addEventListener("click", () => switchMode("daily"));
  $("infiniteTab")?.addEventListener("click", () => switchMode("infinite"));
  $("shareBtn")?.addEventListener("click", copyShare);
  $("newGameBtn")?.addEventListener("click", () => {
    const dailyPair = getDailyPair();
    initGame("infinite", getRandomPair(dailyPair));
  });
  $("playInfiniteBtn")?.addEventListener("click", () => switchMode("infinite"));

  // Update daily tab with streak
  const stats = loadStats();
  if (stats.dailyStreak > 1) {
    $("dailyTab").textContent = `Daily 🔥${stats.dailyStreak}`;
  }

  // Check if today's daily is already done
  const daily = loadDailyResult();
  if (daily && daily.completed) {
    Object.assign(state, {
      mode:           "daily",
      startWord:      daily.startWord,
      endWord:        daily.endWord,
      chain:          daily.chain,
      connections:    daily.connections,
      definitions:    daily.definitions || {},
      status:         "won",
      dailyCompleted: true,
    });
    render();
    renderWinState();
  } else {
    initGame("daily", getDailyPair());
  }
}

document.addEventListener("DOMContentLoaded", init);
