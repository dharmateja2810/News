import os
import re
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
from typing import List, Dict, Optional

from bs4 import BeautifulSoup
from dotenv import load_dotenv

from scrape_afr import (
    session,
    fetch,
    get_meta,
    normalize_image_url,
    is_bad_image_url,
    summarize_with_ollama,
    classify_category_with_ollama,
    post_to_backend,
)

load_dotenv()

ABC_HOME = "https://www.abc.net.au/news/newschannel"
ABC_SECTIONS = os.getenv(
    "ABC_SECTIONS",
    "https://www.abc.net.au/news,https://www.abc.net.au/news/newschannel",
)

MAX_ARTICLES = int(os.getenv("MAX_ARTICLES", "30"))
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "6"))



def is_likely_article(url: str) -> bool:
    if "abc.net.au/news" not in url:
        return False
    if "/news/newschannel" in url:
        return False
    if "/news/justin" in url:
        return False
    if re.search(r"/news/\d{4}-\d{2}-\d{2}/", url):
        return True
    if re.search(r"/news/\d{4}/", url) and re.search(r"-\d{7,}$", url):
        return True
    if re.search(r"/news/\d{4}-\d{2}-\d{2}/[\w-]+-\d{7,}$", url):
        return True
    return False



def extract_links(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: List[str] = []

    for a in soup.select("a[href]"):
        href = a.get("href") or ""
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/"):
            href = urljoin("https://www.abc.net.au", href)

        if not href.startswith("http"):
            continue
        if "abc.net.au/news" not in href:
            continue
        if re.search(r"\.(css|js|png|jpe?g|svg|gif|webp)(\?|$)", href, re.I):
            continue
        if "/news/" not in href:
            continue
        if not is_likely_article(href):
            continue

        links.append(href)

    uniq = list(dict.fromkeys(links))
    return uniq[:MAX_ARTICLES]



def pick_image_url(soup: BeautifulSoup, page_url: str) -> str:
    candidates: List[str] = []

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



def parse_article(url: str) -> Dict[str, str]:
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    title = (
        get_meta(soup, "og:title", "property")
        or get_meta(soup, "twitter:title")
        or (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else "")
    )
    description = (
        get_meta(soup, "og:description", "property")
        or get_meta(soup, "description")
        or ""
    )
    image_url = pick_image_url(soup, url)
    author = (
        get_meta(soup, "author")
        or get_meta(soup, "article:author", "property")
        or ""
    )
    published_at = get_meta(soup, "article:published_time", "property")

    article_tag = soup.find("article") or soup.find("main") or soup
    paragraphs = [p.get_text(" ", strip=True) for p in article_tag.find_all("p")]
    paragraphs = [p for p in paragraphs if len(p) > 60]
    content = "\n\n".join(paragraphs[:8])

    summary = summarize_with_ollama(title, content or description)
    category = classify_category_with_ollama(title, description, content or summary)

    if not description:
        description = summary or content or title

    return {
        "title": title,
        "description": description,
        "content": summary or content or description,
        "imageUrl": image_url,
        "source": "ABC News",
        "category": category,
        "author": author,
        "publishedAt": published_at,
        "url": url,
    }



def main() -> None:
    urls = [ABC_HOME] + [u.strip() for u in ABC_SECTIONS.split(",") if u.strip()]

    all_links: List[str] = []
    for src in urls:
        try:
            page = fetch(src)
            all_links.extend(extract_links(page))
        except Exception as exc:
            print(f"Skip source {src}: {exc}")

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
