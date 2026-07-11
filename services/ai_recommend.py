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
_TTL = 86400  # 24 hours


# ── Helpers ───────────────────────────────────────────────────

def _serper_query(query: str, num: int = 8) -> list:
    import requests as _req
    key = os.getenv("SERPER_API_KEY", "")
    if not key:
        return []
    try:
        resp = _req.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": query, "num": num},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("organic", [])
    except Exception as e:
        logger.warning("[AIRecommend] Serper error: %s", e)
    return []


def _collect_context(movie_name: str, lang: str) -> str:
    """Fetch audience opinions + trending discussions via Serper."""
    lang_label = "Telugu" if lang == "te" else movie_name
    queries = [
        f"{movie_name} audience opinion review",
        f"{movie_name} {lang_label} movie similar recommendations",
        f"movies like {movie_name} {lang_label}",
    ]

    snippets = []
    seen: set = set()

    def _fetch(q):
        return _serper_query(q, num=8)

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = [ex.submit(_fetch, q) for q in queries]
        for f in as_completed(futures):
            try:
                for r in f.result():
                    s = r.get("snippet", "").strip()
                    if s and len(s) > 30:
                        key = s[:60].lower()
                        if key not in seen:
                            seen.add(key)
                            snippets.append(s)
            except Exception:
                pass

    return "\n".join(snippets[:20]) if snippets else ""


def _tmdb_keywords(movie_id: int) -> list[str]:
    """Fetch TMDB keywords for the movie."""
    import requests as _req
    key = os.getenv("TMDB_API_KEY", "")
    if not key:
        return []
    try:
        resp = _req.get(
            f"https://api.themoviedb.org/3/movie/{movie_id}/keywords",
            params={"api_key": key},
            timeout=15,
        )
        if resp.status_code == 200:
            return [k["name"] for k in resp.json().get("keywords", [])[:15]]
    except Exception as e:
        logger.warning("[AIRecommend] Keywords fetch failed: %s", e)
    return []


# ── Gemini call ───────────────────────────────────────────────

_PROMPT = """\
You are a movie recommendation expert specializing in Telugu and Indian cinema.

Movie: "{title}" ({year}, {language})
Genres: {genres}
Keywords: {keywords}
Director: {director}
Cast: {cast}
Runtime: {runtime} min
Rating: {rating}/10
Overview: {overview}

TMDB Similar/Recommended movies (use these as candidates):
{tmdb_candidates}

Audience context from web:
{web_context}

Task:
- Recommend up to 10 movies that a fan of "{title}" would enjoy.
- Prefer Telugu movies if the original is Telugu, but include other languages if highly relevant.
- Use TMDB candidates as your primary pool. You may suggest others only if strongly justified.
- Each recommendation must have a specific, honest reason tied to "{title}".
- match_score is 0-100 based on how well it matches the fan's taste.
- Sort by match_score descending.

Return ONLY valid JSON. No markdown. No explanation outside JSON.

{{
  "reason": "<1-2 sentence explanation of the overall recommendation strategy>",
  "recommendations": [
    {{
      "movie_id": <integer TMDB id or 0 if unknown>,
      "title": "<movie title>",
      "why": "<specific 2-3 sentence reason tied to {title}>",
      "match_score": <integer 0-100>
    }}
  ]
}}
"""


def _call_gemini(payload: dict) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("[AIRecommend] GEMINI_API_KEY not set")
        return None

    prompt = _PROMPT.format(**payload)

    models = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
    ]

    for model in models:
        try:
            from google import genai
            from google.genai import types as genai_types

            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=2048,
                ),
            )
            raw = response.text.strip()
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
            raw = raw.strip()

            data = json.loads(raw)
            if "recommendations" not in data:
                return None

            # Clamp scores, sort descending
            for r in data["recommendations"]:
                r["match_score"] = int(min(100, max(0, r.get("match_score", 70))))
            data["recommendations"].sort(key=lambda x: x["match_score"], reverse=True)
            data["recommendations"] = data["recommendations"][:10]

            logger.info("[AIRecommend] Gemini SUCCESS model=%s movie=%s", model, payload.get("title"))
            return data

        except Exception as e:
            err = str(e)
            if any(x in err for x in ("429", "RESOURCE_EXHAUSTED", "quota")):
                logger.warning("[AIRecommend] Model %s quota exhausted", model)
                continue
            if any(x in err for x in ("404", "NOT_FOUND")):
                logger.warning("[AIRecommend] Model %s not found", model)
                continue
            logger.warning("[AIRecommend] Model %s failed: %s", model, err[:200])
            return None

    logger.warning("[AIRecommend] All Gemini models exhausted")
    return None


