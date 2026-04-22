const STORAGE_KEY = 'unlinxicon_stats';

const DEFAULT_MODE_STATS = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  bestTime: null,
  fewestLinks: null,
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { daily: { ...DEFAULT_MODE_STATS }, infinite: { ...DEFAULT_MODE_STATS }, timed: { ...DEFAULT_MODE_STATS } };
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getStats(mode) {
  const all = load();
  return all[mode] || { ...DEFAULT_MODE_STATS };
}

export function recordWin(mode, timeSeconds, linkCount) {
  const all = load();
  if (!all[mode]) all[mode] = { ...DEFAULT_MODE_STATS };
  const s = all[mode];

  s.played++;
  s.won++;
  s.currentStreak++;
  if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak;
  if (s.bestTime === null || timeSeconds < s.bestTime) s.bestTime = timeSeconds;
  if (s.fewestLinks === null || linkCount < s.fewestLinks) s.fewestLinks = linkCount;

  save(all);
  return s;
}

export function recordLoss(mode) {
  const all = load();
  if (!all[mode]) all[mode] = { ...DEFAULT_MODE_STATS };

  all[mode].played++;
  all[mode].currentStreak = 0;

  save(all);
  return all[mode];
}

export function renderStats(mode) {
  const s = getStats(mode);
  const grid = document.getElementById('stats-grid');

  if (mode === 'infinite') {
    grid.innerHTML = `
      <div class="stats-card">
        <span class="stats-card-value">${s.played}</span>
        <span class="stats-card-label">Games</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.bestTime !== null ? formatTime(s.bestTime) : '—'}</span>
        <span class="stats-card-label">Best Time</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.fewestLinks !== null ? s.fewestLinks : '—'}</span>
        <span class="stats-card-label">Fewest Links</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.won}</span>
        <span class="stats-card-label">Completed</span>
      </div>
    `;
  } else {
    grid.innerHTML = `
      <div class="stats-card">
        <span class="stats-card-value">${s.played}</span>
        <span class="stats-card-label">Played</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.played ? Math.round((s.won / s.played) * 100) : 0}%</span>
        <span class="stats-card-label">Win Rate</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.currentStreak}</span>
        <span class="stats-card-label">Streak</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.maxStreak}</span>
        <span class="stats-card-label">Max Streak</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.bestTime !== null ? formatTime(s.bestTime) : '—'}</span>
        <span class="stats-card-label">Best Time</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${s.fewestLinks !== null ? s.fewestLinks : '—'}</span>
        <span class="stats-card-label">Fewest Links</span>
      </div>
    `;
  }
}

function formatTime(s) {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
