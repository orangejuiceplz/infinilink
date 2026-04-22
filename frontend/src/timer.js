let timerInterval = null;
let startTime = 0;
let elapsed = 0;
let countdownFrom = 0;
let onTimeUp = null;
let isPaused = false;

const timerEl = () => document.getElementById('timer');

export function startStopwatch() {
  stop();
  countdownFrom = 0;
  startTime = Date.now();
  elapsed = 0;
  isPaused = false;
  timerInterval = setInterval(tick, 250);
  render();
}

export function startCountdown(seconds, callback) {
  stop();
  countdownFrom = seconds;
  startTime = Date.now();
  elapsed = 0;
  onTimeUp = callback;
  isPaused = false;
  timerInterval = setInterval(tick, 250);
  render();
}

export function stop() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isPaused = true;
}

export function getElapsedSeconds() {
  return Math.floor(elapsed / 1000);
}

function tick() {
  if (isPaused) return;
  elapsed = Date.now() - startTime;

  if (countdownFrom > 0) {
    const remaining = countdownFrom - Math.floor(elapsed / 1000);
    if (remaining <= 0) {
      stop();
      render();
      if (onTimeUp) onTimeUp();
      return;
    }
  }

  render();
}

function render() {
  const el = timerEl();
  if (!el) return;

  let displaySeconds;
  if (countdownFrom > 0) {
    displaySeconds = Math.max(0, countdownFrom - Math.floor(elapsed / 1000));
  } else {
    displaySeconds = Math.floor(elapsed / 1000);
  }

  const min = Math.floor(displaySeconds / 60);
  const sec = displaySeconds % 60;
  el.textContent = `${min}:${sec.toString().padStart(2, '0')}`;

  el.classList.remove('warning', 'danger');
  if (countdownFrom > 0) {
    if (displaySeconds <= 30) el.classList.add('danger');
    else if (displaySeconds <= 60) el.classList.add('warning');
  }
}

export function formatElapsed() {
  const s = getElapsedSeconds();
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
