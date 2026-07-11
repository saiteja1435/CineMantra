import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()
_BASE     = "https://api.themoviedb.org/3"
_IMG_W500 = "/api/tmdb-img/w500"
_IMG_W185 = "/api/tmdb-img/w185"
_IMG_ORIG = "/api/tmdb-img/original"

_cache: dict = {}
_TTL = 3600  # 1 hour


def _fetch(endpoint: str, params: dict = None) -> dict:
    import requests
    if not TMDB_API_KEY:
        raise RuntimeError("TMDB_API_KEY missing")
    p = dict(params or {})
    p["api_key"] = TMDB_API_KEY
    r = requests.get(f"{_BASE}{endpoint}", params=p,
                     headers={"Accept": "application/json"}, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"TMDB {r.status_code}: {r.text[:200]}")
    return r.json()


def _cached(key: str, fn):
    now = time.time()
    if key in _cache:
        ts, data = _cache[key]
        if now - ts < _TTL:
            return data
    data = fn()
    _cache[key] = (now, data)
    return data


def _enrich_profile(p: dict) -> dict:
    pp = p.get("profile_path")
    p["profile_url"] = f"{_IMG_W500}{pp}" if pp else None
    return p


def _enrich_movie(m: dict) -> dict:
    pp = m.get("poster_path")
    bp = m.get("backdrop_path")
    m["poster_url"]   = f"{_IMG_W500}{pp}" if pp else None
    m["backdrop_url"] = f"{_IMG_ORIG}{bp}"  if bp else None
    return m


# ── Public API ────────────────────────────────────────────────

def getPersonDetails(person_id: int) -> dict | None:
    try:
        return _cached(f"person:{person_id}", lambda: _enrich_profile(
            _fetch(f"/person/{person_id}", {"language": "en-US", "append_to_response": "external_ids"})
        ))
    except Exception as e:
        print(f"[Person] getPersonDetails({person_id}) failed: {e}", flush=True)
        return None


def getPersonMovieCredits(person_id: int) -> dict:
    try:
        return _cached(f"person_movies:{person_id}", lambda:
            _fetch(f"/person/{person_id}/movie_credits", {"language": "en-US"})
        )
    except Exception as e:
        print(f"[Person] getPersonMovieCredits({person_id}) failed: {e}", flush=True)
        return {}


def getPersonTVCredits(person_id: int) -> dict:
    try:
        return _cached(f"person_tv:{person_id}", lambda:
            _fetch(f"/person/{person_id}/tv_credits", {"language": "en-US"})
        )
    except Exception as e:
        print(f"[Person] getPersonTVCredits({person_id}) failed: {e}", flush=True)
        return {}


def getPersonCombinedCredits(person_id: int) -> dict:
    try:
        return _cached(f"person_combined:{person_id}", lambda:
            _fetch(f"/person/{person_id}/combined_credits", {"language": "en-US"})
        )
    except Exception as e:
        print(f"[Person] getPersonCombinedCredits({person_id}) failed: {e}", flush=True)
        return {}


def getPersonImages(person_id: int) -> dict:
    try:
        return _cached(f"person_images:{person_id}", lambda:
            _fetch(f"/person/{person_id}/images")
        )
    except Exception as e:
        print(f"[Person] getPersonImages({person_id}) failed: {e}", flush=True)
        return {}


def searchPerson(query: str) -> list:
    try:
        data = _fetch("/search/person", {"query": query, "language": "en-US",
                                          "include_adult": "false", "page": 1})
        results = data.get("results", [])
        return [_enrich_profile(p) for p in results[:10]]
    except Exception as e:
        print(f"[Person] searchPerson({query!r}) failed: {e}", flush=True)
        return []


def getPersonCore(person_id: int) -> dict:
    tasks = {
        "details":       lambda: getPersonDetails(person_id),
        "movie_credits": lambda: getPersonMovieCredits(person_id),
        "tv_credits":    lambda: getPersonTVCredits(person_id),
        "images":        lambda: getPersonImages(person_id),
    }
    result = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(fn): k for k, fn in tasks.items()}
        for f in as_completed(futures):
            k = futures[f]
            try:
                result[k] = f.result()
            except Exception as e:
                print(f"[Person] getPersonCore {k!r} failed: {e}", flush=True)
                result[k] = None
    return result


