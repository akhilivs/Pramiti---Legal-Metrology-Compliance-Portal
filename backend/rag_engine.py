"""Lightweight retrieval over the Legal Metrology rules.

Sources:
  1. The curated rule summaries in rules_kb.py (always present).
  2. data/rules_corpus.json - a page-by-page transcription of the Gazette PDF produced by
     build_rules_index.py (optional; the PDF is a scan with no text layer).

Ranking is plain BM25, so retrieval needs no embedding API, no vector DB and works offline.
"""
import json
import math
import re
from collections import Counter

from config import RULES_CORPUS_PATH
from rules_kb import RULES

_TOKEN = re.compile(r"[a-z0-9]+")
_STOP = set(
    "a an the of and or to in on for by with is are be shall any such as at from that this which "
    "these those it its into under other than not no may where when".split()
)


def _tokens(text: str) -> list[str]:
    return [t for t in _TOKEN.findall(text.lower()) if t not in _STOP]


def _chunk(text: str, size: int = 1200, overlap: int = 200) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= size:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        end = min(len(text), start + size)
        # prefer to break at a sentence end
        cut = text.rfind(". ", start + size // 2, end)
        if cut != -1 and end < len(text):
            end = cut + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks


class RulesRetriever:
    def __init__(self):
        self.docs: list[dict] = []
        for r in RULES:
            self.docs.append({"source": f"{r['rule']} - {r['title']}", "text": r["text"], "curated": True})

        self.corpus_pages = 0
        if RULES_CORPUS_PATH.exists():
            pages = json.loads(RULES_CORPUS_PATH.read_text(encoding="utf-8"))
            self.corpus_pages = len(pages)
            for p in pages:
                for c in _chunk(p.get("text", "")):
                    self.docs.append({"source": f"Gazette PDF, page {p['page']}", "text": c, "curated": False})

        self._tf = [Counter(_tokens(d["text"])) for d in self.docs]
        self._len = [sum(tf.values()) for tf in self._tf]
        self._avg = (sum(self._len) / len(self._len)) if self._len else 1
        df = Counter()
        for tf in self._tf:
            df.update(tf.keys())
        n = len(self.docs)
        self._idf = {t: math.log(1 + (n - f + 0.5) / (f + 0.5)) for t, f in df.items()}

    def _score(self, q: list[str], i: int, k1=1.5, b=0.75) -> float:
        tf, dl, s = self._tf[i], self._len[i], 0.0
        for t in q:
            if t in tf:
                f = tf[t]
                s += self._idf[t] * f * (k1 + 1) / (f + k1 * (1 - b + b * dl / self._avg))
        return s

    def search(self, query: str, k: int = 4, gazette_only: bool = False) -> list[dict]:
        q = _tokens(query)
        idx = [i for i in range(len(self.docs)) if not (gazette_only and self.docs[i]["curated"])]
        ranked = sorted(idx, key=lambda i: self._score(q, i), reverse=True)
        return [self.docs[i] for i in ranked[:k] if self._score(q, i) > 0]

    def context_for_label(self) -> str:
        """Curated rules plus the most relevant transcribed Gazette passages."""
        parts = [f"[{d['source']}]\n{d['text']}" for d in self.docs if d["curated"]]
        if self.corpus_pages:
            seen = set()
            for q in (
                "declarations to be made on every package name address manufacturer net quantity retail sale price",
                "principal display panel height of numerals area square centimetre table",
                "consumer care telephone e-mail complaints unit sale price",
            ):
                for d in self.search(q, k=2, gazette_only=True):
                    if d["text"] not in seen:
                        seen.add(d["text"])
                        parts.append(f"[{d['source']}]\n{d['text']}")
        return "\n\n---\n\n".join(parts)


_retriever: RulesRetriever | None = None


def get_retriever() -> RulesRetriever:
    global _retriever
    if _retriever is None:
        _retriever = RulesRetriever()
    return _retriever


def reload_retriever() -> RulesRetriever:
    global _retriever
    _retriever = RulesRetriever()
    return _retriever
