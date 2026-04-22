from sentence_transformers import SentenceTransformer
import numpy as np
from collections import deque

CONNECTION_THRESHOLD = 0.38

_model: SentenceTransformer | None = None
_cache: dict[str, np.ndarray] = {}


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        print("Loading sentence-transformers model...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("Model loaded.")
    return _model


def get_embedding(word: str) -> np.ndarray:
    word = word.lower().strip()
    if word not in _cache:
        model = _get_model()
        _cache[word] = model.encode(word, normalize_embeddings=True)
    return _cache[word]


def get_similarity(word_a: str, word_b: str) -> float:
    emb_a = get_embedding(word_a)
    emb_b = get_embedding(word_b)
    sim = float(np.dot(emb_a, emb_b))
    return round(sim * 100, 1)


def get_batch_similarity(new_word: str, existing_words: list[str]) -> list[dict]:
    new_emb = get_embedding(new_word)
    results = []
    for w in existing_words:
        other_emb = get_embedding(w)
        sim = round(float(np.dot(new_emb, other_emb)) * 100, 1)
        results.append({
            "word": w,
            "similarity": sim,
            "connected": sim >= CONNECTION_THRESHOLD * 100,
        })
    return results


def is_connected(similarity_pct: float) -> bool:
    return similarity_pct >= CONNECTION_THRESHOLD * 100


_word_graph: dict[str, list[str]] | None = None
_graph_words: list[str] = []

def _build_word_graph(words: list[str]):
    global _word_graph, _graph_words
    if _word_graph is not None:
        return

    print(f"Building word graph for {len(words)} words...")
    model = _get_model()
    _graph_words = words

    embeddings = model.encode(words, normalize_embeddings=True, batch_size=128, show_progress_bar=True)
    for i, w in enumerate(words):
        _cache[w] = embeddings[i]

    threshold = CONNECTION_THRESHOLD
    sim_matrix = np.dot(embeddings, embeddings.T)

    _word_graph = {w: [] for w in words}
    for i in range(len(words)):
        for j in range(i + 1, len(words)):
            if sim_matrix[i][j] >= threshold:
                _word_graph[words[i]].append(words[j])
                _word_graph[words[j]].append(words[i])

    total_edges = sum(len(v) for v in _word_graph.values()) // 2
    print(f"Word graph built: {len(words)} nodes, {total_edges} edges")


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

