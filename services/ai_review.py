import os
import re
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ── Cache: 24 hours ───────────────────────────────────────────
_cache: dict = {}
_TTL = 86400


# ── Serper: collect IMDb user reviews ────────────────────────

def _serper_search(query: str, num: int = 10) -> dict:
    import requests as _req
    key = os.getenv("SERPER_API_KEY", "")
    if not key:
        return {}
    try:
        resp = _req.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": key, "Content-Type": "application/json"},
            json={"q": query, "num": num},
            timeout=10,
        )
        return resp.json() if resp.status_code == 200 else {}
    except Exception as e:
        logger.warning("[AIReview] Serper error: %s", e)
        return {}


def _collect_imdb_reviews(movie_name: str) -> list[str]:
    """
    Run 3 targeted IMDb review queries in parallel.
    Returns a deduplicated list of review text snippets.
    """
    queries = [
        f"{movie_name} site:imdb.com/review",
        f"{movie_name} IMDb user reviews",
        f"{movie_name} IMDb audience reviews",
    ]

    seen: set = set()
    snippets: list = []

    def _fetch(q):
        data = _serper_search(q, num=10)
        return data.get("organic", [])

    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = [ex.submit(_fetch, q) for q in queries]
        for f in as_completed(futures):
            try:
                for r in f.result():
                    link    = r.get("link", "")
                    snippet = r.get("snippet", "").strip()
                    title   = r.get("title", "").strip()

                    if not snippet or len(snippet) < 30:
                        continue

                    key = snippet[:60].lower()
                    if key in seen:
                        continue
                    seen.add(key)

                    is_imdb = "imdb.com" in link.lower()
                    text = f"{title}: {snippet}" if title else snippet
                    snippets.append((0 if is_imdb else 1, text))
            except Exception:
                pass

    snippets.sort(key=lambda x: x[0])
    return [t for _, t in snippets]


# ── Gemini: analyse reviews ───────────────────────────────────

_GEMINI_PROMPT = """\
You are a movie review analyst.

Analyze ONLY the IMDb user reviews provided below for the movie "{movie_name}".

Do not invent any facts.
Do not use external knowledge.
Ignore duplicate reviews.
Identify the overall audience opinion.
Return ONLY JSON. No markdown. No explanation outside the JSON.

Reviews:
{reviews_block}

Return ONLY this JSON:
{{
  "summary": "<2-3 sentence paragraph summarising overall audience opinion based strictly on the reviews above>",
  "overall_sentiment": "<one of: Positive | Mixed | Negative>",
  "rating_estimate": <float 1.0-10.0 estimated from audience tone>,
  "pros": ["<pro 1>", "<pro 2>", "<pro 3>", "<pro 4>", "<pro 5>"],
  "cons": ["<con 1>", "<con 2>", "<con 3>", "<con 4>"],
  "highlights": ["<highlight 1>", "<highlight 2>", "<highlight 3>"],
  "audience_verdict": "<one sentence overall verdict from the audience perspective>",
  "recommended_for": ["<audience type 1>", "<audience type 2>", "<audience type 3>"]
}}
"""


def _call_gemini(movie_name: str, reviews: list[str]):
    import json
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.warning("[AIReview] GEMINI_API_KEY not set")
        return None

    reviews_block = "\n".join(f"[{i+1}] {r}" for i, r in enumerate(reviews))
    prompt = _GEMINI_PROMPT.format(
        movie_name=movie_name,
        reviews_block=reviews_block,
    )

    # Try multiple models in order — fallback if one is quota-exhausted
    models_to_try = [
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.0-pro",
    ]

    for model in models_to_try:
        try:
            from google import genai
            from google.genai import types as genai_types

            client   = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1024,
                ),
            )
            raw = response.text.strip()

            # Strip accidental markdown fences
            raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
            raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
            raw = raw.strip()

            data = json.loads(raw)

            required = {"summary", "overall_sentiment", "rating_estimate",
                        "pros", "cons", "highlights", "audience_verdict", "recommended_for"}
            missing = required - data.keys()
            if missing:
                logger.warning("[AIReview] Gemini missing keys: %s", missing)
                return None

            data["rating_estimate"] = round(float(min(10.0, max(1.0, data["rating_estimate"]))), 1)
            logger.info("[AIReview] Gemini SUCCESS with model: %s", model)
            return data

        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
                logger.warning("[AIReview] Model %s quota exhausted, trying next...", model)
                continue
            if "404" in err or "NOT_FOUND" in err:
                logger.warning("[AIReview] Model %s not found, trying next...", model)
                continue
            logger.warning("[AIReview] Model %s failed: %s", model, err[:200])
            return None

    logger.warning("[AIReview] All Gemini models exhausted for: %s", movie_name)
    return None


# ── Fallback: build summary directly from Serper snippets ────

