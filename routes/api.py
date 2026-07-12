from flask import Blueprint, jsonify, request, Response
import requests as _req
import os
import requests as req_lib
from dotenv import load_dotenv

load_dotenv(override=True)

from services.tmdb import (
    getTrendingMovies, getPopularMovies, getTopRatedMovies,
    getUpcomingMovies, getNowPlayingMovies, searchMovies,
    getMovieDetails, getMovieCredits, getMovieImages, getWatchProviders,
    getMovieRecommendations, getMovieSimilar, getMovieVideos,
    getMovieCore, clear_cache, _enrich, _PROXY_URL, network_test,
    getTeluguTrending, getTeluguPopular, getTeluguTopRated,
    getTeluguUpcoming, getTeluguNowPlaying, getTeluguWebSeries,
    getTeluguOTT, getTeluguClassics, getTeluguByGenre, searchTeluguMovies,
    getTeluguWebSeriesTopRated, getTeluguWebSeriesNew, getTeluguWebSeriesByGenre,
    getTVCore, getTVDetails, getTVVideos, getTVWatchProviders,
)
from services.youtube import (
    searchOfficialTrailer, searchOfficialTeaser, searchBehindTheScenes,
    searchCastInterviews, searchFeaturettes, searchDeletedScenes, searchMovieSongs,
)
from services.serper import (
    getMovieReviews, getMovieNews, getMovieArticles, getMovieBoxOffice,
    getMovieLatestNews,
)
from services.ai_review import getAIReviewSummary
from services.ai_recommend import getAIRecommendations
from services.ai_search import aiSearch
from services.recommendation import (
    recommendForMovie, recommendPersonalized,
    recommendTrending, recommendTopRated,
    getMovieRecommendationsGrouped,
)
from services.person import (
    getPersonCore, searchPerson, getTeluguActors,
    enrichMovieCredits, enrichTVCredits,
    getSimilarActors, getCollaborators,
)
from database.db import sh_add, sh_get, sh_delete_one, sh_delete_all

api_bp = Blueprint("api", __name__)


def _ok(results):
    return jsonify({"ok": True, "results": results})

def _fail(msg, status=500):
    return jsonify({"ok": False, "error": msg}), status

def _run_list(fn):
    try:
        movies = fn()
        return _ok(movies)
    except Exception as e:
        return jsonify({"ok": False, "network_error": str(e)}), 503


# ── TMDB Image Proxy ─────────────────────────────────────────
# Fetches images server-side so the browser never hits image.tmdb.org

@api_bp.route("/tmdb-img/<path:img_path>")
def tmdb_image_proxy(img_path):
    from flask import redirect
    return redirect(f"https://image.tmdb.org/t/p/{img_path}", code=302)


# ── Debug / Network test ─────────────────────────────────────

@api_bp.route("/network-test")
def network_test_route():
    result = network_test()
    status = 200 if result.get("tmdb") else 503
    return jsonify(result), status

@api_bp.route("/debug")
def debug():
    result = network_test()
    return jsonify(result), (200 if result.get("tmdb") else 503)


# ── Health / Cache ────────────────────────────────────────────

@api_bp.route("/health")
def health():
    key = os.getenv("TMDB_API_KEY", "")
    return jsonify({"status": "ok", "tmdb_key_set": bool(key), "tmdb_key_len": len(key)})

@api_bp.route("/cache/clear")
def cache_clear():
    clear_cache()
    return jsonify({"ok": True})


# ── TMDB list routes ──────────────────────────────────────────

@api_bp.route("/trending")
def trending():
    return _run_list(getTrendingMovies)

@api_bp.route("/popular")
def popular():
    return _run_list(getPopularMovies)

@api_bp.route("/top-rated")
def top_rated():
    return _run_list(getTopRatedMovies)

@api_bp.route("/upcoming")
def upcoming():
    return _run_list(getUpcomingMovies)

@api_bp.route("/now-playing")
def now_playing():
    return _run_list(getNowPlayingMovies)

@api_bp.route("/search")
def search():
    q = request.args.get("q", "").strip()
    if not q:
        return _fail("Missing query parameter: q", 400)
    return _run_list(lambda: searchMovies(q))


