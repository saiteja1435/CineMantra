import os
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(override=True)

_BASE  = "https://google.serper.dev/search"
_cache: dict = {}
_TTL   = 600  # 10 minutes


def _api_key() -> str:
    return os.getenv("SERPER_API_KEY", "")


def _log(msg: str):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _search(query: str, num: int = 5) -> dict:
    key = _api_key()
    if not key:
        _log("[Serper] ERROR: SERPER_API_KEY is empty")
        return {}

    cache_key = f"serper:{query}:{num}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            _log(f"[Serper] Cache HIT: {query}")
            return data

    _log(f"[Serper] Query: {query}")
    try:
        resp = requests.post(
            _BASE,
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": query, "num": num},
            timeout=10,
        )
        _log(f"[Serper] HTTP {resp.status_code}")
        if resp.status_code != 200:
            _log(f"[Serper] Error: {resp.text[:300]}")
            return {}
        data = resp.json()
        _cache[cache_key] = (now, data)
        return data
    except Exception as e:
        _log(f"[Serper] Exception: {e}")
        return {}


def _organic(data: dict) -> list:
    return data.get("organic", [])


def _news_items(data: dict) -> list:
    return data.get("news", [])


# ── Public API ────────────────────────────────────────────────

def getMovieReviews(movie_name: str) -> list:
    """Try multiple review queries, merge unique results."""
    queries = [
        f"{movie_name} movie review",
        f"{movie_name} imdb review",
        f"{movie_name} rotten tomatoes review",
    ]
    seen, results = set(), []
    for q in queries:
        for item in _organic(_search(q, num=5)):
            link = item.get("link", "")
            if link and link not in seen:
                seen.add(link)
                results.append({
                    "title":    item.get("title", ""),
                    "link":     link,
                    "source":   item.get("displayLink", ""),
                    "snippet":  item.get("snippet", ""),
                    "rating":   item.get("rating"),          # may be None
                    "image":    (item.get("imageUrl") or
                                 item.get("thumbnailUrl") or
                                 item.get("image", {}).get("imageUrl") if isinstance(item.get("image"), dict) else None),
                })
        if len(results) >= 6:
            break
    return results[:6]


def getMovieNews(movie_name: str) -> list:
    data = _search(f"{movie_name} latest movie news", num=8)
    items = _news_items(data) or _organic(data)
    results = []
    for item in items[:6]:
        results.append({
            "title":     item.get("title", ""),
            "link":      item.get("link", ""),
            "source":    item.get("source") or item.get("displayLink", ""),
            "date":      item.get("date", ""),
            "snippet":   item.get("snippet", ""),
            "image":     item.get("imageUrl") or item.get("thumbnailUrl"),
        })
    return results


def getMovieArticles(movie_name: str) -> list:
    data = _search(f"{movie_name} movie articles features", num=6)
    results = []
    for item in _organic(data)[:6]:
        results.append({
            "title":   item.get("title", ""),
            "link":    item.get("link", ""),
            "source":  item.get("displayLink", ""),
            "snippet": item.get("snippet", ""),
            "image":   (item.get("imageUrl") or
                        item.get("thumbnailUrl") or
                        (item.get("image", {}).get("imageUrl") if isinstance(item.get("image"), dict) else None)),
        })
    return results


def getMovieBoxOffice(movie_name: str) -> list:
    data = _search(f"{movie_name} box office collection worldwide", num=5)
    results = []
    for item in _organic(data)[:5]:
        results.append({
            "title":   item.get("title", ""),
            "link":    item.get("link", ""),
            "source":  item.get("displayLink", ""),
            "snippet": item.get("snippet", ""),
        })
    return results


def getMovieLatestNews(movie_name: str) -> list:
    """Merge reviews + news + articles in parallel, deduplicate, sort newest first."""
    queries = [
        (f"{movie_name} movie review",          "organic"),
        (f"{movie_name} latest movie news",      "news"),
        (f"{movie_name} movie articles features", "organic"),
    ]

    def _fetch(q, kind):
        data = _search(q, num=6)
        items = _news_items(data) if kind == "news" else _organic(data)
        out = []
        for item in items:
            link = item.get("link", "")
            if not link:
                continue
            img = (item.get("imageUrl") or
                   item.get("thumbnailUrl") or
                   (item["image"].get("imageUrl") if isinstance(item.get("image"), dict) else None))
            out.append({
                "title":   item.get("title", ""),
                "link":    link,
                "source":  item.get("source") or item.get("displayLink", ""),
                "date":    item.get("date", ""),
                "snippet": item.get("snippet", ""),
                "image":   img,
            })
        return out

    all_items = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = [ex.submit(_fetch, q, kind) for q, kind in queries]
        for f in as_completed(futures):
            try:
                all_items.extend(f.result())
            except Exception:
                pass

    # Deduplicate by URL
    seen, merged = set(), []
    for item in all_items:
        if item["link"] not in seen:
            seen.add(item["link"])
            merged.append(item)

    # Sort: items with a date first (newest), then undated
    def _sort_key(x):
        return x["date"] if x["date"] else ""

    merged.sort(key=_sort_key, reverse=True)
    return merged[:10]


# ── Telugu-specific search ──────────────────────────────────────────

def getTeluguMovieReviews(movie_name: str) -> list:
    queries = [
        f"{movie_name} Telugu Review",
        f"{movie_name} Telugu movie review",
        f"{movie_name} Telugu rating",
    ]
    seen, results = set(), []
    for q in queries:
        for item in _organic(_search(q, num=5)):
            link = item.get("link", "")
            if link and link not in seen:
                seen.add(link)
                results.append({
                    "title":   item.get("title", ""),
                    "link":    link,
                    "source":  item.get("displayLink", ""),
                    "snippet": item.get("snippet", ""),
                    "image":   (item.get("imageUrl") or item.get("thumbnailUrl") or
                                (item.get("image", {}).get("imageUrl") if isinstance(item.get("image"), dict) else None)),
                })
        if len(results) >= 6:
            break
    return results[:6]


def getTeluguMovieNews(movie_name: str) -> list:
    data = _search(f"{movie_name} Telugu movie news", num=8)
    items = _news_items(data) or _organic(data)
    return [{
        "title":   item.get("title", ""),
        "link":    item.get("link", ""),
        "source":  item.get("source") or item.get("displayLink", ""),
        "date":    item.get("date", ""),
        "snippet": item.get("snippet", ""),
        "image":   item.get("imageUrl") or item.get("thumbnailUrl"),
    } for item in items[:6]]