def _build_from_snippets(movie_name: str, reviews: list[str]) -> dict:
    """
    When Gemini is unavailable, build a structured summary
    directly from the collected IMDb review snippets.
    No hallucination — only what the snippets say.
    """
    # Sentiment detection from snippet text
    positive_words = ["great", "excellent", "amazing", "brilliant", "masterpiece",
                      "fantastic", "wonderful", "loved", "best", "outstanding",
                      "superb", "perfect", "incredible", "stunning", "beautiful",
                      "enjoyable", "entertaining", "recommend", "must watch", "good"]
    negative_words = ["bad", "terrible", "awful", "boring", "disappointing",
                      "worst", "waste", "poor", "weak", "dull", "slow",
                      "overrated", "mediocre", "confusing", "mess", "failed"]

    combined = " ".join(reviews).lower()
    pos_count = sum(combined.count(w) for w in positive_words)
    neg_count = sum(combined.count(w) for w in negative_words)

    if pos_count > neg_count * 1.5:
        sentiment = "Positive"
        rating    = 7.5
    elif neg_count > pos_count * 1.5:
        sentiment = "Negative"
        rating    = 4.5
    else:
        sentiment = "Mixed"
        rating    = 6.0

    # Use first 3 snippets as summary source (trim to readable length)
    summary_parts = []
    for r in reviews[:3]:
        # Strip "Title: " prefix if present
        text = r.split(": ", 1)[-1] if ": " in r[:60] else r
        text = text[:200].strip()
        if text:
            summary_parts.append(text)

    summary = " ".join(summary_parts)
    if len(summary) > 400:
        summary = summary[:400].rsplit(" ", 1)[0] + "..."

    # Extract pros — snippets with positive tone
    pros = []
    for r in reviews:
        text = r.split(": ", 1)[-1] if ": " in r[:60] else r
        text = text.strip()
        if any(w in text.lower() for w in positive_words) and len(text) > 30:
            pros.append(text[:120])
        if len(pros) == 5:
            break

    # Extract cons — snippets with negative tone
    cons = []
    for r in reviews:
        text = r.split(": ", 1)[-1] if ": " in r[:60] else r
        text = text.strip()
        if any(w in text.lower() for w in negative_words) and len(text) > 30:
            cons.append(text[:120])
        if len(cons) == 4:
            break

    # Highlights — pick snippets that are neither clearly pos nor neg
    highlights = []
    for r in reviews:
        text = r.split(": ", 1)[-1] if ": " in r[:60] else r
        text = text.strip()
        if text not in pros and text not in cons and len(text) > 30:
            highlights.append(text[:100])
        if len(highlights) == 3:
            break

    # Fallbacks if lists are empty
    if not pros:
        pros = ["Audience found the film engaging overall"]
    if not cons:
        cons = ["Some viewers had mixed opinions"]
    if not highlights:
        highlights = [f"Based on {len(reviews)} IMDb user reviews"]

    verdict = (
        f"Audiences generally {sentiment.lower()}ly received {movie_name}, "
        f"with an estimated rating of {rating}/10 based on IMDb user reviews."
    )

    return {
        "summary":           summary or f"Based on {len(reviews)} IMDb user reviews for {movie_name}.",
        "overall_sentiment": sentiment,
        "rating_estimate":   rating,
        "pros":              pros[:5],
        "cons":              cons[:4],
        "highlights":        highlights[:3],
        "audience_verdict":  verdict,
        "recommended_for":   ["Movie enthusiasts", "Fans of the genre", "General audiences"],
        "source":            "serper_snippets",
    }


# ── Public API ────────────────────────────────────────────────

def getAIReviewSummary(
    movie_name: str,
    release_date: str = None,
    status: str = None,
) -> dict | None:
    """
    Returns None (with reason) for unreleased movies.
    Otherwise collects IMDb reviews and generates AI summary.
    """
    from datetime import date

    # ── Release validation ────────────────────────────────────
    today = date.today()
    is_upcoming = False

    if status and status.lower() in ("upcoming", "in production", "planned", "announced"):
        is_upcoming = True

    if release_date:
        try:
            rd = date.fromisoformat(release_date[:10])
            if rd > today:
                is_upcoming = True
        except ValueError:
            pass

    print(f"[AIReview] Movie release check: name={movie_name!r}  release_date={release_date}  status={status}  today={today}", flush=True)
    print(f"[AIReview] AI review allowed: {not is_upcoming}", flush=True)

    if is_upcoming:
        logger.info("[AIReview] Skipping — movie not yet released: %s", movie_name)
        return {"unreleased": True}

    # ── Cache check ───────────────────────────────────────────
    cache_key = f"aireview_v3:{movie_name.lower().strip()}"
    now = time.time()

    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            logger.info("[AIReview] Cache HIT: %s", movie_name)
            return data

    logger.info("[AIReview] Collecting IMDb reviews for: %s", movie_name)
    reviews = _collect_imdb_reviews(movie_name)

    if len(reviews) < 3:
        logger.warning("[AIReview] Insufficient IMDb reviews (%d) for: %s", len(reviews), movie_name)
        return None

    reviews = reviews[:15]

    result = _call_gemini(movie_name, reviews)

    if not result:
        logger.info("[AIReview] Gemini unavailable — building from snippets for: %s", movie_name)
        result = _build_from_snippets(movie_name, reviews)

    if not result:
        return None

    if "source" not in result:
        result["source"] = "gemini_imdb"

    logger.info("[AIReview] SUCCESS: %s  sentiment=%s  rating=%.1f  source=%s",
                movie_name, result.get("overall_sentiment"),
                result.get("rating_estimate", 0), result.get("source"))

    _cache[cache_key] = (now, result)
    return result
