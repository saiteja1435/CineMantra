import os
import socket
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from dotenv import load_dotenv

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()

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

    try:
        ips = dns_resolve("api.themoviedb.org")
        print(f"[TMDB] DNS api.themoviedb.org -> {ips}", flush=True)
    except socket.gaierror as e:
        raise RuntimeError(f"DNS resolution failed: {e}")

    p = dict(params or {})
    p["api_key"] = TMDB_API_KEY

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


# ── Telugu filter helper ─────────────────────────────────────

_TE = "te"

def _te_filter(items: list) -> list:
    return [m for m in items if m.get("original_language") == _TE]

def _te_discover(extra: dict = None, pages: int = 2) -> list:
    """TMDB Discover with with_original_language=te, merges multiple pages."""
    base = {"with_original_language": _TE, "sort_by": "popularity.desc",
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
            print(f"[TMDB] _te_discover page {page} failed: {e}", flush=True)
            break
    return _te_filter(results)

def _te_discover_tv(extra: dict = None, pages: int = 2) -> list:
    base = {"with_original_language": _TE, "sort_by": "popularity.desc",
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
            print(f"[TMDB] _te_discover_tv page {page} failed: {e}", flush=True)
            break
    return _te_filter(results)


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

def getTeluguTrending() -> list:
    """Telugu trending: use /trending/movie/week then filter, fallback to discover."""
    try:
        raw = _list("/trending/movie/week")
        te  = _te_filter(raw)
        if te:
            return te
    except Exception:
        pass
    return _te_discover()

def getTeluguPopular()    -> list: return _te_discover()
def getTeluguTopRated()   -> list: return _te_discover({"sort_by": "vote_average.desc", "vote_count.gte": "100"})
def getTeluguUpcoming()   -> list: return _te_discover({"sort_by": "primary_release_date.desc"})
def getTeluguNowPlaying() -> list: return _te_discover({"with_release_type": "2|3"})

def getTeluguWebSeries()  -> list: return _te_discover_tv()
def getTeluguOTT()        -> list: return _te_discover_tv({"with_watch_monetization_types": "flatrate|free"})
def getTeluguWebSeriesTopRated() -> list: return _te_discover_tv({"sort_by": "vote_average.desc", "vote_count.gte": "20"})
def getTeluguWebSeriesNew()      -> list: return _te_discover_tv({"sort_by": "first_air_date.desc"})
def getTeluguWebSeriesByGenre(genre_id: int) -> list: return _te_discover_tv({"with_genres": str(genre_id)})


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

def getTeluguClassics()   -> list:
    return _te_discover({"primary_release_date.lte": "2000-12-31",
                         "sort_by": "vote_average.desc", "vote_count.gte": "50"})

def getTeluguByGenre(genre_id: int) -> list:
    return _te_discover({"with_genres": str(genre_id)})

def searchTeluguMovies(query: str) -> list:
    """Search Telugu movies only — no fallback to other languages."""
    print(f"[TMDB] Search language filter: Telugu", flush=True)
    raw = _list("/search/movie", {"query": query, "language": "en-US",
                                   "include_adult": "false", "page": 1})
    print(f"[TMDB] Before filter count: {len(raw)}", flush=True)
    te = _te_filter(raw)
    print(f"[TMDB] After Telugu filter count: {len(te)}", flush=True)
    if te:
        return te
    # Fallback: discover Telugu popular (no non-Telugu results ever returned)
    return _te_discover({"sort_by": "popularity.desc"})

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
    pass