@api_bp.route("/smart-search")
def smart_search():
    q = request.args.get("q", "").strip()
    if not q:
        return _fail("Missing query parameter: q", 400)
    try:
        from services.smart_search import smartSearch
        data = smartSearch(q)
        return jsonify({"ok": True, "results": data["results"], "intent": data["intent"]})
    except Exception as e:
        return _fail(str(e))


# ── Telugu-only routes ────────────────────────────────────────

_GENRE_COMEDY   = 35
_GENRE_ACTION   = 28
_GENRE_ROMANCE  = 10749
_GENRE_THRILLER = 53
_GENRE_CRIME    = 80
_GENRE_FAMILY   = 10751
_GENRE_HORROR   = 27
_GENRE_HISTORY  = 36
_GENRE_DRAMA    = 18

@api_bp.route("/telugu/trending")
def telugu_trending():
    return _run_list(getTeluguTrending)

@api_bp.route("/telugu/popular")
def telugu_popular():
    return _run_list(getTeluguPopular)

@api_bp.route("/telugu/top-rated")
def telugu_top_rated():
    return _run_list(getTeluguTopRated)

@api_bp.route("/telugu/upcoming")
def telugu_upcoming():
    return _run_list(getTeluguUpcoming)

@api_bp.route("/telugu/now-playing")
def telugu_now_playing():
    return _run_list(getTeluguNowPlaying)

@api_bp.route("/telugu/web-series")
def telugu_web_series():
    return _run_list(getTeluguWebSeries)

@api_bp.route("/telugu/web-series/top-rated")
def telugu_ws_top_rated():
    return _run_list(getTeluguWebSeriesTopRated)

@api_bp.route("/telugu/web-series/new")
def telugu_ws_new():
    return _run_list(getTeluguWebSeriesNew)

@api_bp.route("/telugu/web-series/drama")
def telugu_ws_drama():
    return _run_list(lambda: getTeluguWebSeriesByGenre(18))

@api_bp.route("/telugu/web-series/comedy")
def telugu_ws_comedy():
    return _run_list(lambda: getTeluguWebSeriesByGenre(35))

@api_bp.route("/telugu/web-series/crime")
def telugu_ws_crime():
    return _run_list(lambda: getTeluguWebSeriesByGenre(80))

@api_bp.route("/telugu/web-series/thriller")
def telugu_ws_thriller():
    return _run_list(lambda: getTeluguWebSeriesByGenre(53))

@api_bp.route("/telugu/web-series/romance")
def telugu_ws_romance():
    return _run_list(lambda: getTeluguWebSeriesByGenre(10749))

@api_bp.route("/telugu/web-series/action")
def telugu_ws_action():
    return _run_list(lambda: getTeluguWebSeriesByGenre(28))

@api_bp.route("/telugu/ott")
def telugu_ott():
    return _run_list(getTeluguOTT)

@api_bp.route("/telugu/classics")
def telugu_classics():
    return _run_list(getTeluguClassics)

@api_bp.route("/telugu/comedy")
def telugu_comedy():
    return _run_list(lambda: getTeluguByGenre(_GENRE_COMEDY))

@api_bp.route("/telugu/action")
def telugu_action():
    return _run_list(lambda: getTeluguByGenre(_GENRE_ACTION))

@api_bp.route("/telugu/romance")
def telugu_romance():
    return _run_list(lambda: getTeluguByGenre(_GENRE_ROMANCE))

@api_bp.route("/telugu/thriller")
def telugu_thriller():
    return _run_list(lambda: getTeluguByGenre(_GENRE_THRILLER))

@api_bp.route("/telugu/crime")
def telugu_crime():
    return _run_list(lambda: getTeluguByGenre(_GENRE_CRIME))

@api_bp.route("/telugu/family")
def telugu_family():
    return _run_list(lambda: getTeluguByGenre(_GENRE_FAMILY))

@api_bp.route("/telugu/horror")
def telugu_horror():
    return _run_list(lambda: getTeluguByGenre(_GENRE_HORROR))

@api_bp.route("/telugu/historical")
def telugu_historical():
    return _run_list(lambda: getTeluguByGenre(_GENRE_HISTORY))

@api_bp.route("/telugu/mythological")
def telugu_mythological():
    return _run_list(lambda: getTeluguByGenre(_GENRE_DRAMA))

@api_bp.route("/telugu/search")
def telugu_search():
    q = request.args.get("q", "").strip()
    if not q:
        return _fail("Missing query parameter: q", 400)
    return _run_list(lambda: searchTeluguMovies(q))


