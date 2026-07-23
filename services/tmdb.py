import os
import socket
import traceback
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()

# ── In-memory response cache (TTL = 5 min) ────────────────────
_CACHE: dict = {}
_CACHE_TTL   = 300  # seconds

def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL:
        return entry["data"]
    return None

def _cache_set(key: str, data):
    _CACHE[key] = {"data": data, "ts": time.time()}
    # Evict oldest entries if cache grows too large
    if len(_CACHE) > 200:
        oldest = sorted(_CACHE, key=lambda k: _CACHE[k]["ts"])[:50]
        for k in oldest:
            _CACHE.pop(k, None)

_BASE     = "https://api.themoviedb.org/3"
_IMG_W500 = "/api/tmdb-img/w500"
_IMG_ORIG = "/api/tmdb-img/original"

_PROXY_URL = os.getenv("TMDB_PROXY", "").strip()
_PROXIES   = {"http": _PROXY_URL, "https": _PROXY_URL} if _PROXY_URL else {}


def _make_session() -> requests.Session:
    session = requests.Session()
    session.trust_env = False
    if _PROXIES:
        session.proxies.update(_PROXIES)
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://",  adapter)
    return session


def dns_resolve(host: str) -> list:
    results = socket.getaddrinfo(host, 443)
    return [r[4][0] for r in results]


def _fetch(endpoint: str, params: dict = None) -> dict:
    if not TMDB_API_KEY:
        raise RuntimeError("TMDB_API_KEY is missing — add it to .env and restart")

    p = dict(params or {})
    p["api_key"] = TMDB_API_KEY
    cache_key = endpoint + str(sorted(p.items()))

    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        ips = dns_resolve("api.themoviedb.org")
        print(f"[TMDB] DNS api.themoviedb.org -> {ips}", flush=True)
    except socket.gaierror as e:
        raise RuntimeError(f"DNS resolution failed: {e}")

    url = f"{_BASE}{endpoint}"
    print(f"[TMDB] GET {url}", flush=True)

    session = _make_session()
    try:
        resp = session.get(
            url,
            params=p,
            headers={"Accept": "application/json"},
            timeout=30,
        )
        print(f"[TMDB] Status: {resp.status_code}", flush=True)
    except requests.exceptions.SSLError as e:
        raise RuntimeError(f"SSL error: {e}")
    except requests.exceptions.ConnectTimeout as e:
        raise RuntimeError(
            f"ConnectTimeout after 5 retries — ISP is blocking api.themoviedb.org:443. "
            f"Set TMDB_PROXY in .env to bypass. Detail: {e}"
        )
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(f"ConnectionError — {e}")
    except Exception:
        raise RuntimeError(traceback.format_exc())
    finally:
        session.close()

    if resp.status_code != 200:
        raise RuntimeError(f"TMDB HTTP {resp.status_code}: {resp.text[:400]}")

    data = resp.json()
    if "results" in data:
        print(f"[TMDB] Results: {len(data['results'])}", flush=True)
    _cache_set(cache_key, data)
    return data


def _enrich(movie: dict) -> dict:
    p = movie.get("poster_path")
    b = movie.get("backdrop_path")
    # Direct TMDB CDN — w342 for posters (faster, smaller), w1280 for backdrops
    movie["poster_url"]   = f"https://image.tmdb.org/t/p/w342{p}"  if p else None
    movie["backdrop_url"] = f"https://image.tmdb.org/t/p/w1280{b}" if b else None
    # Normalise TV show fields so JS treats them identically to movies
    if not movie.get("title") and movie.get("name"):
        movie["title"] = movie["name"]
    if not movie.get("release_date") and movie.get("first_air_date"):
        movie["release_date"] = movie["first_air_date"]
    return movie


def _list(endpoint: str, params: dict = None) -> list:
    data = _fetch(endpoint, params)
    return [_enrich(m) for m in data.get("results", [])]


# ── Language filter helper ───────────────────────────────────

_TE = "te"

def _lang_filter(items: list, lang: str) -> list:
    return [m for m in items if m.get("original_language") == lang]

def _te_filter(items: list) -> list:
    return _lang_filter(items, _TE)

def _discover(lang: str, extra: dict = None, pages: int = 2) -> list:
    base = {"with_original_language": lang, "sort_by": "popularity.desc",
            "include_adult": "false"}
    if extra:
        base.update(extra)
    results = []
    for page in range(1, pages + 1):
        base["page"] = page
        try:
            data = _fetch("/discover/movie", base)
            results.extend([_enrich(m) for m in data.get("results", [])])
        except Exception as e:
            print(f"[TMDB] _discover({lang}) page {page} failed: {e}", flush=True)
            break
    return _lang_filter(results, lang)

