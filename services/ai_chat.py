"""
CineMantra AI Chat — Gemini-powered movie assistant.
"""
import os
import re
import json
import logging
from dotenv import load_dotenv

load_dotenv(override=True)
logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are CineMantra AI, a cinema-only assistant for the CineMantra app.
You ONLY answer questions about movies, web series, actors, directors, and cinema.
Rules:
- If user asks to explain/describe a movie: reply in exactly 50 words or less. Include genre, lead cast, and one-line plot.
- If user asks for movie suggestions/recommendations: suggest 3-5 titles, each with a one-line reason. Format titles in **bold**.
- If user asks about an actor/director: give a brief 2-3 sentence answer about their work.
- Keep ALL replies under 80 words total. Be direct, no filler sentences.
- If the question is NOT about cinema/movies/TV/actors, reply: "I only answer movie-related questions! Ask me about a film, actor, or genre. 🎬"
- Never use markdown headers. Never use bullet points with dashes. Use numbered lists only for recommendations.
"""

def chatResponse(message: str, history: list) -> dict:
    """
    Returns { reply, movies }
    movies: list of TMDB movie objects if recommendations were made
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    reply   = ""
    movies  = []

    # Build conversation history for Gemini
    contents = []
    for h in history[-6:]:  # last 6 turns to keep context
        role    = "user" if h.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": h.get("text", "")}]})
    contents.append({"role": "user", "parts": [{"text": message}]})

    if api_key:
        try:
            from google import genai
            from google.genai import types as gt

            client = genai.Client(api_key=api_key)
            models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]

            for model in models:
                try:
                    resp = client.models.generate_content(
                        model=model,
                        contents=contents,
                        config=gt.GenerateContentConfig(
                            system_instruction=_SYSTEM_PROMPT,
                            temperature=0.7,
                            max_output_tokens=300,
                        ),
                    )
                    reply = resp.text.strip()
                    break
                except Exception as e:
                    err = str(e)
                    if any(x in err for x in ("429", "RESOURCE_EXHAUSTED", "404", "NOT_FOUND")):
                        continue
                    raise
        except Exception as e:
            logger.warning("[AIChat] Gemini failed: %s", str(e)[:200])

    if not reply:
        reply = _fallback_reply(message)

    # Extract movie titles from reply and fetch TMDB data
    movies = _extract_movies(reply)

    return {"reply": reply, "movies": movies}


def _fallback_reply(message: str) -> str:
    q = message.lower()

    # Movie info request — fetch from TMDB
    info_triggers = ("what is", "tell me about", "explain", "about", "describe", "who made", "story of", "plot of")
    if any(t in q for t in info_triggers):
        # Extract movie name after trigger word
        for t in info_triggers:
            if t in q:
                name = q.split(t, 1)[-1].strip().strip('?').strip()
                if len(name) > 2:
                    try:
                        from services.tmdb import _fetch, _enrich
                        data = _fetch("/search/movie", {"query": name, "language": "en-US", "page": 1})
                        m = data.get("results", [None])[0]
                        if m:
                            title    = m.get("title", name)
                            year     = (m.get("release_date") or "")[:4]
                            overview = (m.get("overview") or "").split(".")[0]
                            rating   = m.get("vote_average", 0)
                            return f"{title} ({year}) — {overview}. Rating: {rating}/10. 🎬"
                    except Exception:
                        pass
                break

    if any(w in q for w in ("horror", "scary", "ghost")):
        return "For horror, check out **Awe!**, **Gruham**, and **Iruttu Araiyil Murattu Kuththu**. Great spine-chillers!"
    if any(w in q for w in ("action", "fight", "mass")):
        return "Top action picks: **RRR**, **Pushpa**, **Baahubali**, and **Saaho**. All-out mass entertainers!"
    if any(w in q for w in ("comedy", "funny", "laugh")):
        return "For laughs: **F2**, **Jabardasth**, **Bhale Bhale Magadivoy**, and **Pelli Choopulu**. Pure fun!"
    if any(w in q for w in ("romance", "love", "romantic")):
        return "Romantic picks: **Arjun Reddy**, **Geetha Govindam**, **Fidaa**, and **Ye Maaya Chesave**. Beautiful love stories!"
    if any(w in q for w in ("recommend", "suggest", "watch", "good movie")):
        return "I'd suggest **RRR**, **Baahubali**, **Arjun Reddy**, and **Pushpa**. All are must-watches!"

    # Generic movie name — try TMDB directly
    if len(q.split()) <= 6:
        try:
            from services.tmdb import _fetch
            data = _fetch("/search/movie", {"query": message.strip(), "language": "en-US", "page": 1})
            m = data.get("results", [None])[0]
            if m:
                title    = m.get("title", message)
                year     = (m.get("release_date") or "")[:4]
                overview = (m.get("overview") or "").split(".")[0]
                rating   = m.get("vote_average", 0)
                return f"{title} ({year}) — {overview}. Rating: {rating}/10. 🎬"
        except Exception:
            pass

    return "I'm CineMantra AI! Ask me for movie recommendations, actor info, or anything about cinema. 🎬"


def _extract_movies(text: str) -> list:
    """Extract bold movie titles from reply and fetch TMDB data."""
    titles = re.findall(r'\*\*([^*]+)\*\*', text)
    if not titles:
        return []

    from services.tmdb import _fetch, _enrich
    movies = []
    seen   = set()

    for title in titles[:5]:
        if title.lower() in seen:
            continue
        seen.add(title.lower())
        try:
            data    = _fetch("/search/movie", {"query": title, "language": "en-US", "page": 1})
            results = data.get("results", [])
            if results:
                m = _enrich(results[0])
                movies.append(m)
        except Exception:
            pass

    return movies