# ── Public API ────────────────────────────────────────────────

def getAIRecommendations(movie_id: int, details: dict, credits: dict,
                          similar: list, tmdb_recs: list) -> dict | None:
    """
    Build AI recommendations for a movie.
    Returns {reason, recommendations} or None on failure.
    Falls back to TMDB data if Gemini fails.
    """
    title = details.get("title") or details.get("original_title") or "Unknown"
    cache_key = f"airec_v1:{movie_id}"
    now = time.time()

    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            logger.info("[AIRecommend] Cache HIT: %s", title)
            return data

    # ── Build payload ─────────────────────────────────────────
    genres   = ", ".join(g["name"] for g in details.get("genres", []))
    lang     = details.get("original_language", "")
    year     = (details.get("release_date") or "")[:4]
    rating   = details.get("vote_average", 0)
    overview = (details.get("overview") or "")[:400]
    runtime  = details.get("runtime") or 0

    crew     = credits.get("crew", [])
    cast     = credits.get("cast", [])
    director = next((p["name"] for p in crew if p.get("job") == "Director"), "Unknown")
    cast_str = ", ".join(p["name"] for p in cast[:5]) if cast else "Unknown"

    # Fetch keywords in parallel with Serper context
    with ThreadPoolExecutor(max_workers=2) as ex:
        kw_future  = ex.submit(_tmdb_keywords, movie_id)
        ctx_future = ex.submit(_collect_context, title, lang)
        keywords   = kw_future.result()
        web_context = ctx_future.result()

    keywords_str = ", ".join(keywords) if keywords else "N/A"

    # Build TMDB candidates list
    candidates = []
    seen_ids: set = set()
    for m in (similar or []) + (tmdb_recs or []):
        mid = m.get("id")
        if mid and mid not in seen_ids:
            seen_ids.add(mid)
            candidates.append(f"- [{mid}] {m.get('title','?')} ({(m.get('release_date') or '')[:4]}) rating={m.get('vote_average',0):.1f}")
    tmdb_candidates = "\n".join(candidates[:30]) if candidates else "None available"

    payload = dict(
        title=title, year=year, language=lang,
        genres=genres or "N/A", keywords=keywords_str,
        director=director, cast=cast_str,
        runtime=runtime, rating=rating,
        overview=overview,
        tmdb_candidates=tmdb_candidates,
        web_context=web_context or "No web context available.",
    )

    # ── Try Gemini ────────────────────────────────────────────
    result = _call_gemini(payload)

    # ── Fallback: return TMDB candidates as-is ────────────────
    if not result:
        logger.info("[AIRecommend] Gemini failed — using TMDB fallback for: %s", title)
        fallback_recs = []
        for m in (similar or []) + (tmdb_recs or []):
            mid = m.get("id")
            if not mid or mid in {r.get("movie_id") for r in fallback_recs}:
                continue
            fallback_recs.append({
                "movie_id":    mid,
                "title":       m.get("title", "?"),
                "why":         f"Similar to {title} based on genre and audience profile.",
                "match_score": min(95, int((m.get("vote_average", 5) / 10) * 100)),
                "poster_url":  m.get("poster_url"),
            })
            if len(fallback_recs) == 10:
                break
        if not fallback_recs:
            return None
        result = {
            "reason": f"Recommendations based on TMDB data for {title}.",
            "recommendations": fallback_recs,
            "source": "tmdb_fallback",
        }
    else:
        result["source"] = "gemini"

    # ── Enrich recommendations with poster URLs from TMDB data ──
    all_tmdb = {m["id"]: m for m in (similar or []) + (tmdb_recs or []) if m.get("id")}
    for rec in result["recommendations"]:
        mid = rec.get("movie_id")
        if mid and mid in all_tmdb:
            rec["poster_url"]   = all_tmdb[mid].get("poster_url")
            rec["backdrop_url"] = all_tmdb[mid].get("backdrop_url")

    _cache[cache_key] = (now, result)
    return result
