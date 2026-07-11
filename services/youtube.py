import os
import re
import time
import logging
import requests
from dotenv import load_dotenv

load_dotenv(override=True)

_BASE  = "https://www.googleapis.com/youtube/v3"
_cache: dict = {}
_TTL   = 600  # 10 minutes

logger = logging.getLogger(__name__)


def _api_key() -> str:
    return os.getenv("YOUTUBE_API_KEY", "")


def _log(msg: str):
    """Safe print that never crashes on Windows cp1252."""
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _parse_duration(iso: str) -> str:
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return ""
    h, mn, s = (int(x or 0) for x in m.groups())
    return f"{h}:{mn:02d}:{s:02d}" if h else f"{mn}:{s:02d}"


def _search(query: str, max_results: int = 5) -> list:
    key = _api_key()

    _log(f"[YouTube] API Key Loaded: {'YES' if key else 'NO'}  |  Length: {len(key)}")

    if not key:
        _log("[YouTube] ERROR: YOUTUBE_API_KEY is empty — aborting")
        return []

    cache_key = f"yt:{query}:{max_results}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _TTL:
            _log(f"[YouTube] Cache HIT: {query}")
            return data

    _log(f"[YouTube] Search Query: {query}")

    try:
        resp = requests.get(
            f"{_BASE}/search",
            params={
                "key":            key,
                "q":              query,
                "part":           "snippet",
                "type":           "video",
                "maxResults":     max_results,
                "videoEmbeddable":"true",
            },
            timeout=10,
        )
        _log(f"[YouTube] HTTP Status: {resp.status_code}")

        if resp.status_code == 403:
            _log(f"[YouTube] 403 Forbidden — quota exceeded or API key invalid. Body: {resp.text[:300]}")
            return []
        if resp.status_code != 200:
            _log(f"[YouTube] Error {resp.status_code}: {resp.text[:300]}")
            return []

        body  = resp.json()
        items = body.get("items", [])
        _log(f"[YouTube] Items returned: {len(items)}")

        if not items:
            return []

        # Fetch durations
        video_ids = ",".join(i["id"]["videoId"] for i in items)
        dur_resp  = requests.get(
            f"{_BASE}/videos",
            params={"key": key, "id": video_ids, "part": "contentDetails"},
            timeout=10,
        )
        durations = {}
        if dur_resp.status_code == 200:
            for v in dur_resp.json().get("items", []):
                durations[v["id"]] = _parse_duration(v["contentDetails"]["duration"])

        results = []
        for item in items:
            vid_id = item["id"]["videoId"]
            snip   = item["snippet"]
            results.append({
                "videoId":     vid_id,
                "title":       snip.get("title", ""),
                "thumbnail":   snip.get("thumbnails", {}).get("medium", {}).get("url", ""),
                "channel":     snip.get("channelTitle", ""),
                "publishedAt": snip.get("publishedAt", "")[:10],
                "duration":    durations.get(vid_id, ""),
            })
            _log(f"[YouTube]   → {vid_id} | {snip.get('title','')[:60]}")

        _cache[cache_key] = (now, results)
        return results

    except requests.exceptions.Timeout:
        _log(f"[YouTube] Timeout on query: {query}")
        return []
    except Exception as e:
        _log(f"[YouTube] Exception: {e}")
        return []


def _first_result(queries: list) -> list:
    for q in queries:
        results = _search(q)
        if results:
            return results
    return []


# ── Public API ────────────────────────────────────────────────

def _is_valid_trailer(video: dict, movie_name: str) -> bool:
    """Title must contain at least one movie name keyword."""
    title = video.get("title", "").lower()
    name_words = [w for w in movie_name.lower().split() if len(w) > 2]
    return any(w in title for w in name_words)