# ── TMDB movie detail ─────────────────────────────────────────

@api_bp.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    try:
        core    = getMovieCore(movie_id)
        details = core.get("details")
        if not details:
            return _fail("Movie not found", 404)
        details.pop("budget",  None)
        details.pop("revenue", None)
        return jsonify({
            "ok":      True,
            "details":   details,
            "credits":   core.get("credits")   or {},
            "images":    core.get("images")    or {},
            "providers": core.get("providers") or {},
            "similar":   core.get("similar")   or [],
        })
    except Exception as e:
        return _fail(str(e))


# ── Streaming availability + official YouTube trailer ────────


# ── TV / Web Series Detail ───────────────────────────────────────────

@api_bp.route("/tv/<int:tv_id>")
def tv_detail(tv_id):
    try:
        core = getTVCore(tv_id)
        details = core.get("details")
        if not details:
            return _fail("TV show not found", 404)
        return jsonify({
            "ok":          True,
            "details":     details,
            "credits":     core.get("credits")     or {},
            "images":      core.get("images")      or {},
            "videos":      core.get("videos")      or {},
            "providers":   core.get("providers")   or {},
            "similar":     core.get("similar")     or [],
            "recommended": core.get("recommended") or [],
        })
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/tv/<int:tv_id>/streaming")
def tv_streaming(tv_id):
    """OTT providers for a TV show — IN→US fallback."""
    print(f"[OTT] Loading OTT Providers for TV {tv_id}", flush=True)
    stream, rent, buy = [], [], []
    country = None
    jw_link = "https://www.justwatch.com/in/search?q=series"
    try:
        providers_data = getTVWatchProviders(tv_id)
        results = (providers_data or {}).get("results", {})
        region_data = None
        if results.get("IN"):
            region_data, country = results["IN"], "IN"
            print("[OTT] Country: IN", flush=True)
        elif results.get("US"):
            region_data, country = results["US"], "US"
            print("[OTT] Fallback: US", flush=True)
        else:
            for code, rdata in results.items():
                if isinstance(rdata, dict) and (rdata.get("flatrate") or rdata.get("rent") or rdata.get("buy")):
                    region_data, country = rdata, code
                    print(f"[OTT] Fallback: {code}", flush=True)
                    break
        if region_data:
            jw_link = region_data.get("link") or jw_link
            for p in (region_data.get("flatrate") or []):
                stream.append(_build_ott_provider(p, jw_link))
            for p in (region_data.get("rent") or []):
                rent.append(_build_ott_provider(p, jw_link))
            for p in (region_data.get("buy") or []):
                buy.append(_build_ott_provider(p, jw_link))
        print(f"[OTT] OTT Providers Received — stream:{len(stream)} rent:{len(rent)} buy:{len(buy)}", flush=True)
    except Exception as e:
        print(f"[OTT] TV provider fetch failed: {e}", flush=True)

    # YouTube trailer
    youtube_provider = None
    try:
        videos_data = getTVVideos(tv_id)
        yt_all   = [v for v in (videos_data or {}).get("results", []) if v.get("site") == "YouTube"]
        trailers = [v for v in yt_all if v.get("type") == "Trailer"]
        teasers  = [v for v in yt_all if v.get("type") == "Teaser"]
        best = (next((v for v in trailers if "official" in v.get("name","").lower()), None)
                or (trailers[0] if trailers else None)
                or (teasers[0]  if teasers  else None))
        if best:
            youtube_provider = {
                "id": "youtube", "name": "YouTube", "logo": None,
                "url": f"https://www.youtube.com/watch?v={best['key']}",
                "key": best["key"], "title": best.get("name") or "Watch on YouTube",
            }
    except Exception:
        pass

    return jsonify({"ok": True, "stream": stream, "rent": rent, "buy": buy,
                    "country": country, "link": jw_link, "youtube_provider": youtube_provider})


# ── OTT Streaming Availability ────────────────────────────────

def _build_ott_provider(p, link):
    logo = p.get("logo_path")
    return {
        "id":   p.get("provider_id"),
        "name": p.get("provider_name", ""),
        "logo": f"/api/tmdb-img/w92{logo}" if logo else None,
        "url":  link,
    }


