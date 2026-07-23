"""
Smart Search — query understanding layer on top of TMDB.
No external AI dependency. Pure rule-based NLP + TMDB APIs.
"""

import re
import time
from services.tmdb import _fetch, _enrich, _list

# ── Genre map ────────────────────────────────────────────────
_GENRE_MAP = {
    "action":      28,
    "adventure":   12,
    "animation":   16,
    "comedy":      35,
    "crime":       80,
    "documentary": 99,
    "drama":       18,
    "family":      10751,
    "fantasy":     14,
    "history":     36,
    "historical":  36,
    "horror":      27,
    "music":       10402,
    "mystery":     9648,
    "romance":     10749,
    "romantic":    10749,
    "scifi":       878,
    "sci-fi":      878,
    "thriller":    53,
    "war":         10752,
    "western":     37,
    # Tenglish / Telugu slang
    "comedy":      35,
    "action":      28,
    "love":        10749,
    "family":      10751,
    "horror":      27,
}

# ── Language map ─────────────────────────────────────────────
_LANG_MAP = {
    "telugu":     "te",
    "hindi":      "hi",
    "tamil":      "ta",
    "malayalam":  "ml",
    "kannada":    "kn",
    "english":    "en",
    "bengali":    "bn",
    "marathi":    "mr",
    # Tenglish
    "tollywood":  "te",
    "kollywood":  "ta",
    "bollywood":  "hi",
    "cinemalu":   "te",
    "cinema":     "te",   # "telugu cinema" context handled by co-occurrence
}

# ── Sort keywords ────────────────────────────────────────────
_SORT_KEYWORDS = {
    "top rated":    "vote_average.desc",
    "best":         "vote_average.desc",
    "highest rated":"vote_average.desc",
    "popular":      "popularity.desc",
    "trending":     "popularity.desc",
    "latest":       "primary_release_date.desc",
    "new":          "primary_release_date.desc",
    "newest":       "primary_release_date.desc",
    "recent":       "primary_release_date.desc",
    "upcoming":     "primary_release_date.desc",
    "oldest":       "primary_release_date.asc",
    "classic":      "vote_average.desc",
    "classics":     "vote_average.desc",
}

# ── Noise words to strip before keyword search ───────────────
_NOISE = {
    "movies", "movie", "films", "film", "cinema", "cinemalu",
    "watch", "show", "shows", "series", "web", "ott",
    "best", "top", "good", "great", "nice", "manchi",
    "all", "list", "give", "suggest", "recommend",
    "telugu", "hindi", "tamil", "english", "kannada", "malayalam",
    "in", "of", "the", "a", "an", "and", "or", "with",
    "starring", "featuring", "directed", "by", "from",
    "after", "before", "around", "about",
}

# ── Simple fuzzy: normalise string ──────────────────────────
def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", s.lower().strip())

# ── Year extractor ───────────────────────────────────────────
_YEAR_RE = re.compile(r"\b(19[5-9]\d|20[0-2]\d)\b")

# ── Cache (10 min) ───────────────────────────────────────────
_cache: dict = {}
_TTL = 600

def _cache_get(key):
    e = _cache.get(key)
    if not e: return None
    if time.time() - e[0] > _TTL:
        del _cache[key]
        return None
    return e[1]

def _cache_set(key, val):
    _cache[key] = (time.time(), val)


# ── Intent parser ────────────────────────────────────────────

