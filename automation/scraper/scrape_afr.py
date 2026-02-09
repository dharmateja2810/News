import os
import re
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
from typing import List, Dict, Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()

AFR_HOME = "https://www.afr.com/"
AFR_SECTIONS = os.getenv(
    "AFR_SECTIONS",
    "https://www.afr.com/companies,https://www.afr.com/markets,https://www.afr.com/policy",
)
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
MAX_ARTICLES = int(os.getenv("MAX_ARTICLES", "30"))
SUMMARY_SENTENCES = os.getenv("SUMMARY_SENTENCES", "3-5")
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "6"))
ALLOWED_CATEGORIES = [
    "Technology",
    "Business",
    "Sports",
    "Health",
    "Science",
    "Entertainment",
    "Politics",
    "World",
]



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


def classify_category_with_ollama(title: str, description: str, content: str) -> str:
    prompt = (
        "You are a news classifier. "
        "Choose exactly one category from this list: "
        f"{', '.join(ALLOWED_CATEGORIES)}. "
        "Return only the category name, nothing else.\n\n"
        f"TITLE: {title}\n\nDESCRIPTION: {description}\n\nCONTENT: {content}"
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0,
            "num_predict": 24,
        },
    }

    try:
        res = session.post(OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)
        res.raise_for_status()
        data = res.json()
        response = (data.get("response", "") or "").strip()
        for category in ALLOWED_CATEGORIES:
            if response.lower() == category.lower():
                return category
    except Exception as e:
        print(f"Ollama classification failed: {e}")

    # Fallback heuristics if LLM fails
    text = f"{title} {description} {content}".lower()
    if re.search(r"\b(ai|chip|apple|google|microsoft|cyber|software|startup|tech)\b", text):
        return "Technology"
    if re.search(r"\b(stock|market|asx|profit|earnings|rates|bank|economy|inflation)\b", text):
        return "Business"
    if re.search(r"\b(match|league|tournament|championship|soccer|football|cricket|tennis)\b", text):
        return "Sports"
    if re.search(r"\b(health|hospital|cancer|vaccine|disease|medical)\b", text):
        return "Health"
    if re.search(r"\b(science|research|space|telescope|climate|biology|physics)\b", text):
        return "Science"
    if re.search(r"\b(movie|music|streaming|celebrity|entertainment)\b", text):
        return "Entertainment"
    if re.search(r"\b(election|government|parliament|policy|minister|politics)\b", text):
        return "Politics"

    return "Business"


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

    category = classify_category_with_ollama(title, description, content or summary)

    if not description:
        description = summary or content or title

    return {
        "title": title,
        "description": description,
        "content": summary or content or description,
        "imageUrl": image_url,
        "source": "AFR",
        "category": category,
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
    urls = [AFR_HOME] + [u.strip() for u in AFR_SECTIONS.split(",") if u.strip()]

    all_links: List[str] = []
    for src in urls:
        try:
            page = fetch(src)
            all_links.extend(extract_links(page))
        except Exception as exc:
            print(f"Skip source {src}: {exc}")

    # Deduplicate and cap
    links = list(dict.fromkeys(all_links))[:MAX_ARTICLES]

    if not links:
        print("No article links found.")
        return

    def process_url(url: str) -> Optional[Dict[str, str]]:
        try:
            article = parse_article(url)
            print(f"Parsed: {article['title']}")
            response = post_to_backend(article)
            print(f"Upserted: {article['title']}")
            if response:
                print(json.dumps(response, indent=2)[:500])
            return article
        except Exception as exc:
            print(f"Skip {url}: {exc}")
            return None

    results: List[Dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_url, url) for url in links]
        for future in as_completed(futures):
            item = future.result()
            if item:
                results.append(item)

    print(f"Parsed {len(results)} articles.")


if __name__ == "__main__":
    main()