@api_bp.route("/movie/<int:movie_id>/streaming")
def movie_streaming(movie_id):
    """Returns OTT providers split by stream/rent/buy with IN->US fallback + JustWatch link.
    Also detects if movie is free on YouTube and returns it as a provider."""
    print(f"[OTT] Loading OTT Providers for movie {movie_id}", flush=True)

    stream  = []
    rent    = []
    buy     = []
    country = None
    jw_link = f"https://www.justwatch.com/in/search?q=movie"

    try:
        providers_data = getWatchProviders(movie_id)
        results = (providers_data or {}).get("results", {})

        region_data = None
        if results.get("IN"):
            region_data = results["IN"]
            country = "IN"
            print("[OTT] Country: IN", flush=True)
        elif results.get("US"):
            region_data = results["US"]
            country = "US"
            print("[OTT] Fallback: US", flush=True)
        else:
            for code, rdata in results.items():
                if isinstance(rdata, dict) and (
                    rdata.get("flatrate") or rdata.get("rent") or rdata.get("buy")
                ):
                    region_data = rdata
                    country = code
                    print(f"[OTT] Fallback: {code}", flush=True)
                    break

        if region_data:
            jw_link = region_data.get("link") or jw_link
            for p in (region_data.get("flatrate") or []):
                stream.append(_build_ott_provider(p, jw_link))
            for p in (region_data.get("rent") or []):
                rent.append(_build_ott_provider(p, jw_link))
            for p in (region_data.get("buy") or []):
                buy.append(_build_ott_provider(p, jw_link))

        total = len(stream) + len(rent) + len(buy)
        print(f"[OTT] OTT Providers Received - stream:{len(stream)} rent:{len(rent)} buy:{len(buy)}", flush=True)
        print(f"[OTT] OTT Section Rendered - total:{total} country:{country}", flush=True)

    except Exception as e:
        print(f"[OTT] Provider fetch failed: {e}", flush=True)

    # ── YouTube free availability check ──────────────────────
    # Check TMDB videos for a free YouTube full movie link
    youtube_provider = None
    try:
        tmdb_videos = getMovieVideos(movie_id)
        yt_all = [v for v in (tmdb_videos or {}).get("results", []) if v.get("site") == "YouTube"]
        trailers = [v for v in yt_all if v.get("type") == "Trailer"]
        teasers  = [v for v in yt_all if v.get("type") == "Teaser"]
        best = (
            next((v for v in trailers if "official" in v.get("name", "").lower()), None)
            or (trailers[0] if trailers else None)
            or (teasers[0]  if teasers  else None)
        )
        if best:
            yt_url = f"https://www.youtube.com/watch?v={best['key']}"
            youtube_provider = {
                "id":   "youtube",
                "name": "YouTube",
                "logo": None,
                "url":  yt_url,
                "key":  best["key"],
                "title": best.get("name") or "Watch on YouTube",
            }
            print(f"[OTT] YouTube provider found: {yt_url}", flush=True)
    except Exception as e:
        print(f"[OTT] YouTube check failed: {e}", flush=True)

    return jsonify({
        "ok":               True,
        "stream":           stream,
        "rent":             rent,
        "buy":              buy,
        "country":          country,
        "link":             jw_link,
        "youtube_provider": youtube_provider,
    })


