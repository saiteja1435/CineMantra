import sys
import logging
import os
from dotenv import load_dotenv

# Force UTF-8 on Windows terminal to prevent UnicodeEncodeError on movie titles
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Must run before any other import that reads env vars
load_dotenv(override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_key = os.getenv("TMDB_API_KEY", "")
if _key:
    logger.info("TMDB API Key Loaded: YES  |  Length: %d", len(_key))
else:
    logger.error("TMDB API Key Loaded: NO — add TMDB_API_KEY to .env and restart")

from flask import Flask

app = Flask(__name__)
app.config.from_object("config.Config")

from routes.home import home_bp
from routes.api import api_bp
from routes.watchlist import wl_bp
from database.db import init_db

with app.app_context():
    init_db()

app.register_blueprint(home_bp)
app.register_blueprint(api_bp, url_prefix="/api")
app.register_blueprint(wl_bp)

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"])
