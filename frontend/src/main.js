import { fetchDailyPair, fetchRandomPair } from './api.js';
import { initGame, addWord, getState } from './game.js';
import { initGraph, setInitialNodes, addNode, highlightWinPath, resetGraph } from './graph.js';
import {
  updateSidebar, showFeedback, showWinModal, hideWinModal,
  showStatsModal, hideStatsModal, showTimeUpModal, hideTimeUpModal,
  showScreen, setHeaderMode, setInputEnabled,
} from './ui.js';
import { startStopwatch, startCountdown, stop as stopTimer, formatElapsed, getElapsedSeconds } from './timer.js';
import { generateShareText, copyToClipboard } from './share.js';
import { recordWin, recordLoss, renderStats } from './stats.js';

let currentMode = 'daily';
let currentGameNumber = 0;
let lastWinPath = null;
let lastChainStats = null;
let isProcessing = false;
let wordsUsed = 0;
let wordLimit = 25;

document.addEventListener('DOMContentLoaded', () => {
  bindModeSelect();
  bindGameControls();
  bindModals();
});

function bindModeSelect() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      currentMode = card.dataset.mode;
      startGame(currentMode);
    });
  });

  document.getElementById('btn-stats-home').addEventListener('click', () => {
    renderStats('daily');
    showStatsModal();
  });
}

function bindGameControls() {
  const input = document.getElementById('word-input');
  const addBtn = document.getElementById('btn-add');

  const handleAdd = async () => {
    const word = input.value.trim().toLowerCase();
    if (!word || isProcessing) return;

    if (currentMode === 'daily' && wordsUsed >= wordLimit) {
      showFeedback('No words remaining', 'error');
      return;
    }

    isProcessing = true;
    setInputEnabled(false);
    showFeedback('Checking...', 'info');

    try {
      const result = await addWord(word);

      if (result.error) {
        showFeedback(result.error, 'error');
        setInputEnabled(true);
        isProcessing = false;
        input.focus();
        return;
      }

      input.value = '';
      wordsUsed++;
      addNode(word, result.connections);
      updateSidebar(getState());
      updateRemaining();

      if (result.connections.length > 0) {
        showFeedback(`+${result.connections.length} connection${result.connections.length > 1 ? 's' : ''}`, 'success');
      } else {
        showFeedback('No connections', 'info');
      }

      if (result.win) {
        handleWin(result.winPath, result.chainStats);
      } else if (currentMode === 'daily' && wordsUsed >= wordLimit) {
        setInputEnabled(false);
        showFeedback('Out of words — daily challenge lost', 'error');
        recordLoss('daily');
      } else {
        setInputEnabled(true);
        input.focus();
      }
    } catch (err) {
      showFeedback(err.message || 'Error connecting to server', 'error');
      setInputEnabled(true);
    }

    isProcessing = false;
  };

  addBtn.addEventListener('click', handleAdd);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd();
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    stopTimer();
    resetGraph();
    showScreen('mode-select');
  });

  document.getElementById('btn-stats-game').addEventListener('click', () => {
    renderStats(currentMode);
    showStatsModal();
  });
}

function bindModals() {
  document.getElementById('btn-share').addEventListener('click', async () => {
    if (!lastWinPath || !lastChainStats) return;
    const text = generateShareText(
      currentMode,
      currentGameNumber,
      lastWinPath,
      lastChainStats.avgSimilarity,
      formatElapsed(),
      lastChainStats.totalWords
    );
    await copyToClipboard(text);
    const toast = document.getElementById('share-toast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  });

  document.getElementById('btn-view-graph').addEventListener('click', () => {
    hideWinModal();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    hideWinModal();
    startGame(currentMode);
  });

  document.getElementById('btn-stats-close').addEventListener('click', hideStatsModal);

  document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderStats(tab.dataset.tab);
    });
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    hideTimeUpModal();
    startGame('timed');
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    hideTimeUpModal();
    showScreen('mode-select');
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function updateRemaining() {
  const row = document.getElementById('remaining-row');
  const el = document.getElementById('words-remaining');
  if (currentMode === 'daily') {
    row.style.display = '';
    const left = wordLimit - wordsUsed;
    el.textContent = left;
    el.style.color = left <= 3 ? 'var(--error)' : left <= 6 ? 'var(--yellow)' : '';
  } else {
    row.style.display = 'none';
  }
}

async function startGame(mode) {
  showScreen('game-screen');
  lastWinPath = null;
  lastChainStats = null;
  isProcessing = false;
  wordsUsed = 0;

  let pairData;
  try {
    if (mode === 'daily') {
      pairData = await fetchDailyPair();
      currentGameNumber = pairData.game_number;
      wordLimit = pairData.word_limit || 25;
      setHeaderMode(`Daily #${pairData.game_number}`);
    } else {
      pairData = await fetchRandomPair();
      currentGameNumber = 0;
      setHeaderMode(mode === 'timed' ? 'Timed' : 'Infinite');
    }
  } catch (err) {
    showFeedback('Failed to connect to server. Is the backend running?', 'error');
    return;
  }

  initGraph('graph-container');
  setInitialNodes(pairData.start, pairData.target);

  initGame(pairData.start, pairData.target, mode, currentGameNumber, {
    onUpdate: (state) => updateSidebar(state),
    onWin: () => {},
  });

  updateSidebar(getState());
  updateRemaining();
  setInputEnabled(true);
  document.getElementById('word-input').value = '';
  document.getElementById('word-input').focus();

  if (mode === 'timed') {
    startCountdown(180, () => {
      setInputEnabled(false);
      recordLoss('timed');
      showTimeUpModal();
    });
  } else {
    startStopwatch();
  }
}

function handleWin(path, stats) {
  stopTimer();
  lastWinPath = path;
  lastChainStats = stats;

  highlightWinPath(path);
  setInputEnabled(false);

  const timeStr = formatElapsed();
  recordWin(currentMode, getElapsedSeconds(), stats.linkCount);

  setTimeout(() => {
    showWinModal(path, stats, timeStr);
  }, 800);

  const nextBtn = document.getElementById('btn-next');
  nextBtn.style.display = currentMode === 'daily' ? 'none' : '';
}
