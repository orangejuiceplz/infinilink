// Infinilink — Word pairs for daily challenges
// Each pair: [startWord, endWord]
// Chosen so a satisfying chain of 3-7 steps exists between them.

const WORD_PAIRS = [
  ["fire",     "ice"],
  ["love",     "hate"],
  ["war",      "peace"],
  ["day",      "night"],
  ["brave",    "cowardly"],
  ["ancient",  "modern"],
  ["loud",     "quiet"],
  ["wild",     "tame"],
  ["rough",    "smooth"],
  ["fast",     "slow"],
  ["light",    "shadow"],
  ["rise",     "fall"],
  ["strong",   "weak"],
  ["hot",      "cold"],
  ["sharp",    "dull"],
  ["full",     "empty"],
  ["begin",    "finish"],
  ["victory",  "defeat"],
  ["create",   "destroy"],
  ["freedom",  "prison"],
  ["ocean",    "desert"],
  ["mountain", "valley"],
  ["king",     "beggar"],
  ["summer",   "winter"],
  ["dawn",     "dusk"],
  ["song",     "silence"],
  ["rain",     "drought"],
  ["birth",    "death"],
  ["gold",     "rust"],
  ["feast",    "famine"],
  ["sword",    "shield"],
  ["crown",    "rags"],
  ["wisdom",   "folly"],
  ["grace",    "sin"],
  ["hero",     "villain"],
  ["garden",   "wasteland"],
  ["bloom",    "decay"],
  ["hope",     "despair"],
  ["glory",    "shame"],
  ["water",    "fire"],
  ["earth",    "sky"],
  ["sun",      "moon"],
  ["city",     "wilderness"],
  ["spring",   "autumn"],
  ["truth",    "fiction"],
  ["honey",    "vinegar"],
  ["laughter", "tears"],
  ["thunder",  "whisper"],
  ["storm",    "calm"],
  ["order",    "chaos"],
  ["forest",   "field"],
  ["river",    "stone"],
  ["dream",    "reality"],
  ["noble",    "wicked"],
  ["pure",     "corrupt"],
  ["tender",   "harsh"],
  ["fertile",  "barren"],
  ["serene",   "turbulent"],
  ["ember",    "glacier"],
  ["velvet",   "gravel"],
  ["nectar",   "poison"],
  ["zenith",   "nadir"],
  ["solitude", "crowd"],
  ["steel",    "clay"],
  ["crystal",  "mud"],
  ["lion",     "mouse"],
  ["eagle",    "worm"],
  ["diamond",  "coal"],
  ["tide",     "shore"],
  ["eternal",  "fleeting"],
  ["blossom",  "wither"],
  ["radiant",  "gloomy"],
];

// ── Daily challenge ────────────────────────────────────────────────────────────

/** Return a YYYY-MM-DD string for today (UTC). */
function getDailyDate() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Deterministic daily index (1-based, starts from 2024-01-01). */
function getDailyNumber() {
  const now   = new Date();
  const epoch = Date.UTC(2024, 0, 1);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((today - epoch) / 86_400_000) + 1;
}

/** Word pair for today. */
function getDailyPair() {
  const idx = (getDailyNumber() - 1) % WORD_PAIRS.length;
  return WORD_PAIRS[idx];
}

/**
 * Random pair for Infinite mode.
 * Excludes `exclude` (the current daily pair) so the first infinite game is
 * always different from the daily.
 */
function getRandomPair(exclude) {
  const pool = WORD_PAIRS.filter(
    (p) => !exclude || p[0] !== exclude[0] || p[1] !== exclude[1]
  );
  return pool[Math.floor(Math.random() * pool.length)];
}
