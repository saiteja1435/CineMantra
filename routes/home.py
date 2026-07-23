from flask import Blueprint, render_template
from services.tmdb import getMovieDetails

home_bp = Blueprint("home", __name__)


def _browse(api_url, title, subtitle, icon="🎬"):
    return render_template("browse.html",
        api_url=api_url, page_title=title,
        page_subtitle=subtitle, page_icon=icon)


@home_bp.route("/")
def index():
    return render_template("index.html")


@home_bp.route("/movies")
def movies_page():
    return _browse("/api/movies/popular", "Movies", "All-time crowd favourites", "🎬")


@home_bp.route("/trending")
def trending_page():
    return _browse("/api/movies/trending", "Trending", "Most watched movies right now", "🔥")


@home_bp.route("/new-releases")
def new_releases_page():
    return _browse("/api/movies/now-playing", "New Releases", "Latest movies in theatres", "🆕")


@home_bp.route("/top-rated")
def top_rated_page():
    return _browse("/api/movies/top-rated", "Top Rated", "Critically acclaimed cinema", "⭐")


@home_bp.route("/upcoming")
def upcoming_page():
    return _browse("/api/movies/upcoming", "Upcoming", "New & upcoming releases", "📅")


@home_bp.route("/history")
def history_page():
    return render_template("watchlist.html")


@home_bp.route("/genres")
def genres_page():
    return _browse("/api/telugu/action", "Telugu Genres", "Browse Telugu movies by genre", "🎭")


@home_bp.route("/ott")
def ott_page():
    return _browse("/api/ott/trending", "Now Trending on OTT", "Netflix · Prime · Hotstar లో trending", "📺")


@home_bp.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    og = {}
    try:
        d = getMovieDetails(movie_id) or {}
        og["title"]       = d.get("title") or "CineMantra"
        og["description"] = (d.get("overview") or "")[:200]
        og["image"]       = d.get("backdrop_url") or d.get("poster_url") or ""
        og["url"]         = f"https://cinemantra.app/movie/{movie_id}"
    except Exception:
        pass
    return render_template("movie.html", movie_id=movie_id, og=og)


@home_bp.route("/calendar")
def calendar_page():
    return render_template("calendar.html")


@home_bp.route("/offline")
def offline_page():
    return render_template("offline.html")


@home_bp.route("/search")
def search_page():
    return render_template("search.html")


@home_bp.route("/person/<int:person_id>")
def person_page(person_id):
    return render_template("person.html", person_id=person_id)


@home_bp.route("/celebrities")
def celebrities_page():
    return render_template("celebrities.html")


@home_bp.route("/webseries")
def webseries_page():
    return render_template("webseries.html")


@home_bp.route("/webseries/<int:tv_id>")
def webseries_detail(tv_id):
    return render_template("webseries_detail.html", tv_id=tv_id)
