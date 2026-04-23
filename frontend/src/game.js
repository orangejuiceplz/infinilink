import { fetchBatchSimilarity, validateWord } from './api.js';

const CONNECTION_THRESHOLD = 38;

let state = {
  start: '',
  target: '',
  mode: 'daily',
  gameNumber: 0,
  words: [],
  connections: [],
  onUpdate: null,
  onWin: null,
};

export function initGame(start, target, mode, gameNumber, callbacks) {
  state = {
    start: start.toLowerCase(),
    target: target.toLowerCase(),
    mode,
    gameNumber: gameNumber || 0,
    words: [start.toLowerCase(), target.toLowerCase()],
    connections: [],
    onUpdate: callbacks.onUpdate || null,
    onWin: callbacks.onWin || null,
  };
  if (state.onUpdate) state.onUpdate(state);
}

export function initSandbox(callbacks) {
  state = {
    start: '',
    target: '',
    mode: 'sandbox',
    gameNumber: 0,
    words: [],
    connections: [],
    onUpdate: callbacks.onUpdate || null,
    onWin: null,
  };
  if (state.onUpdate) state.onUpdate(state);
}

export function getState() {
  return { ...state };
}

export async function addWord(word) {
  word = word.toLowerCase().trim();

  if (!word) return { error: 'Enter a word' };
  if (!word.match(/^[a-z]+$/)) return { error: 'Letters only' };
  if (word.length < 3) return { error: 'Minimum 3 letters' };
  if (state.words.includes(word)) return { error: 'Already on the board' };

  const validation = await validateWord(word);
  if (!validation.valid) return { error: validation.reason || 'Not a valid word' };

  const batchResult = await fetchBatchSimilarity(word, state.words);
  state.words.push(word);

  let newConnections = [];
  for (const r of batchResult.results) {
    if (!state.allScores) state.allScores = [];
    state.allScores.push({
      source: word,
      target: r.word,
      similarity: r.similarity,
      connected: r.connected,
    });

    if (r.connected) {
      const conn = {
        source: word,
        target: r.word,
        similarity: r.similarity,
      };
      state.connections.push(conn);
      newConnections.push(conn);
    }
  }

  if (state.onUpdate) state.onUpdate(state);

  if (state.mode === 'sandbox') {
    return { success: true, connections: newConnections, win: false };
  }

  const winPath = checkWin();
  if (winPath) {
    const chainStats = getChainStats(winPath);
    if (state.onWin) state.onWin(winPath, chainStats);
    return { success: true, connections: newConnections, win: true, winPath, chainStats };
  }

  return { success: true, connections: newConnections, win: false };
}

function checkWin() {
  const adj = {};
  for (const w of state.words) adj[w] = [];

  for (const c of state.connections) {
    adj[c.source].push({ word: c.target, similarity: c.similarity });
    adj[c.target].push({ word: c.source, similarity: c.similarity });
  }

  const visited = new Set();
  const parent = {};
  const queue = [state.start];
  visited.add(state.start);
  parent[state.start] = null;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === state.target) {
      const path = [];
      let node = state.target;
      while (node !== null) {
        path.unshift(node);
        node = parent[node];
      }
      return path;
    }

    for (const neighbor of (adj[current] || [])) {
      if (!visited.has(neighbor.word)) {
        visited.add(neighbor.word);
        parent[neighbor.word] = current;
        queue.push(neighbor.word);
      }
    }
  }

  return null;
}

function getChainStats(path) {
  let totalSim = 0;
  let minSim = 100;
  const links = [];

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const conn = state.connections.find(
      c => (c.source === a && c.target === b) || (c.source === b && c.target === a)
    );
    const sim = conn ? conn.similarity : 0;
    totalSim += sim;
    if (sim < minSim) minSim = sim;
    links.push({ from: a, to: b, similarity: sim });
  }

  return {
    linkCount: path.length - 1,
    avgSimilarity: Math.round(totalSim / (path.length - 1) * 10) / 10,
    weakestLink: minSim,
    totalWords: state.words.length,
    links,
  };
}

export function getSmallestGap() {
  if (state.mode === 'sandbox' || !state.start || !state.target) {
    const totalConns = state.connections.length;
    if (totalConns === 0) return { words: '—', similarity: 0 };
    const best = state.connections.reduce((max, c) => c.similarity > max.similarity ? c : max, state.connections[0]);
    return { words: `${best.source} — ${best.target}`, similarity: best.similarity, connected: true };
  }

  const startReachable = getReachableFrom(state.start);
  const targetReachable = getReachableFrom(state.target);

  let bestGap = { words: `${state.start} — ${state.target}`, similarity: 0 };

  for (const [wordA, ] of startReachable) {
    for (const [wordB, ] of targetReachable) {
      const conn = state.connections.find(
        c => (c.source === wordA && c.target === wordB) || (c.source === wordB && c.target === wordA)
      );
      if (!conn) {
        // These two aren't connected — they represent the gap
      } else if (conn.similarity > bestGap.similarity) {
        // Already connected — not really a gap
      }
    }
  }

  // Find the closest pair where one is reachable from start and the other from target
  // but they aren't connected to each other
  let closestUnconnected = null;
  for (const [wA, ] of startReachable) {
    for (const [wB, ] of targetReachable) {
      if (wA === wB) continue;
      const conn = state.connections.find(
        c => (c.source === wA && c.target === wB) || (c.source === wB && c.target === wA)
      );
      if (!conn) {
        // Estimate: we don't know the similarity yet, just show the pair
        if (!closestUnconnected) {
          closestUnconnected = { words: `${wA} — ${wB}`, similarity: 0 };
        }
      }
    }
  }

  // If everything from start connects to something from target, find weakest link
  const path = checkWin();
  if (path) {
    const stats = getChainStats(path);
    const weakest = stats.links.reduce((min, l) => l.similarity < min.similarity ? l : min, stats.links[0]);
    return { words: `${weakest.from} — ${weakest.to}`, similarity: weakest.similarity, connected: true };
  }

  // Show the actual smallest gap from batch results
  let bestPair = null;
  let bestSim = -1;
  for (const c of state.connections) {
    const sInStart = startReachable.has(c.source) || startReachable.has(c.target);
    const sInTarget = targetReachable.has(c.source) || targetReachable.has(c.target);
    if (sInStart && sInTarget && c.similarity > bestSim) {
      bestSim = c.similarity;
      bestPair = c;
    }
  }

  if (bestPair) {
    return { words: `${bestPair.source} — ${bestPair.target}`, similarity: bestPair.similarity, connected: true };
  }

  return closestUnconnected || bestGap;
}

function getReachableFrom(startWord) {
  const visited = new Map();
  const queue = [startWord];
  visited.set(startWord, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const c of state.connections) {
      let neighbor = null;
      if (c.source === current) neighbor = c.target;
      else if (c.target === current) neighbor = c.source;

      if (neighbor && !visited.has(neighbor)) {
        visited.set(neighbor, visited.get(current) + 1);
        queue.push(neighbor);
      }
    }
  }

  return visited;
}
