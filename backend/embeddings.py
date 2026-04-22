import numpy as np
from collections import deque

CONNECTION_THRESHOLD = 0.50

_model = None
_cache: dict[str, np.ndarray] = {}


def _get_model():
    global _model
    if _model is None:
        import gensim.downloader as api
        print("Loading GloVe word vectors...")
        _model = api.load("glove-wiki-gigaword-100")
        print(f"GloVe loaded: {len(_model.key_to_index)} words, 100 dimensions")
    return _model


def get_embedding(word: str) -> np.ndarray | None:
    word = word.lower().strip()
    if word in _cache:
        return _cache[word]

    model = _get_model()
    if word not in model.key_to_index:
        return None

    vec = model[word]
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    _cache[word] = vec
    return vec


def get_similarity(word_a: str, word_b: str) -> float:
    emb_a = get_embedding(word_a)
    emb_b = get_embedding(word_b)
    if emb_a is None or emb_b is None:
        return 0.0
    sim = float(np.dot(emb_a, emb_b))
    return round(max(0, sim) * 100, 1)


def get_batch_similarity(new_word: str, existing_words: list[str]) -> list[dict]:
    new_emb = get_embedding(new_word)
    results = []
    for w in existing_words:
        other_emb = get_embedding(w)
        if new_emb is None or other_emb is None:
            sim = 0.0
        else:
            sim = round(max(0, float(np.dot(new_emb, other_emb))) * 100, 1)
        results.append({
            "word": w,
            "similarity": sim,
            "connected": sim >= CONNECTION_THRESHOLD * 100,
        })
    return results


def word_has_embedding(word: str) -> bool:
    model = _get_model()
    return word.lower().strip() in model.key_to_index


def is_connected(similarity_pct: float) -> bool:
    return similarity_pct >= CONNECTION_THRESHOLD * 100


_word_graph: dict[str, list[str]] | None = None

def _build_word_graph(words: list[str]):
    global _word_graph
    if _word_graph is not None:
        return

    model = _get_model()
    valid_words = [w for w in words if w in model.key_to_index]
    print(f"Building word graph for {len(valid_words)} words (of {len(words)} total)...")

    vecs = np.array([model[w] for w in valid_words])
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1
    vecs = vecs / norms

    sim_matrix = np.dot(vecs, vecs.T)

    _word_graph = {w: [] for w in valid_words}
    for i in range(len(valid_words)):
        for j in range(i + 1, len(valid_words)):
            if sim_matrix[i][j] >= CONNECTION_THRESHOLD:
                _word_graph[valid_words[i]].append(valid_words[j])
                _word_graph[valid_words[j]].append(valid_words[i])

    total_edges = sum(len(v) for v in _word_graph.values()) // 2
    print(f"Word graph built: {len(valid_words)} nodes, {total_edges} edges")


def find_shortest_path(start: str, target: str, words: list[str]) -> int | None:
    _build_word_graph(words)

    if start not in _word_graph or target not in _word_graph:
        return None

    visited = {start}
    queue = deque([(start, 0)])

    while queue:
        current, depth = queue.popleft()
        if current == target:
            return depth

        for neighbor in _word_graph.get(current, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, depth + 1))

    return None