def getTeluguActors(page: int = 1) -> list:
    """Discover popular Telugu-industry actors via TMDB."""
    try:
        data = _fetch("/person/popular", {"language": "en-US", "page": page})
        return [_enrich_profile(p) for p in data.get("results", [])]
    except Exception as e:
        print(f"[Person] getTeluguActors failed: {e}", flush=True)
        return []


def enrichMovieCredits(credits: dict) -> dict:
    """Enrich cast/crew movie credits with poster/backdrop URLs."""
    cast = [_enrich_movie(dict(m)) for m in credits.get("cast", [])]
    crew = [_enrich_movie(dict(m)) for m in credits.get("crew", [])]
    return {"cast": cast, "crew": crew}


def enrichTVCredits(credits: dict) -> dict:
    tv_cast = []
    for m in credits.get("cast", []):
        m = dict(m)
        pp = m.get("poster_path")
        m["poster_url"] = f"{_IMG_W500}{pp}" if pp else None
        tv_cast.append(m)
    return {"cast": tv_cast}


def getSimilarActors(person_id: int, movie_credits: dict) -> list:
    """Find actors who frequently appear in the same movies."""
    cast_movies = movie_credits.get("cast", [])
    # Get top 5 movie IDs by popularity
    top_movies = sorted(cast_movies, key=lambda m: m.get("popularity", 0), reverse=True)[:5]
    co_actors: dict = {}
    for movie in top_movies:
        mid = movie.get("id")
        if not mid:
            continue
        try:
            credits = _cached(f"movie_credits:{mid}", lambda mid=mid:
                _fetch(f"/movie/{mid}/credits", {"language": "en-US"})
            )
            for actor in credits.get("cast", [])[:10]:
                aid = actor.get("id")
                if aid and aid != person_id:
                    if aid not in co_actors:
                        co_actors[aid] = {"count": 0, **actor}
                    co_actors[aid]["count"] += 1
        except Exception:
            pass

    sorted_actors = sorted(co_actors.values(), key=lambda a: a["count"], reverse=True)[:8]
    return [_enrich_profile(a) for a in sorted_actors]


def getCollaborators(person_id: int, movie_credits: dict) -> dict:
    """Extract frequent directors, co-actors, music directors, producers."""
    cast_movies = movie_credits.get("cast", [])
    top_movies = sorted(cast_movies, key=lambda m: m.get("popularity", 0), reverse=True)[:10]

    directors: dict = {}
    music: dict = {}
    producers: dict = {}
    co_actors: dict = {}

    for movie in top_movies:
        mid = movie.get("id")
        if not mid:
            continue
        try:
            credits = _cached(f"movie_credits:{mid}", lambda mid=mid:
                _fetch(f"/movie/{mid}/credits", {"language": "en-US"})
            )
            for crew in credits.get("crew", []):
                name = crew.get("name", "")
                job  = crew.get("job", "")
                cid  = crew.get("id")
                if not cid or not name:
                    continue
                if job == "Director":
                    directors[cid] = directors.get(cid, {"name": name, "count": 0, "id": cid})
                    directors[cid]["count"] += 1
                elif job == "Original Music Composer":
                    music[cid] = music.get(cid, {"name": name, "count": 0, "id": cid})
                    music[cid]["count"] += 1
                elif job == "Producer":
                    producers[cid] = producers.get(cid, {"name": name, "count": 0, "id": cid})
                    producers[cid]["count"] += 1
            for actor in credits.get("cast", [])[:8]:
                aid = actor.get("id")
                if aid and aid != person_id:
                    co_actors[aid] = co_actors.get(aid, {"name": actor.get("name",""), "count": 0, "id": aid,
                                                          "profile_path": actor.get("profile_path")})
                    co_actors[aid]["count"] += 1
        except Exception:
            pass

    def _top(d, n=5):
        return sorted(d.values(), key=lambda x: x["count"], reverse=True)[:n]

    return {
        "directors": _top(directors),
        "actors":    [_enrich_profile(a) for a in _top(co_actors)],
        "music":     _top(music),
        "producers": _top(producers),
    }
