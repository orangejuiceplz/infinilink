import { fetchDailyPair, fetchRandomPair, fetchChallengePair, getSeed, logGameResult } from './api.js';
import { initGame, initSandbox, addWord, getState } from './game.js';
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
let optimalPath = null;
let currentSeed = null;

const ROUTES = {
  '/': 'mode-select',
  '/daily': 'game-screen',
  '/infinite': 'game-screen',
  '/timed': 'game-screen',
};

document.addEventListener('DOMContentLoaded', () => {
  const hashEl = document.getElementById('commit-hash');
  if (hashEl) hashEl.textContent = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';

  bindModeSelect();
  bindGameControls();
  bindModals();
  handleRoute(window.location.pathname);
});

window.addEventListener('popstate', () => {
  handleRoute(window.location.pathname);
});

function navigate(path) {
  if (window.location.pathname === path) return;
  history.pushState(null, '', path);
  handleRoute(path);
}

function handleRoute(path) {
  const challengeMatch = path.match(/^\/challenge\/([a-f0-9]+)$/i);
  if (challengeMatch) {
    currentMode = 'challenge';
    currentSeed = challengeMatch[1];
    startGame('challenge', currentSeed);
  } else if (path === '/sandbox') {
    currentMode = 'sandbox';
    startSandbox();
  } else if (path === '/daily' || path === '/infinite' || path === '/timed') {
    const mode = path.slice(1);
    if (currentMode !== mode || !document.getElementById('game-screen').classList.contains('active')) {
      currentMode = mode;
      startGame(mode);
    }
  } else {
    stopTimer();
    resetGraph();
    showScreen('mode-select');
  }
}

function bindModeSelect() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      navigate(`/${mode}`);
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
        sendAnalytics(false);
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

  document.getElementById('btn-home').addEventListener('click', () => {
    stopTimer();
    resetGraph();
    navigate('/');
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

  document.getElementById('btn-share-challenge').addEventListener('click', async () => {
    const state = getState();
    try {
      const data = await getSeed(state.start, state.target);
      const url = `${window.location.origin}/challenge/${data.seed}`;
      await copyToClipboard(`Try this infinilink challenge! ${url}`);
      const toast = document.getElementById('share-toast');
      toast.textContent = 'Challenge link copied!';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        toast.textContent = 'Copied to clipboard!';
      }, 2000);
    } catch (err) {
      showFeedback('Could not generate challenge link', 'error');
    }
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
    navigate('/timed');
  });

  document.getElementById('btn-menu').addEventListener('click', () => {
    hideTimeUpModal();
    navigate('/');
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

async function startGame(mode, seed) {
  showScreen('game-screen');
  lastWinPath = null;
  lastChainStats = null;
  isProcessing = false;
  wordsUsed = 0;
  optimalPath = null;
  currentSeed = seed || null;

  let pairData;
  try {
    if (mode === 'challenge' && seed) {
      pairData = await fetchChallengePair(seed);
      currentGameNumber = 0;
      setHeaderMode(`Challenge`);
    } else if (mode === 'daily') {
      pairData = await fetchDailyPair();
      currentGameNumber = pairData.game_number;
      wordLimit = pairData.word_limit || 25;
      optimalPath = pairData.optimal_path;
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
      sendAnalytics(false);
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
  sendAnalytics(true);

  setTimeout(() => {
    showWinModal(path, stats, timeStr);
  }, 800);

  const nextBtn = document.getElementById('btn-next');
  nextBtn.style.display = currentMode === 'daily' ? 'none' : '';
}

function sendAnalytics(won) {
  const state = getState();
  logGameResult({
    mode: currentMode,
    start_word: state.start,
    target_word: state.target,
    words_used: state.words.filter(w => w !== state.start && w !== state.target),
    connections: state.connections,
    all_scores: state.allScores || [],
    won,
    time_seconds: getElapsedSeconds(),
    game_number: currentGameNumber || null,
    optimal_path: optimalPath,
    word_limit: currentMode === 'daily' ? wordLimit : null,
  }).catch(() => {});
}

function startSandbox() {
  showScreen('game-screen');
  lastWinPath = null;
  lastChainStats = null;
  isProcessing = false;
  wordsUsed = 0;
  currentGameNumber = 0;
  setHeaderMode('Sandbox');

  initGraph('graph-container');

  initSandbox({
    onUpdate: (state) => updateSidebar(state),
  });

  updateSidebar(getState());
  updateRemaining();
  setInputEnabled(true);
  document.getElementById('word-input').value = '';
  document.getElementById('word-input').focus();
  startStopwatch();
}
