import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.tmdb import (
    getMovieRecommendations, getMovieSimilar, getMovieDetails,
    getMovieCredits, getTrendingMovies, getTopRatedMovies,
    getUpcomingMovies, getPersonMovieCredits, _results, _enrich, _te_filter,
)

_cache: dict = {}
_TTL = 600  # 10 minutes


def _cached(key: str, fn):
    now = time.time()
    if key in _cache:
        ts, data = _cache[key]
        if now - ts < _TTL:
            return data
    data = fn()
    _cache[key] = (now, data)
    return data


def _dedup(movies: list, seen: set = None) -> list:
    seen = seen or set()
    out = []
    for m in movies:
        if m.get("id") and m["id"] not in seen:
            seen.add(m["id"])
            out.append(m)
    return out


def _te_only(movies: list) -> list:
    """Keep only Telugu (original_language=te) movies."""
    return [m for m in movies if m.get("original_language") == "te"]


# ── Core recommendation functions ────────────────────────────

def recommendByGenre(movie_id: int) -> list:
    details = getMovieDetails(movie_id)
    if not details:
        return []
    genre_ids = [g["id"] for g in details.get("genres", [])]
    if not genre_ids:
        return []
    key = f"te_genre:{genre_ids[0]}"
    movies = _cached(key, lambda: _results(
        "/discover/movie",
        {"with_genres": genre_ids[0], "with_original_language": "te",
         "sort_by": "popularity.desc", "page": 1}
    ))
    return _dedup([m for m in movies if m.get("id") != movie_id])[:12]


def recommendByCast(movie_id: int) -> list:
    credits = getMovieCredits(movie_id)
    if not credits:
        return []
    # Top 3 cast members
    cast = credits.get("cast", [])[:3]
    results, seen = [], {movie_id}
    for person in cast:
        pid = person.get("id")
        if not pid:
            continue
        key = f"te_cast:{pid}"
        movies = _cached(key, lambda p=pid: getPersonMovieCredits(p))
        for m in movies:
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                results.append(m)
        if len(results) >= 12:
            break
    return results[:12]


def recommendByDirector(movie_id: int) -> list:
    credits = getMovieCredits(movie_id)
    if not credits:
        return []
    director = next((p for p in credits.get("crew", []) if p.get("job") == "Director"), None)
    if not director:
        return []
    pid = director["id"]
    key = f"te_director:{pid}"
    movies = _cached(key, lambda: getPersonMovieCredits(pid))
    return _dedup([m for m in movies if m.get("id") != movie_id])[:12]


def recommendBySimilarMovies(movie_id: int) -> list:
    key = f"similar:{movie_id}"
    raw = _cached(key, lambda: getMovieSimilar(movie_id))
    return _te_only(raw)


def recommendTrending() -> list:
    return _cached("trending", getTrendingMovies)


def recommendTopRated() -> list:
    return _cached("toprated", getTopRatedMovies)


def recommendUpcoming() -> list:
    return _cached("upcoming", getUpcomingMovies)


def recommendFromWatchlist(movie_ids: list) -> list:
    if not movie_ids:
        return recommendTrending()
    results, seen = [], set()
    for mid in movie_ids[:3]:
        for m in _te_only(getMovieRecommendations(mid)):
            if m.get("id") and m["id"] not in seen and m["id"] not in movie_ids:
                seen.add(m["id"])
                results.append(m)
    return results[:12] or recommendTrending()


def recommendFromFavorites(movie_ids: list) -> list:
    if not movie_ids:
        return recommendTrending()
    results, seen = [], set()
    for mid in movie_ids[:3]:
        for m in _te_only(getMovieRecommendations(mid)):
            if m.get("id") and m["id"] not in seen and m["id"] not in movie_ids:
                seen.add(m["id"])
                results.append(m)
    return results[:12] or recommendTrending()


def recommendPersonalized(history: list, favorites: list, watchlist: list) -> list:
    results, seen = [], set()

    def _add(movies, reason):
        for m in movies:
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                m["reason"] = reason
                results.append(m)

    for mid in (favorites or [])[:2]:
        recs = _te_only(getMovieRecommendations(mid))
        details = getMovieDetails(mid)
        label = f"Because you liked {details['title']}" if details else "From your favorites"
        _add(recs[:6], label)

    for mid in (history or [])[:2]:
        recs = _te_only(getMovieRecommendations(mid))
        details = getMovieDetails(mid)
        label = f"Because you watched {details['title']}" if details else "From your history"
        _add(recs[:6], label)

    for mid in (watchlist or [])[:2]:
        similar = recommendBySimilarMovies(mid)
        details = getMovieDetails(mid)
        label = f"Similar to {details['title']}" if details else "From your watchlist"
        _add(similar[:4], label)

    if len(results) < 8:
        for m in recommendTrending():
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                m["reason"] = "Trending Now"
                results.append(m)

    return results[:20]