@api_bp.route("/movie/<int:movie_id>/videos")
def movie_videos(movie_id):
    """TMDB videos — returns filtered list + best trailer pick. Falls back to YouTube API."""
    print(f"[Videos] Fetching movie videos: TMDB id={movie_id}", flush=True)
    try:
        data = getMovieVideos(movie_id)
        print(f"[Videos] TMDB raw response: {data}", flush=True)

        all_videos = (data or {}).get("results", [])
        print(f"[Videos] Total videos from TMDB: {len(all_videos)}", flush=True)
        for v in all_videos:
            print(f"[Videos]   site={v.get('site')} type={v.get('type')} key={v.get('key')} name={v.get('name')!r}", flush=True)

        yt_all      = [v for v in all_videos if v.get("site") == "YouTube"]
        yt_trailers = [v for v in yt_all if v.get("type") in ("Trailer", "Official Trailer")]
        yt_teasers  = [v for v in yt_all if v.get("type") == "Teaser"]

        trailer = (
            next((v for v in yt_trailers if "official" in v.get("name", "").lower()), None)
            or (yt_trailers[0] if yt_trailers else None)
            or (yt_teasers[0]  if yt_teasers  else None)
        )

        # YouTube API fallback if TMDB has no trailer
        if not trailer:
            try:
                det = getMovieDetails(movie_id)
                movie_title = (det or {}).get("title") or ""
                if movie_title:
                    print(f"[Videos] TMDB trailer missing — falling back to YouTube API for {movie_title!r}", flush=True)
                    yt_results = searchOfficialTrailer(movie_title)
                    if yt_results:
                        v = yt_results[0]
                        trailer = {"key": v["videoId"], "name": v.get("title") or "Official Trailer",
                                   "type": "Trailer", "site": "YouTube"}
            except Exception as e:
                print(f"[Videos] YouTube fallback failed: {e}", flush=True)

        if trailer:
            print(f"[Videos] Valid trailer found: key={trailer.get('key')} name={trailer.get('name')!r}", flush=True)
        else:
            print(f"[Videos] No valid trailer found for movie {movie_id}", flush=True)

        trailer_out = {"key": trailer["key"], "name": trailer.get("name") or "Main Trailer",
                       "type": trailer.get("type"), "site": "YouTube"} if trailer else None

        videos_out = yt_trailers + yt_teasers
        return jsonify({"ok": True, "videos": videos_out, "trailer": trailer_out})
    except Exception as e:
        print(f"[Videos] Exception for movie {movie_id}: {e}", flush=True)
        return jsonify({"ok": False, "videos": [], "trailer": None, "error": str(e)})


# ── YouTube ───────────────────────────────────────────────────

def _q():
    return request.args.get("q", "").strip()

@api_bp.route("/youtube/trailer")
def yt_trailer():
    name = _q()
    if not name:
        return _fail("Missing q", 400)
    results = searchOfficialTrailer(name)
    return jsonify({"ok": True, "results": results, "video": results[0] if results else None})

@api_bp.route("/youtube/teaser")
def yt_teaser():
    name = _q(); return _ok(searchOfficialTeaser(name)) if name else _fail("Missing q", 400)

@api_bp.route("/youtube/behind")
def yt_behind():
    name = _q(); return _ok(searchBehindTheScenes(name)) if name else _fail("Missing q", 400)

@api_bp.route("/youtube/interviews")
def yt_interviews():
    name = _q(); return _ok(searchCastInterviews(name)) if name else _fail("Missing q", 400)

@api_bp.route("/youtube/featurettes")
def yt_featurettes():
    name = _q(); return _ok(searchFeaturettes(name)) if name else _fail("Missing q", 400)

@api_bp.route("/youtube/deleted")
def yt_deleted():
    name = _q(); return _ok(searchDeletedScenes(name)) if name else _fail("Missing q", 400)

@api_bp.route("/youtube/songs")
def yt_songs():
    name = _q(); return _ok(searchMovieSongs(name)) if name else _fail("Missing q", 400)


# ── Serper ────────────────────────────────────────────────────

@api_bp.route("/reviews/<path:movie_name>")
def serper_reviews(movie_name):
    return jsonify({"ok": True, "results": getMovieReviews(movie_name)})

@api_bp.route("/news/<path:movie_name>")
def serper_news(movie_name):
    return jsonify({"ok": True, "results": getMovieNews(movie_name)})

@api_bp.route("/articles/<path:movie_name>")
def serper_articles(movie_name):
    return jsonify({"ok": True, "results": getMovieArticles(movie_name)})

@api_bp.route("/boxoffice/<path:movie_name>")
def serper_boxoffice(movie_name):
    return jsonify({"ok": True, "results": getMovieBoxOffice(movie_name)})

@api_bp.route("/latestnews/<path:movie_name>")
def serper_latestnews(movie_name):
    return jsonify({"ok": True, "results": getMovieLatestNews(movie_name)})

@api_bp.route("/aireview/<path:movie_name>")
def ai_review(movie_name):
    release_date = request.args.get("release_date", "").strip() or None
    status       = request.args.get("status", "").strip() or None
    data = getAIReviewSummary(movie_name, release_date=release_date, status=status)
    if not data:
        return jsonify({"ok": False, "result": None}), 200
    if data.get("unreleased"):
        return jsonify({"ok": False, "result": None, "unreleased": True}), 200
    return jsonify({"ok": True, "result": data})


# ── AI Search Agent ───────────────────────────────────────────────

