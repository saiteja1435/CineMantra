import os
import re
import json
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

_cache: dict = {}
_TTL = 1800  # 30 minutes


# ── TMDB genre map ────────────────────────────────────────────

_GENRE_MAP = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "sci-fi": 878, "science fiction": 878,
    "thriller": 53, "war": 10752, "western": 37,
}

_LANG_MAP = {
    "telugu": "te", "hindi": "hi", "tamil": "ta", "malayalam": "ml",
    "kannada": "kn", "english": "en", "korean": "ko", "japanese": "ja",
    "french": "fr", "spanish": "es",
}

_OTT_PROVIDER_IDS = {
    "netflix": 8, "amazon": 119, "prime": 119, "prime video": 119,
    "hotstar": 122, "disney": 337, "disney+": 337, "disney+ hotstar": 122,
    "zee5": 232, "sonyliv": 237, "apple tv": 2, "apple tv+": 2,
    "jiocinema": 220, "mubi": 11,
}


# ── Gemini: extract structured filters ───────────────────────

_FILTER_PROMPT = """\
You are a movie search assistant. Extract structured search filters from the user query.

Query: "{query}"

Return ONLY valid JSON with these exact keys (use null for unknown/unspecified):
{{
  "intent": "<short description of what user wants>",
  "language": "<language name or null>",
  "genre": "<single genre or null>",
  "year_min": <integer or null>,
  "year_max": <integer or null>,
  "actor": "<actor name or null>",
  "director": "<director name or null>",
  "ott": "<platform name or null>",
  "sort": "<one of: rating | popularity | release_date | null>",
  "runtime_max": <max runtime in minutes or null>,
  "rating_min": <minimum rating 1-10 or null>,
  "keywords": "<comma-separated keywords or null>",
  "similar_to": "<movie title to find similar movies or null>",
  "free_text": "<remaining search terms not captured above or null>"
}}

Rules:
- "Best" or "Top" → sort by rating
- "Latest" or "Recent" or "New" → sort by release_date
- "Popular" or "Trending" → sort by popularity
- "After YYYY" → year_min = YYYY+1
- "Before YYYY" → year_max = YYYY-1
- "Under X hours" or "Under X minutes" → runtime_max
- Telugu/Hindi/Tamil etc → language
- OTT platform names → ott field
- Actor/Director names → actor/director fields
- "Similar to X" or "Like X" → similar_to field
- Return ONLY JSON, no markdown, no explanation
"""


def _extract_filters_gemini(query: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None

    models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
    prompt = _FILTER_PROMPT.format(query=query)

    for model in models:
        try:
            from google import genai
            from google.genai import types as genai_types

            client = genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=512,
                ),
            )
            raw = resp.text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
            data = json.loads(raw.strip())
            logger.info("[AISearch] Gemini filters extracted: %s", data)
            return data
        except Exception as e:
            err = str(e)
            if any(x in err for x in ("429", "RESOURCE_EXHAUSTED", "quota")):
                continue
            if any(x in err for x in ("404", "NOT_FOUND")):
                continue
            logger.warning("[AISearch] Gemini filter extraction failed: %s", err[:200])
            return None

    return None


def _extract_filters_fallback(query: str) -> dict:
    """Rule-based fallback when Gemini is unavailable."""
    q = query.lower()
    filters: dict = {
        "intent": f"Search: {query}",
        "language": None, "genre": None,
        "year_min": None, "year_max": None,
        "actor": None, "director": None,
        "ott": None, "sort": None,
        "runtime_max": None, "rating_min": None,
        "keywords": None, "similar_to": None,
        "free_text": query,
    }

    for name, code in _LANG_MAP.items():
        if name in q:
            filters["language"] = name.capitalize()
            break

    for genre in _GENRE_MAP:
        if genre in q:
            filters["genre"] = genre.capitalize()
            break

    for ott in _OTT_PROVIDER_IDS:
        if ott in q:
            filters["ott"] = ott.capitalize()
            break

    if any(w in q for w in ("best", "top", "highest rated")):
        filters["sort"] = "rating"
    elif any(w in q for w in ("latest", "recent", "new", "newest")):
        filters["sort"] = "release_date"
    elif any(w in q for w in ("popular", "trending")):
        filters["sort"] = "popularity"

    m = re.search(r"after\s+(\d{4})", q)
    if m:
        filters["year_min"] = int(m.group(1)) + 1

    m = re.search(r"before\s+(\d{4})", q)
    if m:
        filters["year_max"] = int(m.group(1)) - 1

    m = re.search(r"under\s+(\d+)\s*hour", q)
    if m:
        filters["runtime_max"] = int(m.group(1)) * 60

    m = re.search(r"under\s+(\d+)\s*min", q)
    if m:
        filters["runtime_max"] = int(m.group(1))

    m = re.search(r"similar\s+to\s+(.+?)(?:\s+movie|$)", q)
    if m:
        filters["similar_to"] = m.group(1).strip().title()

    return filters


# ── TMDB helpers ──────────────────────────────────────────────

