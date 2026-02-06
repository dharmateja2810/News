import os
import re
import json
import time
from urllib.parse import urljoin
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

AFR_HOME = "https://www.afr.com/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36"
)

BACKEND_URL = os.getenv("DAILYDIGEST_BACKEND_ARTICLES_URL", "http://localhost:3001/api/articles")
WEBHOOK_SECRET = os.getenv("DAILYDIGEST_WEBHOOK_SECRET") or os.getenv("N8N_WEBHOOK_SECRET", "")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

REQUEST_TIMEOUT = 30
OLLAMA_TIMEOUT = 120  # Longer timeout for local LLM
MAX_ARTICLES = int(os.getenv("MAX_ARTICLES", "12"))
SUMMARY_SENTENCES = os.getenv("SUMMARY_SENTENCES", "3-5")


session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})


def fetch(url: str) -> str:
    res = session.get(url, timeout=REQUEST_TIMEOUT)
    res.raise_for_status()
    return res.text


def is_likely_article(url: str) -> bool:
    # AFR articles typically have a dated slug with digits at the end.
    # Example: .../some-headline-20260131-p5fabc
    path = url.split("?")[0].rstrip("/")
    slug = path.split("/")[-1]
    if re.search(r"-\d{6,}$", slug):
        return True
    if re.search(r"/20\d{2}/", path):
        return True
    if re.search(r"-p[0-9a-z]{4,}$", slug, re.I):
        return True
    return False


def extract_links(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = "https://www.afr.com" + href
        if not href.startswith("http"):
            continue
        if "afr.com" not in href:
            continue
        if "/static/" in href:
            continue
        if re.search(r"\.(css|js|png|jpe?g|svg|gif|webp)(\?|$)", href, re.I):
            continue
        if "/subscribe" in href or "/login" in href:
            continue
        if href.count("/") < 4:
            continue
        if not is_likely_article(href):
            continue
        links.append(href)

    uniq = list(dict.fromkeys(links))

    article_links = [u for u in uniq if is_likely_article(u)]
    if article_links:
        return article_links[:MAX_ARTICLES]

    # Fallback: take longer slugs (still avoid obvious category pages)
    fallback = []
    for u in uniq:
        path = u.split("?")[0].rstrip("/")
        slug = path.split("/")[-1]
        if len(slug) < 15:
            continue
        if any(seg in path for seg in ["/companies/", "/markets/", "/policy/", "/newsfeed/", "/topic/"]):
            continue
        fallback.append(u)

    return fallback[:MAX_ARTICLES]


def get_meta(soup: BeautifulSoup, name: str, attr: str = "name") -> str:
    tag = soup.find("meta", attrs={attr: name})
    if tag and tag.get("content"):
        return tag["content"].strip()
    return ""


def normalize_image_url(raw: str, page_url: str) -> str:
    if not raw:
        return ""
    raw = raw.strip()
    if not raw:
        return ""
    if raw.startswith("//"):
        raw = "https:" + raw
    return urljoin(page_url, raw)


def is_bad_image_url(url: str) -> bool:
    lowered = url.lower()
    return any(
        token in lowered
        for token in [
            "logo",
            "icon",
            "sprite",
            "favicon",
            "placeholder",
            "spacer",
            "data:image",
        ]
    )


def pick_image_url(soup: BeautifulSoup, page_url: str) -> str:
    candidates = []

    for name, attr in [
        ("og:image:secure_url", "property"),
        ("og:image", "property"),
        ("og:image:url", "property"),
        ("twitter:image", "name"),
        ("twitter:image:src", "name"),
    ]:
        val = get_meta(soup, name, attr)
        if val:
            candidates.append(val)

    for img in soup.select("article img, figure img, main img"):
        src = img.get("src") or img.get("data-src") or img.get("data-original")
        if src:
            candidates.append(src)

    seen = set()
    for raw in candidates:
        normalized = normalize_image_url(raw, page_url)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        if is_bad_image_url(normalized):
            continue
        return normalized

    return ""


def title_from_url(url: str) -> str:
    slug = url.rstrip("/").split("/")[-1]
    return re.sub(r"[-_]", " ", slug).title()


def summarize_with_ollama(title: str, content: str) -> str:
    """Summarize article using local Ollama with Llama model."""
    prompt = (
        f"Summarize the following news article in {SUMMARY_SENTENCES} sentences. "
        "Keep it neutral, factual, and concise. Only output the summary, nothing else.\n\n"
        f"TITLE: {title}\n\nCONTENT: {content}"
    )
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 256,
        }
    }

    try:
        res = session.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        res.raise_for_status()
        data = res.json()
        return data.get("response", "").strip()
    except Exception as e:
        print(f"Ollama summarization failed: {e}")
        return ""


def parse_article(url: str) -> Dict[str, str]:
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    title = (
        get_meta(soup, "og:title", "property")
        or get_meta(soup, "twitter:title")
        or (soup.title.string.strip() if soup.title else "")
        or title_from_url(url)
    )
    description = (
        get_meta(soup, "og:description", "property")
        or get_meta(soup, "description")
        or ""
    )
    image_url = pick_image_url(soup, url)
    author = get_meta(soup, "author") or get_meta(soup, "article:author", "property")
    published_at = get_meta(soup, "article:published_time", "property")

    paragraphs = [p.get_text(" ", strip=True) for p in soup.find_all("p")]
    paragraphs = [p for p in paragraphs if len(p) > 60]
    content = "\n\n".join(paragraphs[:5])

    summary = summarize_with_ollama(title, content or description)

    if not description:
        description = summary or content or title

    return {
        "title": title,
        "description": description,
        "content": summary or content or description,
        "imageUrl": image_url,
        "source": "AFR",
        "category": "Business",
        "author": author,
        "publishedAt": published_at,
        "url": url,
    }


def post_to_backend(article: Dict[str, str]) -> Optional[Dict]:
    if not BACKEND_URL:
        return None
    headers = {"Content-Type": "application/json"}
    if not WEBHOOK_SECRET:
        raise RuntimeError("Missing webhook secret. Set DAILYDIGEST_WEBHOOK_SECRET or N8N_WEBHOOK_SECRET.")
    headers["x-webhook-secret"] = WEBHOOK_SECRET

    res = session.post(BACKEND_URL, json=article, headers=headers, timeout=REQUEST_TIMEOUT)
    res.raise_for_status()
    return res.json() if res.content else None


def main() -> None:
    homepage = fetch(AFR_HOME)
    links = extract_links(homepage)

    if not links:
        print("No article links found.")
        return

    results = []
    for url in links:
        try:
            article = parse_article(url)
            results.append(article)
            print(f"Parsed: {article['title']}")
            time.sleep(0.5)
        except Exception as exc:
            print(f"Skip {url}: {exc}")

    print(f"Parsed {len(results)} articles.")

    for article in results:
        try:
            response = post_to_backend(article)
            print(f"Upserted: {article['title']}")
            if response:
                print(json.dumps(response, indent=2)[:500])
        except Exception as exc:
            print(f"Upsert failed: {article['url']} -> {exc}")


if __name__ == "__main__":
    main()
