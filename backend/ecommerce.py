"""Fetch an e-commerce product listing and extract its text and main images.

Marketplaces often block automated requests; in that case the officer can paste the listing text
or upload screenshots instead, and the same Rule 6(10) checks run on those.
"""
import io
import ipaddress
import json
import re
import socket
from html import unescape
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx
from PIL import Image

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/126.0 Safari/537.36",
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml",
}
BLOCK_MARKERS = ("captcha", "robot check", "are you a human", "access denied", "unusual traffic", "enable javascript")


class ListingError(Exception):
    pass


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "head", "iframe", "template"}

    def __init__(self):
        super().__init__()
        self.depth = 0
        self.parts: list[str] = []
        self.title = ""
        self._in_title = False
        self.meta: dict[str, str] = {}
        self.images: list[str] = []
        self.jsonld: list[str] = []
        self._in_jsonld = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        if tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self._in_jsonld = True
        if tag in self.SKIP:
            self.depth += 1
        if tag == "meta":
            key = (a.get("property") or a.get("name") or "").lower()
            if key and a.get("content"):
                self.meta[key] = a["content"]
        if tag == "img":
            src = a.get("data-old-hires") or a.get("data-src") or a.get("src") or ""
            if src and not src.startswith("data:") and any(k in (a.get("id", "") + a.get("class", "") + src).lower()
                                                            for k in ("landing", "product", "main", "zoom", "image")):
                self.images.append(src)
        if tag in ("br", "p", "div", "li", "tr", "h1", "h2", "h3", "td", "th"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag == "script":
            self._in_jsonld = False
        if tag in self.SKIP and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_jsonld:
            self.jsonld.append(data)
            return
        if not self.depth and data.strip():
            self.parts.append(data.strip() + " ")


def _check_public_url(url: str) -> str:
    """Only allow http(s) URLs on public addresses (prevents requests into the internal network)."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ListingError("Enter a full product URL starting with http:// or https://")
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise ListingError(f"Could not resolve '{parsed.hostname}'. Check the URL.")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise ListingError("That address is not a public website.")
    return url.strip()


def _jsonld_products(blocks: list[str]) -> list[dict]:
    out = []
    for block in blocks:
        try:
            data = json.loads(block)
        except Exception:
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for it in items:
            if isinstance(it, dict) and "product" in str(it.get("@type", "")).lower():
                out.append(it)
    return out


def fetch_listing(url: str, max_images: int = 3) -> dict:
    """Returns {url, title, text, images: [PIL.Image]}. Raises ListingError with an officer-friendly message."""
    url = _check_public_url(url)
    try:
        with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=20) as client:
            resp = client.get(url)
            # follow_redirects may land elsewhere - re-validate the final host
            _check_public_url(str(resp.url))
            if resp.status_code >= 400:
                raise ListingError(f"The marketplace refused the request (HTTP {resp.status_code}). "
                                   "Paste the listing text or upload screenshots instead.")
            html = resp.text
            p = _TextExtractor()
            p.feed(html)
            text = unescape(re.sub(r"[ \t]+", " ", "".join(p.parts)))
            text = re.sub(r"\n\s*\n+", "\n", text).strip()

            products = _jsonld_products(p.jsonld)
            structured = "\n".join(json.dumps(pr, ensure_ascii=False)[:4000] for pr in products[:2])
            title = (p.meta.get("og:title") or p.title or "").strip()

            if len(text) < 300 and not structured or any(m in text.lower()[:3000] for m in BLOCK_MARKERS):
                raise ListingError("The marketplace blocked automated access to this page. "
                                   "Paste the listing text or upload screenshots of the listing instead.")

            candidates = []
            if p.meta.get("og:image"):
                candidates.append(p.meta["og:image"])
            for pr in products:
                img = pr.get("image")
                candidates += img if isinstance(img, list) else [img] if isinstance(img, str) else []
            candidates += p.images
            images, seen = [], set()
            for src in candidates:
                full = urljoin(str(resp.url), src)
                if full in seen or len(images) >= max_images:
                    continue
                seen.add(full)
                try:
                    _check_public_url(full)
                    r = client.get(full, timeout=15)
                    if r.status_code == 200 and len(r.content) > 5000:
                        img = Image.open(io.BytesIO(r.content)).convert("RGB")
                        if min(img.size) >= 200:
                            img.thumbnail((1600, 1600))
                            images.append(img)
                except Exception:
                    continue
    except httpx.HTTPError as e:
        raise ListingError(f"Could not open the listing ({type(e).__name__}). Paste the listing text or upload screenshots instead.")

    body = f"PAGE TITLE: {title}\nURL: {url}\n"
    if structured:
        body += f"\nSTRUCTURED PRODUCT DATA:\n{structured}\n"
    body += f"\nPAGE TEXT:\n{text[:12000]}"
    return {"url": url, "title": title, "text": body, "images": images}