def _tmdb_get(endpoint: str, params: dict) -> dict:
    import requests as _req
    key = os.getenv("TMDB_API_KEY", "")
    if not key:
        return {}
    params["api_key"] = key
    try:
        resp = _req.get(
            f"https://api.themoviedb.org/3{endpoint}",
            params=params,
            timeout=15,
        )
        return resp.json() if resp.status_code == 200 else {}
    except Exception as e:
        logger.warning("[AISearch] TMDB error %s: %s", endpoint, e)
        return {}


def _enrich_movie(m: dict) -> dict:
    p = m.get("poster_path")
    b = m.get("backdrop_path")
    m["poster_url"]   = f"/api/tmdb-img/w500{p}"   if p else None
    m["backdrop_url"] = f"/api/tmdb-img/original{b}" if b else None
    return m


def _person_id(name: str, role: str = "acting") -> int | None:
    """Resolve actor/director name to TMDB person ID."""
    data = _tmdb_get("/search/person", {"query": name, "language": "en-US"})
    results = data.get("results", [])
    if not results:
        return None
    # Prefer exact match
    for r in results[:3]:
        if r.get("name", "").lower() == name.lower():
            return r["id"]
    return results[0]["id"]


def _similar_movie_id(title: str) -> int | None:
    data = _tmdb_get("/search/movie", {"query": title, "language": "en-US"})
    results = data.get("results", [])
    return results[0]["id"] if results else None


_TE = "te"


def _te_only(items: list) -> list:
    """Hard filter: keep only original_language == 'te'."""
    logger.info("[AISearch] Applying Telugu language filter")
    filtered = [m for m in items if m.get("original_language") == _TE]
    logger.info("[AISearch] Filtered Telugu results count: %d", len(filtered))
    return filtered


def _discover(filters: dict) -> list:
    """Build TMDB Discover query from extracted filters — always Telugu."""
    params: dict = {"language": "en-US", "page": 1, "include_adult": "false",
                    "with_original_language": _TE}

    # Language override ignored — always Telugu
    lang_name = (filters.get("language") or "").lower()
    if lang_name and lang_name in _LANG_MAP:
        pass  # already forced to 'te'

    # Genre
    genre_name = (filters.get("genre") or "").lower()
    if genre_name and genre_name in _GENRE_MAP:
        params["with_genres"] = _GENRE_MAP[genre_name]

    # Year
    if filters.get("year_min"):
        params["primary_release_date.gte"] = f"{filters['year_min']}-01-01"
    if filters.get("year_max"):
        params["primary_release_date.lte"] = f"{filters['year_max']}-12-31"

    # Runtime
    if filters.get("runtime_max"):
        params["with_runtime.lte"] = filters["runtime_max"]

    # Rating
    if filters.get("rating_min"):
        params["vote_average.gte"] = filters["rating_min"]
        params["vote_count.gte"]   = 50

    # OTT provider
    ott_name = (filters.get("ott") or "").lower()
    if ott_name:
        for key, pid in _OTT_PROVIDER_IDS.items():
            if key in ott_name:
                params["with_watch_providers"] = pid
                params["watch_region"]         = "IN"
                break

    # Sort
    sort_val = filters.get("sort")
    sort_map = {
        "rating":       "vote_average.desc",
        "popularity":   "popularity.desc",
        "release_date": "primary_release_date.desc",
    }
    params["sort_by"] = sort_map.get(sort_val or "", "popularity.desc")

    # Minimum vote count for quality results
    if "vote_count.gte" not in params:
        params["vote_count.gte"] = 20

    data = _tmdb_get("/discover/movie", params)
    return [_enrich_movie(m) for m in data.get("results", [])]


def _search_by_person(filters: dict) -> list:
    """Search movies by actor or director."""
    results = []
    seen: set = set()

    actor_name    = filters.get("actor")
    director_name = filters.get("director")

    def _fetch_person_movies(name, role):
        pid = _person_id(name, role)
        if not pid:
            return []
        key = "with_cast" if role == "acting" else "with_crew"
        data = _tmdb_get("/discover/movie", {
            key: pid,
            "with_original_language": _TE,
            "sort_by": "popularity.desc",
            "language": "en-US",
            "page": 1,
        })
        return _te_only([_enrich_movie(m) for m in data.get("results", [])])

    with ThreadPoolExecutor(max_workers=2) as ex:
        futures = []
        if actor_name:
            futures.append(ex.submit(_fetch_person_movies, actor_name, "acting"))
        if director_name:
            futures.append(ex.submit(_fetch_person_movies, director_name, "directing"))
        for f in as_completed(futures):
            try:
                for m in f.result():
                    if m.get("id") and m["id"] not in seen:
                        seen.add(m["id"])
                        results.append(m)
            except Exception:
                pass

    return results


def _search_similar(title: str) -> list:
    mid = _similar_movie_id(title)
    if not mid:
        return []
    data = _tmdb_get(f"/movie/{mid}/recommendations", {"language": "en-US", "page": 1})
    results = _te_only([_enrich_movie(m) for m in data.get("results", [])])
    if not results:
        data = _tmdb_get(f"/movie/{mid}/similar", {"language": "en-US", "page": 1})
        results = _te_only([_enrich_movie(m) for m in data.get("results", [])])
    return results


