"""
CyberVeriX - JSON API layer
Thin request handlers. Every handler returns (status_code, dict).
"""
import copy
import json
import re

import auth
import db
import recommend
import scoring

MAX_TEXT_ANSWER = 4000


class ApiError(Exception):
    def __init__(self, status, message, details=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details or []


def public_challenge(challenge, include_questions=True):
    """Strip every answer key before anything leaves the server."""
    out = {
        "id": challenge["id"],
        "title": challenge["title"],
        "category": challenge["category"],
        "category_name": db.CATEGORY_NAMES.get(challenge["category"], challenge["category"]),
        "difficulty": challenge.get("difficulty", "Easy"),
        "minutes": challenge.get("minutes", 10),
        "summary": challenge.get("summary", ""),
        "max_points": db.max_points_of(challenge),
        "question_count": len(challenge.get("questions", [])),
    }
    if not include_questions:
        return out
    out["scenario"] = challenge.get("scenario", "")
    out["objective"] = challenge.get("objective", "")
    out["evidence"] = challenge.get("evidence", [])
    questions = []
    for q in challenge["questions"]:
        safe = {
            "id": q["id"],
            "type": q["type"],
            "prompt": q["prompt"],
            "points": q["points"],
            "hint": q.get("hint", ""),
        }
        if q["type"] in ("single", "multi"):
            safe["options"] = [{"id": o["id"], "label": o["label"]} for o in q["options"]]
        if q["type"] == "keywords":
            safe["placeholder"] = q.get("placeholder", "Write 2-3 sentences.")
            safe["min_words"] = q.get("min_words", 3)
        if q["type"] == "classify":
            safe["labels"] = q["labels"]
            safe["items"] = [
                {"id": i["id"], "ref": i["ref"], "text": i["text"]} for i in q["items"]
            ]
        questions.append(safe)
    out["questions"] = questions
    return out


def sanitise_answers(challenge, raw):
    """Validate submitted answers against the challenge shape. Nothing is executed."""
    if not isinstance(raw, dict):
        raise ApiError(400, "Answers must be an object keyed by question id.")
    clean = {}
    for q in challenge["questions"]:
        value = raw.get(q["id"])
        if value is None:
            continue
        if q["type"] == "single":
            valid = {o["id"] for o in q["options"]}
            if isinstance(value, str) and value in valid:
                clean[q["id"]] = value
        elif q["type"] == "multi":
            valid = {o["id"] for o in q["options"]}
            if isinstance(value, list):
                clean[q["id"]] = [v for v in value if isinstance(v, str) and v in valid][:20]
        elif q["type"] == "keywords":
            if isinstance(value, str):
                clean[q["id"]] = value[:MAX_TEXT_ANSWER]
        elif q["type"] == "classify":
            valid_labels = {o["id"] for o in q["labels"]}
            valid_items = {i["id"] for i in q["items"]}
            if isinstance(value, dict):
                clean[q["id"]] = {
                    k: v for k, v in value.items()
                    if k in valid_items and isinstance(v, str) and v in valid_labels
                }
    return clean


def answered_count(challenge, answers):
    filled = 0
    for q in challenge["questions"]:
        value = answers.get(q["id"])
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            filled += 1
        elif isinstance(value, (list, dict)) and len(value):
            filled += 1
    return filled


# --------------------------------------------------------------------------
# handlers
# --------------------------------------------------------------------------

def h_health(ctx):
    return 200, {"status": "ok", "challenges": len(db.all_challenges())}


def h_register(ctx):
    body = ctx["body"]
    full_name = str(body.get("full_name", ""))[:200]
    email = str(body.get("email", ""))[:200]
    password = str(body.get("password", ""))[:300]
    errors = auth.validate_registration(full_name, email, password)
    if errors:
        raise ApiError(400, "Please fix the highlighted fields.", errors)
    user_id, error = auth.create_user(full_name, email, password)
    if error:
        raise ApiError(409, error)
    token = auth.start_session(user_id)
    row = db.query("SELECT * FROM users WHERE id = ?", (user_id,), one=True)
    return 201, {"token": token, "user": auth.public_user(row)}


def h_login(ctx):
    body = ctx["body"]
    row = auth.authenticate(body.get("email"), body.get("password"))
    if not row:
        raise ApiError(401, "Email or password is incorrect.")
    token = auth.start_session(row["id"])
    return 200, {"token": token, "user": auth.public_user(row)}


def h_logout(ctx):
    auth.end_session(ctx["token"])
    return 200, {"ok": True}


def h_me(ctx):
    user = require_user(ctx)
    return 200, {"user": auth.public_user(user)}


def h_challenges(ctx):
    user = require_user(ctx)
    profile = scoring.build_profile(user["id"])
    status = {c["id"]: c for c in profile["challenges"]}
    items = []
    for ch in db.all_challenges():
        row = public_challenge(ch, include_questions=False)
        state = status.get(ch["id"], {})
        row["completed"] = state.get("completed", False)
        row["percent"] = state.get("percent")
        row["attempt_id"] = state.get("attempt_id")
        items.append(row)
    return 200, {
        "challenges": items,
        "categories": [{"key": k, "name": n} for k, n in db.CATEGORIES],
        "recommended": recommend.next_challenge(profile),
    }


def h_challenge(ctx):
    require_user(ctx)
    challenge = db.get_challenge(ctx["params"]["cid"])
    if not challenge:
        raise ApiError(404, "That challenge does not exist.")
    return 200, {"challenge": public_challenge(challenge)}


def h_submit(ctx):
    user = require_user(ctx)
    challenge = db.get_challenge(ctx["params"]["cid"])
    if not challenge:
        raise ApiError(404, "That challenge does not exist.")
    answers = sanitise_answers(challenge, ctx["body"].get("answers"))
    if answered_count(challenge, answers) == 0:
        raise ApiError(400, "Answer at least one question before submitting.")

    result = scoring.grade_challenge(challenge, answers)
    attempt_id = db.execute(
        """INSERT INTO attempts (user_id, challenge_id, category, earned, max_points,
                                 percent, answers, breakdown, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (
            user["id"], challenge["id"], challenge["category"], result["earned"],
            result["max_points"], result["percent"], json.dumps(answers),
            json.dumps(result), db.now(),
        ),
    )
    profile = scoring.build_profile(user["id"])
    result["attempt_id"] = attempt_id
    result["feedback"] = recommend.challenge_feedback(user, result, profile)
    result["next_challenge"] = recommend.next_challenge(profile, exclude=challenge["id"])
    result["category_name"] = db.CATEGORY_NAMES.get(result["category"], result["category"])
    category = next((c for c in profile["categories"] if c["key"] == result["category"]), None)
    return 201, {
        "result": result,
        "category_score": category,
        "overall_score": profile["overall_score"],
        "overall_level": profile["overall_level"],
    }


def h_attempt(ctx):
    user = require_user(ctx)
    row = db.query(
        "SELECT * FROM attempts WHERE id = ? AND user_id = ?",
        (ctx["params"]["aid"], user["id"]),
        one=True,
    )
    if not row:
        raise ApiError(404, "Attempt not found.")
    result = json.loads(row["breakdown"])
    profile = scoring.build_profile(user["id"])
    result["attempt_id"] = row["id"]
    result["feedback"] = recommend.challenge_feedback(user, result, profile)
    result["next_challenge"] = recommend.next_challenge(profile, exclude=result["challenge_id"])
    result["category_name"] = db.CATEGORY_NAMES.get(result["category"], result["category"])
    category = next((c for c in profile["categories"] if c["key"] == result["category"]), None)
    return 200, {
        "result": result,
        "category_score": category,
        "overall_score": profile["overall_score"],
        "overall_level": profile["overall_level"],
    }


def h_profile(ctx):
    user = require_user(ctx)
    profile = scoring.build_profile(user["id"])
    profile.update(recommend.build_coaching(user, profile))
    profile["user"] = auth.public_user(user)
    profile["history"] = attempt_history(user["id"])
    return 200, {"profile": profile}


def attempt_history(user_id, limit=25):
    rows = db.query(
        """SELECT a.id, a.challenge_id, a.category, a.percent, a.earned, a.max_points,
                  a.created_at, c.title
           FROM attempts a LEFT JOIN challenges c ON c.id = a.challenge_id
           WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT ?""",
        (user_id, limit),
    )
    return [
        {
            "attempt_id": r["id"],
            "challenge_id": r["challenge_id"],
            "title": r["title"] or r["challenge_id"],
            "category_name": db.CATEGORY_NAMES.get(r["category"], r["category"]),
            "percent": scoring.round2(r["percent"]),
            "earned": scoring.round2(r["earned"]),
            "max_points": scoring.round2(r["max_points"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def h_report(ctx):
    user = require_user(ctx)
    profile = scoring.build_profile(user["id"])
    coaching = recommend.build_coaching(user, profile)
    return 200, {
        "report": {
            "student": auth.public_user(user),
            "generated_at": db.now(),
            "overall_score": profile["overall_score"],
            "overall_level": profile["overall_level"],
            "readiness": profile["readiness"],
            "categories": profile["categories"],
            "challenges": profile["challenges"],
            "completed": [c for c in profile["challenges"] if c["completed"]],
            "strengths": profile["strengths"],
            "weaknesses": profile["weaknesses"],
            "learning_areas": coaching["learning_areas"],
            "feedback": coaching["feedback"],
            "points_earned": profile["points_earned"],
            "points_possible": profile["points_possible"],
            "challenges_completed": profile["challenges_completed"],
            "challenges_total": profile["challenges_total"],
            "disclaimer": (
                "This report is an educational skill assessment produced by the CyberVeriX "
                "academic project. It is not a professional certification, an accredited "
                "qualification, or a hiring recommendation."
            ),
        }
    }


def require_user(ctx):
    if not ctx.get("user"):
        raise ApiError(401, "Please sign in to continue.")
    return ctx["user"]


ROUTES = [
    ("GET", r"^/api/health$", h_health),
    ("POST", r"^/api/register$", h_register),
    ("POST", r"^/api/login$", h_login),
    ("POST", r"^/api/logout$", h_logout),
    ("GET", r"^/api/me$", h_me),
    ("GET", r"^/api/challenges$", h_challenges),
    ("GET", r"^/api/challenges/(?P<cid>[A-Za-z0-9_\-]+)$", h_challenge),
    ("POST", r"^/api/challenges/(?P<cid>[A-Za-z0-9_\-]+)/submit$", h_submit),
    ("GET", r"^/api/attempts/(?P<aid>\d+)$", h_attempt),
    ("GET", r"^/api/profile$", h_profile),
    ("GET", r"^/api/report$", h_report),
]

COMPILED = [(m, re.compile(p), fn) for m, p, fn in ROUTES]


def dispatch(method, path, body, token):
    user = auth.user_for_token(token)
    matched_path = False
    for route_method, pattern, handler in COMPILED:
        match = pattern.match(path)
        if not match:
            continue
        matched_path = True
        if route_method != method:
            continue
        ctx = {
            "body": body if isinstance(body, dict) else {},
            "token": token,
            "user": user,
            "params": match.groupdict(),
        }
        return handler(ctx)
    if matched_path:
        raise ApiError(405, "Method not allowed for this endpoint.")
    raise ApiError(404, "Unknown API endpoint.")
