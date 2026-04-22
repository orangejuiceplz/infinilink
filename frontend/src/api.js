async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchDailyPair(dateStr) {
  const params = dateStr ? `?date_str=${dateStr}` : '';
  return request(`/api/daily${params}`);
}

export async function fetchRandomPair() {
  return request('/api/random');
}

export async function fetchBatchSimilarity(newWord, existingWords) {
  return request('/api/batch-similarity', {
    method: 'POST',
    body: JSON.stringify({ new_word: newWord, existing_words: existingWords }),
  });
}

export async function validateWord(word) {
  return request(`/api/validate/${encodeURIComponent(word)}`);
}
