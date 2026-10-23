"""AI analysis: Gemini vision + retrieved rules -> structured, rule-by-rule findings.

Two modes:
  label      - photos of a physical package
  ecommerce  - an online product listing (page text and/or listing images / screenshots)
"""
import io
import json
import time
from typing import Literal, Optional

from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

from config import GEMINI_API_KEY, GEMINI_FALLBACK_MODELS, GEMINI_MODEL
from rag_engine import get_retriever
from rules_kb import LABEL, LISTING, checks_for

Status = Literal["pass", "fail", "unclear", "not_applicable"]
FIELD_KEYS = ["mrp", "net_quantity", "manufacturer", "date", "best_before", "consumer_care",
              "unit_sale_price", "generic_name", "country_of_origin"]


class LabelFields(BaseModel):
    product_name: Optional[str] = Field(None, description="Product name as printed / listed")
    brand: Optional[str] = None
    generic_name: Optional[str] = None
    manufacturer: Optional[str] = Field(None, description="Manufacturer / packer / importer name AND address")
    manufacturer_name: Optional[str] = Field(None, description="Only the company name of the manufacturer/packer/importer, no address")
    net_quantity: Optional[str] = None
    mrp: Optional[str] = Field(None, description="MRP exactly as shown, including the tax phrase")
    unit_sale_price: Optional[str] = None
    date: Optional[str] = Field(None, description="Month/year of manufacture, packing or import")
    best_before: Optional[str] = None
    consumer_care: Optional[str] = None
    country_of_origin: Optional[str] = None
    batch_no: Optional[str] = None
    fssai_license: Optional[str] = None
    seller: Optional[str] = Field(None, description="For listings: the seller / marketplace name")


class CheckResult(BaseModel):
    id: str = Field(description="One of the check ids given in the prompt")
    status: Status
    evidence: str = Field(description="Short quote from the label/listing, or exactly what is missing/wrong")
    recommendation: Optional[str] = Field(None, description="Corrective action, if not pass")


class Region(BaseModel):
    field: str = Field(description=f"One of: {', '.join(FIELD_KEYS)}")
    image_index: int = Field(description="0-based index of the image the text appears in")
    box_2d: list[int] = Field(description="[ymin, xmin, ymax, xmax] normalised to 0-1000")


class LabelAnalysis(BaseModel):
    is_package_label: bool = Field(description="False if the input is not a product package / product listing")
    image_quality: Literal["good", "fair", "poor"]
    category: Optional[str] = Field(None, description="e.g. Food, Beverage, Personal care, Household, Electronics")
    is_imported: bool = False
    languages: list[str] = []
    raw_text: str
    fields: LabelFields
    estimated_pdp_area_cm2: Optional[float] = None
    estimated_numeral_height_mm: Optional[float] = None
    checks: list[CheckResult]
    regions: list[Region] = Field(default_factory=list, description="Where each declaration appears in the images")
    summary: str = Field(description="2-3 sentence summary for the enforcement officer, in English")
    summary_hi: str = Field(description="The same summary in Hindi (Devanagari)")


class AnalysisError(Exception):
    """Raised with a message that is safe to show the officer."""


def _prompt(rules_context: str, mode: str, n_images: int, listing_text: str | None) -> str:
    checks = "\n".join(f'- "{c["id"]}" ({c["rule"]}, {c["title"]}): {c["requirement"]}' for c in checks_for(mode, "ai"))
    if mode == LISTING:
        subject = (
            "an ONLINE PRODUCT LISTING on an e-commerce platform"
            + (f", given as page text{' and ' + str(n_images) + ' listing image(s)' if n_images else ''}" if listing_text else
               f", given as {n_images} screenshot(s)/listing image(s)")
        )
        extra = (
            "\nThe declarations must be visible to the buyer on the listing (text, specification table or product "
            "images). Treat information present in listing images as displayed. The month/year of manufacture is "
            "verified on the delivered pack, so it is not checked here.\n"
        )
    else:
        subject = "a photograph" if n_images == 1 else f"{n_images} photographs showing different faces of the SAME package (combine them)"
        subject += " of a pre-packaged commodity"
        extra = ""
    listing = f"\n<LISTING_TEXT>\n{listing_text[:15000]}\n</LISTING_TEXT>\n" if listing_text else ""
    return f"""You are a senior Legal Metrology inspector in India examining {subject} for compliance with the
Legal Metrology (Packaged Commodities) Rules, 2011 (as amended).
<LEGAL_CONTEXT>
{rules_context}
</LEGAL_CONTEXT>
{listing}{extra}
Instructions:
1. Read ALL visible text (any language; keep as printed) into raw_text.
2. Extract the declaration fields. Use null for anything not shown. Never invent values.
3. Answer EVERY one of these checks exactly once, using these ids:
{checks}
   Status meanings: "pass" = clearly satisfied; "fail" = clearly missing or wrong; "unclear" = cannot be judged
   (side not visible, blurred, scale unknown); "not_applicable" = the requirement does not apply to this product.
   If a declaration could plausibly be on a face of the pack that is not shown, prefer "unclear" over "fail".
4. evidence must quote the text or state precisely what is missing. Give a short recommendation for every check that is not "pass".
5. regions: for each declaration you found IN AN IMAGE, give a tight bounding box (box_2d = [ymin, xmin, ymax, xmax], 0-1000)
   and the image_index. Skip declarations found only in listing text.
6. If the input is not a product package or product listing, set is_package_label=false and keep the rest minimal.
"""


_genai_client: genai.Client | None = None