@api_bp.route("/ai/search", methods=["POST"])
def ai_search():
    d     = request.get_json(silent=True) or {}
    query = (d.get("query") or "").strip()
    if not query:
        return _fail("query required", 400)
    try:
        result = aiSearch(query)
        return jsonify({"ok": True, **result})
    except Exception as e:
        return _fail(str(e))


# ── AI Recommendation Agent ─────────────────────────────────

@api_bp.route("/ai/recommend", methods=["POST"])
def ai_recommend():
    d        = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    if not movie_id:
        return _fail("movie_id required", 400)
    try:
        movie_id = int(movie_id)
        core     = getMovieCore(movie_id)
        details  = core.get("details")
        if not details:
            return _fail("Movie not found", 404)

        credits   = core.get("credits")  or {}
        similar   = core.get("similar")   or []

        # Also fetch TMDB recommendations
        try:
            from services.tmdb import getMovieRecommendations
            tmdb_recs = getMovieRecommendations(movie_id)
        except Exception:
            tmdb_recs = []

        result = getAIRecommendations(movie_id, details, credits, similar, tmdb_recs)
        if not result:
            return jsonify({"ok": False, "result": None}), 200
        return jsonify({"ok": True, "result": result})
    except Exception as e:
        return _fail(str(e))


# ── Person / Actor ───────────────────────────────────────────

@api_bp.route("/person/<int:person_id>")
def person_detail(person_id):
    try:
        from services.person import getPersonDetails
        details = getPersonDetails(person_id)
        if not details:
            return _fail("Person not found", 404)

        GENDER = {0: "Unknown", 1: "Female", 2: "Male", 3: "Non-binary"}
        person = {
            "id":          details.get("id"),
            "name":        details.get("name"),
            "biography":   details.get("biography") or "",
            "birthday":    details.get("birthday"),
            "birthplace":  details.get("place_of_birth"),
            "gender":      GENDER.get(details.get("gender", 0), "Unknown"),
            "popularity":  round(details.get("popularity") or 0, 1),
            "profile_url": details.get("profile_url"),
            "known_for":   details.get("known_for_department"),
            "also_known_as": details.get("also_known_as") or [],
        }
        return jsonify({"ok": True, "person": person})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/person/<int:person_id>/collaborators")
def person_collaborators(person_id):
    try:
        movie_credits = getPersonCore(person_id).get("movie_credits") or {}
        from services.person import enrichMovieCredits
        enriched = enrichMovieCredits(movie_credits)
        collabs = getCollaborators(person_id, enriched)
        return jsonify({"ok": True, "result": collabs})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/person/<int:person_id>/similar")
def person_similar(person_id):
    try:
        movie_credits = getPersonCore(person_id).get("movie_credits") or {}
        from services.person import enrichMovieCredits
        enriched = enrichMovieCredits(movie_credits)
        similar = getSimilarActors(person_id, enriched)
        return jsonify({"ok": True, "results": similar})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/person/<int:person_id>/credits")
def person_credits(person_id):
    try:
        from services.person import getPersonCombinedCredits, _enrich_movie
        raw  = getPersonCombinedCredits(person_id)
        cast = raw.get("cast", [])

        credits = []
        seen = set()
        for item in cast:
            uid = f"{item.get('id')}_{item.get('media_type')}"
            if uid in seen:
                continue
            seen.add(uid)
            item = dict(item)
            item = _enrich_movie(item)
            credits.append(item)

        return jsonify({"ok": True, "credits": credits})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/person/search")
def person_search():
    q = request.args.get("q", "").strip()
    if not q:
        return _fail("Missing q", 400)
    return jsonify({"ok": True, "results": searchPerson(q)})


@api_bp.route("/person/<int:person_id>/images")
def person_images(person_id):
    try:
        from services.person import getPersonImages
        data = getPersonImages(person_id)
        profiles = data.get("profiles", [])
        enriched = []
        for img in profiles:
            fp = img.get("file_path")
            if fp:
                enriched.append({
                    "file_path":   fp,
                    "url":         f"/api/tmdb-img/w500{fp}",
                    "url_orig":    f"/api/tmdb-img/original{fp}",
                    "width":       img.get("width"),
                    "height":      img.get("height"),
                    "vote_average":img.get("vote_average", 0),
                })
        enriched.sort(key=lambda x: x["vote_average"], reverse=True)
        return jsonify({"ok": True, "images": enriched})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/person/<int:person_id>/news")
