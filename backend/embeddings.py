from sentence_transformers import SentenceTransformer
import numpy as np

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
