"""Offline accuracy benchmark against hand-labelled photos.

Put photos in backend/benchmark/ and describe the correct answer for each in
backend/benchmark/labels.json - only the checks you have verified need to be listed:

    {
      "atta_front.jpg": {"mrp": "pass", "unit_sale_price": "fail", "consumer_care": "fail"},
      "biscuit_back.jpg": {"date": "pass", "mrp_integrity": "fail"}
    }

Several photos of one pack can be grouped with a list key:  "pack1": {"files": ["a.jpg", "b.jpg"], "mrp": "pass"}

    python benchmark.py

Results are written to data/benchmark_results.json and shown on the AI Accuracy page.
"""
import datetime
import json
import sys
import time
from pathlib import Path

from analyzer import AnalysisError, analyze
from config import DATA_DIR
from rules_kb import CHECK_BY_ID
from services import load_image

BENCH_DIR = Path(__file__).resolve().parent / "benchmark"


def main():
    labels_file = BENCH_DIR / "labels.json"
    if not labels_file.exists():
        sys.exit(f"Create {labels_file} first (see the docstring at the top of this file).")
    labels = json.loads(labels_file.read_text(encoding="utf-8"))

    stats: dict[str, dict] = {}
    model, done = None, 0
    for key, truth in labels.items():
        truth = dict(truth)
        files = truth.pop("files", [key])
        try:
            images = [load_image((BENCH_DIR / f).read_bytes(), f) for f in files]
            result = analyze(images)
        except (AnalysisError, OSError) as e:
            print(f"  {key}: skipped ({e})")
            continue
        model = result["model"]
        done += 1
        for cid, expected in truth.items():
            got = result["ai_checks"].get(cid, {}).get("status", "unclear")
            s = stats.setdefault(cid, {"n": 0, "correct": 0, "tp": 0, "fp": 0, "fn": 0})
            s["n"] += 1
            s["correct"] += got == expected
            s["tp"] += got == "fail" and expected == "fail"
            s["fp"] += got == "fail" and expected != "fail"
            s["fn"] += got != "fail" and expected == "fail"
            mark = "ok " if got == expected else "XX "
            print(f"  {mark}{key} {cid}: expected {expected}, AI said {got}")
        time.sleep(1)

    pct = lambda a, b: round(100 * a / b, 1) if b else None  # noqa: E731
    results = {
        "run_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "images": done,
        "model": model,
        "checks": [
            {"id": cid, "title": CHECK_BY_ID.get(cid, {}).get("title", cid), "n": s["n"],
             "accuracy": pct(s["correct"], s["n"]), "precision": pct(s["tp"], s["tp"] + s["fp"]),
             "recall": pct(s["tp"], s["tp"] + s["fn"])}
            for cid, s in stats.items()
        ],
    }
    (DATA_DIR / "benchmark_results.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
    print(f"\nBenchmarked {done} items. Results saved to data/benchmark_results.json")


if __name__ == "__main__":
    main()
