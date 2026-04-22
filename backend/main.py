from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import date

from embeddings import get_similarity, get_batch_similarity, CONNECTION_THRESHOLD
from words import get_daily_pair, get_random_pair

app = FastAPI(title="unlinxicon API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimilarityRequest(BaseModel):
    word_a: str
    word_b: str


class BatchSimilarityRequest(BaseModel):
    new_word: str
    existing_words: list[str]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/daily")
def daily_pair(date_str: str | None = None):
    d = date.fromisoformat(date_str) if date_str else date.today()
    start, target = get_daily_pair(d)
    epoch = date(2025, 1, 1)
    game_number = (d - epoch).days
    return {
        "start": start,
        "target": target,
        "game_number": game_number,
        "date": d.isoformat(),
    }


@app.get("/api/random")
def random_pair():
    start, target = get_random_pair()
    return {"start": start, "target": target}


@app.post("/api/similarity")
def similarity(req: SimilarityRequest):
    word_a = req.word_a.lower().strip()
    word_b = req.word_b.lower().strip()
    if not word_a or not word_b:
        raise HTTPException(400, "Both words required")
    sim = get_similarity(word_a, word_b)
    return {
        "word_a": word_a,
        "word_b": word_b,
        "similarity": sim,
        "connected": sim >= CONNECTION_THRESHOLD * 100,
    }


@app.post("/api/batch-similarity")
def batch_similarity(req: BatchSimilarityRequest):
    new_word = req.new_word.lower().strip()
    if not new_word:
        raise HTTPException(400, "Word required")
    existing = [w.lower().strip() for w in req.existing_words if w.strip()]
    results = get_batch_similarity(new_word, existing)
    return {"word": new_word, "results": results}


@app.get("/api/validate/{word}")
def validate_word(word: str):
    word = word.lower().strip()
    if not word or not word.isalpha():
        return {"valid": False, "word": word}
    return {"valid": True, "word": word}