def _discover_tv(lang: str, extra: dict = None, pages: int = 2) -> list:
    base = {"with_original_language": lang, "sort_by": "popularity.desc",
            "include_adult": "false"}
    if extra:
        base.update(extra)
    results = []
    for page in range(1, pages + 1):
        base["page"] = page
        try:
            data = _fetch("/discover/tv", base)
            results.extend([_enrich(m) for m in data.get("results", [])])
        except Exception as e:
            print(f"[TMDB] _discover_tv({lang}) page {page} failed: {e}", flush=True)
            break
    return _lang_filter(results, lang)

def _te_discover(extra: dict = None, pages: int = 2) -> list:
    return _discover(_TE, extra, pages)

def _te_discover_tv(extra: dict = None, pages: int = 2) -> list:
    return _discover_tv(_TE, extra, pages)


# ── Public API ────────────────────────────────────────────────

def getTrendingMovies()   -> list: return _list("/trending/movie/week")
def getPopularMovies()    -> list: return _list("/movie/popular")
def getTopRatedMovies()   -> list: return _list("/movie/top_rated")
def getUpcomingMovies()   -> list: return _list("/movie/upcoming")
def getNowPlayingMovies() -> list: return _list("/movie/now_playing")

def searchMovies(query: str) -> list:
    return _list("/search/movie", {"query": query, "language": "en-US",
                                   "include_adult": "false", "page": 1})


# ── Telugu-only Public API ────────────────────────────────────

def getTrendingNow(lang: str = "te") -> list:
    """Trending = released in current month or last month only."""
    from datetime import date, timedelta
    today      = date.today()
    # First day of last month
    first_this = today.replace(day=1)
    last_month_end = first_this - timedelta(days=1)
    date_from  = last_month_end.replace(day=1).isoformat()
    date_to    = today.isoformat()
    return _discover(lang, {
        "primary_release_date.gte": date_from,
        "primary_release_date.lte": date_to,
        "sort_by": "popularity.desc",
    }, pages=3)

def getTeluguTrending() -> list:
    return getTrendingNow("te")

def getLangPopular(lang: str)  -> list: return _discover(lang)
def getLangTopRated(lang: str) -> list: return _discover(lang, {"sort_by": "vote_average.desc", "vote_count.gte": "100"})
def getLangNowPlaying(lang: str) -> list:
    """Movies released in last 10 days to today — currently in theatres."""
    from datetime import date, timedelta
    today     = date.today()
    date_from = (today - timedelta(days=10)).isoformat()
    date_to   = today.isoformat()
    return _discover(lang, {
        "primary_release_date.gte": date_from,
        "primary_release_date.lte": date_to,
        "sort_by": "popularity.desc",
    }, pages=2)

def getLangUpcoming(lang: str) -> list:
    """Movies releasing from tomorrow to next 3 months."""
    from datetime import date, timedelta
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    far_date = (date.today() + timedelta(days=90)).isoformat()
    return _discover(lang, {
        "primary_release_date.gte": tomorrow,
        "primary_release_date.lte": far_date,
        "sort_by": "primary_release_date.asc",
    }, pages=5)
def getLangWebSeries(lang: str)  -> list: return _discover_tv(lang)
def getLangClassics(lang: str)   -> list: return _discover(lang, {"primary_release_date.lte": "2000-12-31", "sort_by": "vote_average.desc", "vote_count.gte": "50"})
def getLangByGenre(lang: str, genre_id: int) -> list: return _discover(lang, {"with_genres": str(genre_id)})

def getTeluguPopular()  -> list: return getLangPopular("te")
def getTeluguTopRated() -> list: return getLangTopRated("te")

def getTeluguUpcoming() -> list:
    return getLangUpcoming("te")

def getTeluguNowPlaying() -> list: return getLangNowPlaying("te")

def getTeluguWebSeries()  -> list: return getLangWebSeries("te")
def getTeluguOTT()        -> list: return _discover_tv(_TE, {"with_watch_monetization_types": "flatrate|free"})
def getTeluguWebSeriesTopRated() -> list: return _discover_tv(_TE, {"sort_by": "vote_average.desc", "vote_count.gte": "20"})
def getTeluguWebSeriesNew()      -> list: return _discover_tv(_TE, {"sort_by": "first_air_date.desc"})
def getTeluguWebSeriesByGenre(genre_id: int) -> list: return _discover_tv(_TE, {"with_genres": str(genre_id)})


# ── TV Show Detail ────────────────────────────────────────────

def getTVDetails(tv_id: int) -> dict | None:
    try:
        return _enrich(_fetch(f"/tv/{tv_id}"))
    except Exception as e:
        print(f"[TMDB] getTVDetails({tv_id}) failed: {e}", flush=True)
        return None