def _tmdb_text_search(query: str) -> list:
    data = _tmdb_get("/search/movie", {"query": query, "language": "en-US", "page": 1})
    return _te_only([_enrich_movie(m) for m in data.get("results", [])])


# ── Serper: OTT / news enrichment ────────────────────────────

def _serper_ott_info(movie_title: str, ott: str) -> str | None:
    import requests as _req
    key = os.getenv("SERPER_API_KEY", "")
    if not key:
        return None
    try:
        resp = _req.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": f"{movie_title} {ott} streaming", "num": 3},
            timeout=8,
        )
        if resp.status_code == 200:
            items = resp.json().get("organic", [])
            if items:
                return items[0].get("snippet", "")
    except Exception:
        pass
    return None


# ── AI reason generator ───────────────────────────────────────

def _build_reason(movie: dict, filters: dict) -> str:
    parts = []
    lang = (filters.get("language") or "").capitalize()
    genre = (filters.get("genre") or "").capitalize()
    sort = filters.get("sort")
    actor = filters.get("actor")
    director = filters.get("director")
    ott = filters.get("ott")
    similar = filters.get("similar_to")

    rating = movie.get("vote_average", 0)
    year   = (movie.get("release_date") or "")[:4]

    if similar:
        parts.append(f"Recommended because it's similar to {similar}")
    elif actor:
        parts.append(f"Features {actor}")
    elif director:
        parts.append(f"Directed by {director}")
    else:
        if lang:
            parts.append(f"{lang} film")
        if genre:
            parts.append(f"{genre} genre")

    if sort == "rating" and rating:
        parts.append(f"rated {rating:.1f}/10")
    if year:
        parts.append(f"released {year}")
    if ott:
        parts.append(f"available on {ott}")

    return " • ".join(parts) if parts else "Matches your search"


# ── Public API ────────────────────────────────────────────────

def aiSearch(query: str) -> dict:
    """
    1. Check cache.
    2. Extract filters via Gemini (fallback: rule-based).
    3. Fetch movies from TMDB.
    4. Enrich with Serper if OTT requested.
    5. Return {intent, filters, results}.
    """
    cache_key = f"aisearch_v1:{query.lower().strip()}"
    now = time.time()

    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            logger.info("[AISearch] Cache HIT: %s", query)
            return data

    # Step 1: Extract filters
    filters = _extract_filters_gemini(query)
    if not filters:
        logger.info("[AISearch] Gemini unavailable — using fallback filters")
        filters = _extract_filters_fallback(query)

    intent = filters.get("intent") or f"Search: {query}"

    # Step 2: Fetch movies — strategy depends on filters
    movies: list = []
    seen_ids: set = set()

    def _add(new_movies):
        for m in new_movies:
            if m.get("id") and m["id"] not in seen_ids:
                seen_ids.add(m["id"])
                movies.append(m)

    similar_to = filters.get("similar_to")
    actor      = filters.get("actor")
    director   = filters.get("director")
    free_text  = filters.get("free_text")

    has_structured = any([
        filters.get("language"), filters.get("genre"),
        filters.get("year_min"), filters.get("year_max"),
        filters.get("ott"), filters.get("sort"),
        filters.get("runtime_max"), filters.get("rating_min"),
    ])

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = []

        if similar_to:
            futures.append(ex.submit(_search_similar, similar_to))

        if actor or director:
            futures.append(ex.submit(_search_by_person, filters))

        if has_structured:
            futures.append(ex.submit(_discover, filters))

        # Always include a text search as fallback/supplement
        search_q = similar_to or free_text or query
        futures.append(ex.submit(_tmdb_text_search, search_q))

        for f in as_completed(futures):
            try:
                _add(f.result())
            except Exception:
                pass

    # If still empty, plain text search
    if not movies:
        _add(_tmdb_text_search(query))

    # Final Telugu-only guard
    movies = _te_only(movies)

    # Step 3: Serper OTT enrichment (non-blocking, best-effort)
    ott = filters.get("ott")
    if ott and movies:
        try:
            snippet = _serper_ott_info(movies[0].get("title", query), ott)
            if snippet:
                filters["_ott_snippet"] = snippet
        except Exception:
            pass

    # Step 4: Attach AI reason + sort
    for m in movies:
        m["ai_reason"] = _build_reason(m, filters)

    # Sort: rating-first if requested, else by popularity
    sort_pref = filters.get("sort")
    if sort_pref == "rating":
        movies.sort(key=lambda m: m.get("vote_average", 0), reverse=True)
    elif sort_pref == "release_date":
        movies.sort(key=lambda m: m.get("release_date") or "", reverse=True)
    else:
        movies.sort(key=lambda m: m.get("popularity", 0), reverse=True)

    movies = movies[:40]

    result = {"intent": intent, "filters": filters, "results": movies}
    _cache[cache_key] = (now, result)
    return result