def _client() -> genai.Client:
    # Keep one long-lived client: a temporary one gets closed when garbage-collected mid-request.
    global _genai_client
    if not GEMINI_API_KEY:
        raise AnalysisError("GEMINI_API_KEY is not configured on the server. Add it to backend/.env.")
    if _genai_client is None:
        _genai_client = genai.Client(api_key=GEMINI_API_KEY)
    return _genai_client


def _is_transient(msg: str) -> bool:
    return any(s in msg for s in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "500", "INTERNAL", "overloaded",
                                  "timed out", "Timeout", "DEADLINE_EXCEEDED"))


# Whole AI step must finish well inside the 100 s a request may take behind Render's proxy
# (upload and image handling need a few seconds too), or the browser sees an error while the
# inspection still completes on the server.
TOTAL_BUDGET_S = 70
PER_CALL_TIMEOUT_S = 25
LAST_RESORT_RESERVE_S = 20  # always leave the last (fastest) model this long
COOL_OFF_S = 300  # an overloaded model is skipped by later inspections for this long

_cooling: dict[str, float] = {}  # model -> time it may be tried again
_no_thinking_level: set[str] = set()  # models that rejected thinking_level


def _models() -> list[str]:
    models = list(dict.fromkeys([GEMINI_MODEL, *GEMINI_FALLBACK_MODELS]))
    now = time.monotonic()
    ready = [m for m in models[:-1] if _cooling.get(m, 0) <= now]
    return ready + models[-1:]  # the last resort is always tried


def _call_config(config, model: str, timeout_s: float):
    update = {"http_options": types.HttpOptions(timeout=int(timeout_s * 1000))}
    # Flash models otherwise "think" for 10-20 s before answering; extraction does not need it.
    # Lite models do not think by default.
    if "lite" not in model and model not in _no_thinking_level and config.thinking_config is None:
        update["thinking_config"] = types.ThinkingConfig(thinking_level="low")
    return config.model_copy(update=update)


def generate_with_fallback(contents, config=None):
    """Call Gemini, moving straight to the next model on overload, rate limits or timeouts.

    Models that fail are skipped by later calls for a few minutes, so one overloaded model does not
    add its delay to every inspection. Everything fits in TOTAL_BUDGET_S.
    """
    config = config or types.GenerateContentConfig()
    deadline = time.monotonic() + TOTAL_BUDGET_S
    models = _models()
    last = ""
    for i, model in enumerate(models):
        is_last = i == len(models) - 1
        remaining = deadline - time.monotonic()
        if not is_last and remaining < LAST_RESORT_RESERVE_S + 5:
            continue  # not enough time for this one and the last resort; go to the last resort
        timeout = max(5.0, min(PER_CALL_TIMEOUT_S, remaining if is_last else remaining - LAST_RESORT_RESERVE_S))
        for _ in range(2):  # the second pass only runs if the model rejected thinking_level
            try:
                resp = _client().models.generate_content(model=model, contents=contents,
                                                         config=_call_config(config, model, timeout))
                _cooling.pop(model, None)
                return resp, model
            except AnalysisError:
                raise
            except Exception as e:
                last = str(e) or type(e).__name__
                if "thinking" in last.lower() and model not in _no_thinking_level and ("400" in last or "INVALID" in last):
                    _no_thinking_level.add(model)
                    continue
                break
        if "API key" in last or "PERMISSION_DENIED" in last or "401" in last:
            raise AnalysisError("The Gemini API key was rejected. Check GEMINI_API_KEY in backend/.env.")
        if not _is_transient(last) and "404" not in last:
            raise AnalysisError(f"AI analysis failed: {last[:300]}")
        print(f"Gemini {model} failed, trying the next model: {last[:120]}")
        _cooling[model] = time.monotonic() + COOL_OFF_S
    if "429" in last or "RESOURCE_EXHAUSTED" in last:
        raise AnalysisError("Gemini rate limit / quota reached. Please wait a minute and try again.")
    raise AnalysisError("The Gemini AI service is busy right now. Please try again in a minute.")


def analyze(images: list[Image.Image], mode: str = LABEL, listing_text: str | None = None) -> dict:
    """Run the AI checks. Returns raw AI output; services.build_scan_result adds deterministic checks."""
    contents: list = []
    for image in images:
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=90)
        contents.append(types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))
    contents.append(_prompt(get_retriever().context_for_label(), mode, len(images), listing_text))
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=LabelAnalysis,
        temperature=0.1,
    )
    resp, used_model = generate_with_fallback(contents, config)

    result: LabelAnalysis | None = resp.parsed if isinstance(resp.parsed, LabelAnalysis) else None
    if result is None:
        try:
            result = LabelAnalysis.model_validate(json.loads(resp.text))
        except Exception:
            raise AnalysisError("The AI returned an unreadable response. Please try again with a clearer photo.")

    if not result.is_package_label:
        what = "product listing" if mode == LISTING else "product package label"
        raise AnalysisError(f"This does not look like a {what}. Please capture the label clearly.")

    regions = [
        {"field": r.field, "image_index": r.image_index, "box": r.box_2d}
        for r in result.regions
        if r.field in FIELD_KEYS and len(r.box_2d) == 4 and 0 <= r.image_index < max(1, len(images))
    ]
    fields = result.fields.model_dump()
    fields.update({
        "category": result.category,
        "is_imported": result.is_imported,
        "languages": result.languages,
        "image_quality": result.image_quality,
        "estimated_pdp_area_cm2": result.estimated_pdp_area_cm2,
        "estimated_numeral_height_mm": result.estimated_numeral_height_mm,
    })
    return {
        "fields": fields,
        "ai_checks": {c.id: c.model_dump() for c in result.checks},
        "regions": regions,
        "raw_text": result.raw_text,
        "summary": result.summary,
        "summary_hi": result.summary_hi,
        "model": used_model,
    }