def getTVCredits(tv_id: int) -> dict | None:
    try:
        return _fetch(f"/tv/{tv_id}/credits")
    except Exception as e:
        print(f"[TMDB] getTVCredits({tv_id}) failed: {e}", flush=True)
        return None

def getTVImages(tv_id: int) -> dict | None:
    try:
        return _fetch(f"/tv/{tv_id}/images", {"include_image_language": "en,null"})
    except Exception as e:
        print(f"[TMDB] getTVImages({tv_id}) failed: {e}", flush=True)
        return None

def getTVVideos(tv_id: int) -> dict | None:
    try:
        return _fetch(f"/tv/{tv_id}/videos")
    except Exception as e:
        print(f"[TMDB] getTVVideos({tv_id}) failed: {e}", flush=True)
        return None

def getTVRecommendations(tv_id: int) -> list:
    try:
        return _list(f"/tv/{tv_id}/recommendations")
    except Exception as e:
        print(f"[TMDB] getTVRecommendations({tv_id}) failed: {e}", flush=True)
        return []

def getTVSimilar(tv_id: int) -> list:
    try:
        return _list(f"/tv/{tv_id}/similar")
    except Exception as e:
        print(f"[TMDB] getTVSimilar({tv_id}) failed: {e}", flush=True)
        return []

def getTVWatchProviders(tv_id: int) -> dict | None:
    try:
        return _fetch(f"/tv/{tv_id}/watch/providers")
    except Exception as e:
        print(f"[TMDB] getTVWatchProviders({tv_id}) failed: {e}", flush=True)
        return None

def getTVCore(tv_id: int) -> dict:
    tasks = {
        "details":   lambda: getTVDetails(tv_id),
        "credits":   lambda: getTVCredits(tv_id),
        "images":    lambda: getTVImages(tv_id),
        "videos":    lambda: getTVVideos(tv_id),
        "providers": lambda: getTVWatchProviders(tv_id),
        "similar":   lambda: getTVSimilar(tv_id),
        "recommended": lambda: getTVRecommendations(tv_id),
    }
    result = {}
    with ThreadPoolExecutor(max_workers=7) as ex:
        futures = {ex.submit(fn): k for k, fn in tasks.items()}
        for f in as_completed(futures):
            k = futures[f]
            try:
                result[k] = f.result()
            except Exception as e:
                print(f"[TMDB] getTVCore {k!r} failed: {e}", flush=True)
                result[k] = None
    return result

def getTeluguCalendar(year: int, month: int) -> list:
    """Telugu movies releasing in a given month, sorted by release date."""
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    date_from = f"{year}-{month:02d}-01"
    date_to   = f"{year}-{month:02d}-{last_day}"
    results = _te_discover({
        "primary_release_date.gte": date_from,
        "primary_release_date.lte": date_to,
        "sort_by": "primary_release_date.asc",
    }, pages=3)
    return results


def getOTTTrending() -> list:
    """Telugu movies trending on OTT (Netflix/Prime/Hotstar IN region)."""
    _PROVIDER_NAMES = {8: "Netflix", 119: "Prime Video", 122: "Hotstar", 237: "SonyLIV", 220: "Zee5"}
    results = []
    seen = set()
    for provider_id, name in _PROVIDER_NAMES.items():
        try:
            items = _te_discover({
                "with_watch_providers": str(provider_id),
                "watch_region": "IN",
                "sort_by": "popularity.desc",
            }, pages=1)
            for m in items:
                if m.get("id") not in seen:
                    seen.add(m["id"])
                    m["_ott_provider"] = name
                    results.append(m)
        except Exception as e:
            print(f"[TMDB] getOTTTrending provider {provider_id} failed: {e}", flush=True)
    return results[:30] if results else _te_discover(
        {"with_watch_monetization_types": "flatrate", "watch_region": "IN"}, pages=1
    )


def getTeluguClassics() -> list:
    return getLangClassics("te")


def getTeluguByGenre(genre_id: int) -> list:
    return getLangByGenre("te", genre_id)

def searchLangMovies(query: str, lang: str) -> list:
    raw = _list("/search/movie", {"query": query, "language": "en-US",
                                   "include_adult": "false", "page": 1})
    filtered = _lang_filter(raw, lang)
    if filtered:
        return filtered
    return _discover(lang, {"sort_by": "popularity.desc"})

def searchTeluguMovies(query: str) -> list:
    return searchLangMovies(query, "te")

def getMovieRecommendations(movie_id: int) -> list:
    return _list(f"/movie/{movie_id}/recommendations")

def getMovieSimilar(movie_id: int) -> list:
    return _list(f"/movie/{movie_id}/similar")