def parse_intent(raw: str) -> dict:
    """
    Returns:
      intent   : "person" | "discover" | "search"
      person   : str | None
      language : str | None   (ISO code)
      genre_id : int | None
      year     : str | None
      sort_by  : str
      keywords : str          (cleaned query for /search/movie fallback)
    """
    q = _norm(raw)

    intent = {
        "intent":   "search",
        "person":   None,
        "language": None,
        "genre_id": None,
        "year":     None,
        "sort_by":  "popularity.desc",
        "keywords": raw.strip(),
    }

    # ── Year ────────────────────────────────────────────────
    m = _YEAR_RE.search(q)
    if m:
        intent["year"] = m.group(1)
        q = q.replace(m.group(1), "").strip()

    # ── Language ────────────────────────────────────────────
    for word, code in _LANG_MAP.items():
        if word in q:
            intent["language"] = code
            q = q.replace(word, "").strip()
            break

    # ── Genre ────────────────────────────────────────────────
    for word, gid in _GENRE_MAP.items():
        if word in q:
            intent["genre_id"] = gid
            q = q.replace(word, "").strip()
            break

    # ── Sort ─────────────────────────────────────────────────
    for phrase, sort in _SORT_KEYWORDS.items():
        if phrase in q:
            intent["sort_by"] = sort
            break

    # ── Person detection ─────────────────────────────────────
    # Patterns: "<name> movies", "<name> films", "movies of <name>", "films by <name>"
    person_patterns = [
        r"^(.+?)\s+(?:movies?|films?|cinemalu|pictures?)$",
        r"^(?:movies?|films?)\s+(?:of|by|starring|featuring)\s+(.+)$",
        r"^(.+?)\s+(?:acted|starred|directed)\b",
    ]

    # Words that look like person names but are not
    _NOT_PERSON = _NOISE | set(_GENRE_MAP.keys()) | set(_LANG_MAP.keys()) | {
        "best", "top", "good", "great", "latest", "new", "old",
        "popular", "trending", "classic", "recent", "upcoming",
        "top rated", "highest rated", "most popular", "top rated",
    }

    for pat in person_patterns:
        pm = re.match(pat, q)
        if pm:
            candidate = pm.group(1).strip()
            # Must be 2+ words OR a single word not in noise/genre/sort sets
            words = candidate.split()
            # Reject if candidate is a known sort/quality phrase
            is_sort_phrase = candidate in _NOT_PERSON or any(
                w in {"top", "best", "good", "great", "latest", "new",
                      "popular", "trending", "classic", "recent", "upcoming",
                      "highest", "most", "rated", "old", "oldest"}
                for w in words
            )
            is_likely_name = (
                not is_sort_phrase and (
                    len(words) >= 2 or
                    (len(words) == 1 and candidate not in _NOT_PERSON and len(candidate) >= 3)
                )
            )
            if is_likely_name:
                intent["intent"]  = "person"
                intent["person"]  = candidate
                intent["keywords"] = candidate
                return intent

    # ── Decide: discover vs search ───────────────────────────
    if intent["language"] or intent["genre_id"] or intent["year"]:
        intent["intent"] = "discover"
        # Clean keywords for fallback
        kw = re.sub(r"\b(" + "|".join(_NOISE) + r")\b", "", _norm(raw)).strip()
        kw = re.sub(r"\s+", " ", kw).strip()
        intent["keywords"] = kw or raw.strip()
    else:
        # Pure keyword search — strip noise
        kw = re.sub(r"\b(" + "|".join(_NOISE) + r")\b", "", _norm(raw)).strip()
        kw = re.sub(r"\s+", " ", kw).strip()
        intent["keywords"] = kw or raw.strip()

    return intent


# ── Language filter ──────────────────────────────────────────
_TE = "te"

def _lang_filter(items: list, lang: str | None) -> list:
    """Filter by language. If lang is None, defaults to Telugu."""
    target = lang or _TE
    print(f"[SmartSearch] Search language filter: {target}", flush=True)
    print(f"[SmartSearch] Before filter count: {len(items)}", flush=True)
    filtered = [m for m in items if m.get("original_language") == target]
    print(f"[SmartSearch] After {target} filter count: {len(filtered)}", flush=True)
    return filtered

def _te_only(items: list) -> list:
    return _lang_filter(items, _TE)


# ── TMDB helpers ─────────────────────────────────────────────

def _search_person_id(name: str) -> int | None:
    try:
        data = _fetch("/search/person", {"query": name, "language": "en-US", "page": 1})
        results = data.get("results", [])
        if results:
            return results[0]["id"]
    except Exception as e:
        print(f"[SmartSearch] person search failed: {e}", flush=True)
    return None