def person_news(person_id):
    name = request.args.get("name", "").strip()
    if not name:
        return _fail("name required", 400)
    from services.serper import _search, _news_items, _organic
    data = _search(f"{name} Telugu actor latest news", num=8)
    items = _news_items(data) or _organic(data)
    results = [{
        "title":   item.get("title", ""),
        "link":    item.get("link", ""),
        "source":  item.get("source") or item.get("displayLink", ""),
        "date":    item.get("date", ""),
        "snippet": item.get("snippet", ""),
        "image":   item.get("imageUrl") or item.get("thumbnailUrl"),
    } for item in items[:8]]
    return jsonify({"ok": True, "results": results})


@api_bp.route("/person/<int:person_id>/videos")
def person_videos(person_id):
    name = request.args.get("name", "").strip()
    if not name:
        return _fail("name required", 400)
    from services.youtube import _search
    tabs = {
        "interviews":   f"{name} interview Telugu",
        "press_meets":  f"{name} press meet Telugu",
        "behind":       f"{name} behind the scenes",
        "promotions":   f"{name} movie promotions Telugu",
        "awards":       f"{name} award function Telugu",
        "speeches":     f"{name} speech Telugu",
    }
    results = {}
    for tab, query in tabs.items():
        results[tab] = _search(query, max_results=5)
    return jsonify({"ok": True, "results": results})


# ── Recommendations ───────────────────────────────────────────

@api_bp.route("/recommend/<int:movie_id>")
def recommend_movie(movie_id):
    return jsonify({"ok": True, "results": recommendForMovie(movie_id)})


@api_bp.route("/movie/<int:movie_id>/recommendations")
def movie_recommendations(movie_id):
    """Combined endpoint: similar, genre, actor, director, recommended — all Telugu."""
    try:
        data = getMovieRecommendationsGrouped(movie_id)
        return jsonify({"ok": True, **data})
    except Exception as e:
        return _fail(str(e))


@api_bp.route("/recommend/<int:movie_id>/grouped")
def recommend_movie_grouped(movie_id):
    """Returns genre / actor / director buckets separately with labels."""
    from services.recommendation import (
        recommendByGenre, recommendByCast, recommendByDirector,
        recommendBySimilarMovies,
    )
    from services.tmdb import getMovieDetails, getMovieCredits
    try:
        details = getMovieDetails(movie_id)
        credits = getMovieCredits(movie_id) or {}

        genres   = [g["name"] for g in (details or {}).get("genres", [])][:2]
        crew     = credits.get("crew", [])
        cast     = credits.get("cast", [])
        director = next((p["name"] for p in crew if p.get("job") == "Director"), None)
        lead_actor = cast[0]["name"] if cast else None

        seen = {movie_id}

        def _dedup_bucket(movies):
            out = []
            for m in movies:
                if m.get("id") and m["id"] not in seen:
                    seen.add(m["id"])
                    out.append(m)
            return out[:12]

        genre_movies    = _dedup_bucket(recommendByGenre(movie_id))
        actor_movies    = _dedup_bucket(recommendByCast(movie_id))
        director_movies = _dedup_bucket(recommendByDirector(movie_id))
        similar_movies  = _dedup_bucket(recommendBySimilarMovies(movie_id))

        return jsonify({
            "ok": True,
            "genre":    {"label": ", ".join(genres) if genres else "Same Genre",    "movies": genre_movies},
            "actor":    {"label": lead_actor or "Same Cast",                         "movies": actor_movies},
            "director": {"label": director or "Same Director",                       "movies": director_movies},
            "similar":  {"label": "Similar Movies",                                  "movies": similar_movies},
        })
    except Exception as e:
        return _fail(str(e))

@api_bp.route("/recommend/personalized")
def recommend_personalized():
    def _ids(key):
        raw = request.args.get(key, "")
        return [int(x) for x in raw.split(",") if x.isdigit()] if raw else []
    return jsonify({"ok": True, "results": recommendPersonalized(
        _ids("history"), _ids("favorites"), _ids("watchlist"))})

@api_bp.route("/recommend/trending")
def recommend_trending():
    return jsonify({"ok": True, "results": recommendTrending()})

@api_bp.route("/recommend/top-rated")
def recommend_top_rated():
    return jsonify({"ok": True, "results": recommendTopRated()})
