"""
CyberVeriX - database layer
SQLite access helpers, schema creation and challenge seeding.
Standard library only (sqlite3), so the project runs with zero installs.
"""
import json
import os
import sqlite3
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
DB_DIR = os.path.join(PROJECT_DIR, "database")
DB_PATH = os.environ.get("CYBERVERIX_DB", os.path.join(DB_DIR, "cyberverix.db"))
CHALLENGE_DIR = os.path.join(PROJECT_DIR, "challenges")

CATEGORIES = [
    ("network", "Network Security"),
    ("web", "Web Security"),
    ("soc", "SOC & Log Analysis"),
    ("windows", "Windows Security"),
    ("incident", "Incident Analysis"),
    ("fundamentals", "Cybersecurity Fundamentals"),
]
CATEGORY_NAMES = dict(CATEGORIES)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    created_at    REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at REAL    NOT NULL
);

CREATE TABLE IF NOT EXISTS challenges (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    category    TEXT NOT NULL,
    difficulty  TEXT NOT NULL,
    minutes     INTEGER NOT NULL DEFAULT 10,
    max_points  INTEGER NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    payload     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id TEXT    NOT NULL,
    category     TEXT    NOT NULL,
    earned       REAL    NOT NULL,
    max_points   REAL    NOT NULL,
    percent      REAL    NOT NULL,
    answers      TEXT    NOT NULL,
    breakdown    TEXT    NOT NULL,
    created_at   REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
"""


def connect():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def query(sql, params=(), one=False):
    with connect() as conn:
        cur = conn.execute(sql, params)
        rows = cur.fetchall()
    if one:
        return rows[0] if rows else None
    return rows


def execute(sql, params=()):
    with connect() as conn:
        cur = conn.execute(sql, params)
        conn.commit()
        return cur.lastrowid


def load_challenge_files():
    """Read every challenge JSON file from the top level challenges/ folder."""
    items = []
    if not os.path.isdir(CHALLENGE_DIR):
        return items
    for name in sorted(os.listdir(CHALLENGE_DIR)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(CHALLENGE_DIR, name), "r", encoding="utf-8") as fh:
            items.append(json.load(fh))
    return items


def max_points_of(challenge):
    return sum(q.get("points", 0) for q in challenge.get("questions", []))


def seed_challenges():
    """Idempotent upsert of the challenge library into SQLite."""
    challenges = load_challenge_files()
    with connect() as conn:
        for idx, ch in enumerate(challenges):
            conn.execute(
                """INSERT INTO challenges (id, title, category, difficulty, minutes,
                                           max_points, sort_order, payload)
                   VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET
                        title=excluded.title, category=excluded.category,
                        difficulty=excluded.difficulty, minutes=excluded.minutes,
                        max_points=excluded.max_points, sort_order=excluded.sort_order,
                        payload=excluded.payload""",
                (
                    ch["id"], ch["title"], ch["category"], ch.get("difficulty", "Easy"),
                    int(ch.get("minutes", 10)), max_points_of(ch), idx,
                    json.dumps(ch),
                ),
            )
        conn.commit()
    return len(challenges)


def all_challenges():
    rows = query("SELECT payload FROM challenges ORDER BY sort_order ASC")
    return [json.loads(r["payload"]) for r in rows]


def get_challenge(challenge_id):
    row = query("SELECT payload FROM challenges WHERE id = ?", (challenge_id,), one=True)
    return json.loads(row["payload"]) if row else None


def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.commit()
    count = seed_challenges()
    return count


def now():
    return time.time()