def _person_movies(person_id: int, lang: str | None = None) -> list:
    """Fetch person movie credits, filtered by language (default Telugu)."""
    try:
        data = _fetch(f"/person/{person_id}/movie_credits")
        cast = data.get("cast", [])
        seen = set()
        out  = []
        for m in sorted(cast, key=lambda x: x.get("popularity", 0), reverse=True):
            if m["id"] not in seen:
                seen.add(m["id"])
                out.append(_enrich(m))
        return _lang_filter(out, lang)
    except Exception as e:
        print(f"[SmartSearch] person credits failed: {e}", flush=True)
        return []


def _discover(intent: dict) -> list:
    """Discover movies by language/genre/year."""
    lang = intent.get("language") or _TE
    params = {
        "sort_by":                intent["sort_by"],
        "include_adult":          "false",
        "with_original_language": lang,
    }
    if intent["genre_id"]:
        params["with_genres"] = str(intent["genre_id"])
    if intent["year"]:
        params["primary_release_year"] = intent["year"]
    try:
        results = []
        for page in range(1, 3):
            params["page"] = page
            data = _fetch("/discover/movie", params)
            results.extend([_enrich(m) for m in data.get("results", [])])
        return _lang_filter(results, lang)[:20]
    except Exception as e:
        print(f"[SmartSearch] discover failed: {e}", flush=True)
        return []


def _keyword_search(query: str, lang: str | None = None) -> list:
    """
    Search movies by keyword, filtered by language (default Telugu).
    """
    target = lang or _TE
    # Step 1: /search/movie filtered by language
    try:
        params = {"query": query, "language": "en-US", "include_adult": "false", "page": 1}
        raw = [_enrich(m) for m in _fetch("/search/movie", params).get("results", [])]
        filtered = _lang_filter(raw, target)
        if filtered:
            return filtered
    except Exception as e:
        print(f"[SmartSearch] keyword search failed: {e}", flush=True)

    # Step 2: fallback — discover by language popular
    try:
        data = _fetch("/discover/movie", {
            "with_original_language": target,
            "sort_by":                "popularity.desc",
            "include_adult":          "false",
            "page":                   1,
        })
        return _lang_filter([_enrich(m) for m in data.get("results", [])], target)
    except Exception as e:
        print(f"[SmartSearch] discover fallback failed: {e}", flush=True)
        return []

# Keep old name as alias for backward compat
_keyword_search_telugu = _keyword_search


# ── Public entry point ───────────────────────────────────────

def smartSearch(raw_query: str) -> dict:
    """
    Returns { intent, results, query }
    """
    raw_query = raw_query.strip()
    cache_key = f"smart:{raw_query.lower()}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    print(f"[SmartSearch] Smart search query: {raw_query!r}", flush=True)

    intent = parse_intent(raw_query)
    print(f"[SmartSearch] Detected intent: {intent}", flush=True)

    results = []

    lang = intent.get("language")  # None means Telugu (default)

    if intent["intent"] == "person":
        person_id = _search_person_id(intent["person"])
        print(f"[SmartSearch] TMDB request: /search/person -> id={person_id}", flush=True)
        if person_id:
            results = _person_movies(person_id, lang)
        # Fallback: keyword search with person name
        if not results:
            results = _keyword_search(intent["person"], lang)

    elif intent["intent"] == "discover":
        print(f"[SmartSearch] TMDB request: /discover/movie params lang={intent['language']} genre={intent['genre_id']} year={intent['year']}", flush=True)
        results = _discover(intent)
        if not results and intent["keywords"]:
            results = _keyword_search(intent["keywords"], lang)

    else:  # plain search
        kw = intent["keywords"]
        print(f"[SmartSearch] TMDB request: /search/movie query={kw!r}", flush=True)
        results = _keyword_search(kw, lang)
        if not results and kw != raw_query:
            results = _keyword_search(raw_query, lang)

    print(f"[SmartSearch] Smart results count: {len(results)}", flush=True)

    out = {
        "intent":  intent["intent"],
        "results": results,
        "query":   raw_query,
    }
    _cache_set(cache_key, out)
    return out
