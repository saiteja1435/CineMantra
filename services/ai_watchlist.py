import os
import re
import json
import time
import logging
from collections import Counter
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

_cache: dict = {}
_TTL_RECS  = 86400   # 24h for recommendations
_TTL_TASTE = 3600    # 1h for taste summary (re-analyse when watchlist changes)

_GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi",
    53: "Thriller", 10752: "War", 37: "Western",
}


# ── Gemini helper ─────────────────────────────────────────────

def _call_gemini(prompt: str, max_tokens: int = 1024) -> str | None:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        return None
    models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]
    for model in models:
        try:
            from google import genai
            from google.genai import types as genai_types
            client = genai.Client(api_key=api_key)
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=max_tokens,
                ),
            )
            raw = resp.text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
            return raw.strip()
        except Exception as e:
            err = str(e)
            if any(x in err for x in ("429", "RESOURCE_EXHAUSTED", "quota", "404", "NOT_FOUND")):
                continue
            logger.warning("[AIWatchlist] Gemini %s failed: %s", model, err[:150])
            return None
    return None


# ── TMDB helpers ──────────────────────────────────────────────

def _tmdb_get(endpoint: str, params: dict) -> dict:
    import requests as _req
    key = os.getenv("TMDB_API_KEY", "")
    if not key:
        return {}
    params["api_key"] = key
    try:
        r = _req.get(f"https://api.themoviedb.org/3{endpoint}", params=params, timeout=15)
        return r.json() if r.status_code == 200 else {}
    except Exception as e:
        logger.warning("[AIWatchlist] TMDB %s: %s", endpoint, e)
        return {}


def _enrich(m: dict) -> dict:
    p = m.get("poster_path")
    b = m.get("backdrop_path")
    m["poster_url"]   = f"/api/tmdb-img/w500{p}"    if p else None
    m["backdrop_url"] = f"/api/tmdb-img/original{b}" if b else None
    return m


def _discover(params: dict) -> list:
    base = {"language": "en-US", "page": 1, "include_adult": "false",
            "vote_count.gte": 30, "sort_by": "popularity.desc"}
    base.update(params)
    data = _tmdb_get("/discover/movie", base)
    return [_enrich(m) for m in data.get("results", [])]


def _movie_details(movie_id: int) -> dict:
    return _tmdb_get(f"/movie/{movie_id}", {"language": "en-US"})


# ── Taste analysis ────────────────────────────────────────────

_TASTE_PROMPT = """\
You are a movie taste analyst. Based on the user's watchlist data below, \
generate a concise taste profile.

Watchlist summary:
{watchlist_summary}

Return ONLY valid JSON:
{{
  "taste_summary": "<2-3 sentence description of the user's movie taste>",
  "favorite_genres": ["<genre1>", "<genre2>", "<genre3>"],
  "favorite_actors": ["<actor1>", "<actor2>"],
  "favorite_directors": ["<director1>", "<director2>"],
  "preferred_runtime": "<e.g. 90-120 minutes>",
  "preferred_years": "<e.g. 2015-2024>",
  "mood": "<e.g. Emotional Drama Lover | Action Enthusiast | Comedy Fan>"
}}
"""


def _build_watchlist_summary(items: list) -> str:
    """Build a text summary of the watchlist for Gemini."""
    if not items:
        return "Empty watchlist."
    lines = []
    for m in items[:30]:
        genres = m.get("genres", "")
        lang   = m.get("language", "")
        yr     = (m.get("release_date") or "")[:4]
        rating = m.get("user_rating") or m.get("rating") or 0
        fav    = "★ Favorite" if m.get("favorite") else ""
        watched = "✓ Watched" if m.get("watched") else ""
        lines.append(
            f"- {m['title']} ({yr}) | genres:{genres} | lang:{lang} "
            f"| rating:{rating} {fav} {watched}"
        )
    return "\n".join(lines)


def _fallback_taste(items: list) -> dict:
    """Rule-based taste profile when Gemini is unavailable."""
    genre_counts: Counter = Counter()
    years = []
    runtimes = []

    for m in items:
        for g in (m.get("genres") or "").split(","):
            g = g.strip()
            if g:
                genre_counts[g] += 1
        yr = (m.get("release_date") or "")[:4]
        if yr.isdigit():
            years.append(int(yr))
        rt = m.get("runtime") or 0
        if rt:
            runtimes.append(rt)

    top_genres = [g for g, _ in genre_counts.most_common(3)]
    yr_range   = f"{min(years)}–{max(years)}" if years else "Various"
    avg_rt     = int(sum(runtimes) / len(runtimes)) if runtimes else 0
    rt_str     = f"~{avg_rt} minutes" if avg_rt else "Varies"
    mood       = f"{top_genres[0]} Fan" if top_genres else "Eclectic Viewer"

    return {
        "taste_summary":      f"You enjoy {', '.join(top_genres) or 'various'} movies from {yr_range}.",
        "favorite_genres":    top_genres,
        "favorite_actors":    [],
        "favorite_directors": [],
        "preferred_runtime":  rt_str,
        "preferred_years":    yr_range,
        "mood":               mood,
    }