def getPersonMovieCredits(person_id: int) -> list:
    """Fetch a person's movie credits, return Telugu-only enriched list."""
    try:
        data = _fetch(f"/person/{person_id}/movie_credits")
        movies = [_enrich(m) for m in data.get("cast", [])]
        return _te_filter(movies)
    except Exception as e:
        print(f"[TMDB] getPersonMovieCredits({person_id}) failed: {e}", flush=True)
        return []

def getMovieDetails(movie_id: int) -> dict | None:
    try:
        return _enrich(_fetch(f"/movie/{movie_id}"))
    except Exception as e:
        print(f"[TMDB] getMovieDetails({movie_id}) failed: {e}", flush=True)
        return None

def getMovieCredits(movie_id: int) -> dict | None:
    try:
        return _fetch(f"/movie/{movie_id}/credits")
    except Exception as e:
        print(f"[TMDB] getMovieCredits({movie_id}) failed: {e}", flush=True)
        return None

def getMovieVideos(movie_id: int) -> dict | None:
    try:
        # Fetch without language filter so Telugu/regional videos are included
        data = _fetch(f"/movie/{movie_id}/videos", {"language": "en-US"})
        results = data.get("results", [])
        # If no YouTube videos found, retry without language restriction
        if not any(v.get("site") == "YouTube" for v in results):
            print(f"[TMDB] No YouTube videos in en-US for {movie_id}, retrying without language filter", flush=True)
            data = _fetch(f"/movie/{movie_id}/videos")
        return data
    except Exception as e:
        print(f"[TMDB] getMovieVideos({movie_id}) failed: {e}", flush=True)
        return None

def getMovieImages(movie_id: int) -> dict | None:
    try:
        return _fetch(f"/movie/{movie_id}/images", {"include_image_language": "en,null"})
    except Exception as e:
        print(f"[TMDB] getMovieImages({movie_id}) failed: {e}", flush=True)
        return None

def getWatchProviders(movie_id: int) -> dict | None:
    try:
        return _fetch(f"/movie/{movie_id}/watch/providers")
    except Exception as e:
        print(f"[TMDB] getWatchProviders({movie_id}) failed: {e}", flush=True)
        return None

def getMovieCore(movie_id: int) -> dict:
    tasks = {
        "details":   lambda: getMovieDetails(movie_id),
        "credits":   lambda: getMovieCredits(movie_id),
        "images":    lambda: getMovieImages(movie_id),
        "providers": lambda: getWatchProviders(movie_id),
        "similar":   lambda: getMovieSimilar(movie_id),
    }
    result = {}
    with ThreadPoolExecutor(max_workers=5) as ex:
        futures = {ex.submit(fn): k for k, fn in tasks.items()}
        for f in as_completed(futures):
            k = futures[f]
            try:
                result[k] = f.result()
            except Exception as e:
                print(f"[TMDB] getMovieCore {k!r} failed: {e}", flush=True)
                result[k] = None
    return result


# ── network_test helper (used by /api/network-test) ───────────

def network_test() -> dict:
    out = {"internet": False, "dns": False, "tmdb": False}

    # 1. Internet check
    try:
        s = socket.create_connection(("8.8.8.8", 53), timeout=5)
        s.close()
        out["internet"] = True
    except Exception as e:
        out["error"] = f"No internet: {e}"
        return out

    # 2. DNS check
    try:
        ips = dns_resolve("api.themoviedb.org")
        out["dns"]  = True
        out["ips"]  = ips
    except Exception as e:
        out["error"] = f"DNS failed: {e}"
        return out

    # 3. TCP reachability
    try:
        s = socket.create_connection(("api.themoviedb.org", 443), timeout=10)
        s.close()
        out["tcp"] = True
    except Exception as e:
        out["tcp"]   = False
        out["error"] = f"TCP blocked — ISP is blocking api.themoviedb.org:443: {e}"
        return out

    # 4. TMDB API call
    try:
        session = _make_session()
        resp = session.get(
            f"{_BASE}/trending/movie/week",
            params={"api_key": TMDB_API_KEY},
            headers={"Accept": "application/json"},
            timeout=30,
        )
        session.close()
        out["status"] = resp.status_code
        if resp.status_code == 200:
            out["tmdb"]        = True
            out["movie_count"] = len(resp.json().get("results", []))
        else:
            out["error"] = f"TMDB HTTP {resp.status_code}: {resp.text[:200]}"
    except Exception as e:
        out["error"] = str(e)

    return out


# ── Compat exports for recommendation.py ─────────────────────

def _results(endpoint: str, params: dict = None) -> list:
    try:
        return _list(endpoint, params)
    except Exception as e:
        print(f"[TMDB] _results({endpoint!r}) failed: {e}", flush=True)
        return []

def clear_cache():
    _CACHE.clear()
