import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cinemantra.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS watchlist (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id      TEXT    NOT NULL DEFAULT 'local',
            movie_id     INTEGER NOT NULL,
            title        TEXT    NOT NULL,
            poster       TEXT,
            backdrop     TEXT,
            rating       REAL    DEFAULT 0,
            release_date TEXT,
            status       TEXT    DEFAULT 'watching',
            created_at   TEXT    DEFAULT (datetime('now')),
            favorite     INTEGER DEFAULT 0,
            watched      INTEGER DEFAULT 0,
            user_rating  REAL    DEFAULT 0,
            notes        TEXT    DEFAULT '',
            collection   TEXT    DEFAULT '',
            genres       TEXT    DEFAULT '',
            language     TEXT    DEFAULT '',
            runtime      INTEGER DEFAULT 0
        )
    """)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_watchlist_user_movie ON watchlist(user_id, movie_id)")
    # Add new columns to existing watchlist table if they don't exist yet
    for col, definition in [
        ("user_id",     "TEXT DEFAULT 'local'"),
        ("user_rating", "REAL DEFAULT 0"),
        ("notes",       "TEXT DEFAULT ''"),
        ("collection",  "TEXT DEFAULT ''"),
        ("genres",      "TEXT DEFAULT ''"),
        ("language",    "TEXT DEFAULT ''"),
        ("runtime",     "INTEGER DEFAULT 0"),
    ]:
        try:
            conn.execute(f"ALTER TABLE watchlist ADD COLUMN {col} {definition}")
        except Exception:
            pass  # column already exists
    conn.execute("""
        CREATE TABLE IF NOT EXISTS recent (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    TEXT    NOT NULL DEFAULT 'local',
            movie_id   INTEGER NOT NULL,
            title      TEXT    NOT NULL,
            poster     TEXT,
            backdrop   TEXT,
            rating     REAL    DEFAULT 0,
            release_date TEXT,
            viewed_at  TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_recent_user_movie ON recent(user_id, movie_id)")
    for col, definition in [("user_id", "TEXT DEFAULT 'local'")]:
        try:
            conn.execute(f"ALTER TABLE recent ADD COLUMN {col} {definition}")
        except Exception:
            pass
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id            TEXT    NOT NULL DEFAULT 'local',
            taste_summary      TEXT    DEFAULT '',
            favorite_genres    TEXT    DEFAULT '',
            favorite_actors TEXT    DEFAULT '',
            favorite_directors TEXT DEFAULT '',
            preferred_runtime  TEXT DEFAULT '',
            preferred_years    TEXT DEFAULT '',
            mood               TEXT DEFAULT '',
            updated_at         TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     TEXT    NOT NULL DEFAULT 'local',
            query       TEXT    NOT NULL,
            searched_at TEXT    DEFAULT (datetime('now'))
        )
    """)
    for col, definition in [("user_id", "TEXT DEFAULT 'local'")]:
        try:
            conn.execute(f"ALTER TABLE search_history ADD COLUMN {col} {definition}")
        except Exception:
            pass
    conn.commit()
    conn.close()


def _row_to_dict(row):
    return dict(row) if row else None


# ── Watchlist ─────────────────────────────────────────────────

def wl_get_all(user_id="local"):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM watchlist WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def wl_get_one(movie_id: int, user_id="local"):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM watchlist WHERE movie_id = ? AND user_id = ?", (movie_id, user_id)
    ).fetchone()
    conn.close()
    return _row_to_dict(row)


def wl_add(movie_id, title, poster, backdrop, rating, release_date, user_id="local"):
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO watchlist (user_id, movie_id, title, poster, backdrop, rating, release_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, movie_id, title, poster or "", backdrop or "", rating or 0, release_date or ""))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def wl_remove(movie_id: int, user_id="local"):
    conn = get_db()
    conn.execute("DELETE FROM watchlist WHERE movie_id = ? AND user_id = ?", (movie_id, user_id))
    conn.commit()
    conn.close()


def wl_toggle_favorite(movie_id: int, user_id="local"):
    conn = get_db()
    row = conn.execute(
        "SELECT favorite FROM watchlist WHERE movie_id = ? AND user_id = ?", (movie_id, user_id)
    ).fetchone()
    if not row:
        conn.close()
        return None
    new_val = 0 if row["favorite"] else 1
    conn.execute(
        "UPDATE watchlist SET favorite = ? WHERE movie_id = ? AND user_id = ?", (new_val, movie_id, user_id)
    )
    conn.commit()
    conn.close()
    return bool(new_val)


def wl_toggle_watched(movie_id: int, user_id="local"):
    conn = get_db()
    row = conn.execute(
        "SELECT watched, status FROM watchlist WHERE movie_id = ? AND user_id = ?", (movie_id, user_id)
    ).fetchone()
    if not row:
        conn.close()
        return None
    new_watched = 0 if row["watched"] else 1
    new_status  = "completed" if new_watched else "watching"
    conn.execute(
        "UPDATE watchlist SET watched = ?, status = ? WHERE movie_id = ? AND user_id = ?",
        (new_watched, new_status, movie_id, user_id)
    )
    conn.commit()
    conn.close()
    return bool(new_watched)


# ── Recent ────────────────────────────────────────────────────

def recent_add(movie_id, title, poster, backdrop, rating, release_date, user_id="local"):
    conn = get_db()
    conn.execute("""
        INSERT INTO recent (user_id, movie_id, title, poster, backdrop, rating, release_date, viewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, movie_id) DO UPDATE SET viewed_at = datetime('now')
    """, (user_id, movie_id, title, poster or "", backdrop or "", rating or 0, release_date or ""))
    conn.commit()
    conn.close()


def recent_get(limit=20, user_id="local"):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM recent WHERE user_id = ? ORDER BY viewed_at DESC LIMIT ?", (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Extended watchlist ops ────────────────────────────────────

def wl_rate(movie_id: int, user_rating: float, user_id="local"):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET user_rating = ? WHERE movie_id = ? AND user_id = ?",
        (round(float(max(0, min(10, user_rating))), 1), movie_id, user_id)
    )
    conn.commit()
    conn.close()


def wl_set_notes(movie_id: int, notes: str, user_id="local"):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET notes = ? WHERE movie_id = ? AND user_id = ?",
        ((notes or "")[:1000], movie_id, user_id)
    )
    conn.commit()
    conn.close()


def wl_set_collection(movie_id: int, collection: str, user_id="local"):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET collection = ? WHERE movie_id = ? AND user_id = ?",
        ((collection or "").strip()[:100], movie_id, user_id)
    )
    conn.commit()
    conn.close()


def wl_add_full(movie_id, title, poster, backdrop, rating, release_date,
                genres="", language="", runtime=0, user_id="local"):
    """Add with extra metadata fields."""
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO watchlist
                (user_id, movie_id, title, poster, backdrop, rating, release_date, genres, language, runtime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, movie_id, title, poster or "", backdrop or "",
              rating or 0, release_date or "",
              genres or "", language or "", runtime or 0))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


# ── User preferences ──────────────────────────────────────────

def prefs_get(user_id="local") -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM user_preferences WHERE user_id = ? ORDER BY id DESC LIMIT 1", (user_id,)
    ).fetchone()
    conn.close()
    return _row_to_dict(row)


def prefs_save(taste_summary, favorite_genres, favorite_actors,
               favorite_directors, preferred_runtime, preferred_years, mood, user_id="local"):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM user_preferences WHERE user_id = ? LIMIT 1", (user_id,)
    ).fetchone()
    if existing:
        conn.execute("""
            UPDATE user_preferences SET
                taste_summary=?, favorite_genres=?, favorite_actors=?,
                favorite_directors=?, preferred_runtime=?, preferred_years=?,
                mood=?, updated_at=datetime('now')
            WHERE id=?
        """, (taste_summary, _json(favorite_genres), _json(favorite_actors),
              _json(favorite_directors), preferred_runtime, preferred_years,
              mood, existing["id"]))
    else:
        conn.execute("""
            INSERT INTO user_preferences
                (user_id, taste_summary, favorite_genres, favorite_actors,
                 favorite_directors, preferred_runtime, preferred_years, mood)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_id, taste_summary, _json(favorite_genres), _json(favorite_actors),
              _json(favorite_directors), preferred_runtime, preferred_years, mood))
    conn.commit()
    conn.close()


def _json(val):
    import json
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return val or ""


# ── Search History ────────────────────────────────────────────

def sh_add(query: str, user_id="local"):
    q = (query or "").strip()[:200]
    if not q:
        return
    conn = get_db()
    conn.execute("DELETE FROM search_history WHERE LOWER(query) = LOWER(?) AND user_id = ?", (q, user_id))
    conn.execute("INSERT INTO search_history (user_id, query) VALUES (?, ?)", (user_id, q))
    conn.execute("""
        DELETE FROM search_history WHERE user_id = ? AND id NOT IN (
            SELECT id FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT 50
        )
    """, (user_id, user_id))
    conn.commit()
    conn.close()


def sh_get(limit: int = 10, user_id="local") -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, query, searched_at FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def sh_delete_one(history_id: int, user_id="local"):
    conn = get_db()
    conn.execute("DELETE FROM search_history WHERE id = ? AND user_id = ?", (history_id, user_id))
    conn.commit()
    conn.close()


def sh_delete_all(user_id="local"):
    conn = get_db()
    conn.execute("DELETE FROM search_history WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()
