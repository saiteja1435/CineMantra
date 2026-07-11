from flask import Blueprint, jsonify, request, render_template
from database.db import (
    wl_get_all, wl_get_one, wl_add, wl_remove,
    wl_toggle_favorite, wl_toggle_watched,
    wl_rate, wl_set_notes, wl_set_collection, wl_add_full,
    recent_add, recent_get,
    prefs_get, prefs_save,
)

wl_bp = Blueprint("watchlist", __name__)


# ── Page ──────────────────────────────────────────────────────

@wl_bp.route("/watchlist")
def watchlist_page():
    return render_template("watchlist.html")


# ── Existing APIs (unchanged) ─────────────────────────────────

@wl_bp.route("/api/watchlist")
def api_get():
    return jsonify({"ok": True, "results": wl_get_all()})


@wl_bp.route("/api/watchlist/status/<int:movie_id>")
def api_status(movie_id):
    item = wl_get_one(movie_id)
    return jsonify({"ok": True, "item": item})


@wl_bp.route("/api/watchlist/add", methods=["POST"])
def api_add():
    d            = request.get_json(silent=True) or {}
    movie_id     = d.get("movie_id")
    title        = d.get("title", "")
    poster       = d.get("poster", "")
    backdrop     = d.get("backdrop", "")
    rating       = d.get("rating", 0)
    release_date = d.get("release_date", "")
    genres       = d.get("genres", "")
    language     = d.get("language", "")
    runtime      = d.get("runtime", 0)
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    # Use extended add if extra fields provided, else basic add
    if genres or language or runtime:
        added = wl_add_full(int(movie_id), title, poster, backdrop,
                            rating, release_date, genres, language, runtime)
    else:
        added = wl_add(int(movie_id), title, poster, backdrop, rating, release_date)
    item = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "added": added, "item": item})


@wl_bp.route("/api/watchlist/remove", methods=["POST"])
def api_remove():
    d = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    wl_remove(int(movie_id))
    return jsonify({"ok": True})


@wl_bp.route("/api/watchlist/favorite", methods=["POST"])
def api_favorite():
    d = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    if not wl_get_one(int(movie_id)):
        wl_add(int(movie_id), d.get("title", ""), d.get("poster", ""),
               d.get("backdrop", ""), d.get("rating", 0), d.get("release_date", ""))
    result = wl_toggle_favorite(int(movie_id))
    item   = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "favorite": result, "item": item})


@wl_bp.route("/api/watchlist/watched", methods=["POST"])
def api_watched():
    d = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    result = wl_toggle_watched(int(movie_id))
    item   = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "watched": result, "item": item})


# ── New: Rate ─────────────────────────────────────────────────

@wl_bp.route("/api/watchlist/rate", methods=["POST"])
def api_rate():
    d = request.get_json(silent=True) or {}
    movie_id    = d.get("movie_id")
    user_rating = d.get("user_rating")
    if not movie_id or user_rating is None:
        return jsonify({"ok": False, "error": "movie_id and user_rating required"}), 400
    wl_rate(int(movie_id), float(user_rating))
    item = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "item": item})


# ── New: Notes ────────────────────────────────────────────────

@wl_bp.route("/api/watchlist/notes", methods=["POST"])
def api_notes():
    d = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    notes    = d.get("notes", "")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    wl_set_notes(int(movie_id), notes)
    item = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "item": item})


# ── New: Collection ───────────────────────────────────────────

@wl_bp.route("/api/watchlist/collection", methods=["POST"])
def api_collection():
    d = request.get_json(silent=True) or {}
    movie_id   = d.get("movie_id")
    collection = d.get("collection", "")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    wl_set_collection(int(movie_id), collection)
    item = wl_get_one(int(movie_id))
    return jsonify({"ok": True, "item": item})


# ── New: AI Taste Summary ─────────────────────────────────────

@wl_bp.route("/api/watchlist/summary")
def api_summary():
    from services.ai_watchlist import analyzeTaste
    items  = wl_get_all()
    result = analyzeTaste(items)
    # Persist to DB
    try:
        import json as _json
        prefs_save(
            result.get("taste_summary", ""),
            result.get("favorite_genres", []),
            result.get("favorite_actors", []),
            result.get("favorite_directors", []),
            result.get("preferred_runtime", ""),
            result.get("preferred_years", ""),
            result.get("mood", ""),
        )
    except Exception:
        pass
    return jsonify({"ok": True, "result": result})


# ── New: AI Personalized Recommendations ─────────────────────

@wl_bp.route("/api/watchlist/recommendations")
def api_recommendations():
    from services.ai_watchlist import analyzeTaste, getPersonalizedRecs
    items = wl_get_all()
    if not items:
        return jsonify({"ok": False, "result": None})
    taste  = analyzeTaste(items)
    result = getPersonalizedRecs(items, taste)
    return jsonify({"ok": True, "result": result})


# ── Recent ────────────────────────────────────────────────────

@wl_bp.route("/api/recent", methods=["GET"])
def api_recent_get():
    return jsonify({"ok": True, "results": recent_get(20)})


@wl_bp.route("/api/recent/add", methods=["POST"])
def api_recent_add():
    d = request.get_json(silent=True) or {}
    movie_id = d.get("movie_id")
    if not movie_id:
        return jsonify({"ok": False, "error": "movie_id required"}), 400
    recent_add(
        int(movie_id),
        d.get("title", ""),
        d.get("poster", ""),
        d.get("backdrop", ""),
        d.get("rating", 0),
        d.get("release_date", ""),
    )
    return jsonify({"ok": True})