def analyzeTaste(items: list) -> dict:
    """Analyze watchlist and return taste profile. Caches for 1h."""
    cache_key = f"taste_v1:{len(items)}:{sum(m.get('movie_id',0) for m in items)}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL_TASTE:
            return data

    if not items:
        return _fallback_taste([])

    summary_text = _build_watchlist_summary(items)
    prompt = _TASTE_PROMPT.format(watchlist_summary=summary_text)
    raw = _call_gemini(prompt, max_tokens=512)

    result = None
    if raw:
        try:
            result = json.loads(raw)
        except Exception:
            pass

    if not result:
        result = _fallback_taste(items)

    _cache[cache_key] = (now, result)
    return result


# ── Personalized recommendations ─────────────────────────────

_REC_PROMPT = """\
You are a movie recommendation engine.

User taste profile:
{taste_profile}

Movies already in watchlist (do NOT recommend these):
{watchlist_ids}

Generate recommendations for these 5 categories. \
For each category return up to 5 TMDB movie IDs with a short reason.
Use ONLY real, well-known movies. Prefer Telugu/Indian cinema when relevant.

Return ONLY valid JSON:
{{
  "because_you_liked": [
    {{"movie_id": <int>, "title": "<str>", "reason": "<str>"}}
  ],
  "hidden_gems": [
    {{"movie_id": <int>, "title": "<str>", "reason": "<str>"}}
  ],
  "underrated_telugu": [
    {{"movie_id": <int>, "title": "<str>", "reason": "<str>"}}
  ],
  "trending_for_you": [
    {{"movie_id": <int>, "title": "<str>", "reason": "<str>"}}
  ],
  "weekend_picks": [
    {{"movie_id": <int>, "title": "<str>", "reason": "<str>"}}
  ]
}}
"""


def _fetch_tmdb_movies(movie_ids: list[int]) -> dict[int, dict]:
    """Batch-fetch TMDB details for a list of movie IDs."""
    from concurrent.futures import ThreadPoolExecutor, as_completed
    results = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_movie_details, mid): mid for mid in movie_ids if mid}
        for f in as_completed(futures):
            mid = futures[f]
            try:
                d = f.result()
                if d.get("id"):
                    results[mid] = _enrich(d)
            except Exception:
                pass
    return results


def _fallback_recs(taste: dict, watchlist_ids: set) -> dict:
    """TMDB-only recommendations when Gemini is unavailable."""
    genre_map_rev = {v.lower(): k for k, v in _GENRE_MAP.items()}
    genres = taste.get("favorite_genres") or []

    def _disc(genre_name, extra=None):
        params = {"sort_by": "popularity.desc", "vote_count.gte": 50}
        gid = genre_map_rev.get(genre_name.lower())
        if gid:
            params["with_genres"] = gid
        if extra:
            params.update(extra)
        movies = _discover(params)
        return [m for m in movies if m.get("id") not in watchlist_ids][:5]

    primary_genre = genres[0] if genres else "Drama"

    return {
        "because_you_liked": _disc(primary_genre),
        "hidden_gems":       _discover({"sort_by": "vote_average.desc",
                                        "vote_count.gte": 100,
                                        "vote_average.lte": 7.5})[:5],
        "underrated_telugu": _discover({"with_original_language": "te",
                                        "sort_by": "vote_average.desc",
                                        "vote_count.gte": 50})[:5],
        "trending_for_you":  _discover({"sort_by": "popularity.desc"})[:5],
        "weekend_picks":     _disc(genres[1] if len(genres) > 1 else "Comedy"),
    }


def getPersonalizedRecs(items: list, taste: dict) -> dict:
    """Generate personalized recommendations. Caches for 24h."""
    watchlist_ids = {m.get("movie_id") for m in items}
    cache_key = f"wlrecs_v1:{len(items)}:{hash(taste.get('mood',''))}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL_RECS:
            return data

    # Try Gemini
    taste_str     = json.dumps(taste, indent=2)
    wl_ids_str    = ", ".join(str(i) for i in list(watchlist_ids)[:30])
    prompt        = _REC_PROMPT.format(taste_profile=taste_str, watchlist_ids=wl_ids_str)
    raw           = _call_gemini(prompt, max_tokens=2048)

    gemini_result = None
    if raw:
        try:
            gemini_result = json.loads(raw)
        except Exception:
            pass

    if not gemini_result:
        result = _fallback_recs(taste, watchlist_ids)
        _cache[cache_key] = (now, result)
        return result

    # Enrich Gemini suggestions with TMDB poster/details
    all_ids = []
    for cat_items in gemini_result.values():
        if isinstance(cat_items, list):
            for entry in cat_items:
                mid = entry.get("movie_id")
                if mid and mid not in watchlist_ids:
                    all_ids.append(mid)

    tmdb_data = _fetch_tmdb_movies(all_ids)

    result = {}
    for cat, cat_items in gemini_result.items():
        enriched = []
        if not isinstance(cat_items, list):
            continue
        for entry in cat_items:
            mid = entry.get("movie_id")
            if not mid or mid in watchlist_ids:
                continue
            details = tmdb_data.get(mid, {})
            enriched.append({
                "movie_id":    mid,
                "title":       entry.get("title") or details.get("title", ""),
                "reason":      entry.get("reason", ""),
                "poster_url":  details.get("poster_url"),
                "backdrop_url":details.get("backdrop_url"),
                "vote_average":details.get("vote_average", 0),
                "release_date":details.get("release_date", ""),
                "genre_ids":   [g["id"] for g in details.get("genres", [])],
            })
        result[cat] = enriched[:5]

    _cache[cache_key] = (now, result)
    return result
