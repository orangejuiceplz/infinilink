import { getState, getSmallestGap } from './game.js';

export function updateSidebar(state) {
  document.getElementById('word-count').textContent = state.words.length;
  document.getElementById('link-count').textContent = state.connections.length;

  updateGapDisplay();
  updateLinksList(state);
}

function updateGapDisplay() {
  const gap = getSmallestGap();
  const gapWords = document.getElementById('gap-words');
  const gapPct = document.getElementById('gap-pct');
  const gapDisplay = document.getElementById('gap-display');

  gapWords.textContent = gap.words;
  gapPct.textContent = gap.similarity > 0 ? `${gap.similarity}%` : '—';

  gapDisplay.classList.remove('warm', 'hot');
  if (gap.connected) {
    gapDisplay.classList.add('hot');
  } else if (gap.similarity >= 25) {
    gapDisplay.classList.add('warm');
  }
}

function updateLinksList(state) {
  const list = document.getElementById('links-list');

  const startReachable = getReachable(state.start, state.connections);
  const targetReachable = getReachable(state.target, state.connections);

  const sorted = [...state.connections].sort((a, b) => b.similarity - a.similarity);

  list.innerHTML = sorted.map(c => {
    let chainClass = '';
    if (startReachable.has(c.source) && startReachable.has(c.target)) chainClass = 'start-chain';
    else if (targetReachable.has(c.source) && targetReachable.has(c.target)) chainClass = 'target-chain';

    return `
      <div class="link-row ${chainClass}">
        <span class="link-words">
          <span>${c.source}</span>
          <span class="link-dash">—</span>
          <span>${c.target}</span>
        </span>
        <span class="link-pct">${c.similarity}%</span>
      </div>
    `;
  }).join('');
}

function getReachable(startWord, connections) {
  const visited = new Set([startWord]);
  const queue = [startWord];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const c of connections) {
      let neighbor = null;
      if (c.source === current) neighbor = c.target;
      else if (c.target === current) neighbor = c.source;

      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

export function showFeedback(message, type = 'info') {
  const el = document.getElementById('input-feedback');
  el.textContent = message;
  el.className = `input-feedback ${type}`;
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      el.textContent = '';
      el.className = 'input-feedback';
    }, 3000);
  }
}

export function showWinModal(path, stats, timeStr) {
  const modal = document.getElementById('win-modal');
  const chain = document.getElementById('win-chain');

  chain.innerHTML = path.map((word, i) => {
    let cls = '';
    if (i === 0) cls = 'start';
    else if (i === path.length - 1) cls = 'target';
    const arrow = i < path.length - 1 ? '<span class="chain-arrow">→</span>' : '';
    return `<span class="chain-word ${cls}">${word}</span>${arrow}`;
  }).join('');

  document.getElementById('win-links').textContent = stats.linkCount;
  document.getElementById('win-avg').textContent = `${stats.avgSimilarity}%`;
  document.getElementById('win-time').textContent = timeStr;
  document.getElementById('win-words').textContent = stats.totalWords;

  modal.classList.add('active');
}

export function hideWinModal() {
  document.getElementById('win-modal').classList.remove('active');
}

export function showStatsModal() {
  document.getElementById('stats-modal').classList.add('active');
}

export function hideStatsModal() {
  document.getElementById('stats-modal').classList.remove('active');
}

export function showTimeUpModal() {
  document.getElementById('timeup-modal').classList.add('active');
}

export function hideTimeUpModal() {
  document.getElementById('timeup-modal').classList.remove('active');
}

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active', 'fade-in');
  });
  const target = document.getElementById(screenId);
  target.classList.add('active', 'fade-in');
}

export function setHeaderMode(text) {
  document.getElementById('header-mode').textContent = text;
}

export function setInputEnabled(enabled) {
  document.getElementById('word-input').disabled = !enabled;
  document.getElementById('btn-add').disabled = !enabled;
}