# ── Per-movie recommendations with reason labels ──────────────

def recommendForMovie(movie_id: int) -> list:
    results, seen = [], {movie_id}

    def _add(movies, reason):
        for m in movies:
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                m["reason"] = reason
                results.append(m)

    _add(_te_only(getMovieRecommendations(movie_id))[:8], "Recommended")
    if len(results) < 6:
        _add(recommendBySimilarMovies(movie_id)[:8],     "Similar Movie")
    if len(results) < 6:
        _add(recommendByGenre(movie_id)[:6],             "Same Genre")
    if len(results) < 6:
        _add(recommendByDirector(movie_id)[:4],          "Same Director")
    if len(results) < 6:
        _add(recommendByCast(movie_id)[:4],              "Same Cast")

    return results[:20]


# ── Combined recommendations endpoint ─────────────────────────

def getMovieRecommendationsGrouped(movie_id: int) -> dict:
    """
    Returns all 4 buckets in parallel with Telugu filter applied.
    Used by /api/movie/<id>/recommendations
    """
    print(f"[Rec] Loading recommendations for movie {movie_id}", flush=True)

    cache_key = f"grouped:{movie_id}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            print(f"[Rec] Recommendation API response: cache HIT for {movie_id}", flush=True)
            return data

    details = getMovieDetails(movie_id)
    credits = getMovieCredits(movie_id) or {}

    genres     = [g["name"] for g in (details or {}).get("genres", [])][:2]
    crew       = credits.get("crew", [])
    cast       = credits.get("cast", [])
    director   = next((p["name"] for p in crew if p.get("job") == "Director"), None)
    lead_actor = cast[0]["name"] if cast else None

    seen = {movie_id}

    def _bucket(movies):
        out = []
        for m in movies:
            if m.get("id") and m["id"] not in seen:
                seen.add(m["id"])
                out.append(m)
        return out[:12]

    def _fetch_similar():
        return _bucket(recommendBySimilarMovies(movie_id))

    def _fetch_genre():
        return _bucket(recommendByGenre(movie_id))

    def _fetch_actor():
        return _bucket(recommendByCast(movie_id))

    def _fetch_director():
        return _bucket(recommendByDirector(movie_id))

    # Fetch all 4 in parallel
    with ThreadPoolExecutor(max_workers=4) as ex:
        f_similar   = ex.submit(_fetch_similar)
        f_genre     = ex.submit(_fetch_genre)
        f_actor     = ex.submit(_fetch_actor)
        f_director  = ex.submit(_fetch_director)

        similar_movies  = f_similar.result()
        genre_movies    = f_genre.result()
        actor_movies    = f_actor.result()
        director_movies = f_director.result()

    # Recommended = scored blend
    scored = {}
    for m in similar_movies:
        scored[m["id"]] = scored.get(m["id"], 0) + 3
    for m in genre_movies:
        scored[m["id"]] = scored.get(m["id"], 0) + 2
    for m in actor_movies:
        scored[m["id"]] = scored.get(m["id"], 0) + 2
    for m in director_movies:
        scored[m["id"]] = scored.get(m["id"], 0) + 3

    all_movies = {m["id"]: m for m in similar_movies + genre_movies + actor_movies + director_movies}
    recommended = sorted(
        [m for m in all_movies.values()],
        key=lambda m: (scored.get(m["id"], 0) + (m.get("vote_average") or 0)),
        reverse=True
    )[:10]

    result = {
        "similar":    {"label": "Similar Movies",                                 "movies": similar_movies},
        "genre":      {"label": ", ".join(genres) if genres else "Same Genre",    "movies": genre_movies},
        "actor":      {"label": lead_actor or "Same Cast",                        "movies": actor_movies},
        "director":   {"label": director or "Same Director",                      "movies": director_movies},
        "recommended":{"label": "Recommended For You",                            "movies": recommended},
    }

    print(f"[Rec] Recommendation API response: similar={len(similar_movies)} genre={len(genre_movies)} "
          f"actor={len(actor_movies)} director={len(director_movies)} recommended={len(recommended)}", flush=True)

    _cache[cache_key] = (now, result)
    return result