def searchOfficialTrailer(movie_name: str) -> list:
    queries = [
        f"{movie_name} official trailer",
        f"{movie_name} trailer",
        f"{movie_name} official teaser",
    ]
    print(f"[YouTube] Fetching movie videos: trailer for {movie_name!r}", flush=True)
    for q in queries:
        results = _search(q, max_results=5)
        valid = [v for v in results if _is_valid_trailer(v, movie_name)]
        if valid:
            print(f"[YouTube] Valid trailer found: {valid[0].get('title')!r}", flush=True)
            return valid
    return []


def searchOfficialTeaser(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Official Teaser",
        f"{movie_name} Teaser Trailer",
        f"{movie_name} Teaser",
    ])


def searchBehindTheScenes(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Behind The Scenes",
        f"{movie_name} Making Of",
        f"{movie_name} Production Diary",
    ])


def searchCastInterviews(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Cast Interview",
        f"{movie_name} Director Interview",
        f"{movie_name} Press Meet",
    ])


def searchFeaturettes(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Featurette",
        f"{movie_name} Clip",
        f"{movie_name} Exclusive Clip",
    ])


def searchDeletedScenes(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Deleted Scenes",
        f"{movie_name} Extended Scene",
        f"{movie_name} Bonus Scene",
    ])


_OFFICIAL_MUSIC_CHANNELS = {
    "t-series", "aditya music", "saregama", "sony music south",
    "lahari music", "mango music", "sony music india", "zee music company",
    "tips official", "speed records",
}

_SONG_KEYWORDS = {"song", "songs", "lyrical", "jukebox", "audio", "full album", "ost", "soundtrack"}
_REJECT_KEYWORDS = {"interview", "review", "trailer", "teaser", "making", "behind", "press meet",
                    "reaction", "analysis", "explained", "deleted", "scene", "clip"}


def _is_valid_song(video: dict, movie_name: str) -> bool:
    """Accept video only if it's clearly a song for this movie."""
    title   = video.get("title", "").lower()
    channel = video.get("channel", "").lower()

    # Reject if title contains reject keywords
    if any(kw in title for kw in _REJECT_KEYWORDS):
        return False

    # Check movie name keywords present in title
    name_words = [w for w in movie_name.lower().split() if len(w) > 2]
    name_match = any(w in title for w in name_words)

    # Accept if official music channel
    if any(ch in channel for ch in _OFFICIAL_MUSIC_CHANNELS):
        return name_match  # still require movie name in title

    # Otherwise require both movie name AND song keyword
    has_song_kw = any(kw in title for kw in _SONG_KEYWORDS)
    return name_match and has_song_kw


def searchMovieSongs(movie_name: str) -> list:
    queries = [
        f"{movie_name} songs official",
        f"{movie_name} jukebox",
        f"{movie_name} lyrical video",
    ]
    print(f"[YouTube] Fetching movie videos: songs for {movie_name!r}", flush=True)
    for q in queries:
        results = _search(q, max_results=8)
        valid = [v for v in results if _is_valid_song(v, movie_name)]
        if valid:
            print(f"[YouTube] Valid songs found: {len(valid)} for query {q!r}", flush=True)
            return valid
    print(f"[YouTube] No valid songs found for {movie_name!r}", flush=True)
    return []


# ── Telugu-specific search ──────────────────────────────────────────

def searchTeluguTrailer(movie_name: str) -> list:
    return _first_result([
        f"{movie_name} Telugu Official Trailer",
        f"{movie_name} Telugu Trailer",
        f"{movie_name} Official Trailer",
        f"{movie_name} Trailer",
    ])

def searchTeluguSongs(movie_name: str) -> list:
    queries = [
        f"{movie_name} Telugu songs official",
        f"{movie_name} jukebox",
        f"{movie_name} lyrical video",
    ]
    print(f"[YouTube] Fetching movie videos: Telugu songs for {movie_name!r}", flush=True)
    for q in queries:
        results = _search(q, max_results=8)
        valid = [v for v in results if _is_valid_song(v, movie_name)]
        if valid:
            print(f"[YouTube] Valid songs found: {len(valid)} for query {q!r}", flush=True)
            return valid
    print(f"[YouTube] No valid Telugu songs found for {movie_name!r}", flush=True)
    return []
