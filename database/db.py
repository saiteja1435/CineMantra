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
            movie_id     INTEGER NOT NULL UNIQUE,
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
    # Add new columns to existing watchlist table if they don't exist yet
    for col, definition in [
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
            movie_id   INTEGER NOT NULL UNIQUE,
            title      TEXT    NOT NULL,
            poster     TEXT,
            backdrop   TEXT,
            rating     REAL    DEFAULT 0,
            release_date TEXT,
            viewed_at  TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            taste_summary   TEXT    DEFAULT '',
            favorite_genres TEXT    DEFAULT '',
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
            query       TEXT    NOT NULL,
            searched_at TEXT    DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def _row_to_dict(row):
    return dict(row) if row else None


# ── Watchlist ─────────────────────────────────────────────────

def wl_get_all():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM watchlist ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def wl_get_one(movie_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM watchlist WHERE movie_id = ?", (movie_id,)
    ).fetchone()
    conn.close()
    return _row_to_dict(row)


def wl_add(movie_id, title, poster, backdrop, rating, release_date):
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO watchlist (movie_id, title, poster, backdrop, rating, release_date)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (movie_id, title, poster or "", backdrop or "", rating or 0, release_date or ""))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def wl_remove(movie_id: int):
    conn = get_db()
    conn.execute("DELETE FROM watchlist WHERE movie_id = ?", (movie_id,))
    conn.commit()
    conn.close()


def wl_toggle_favorite(movie_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT favorite FROM watchlist WHERE movie_id = ?", (movie_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    new_val = 0 if row["favorite"] else 1
    conn.execute(
        "UPDATE watchlist SET favorite = ? WHERE movie_id = ?", (new_val, movie_id)
    )
    conn.commit()
    conn.close()
    return bool(new_val)


def wl_toggle_watched(movie_id: int):
    conn = get_db()
    row = conn.execute(
        "SELECT watched, status FROM watchlist WHERE movie_id = ?", (movie_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    new_watched = 0 if row["watched"] else 1
    new_status  = "completed" if new_watched else "watching"
    conn.execute(
        "UPDATE watchlist SET watched = ?, status = ? WHERE movie_id = ?",
        (new_watched, new_status, movie_id)
    )
    conn.commit()
    conn.close()
    return bool(new_watched)


# ── Recent ────────────────────────────────────────────────────

def recent_add(movie_id, title, poster, backdrop, rating, release_date):
    conn = get_db()
    conn.execute("""
        INSERT INTO recent (movie_id, title, poster, backdrop, rating, release_date, viewed_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(movie_id) DO UPDATE SET viewed_at = datetime('now')
    """, (movie_id, title, poster or "", backdrop or "", rating or 0, release_date or ""))
    conn.commit()
    conn.close()


def recent_get(limit=20):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM recent ORDER BY viewed_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Extended watchlist ops ────────────────────────────────────

def wl_rate(movie_id: int, user_rating: float):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET user_rating = ? WHERE movie_id = ?",
        (round(float(max(0, min(10, user_rating))), 1), movie_id)
    )
    conn.commit()
    conn.close()


def wl_set_notes(movie_id: int, notes: str):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET notes = ? WHERE movie_id = ?",
        ((notes or "")[:1000], movie_id)
    )
    conn.commit()
    conn.close()


def wl_set_collection(movie_id: int, collection: str):
    conn = get_db()
    conn.execute(
        "UPDATE watchlist SET collection = ? WHERE movie_id = ?",
        ((collection or "").strip()[:100], movie_id)
    )
    conn.commit()
    conn.close()


def wl_add_full(movie_id, title, poster, backdrop, rating, release_date,
                genres="", language="", runtime=0):
    """Add with extra metadata fields."""
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO watchlist
                (movie_id, title, poster, backdrop, rating, release_date, genres, language, runtime)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (movie_id, title, poster or "", backdrop or "",
              rating or 0, release_date or "",
              genres or "", language or "", runtime or 0))
        conn.commit()
        return True
    except Exception:
        return False
    finally:
        conn.close()


# ── User preferences ──────────────────────────────────────────

def prefs_get() -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM user_preferences ORDER BY id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    return _row_to_dict(row)


def prefs_save(taste_summary, favorite_genres, favorite_actors,
               favorite_directors, preferred_runtime, preferred_years, mood):
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM user_preferences LIMIT 1"
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
                (taste_summary, favorite_genres, favorite_actors,
                 favorite_directors, preferred_runtime, preferred_years, mood)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (taste_summary, _json(favorite_genres), _json(favorite_actors),
              _json(favorite_directors), preferred_runtime, preferred_years, mood))
    conn.commit()
    conn.close()


def _json(val):
    import json
    if isinstance(val, (list, dict)):
        return json.dumps(val)
    return val or ""


# ── Search History ────────────────────────────────────────────

def sh_add(query: str):
    q = (query or "").strip()[:200]
    if not q:
        return
    conn = get_db()
    # Remove duplicate if exists, then insert fresh
    conn.execute("DELETE FROM search_history WHERE LOWER(query) = LOWER(?)", (q,))
    conn.execute("INSERT INTO search_history (query) VALUES (?)", (q,))
    # Keep only latest 50
    conn.execute("""
        DELETE FROM search_history WHERE id NOT IN (
            SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 50
        )
    """)
    conn.commit()
    conn.close()


def sh_get(limit: int = 10) -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT id, query, searched_at FROM search_history ORDER BY searched_at DESC LIMIT ?",
        (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def sh_delete_one(history_id: int):
    conn = get_db()
    conn.execute("DELETE FROM search_history WHERE id = ?", (history_id,))
    conn.commit()
    conn.close()


def sh_delete_all():
    conn = get_db()
    conn.execute("DELETE FROM search_history")
    conn.commit()
    conn.close()
