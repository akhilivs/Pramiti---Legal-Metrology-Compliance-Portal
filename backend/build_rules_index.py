"""One-time transcription of the scanned Gazette PDF into data/rules_corpus.json.

The bundled sih_eng.pdf is a scan with no text layer, so we send each page image to Gemini
for transcription. Re-running resumes where it stopped (pages already transcribed are kept).

    python build_rules_index.py            # transcribe missing pages
    python build_rules_index.py --force    # start over
"""
import io
import json
import sys

from google.genai import types
from PIL import Image
from pypdf import PdfReader

from analyzer import generate_with_fallback
from config import GEMINI_API_KEY, RULES_CORPUS_PATH, RULES_PDF_PATH

PROMPT = (
    "This is one page of the Gazette of India notification of the Legal Metrology (Packaged "
    "Commodities) Rules, 2011. Transcribe ALL English text on the page exactly, preserving rule "
    "numbers, clause letters and tables (render tables as 'col | col' lines). Skip Hindi page "
    "headers and page numbers. Output plain text only."
)


def page_image(page) -> bytes | None:
    images = list(page.images)
    if not images:
        return None
    img = Image.open(io.BytesIO(images[0].data)).convert("L")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def main():
    if not GEMINI_API_KEY:
        sys.exit("GEMINI_API_KEY is not set in backend/.env")
    if not RULES_PDF_PATH.exists():
        sys.exit(f"Rules PDF not found at {RULES_PDF_PATH}")

    pages: dict[int, str] = {}
    if RULES_CORPUS_PATH.exists() and "--force" not in sys.argv:
        pages = {p["page"]: p["text"] for p in json.loads(RULES_CORPUS_PATH.read_text(encoding="utf-8"))}

    reader = PdfReader(str(RULES_PDF_PATH))
    total = len(reader.pages)

    for i, page in enumerate(reader.pages, start=1):
        if i in pages:
            continue
        text = (page.extract_text() or "").strip()
        if len(text) < 50:
            img = page_image(page)
            if img is None:
                continue
            try:
                resp, _ = generate_with_fallback([types.Part.from_bytes(data=img, mime_type="image/jpeg"), PROMPT])
                text = (resp.text or "").strip()
            except Exception as e:
                print(f"[{i}/{total}] skipped ({e}) - re-run the script later to fill it in")
                continue
        pages[i] = text
        print(f"[{i}/{total}] {len(text)} chars")
        RULES_CORPUS_PATH.write_text(
            json.dumps([{"page": p, "text": t} for p, t in sorted(pages.items())], ensure_ascii=False, indent=1),
            encoding="utf-8",
        )

    print(f"Done. {len(pages)} pages saved to {RULES_CORPUS_PATH}")


if __name__ == "__main__":
    main()
