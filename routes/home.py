from flask import Blueprint, render_template

home_bp = Blueprint("home", __name__)


@home_bp.route("/")
def index():
    return render_template("index.html")


@home_bp.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    return render_template("movie.html", movie_id=movie_id)


@home_bp.route("/search")
def search_page():
    return render_template("search.html")


@home_bp.route("/person/<int:person_id>")
def person_page(person_id):
    return render_template("person.html", person_id=person_id)
