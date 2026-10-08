"""
CyberVeriX - scoring engine
Deterministic, explainable grading. No AI service required.

Question types
--------------
single    : one correct option        -> full points or zero
multi     : several correct options   -> partial credit, wrong picks subtract
keywords  : short written answer      -> partial credit per concept group matched
classify  : label a list of items     -> partial credit per item labelled correctly
"""
import json
import re
import unicodedata

import db

LEVELS = [
    (90, "Advanced"),
    (75, "Strong"),
    (60, "Intermediate"),
    (40, "Developing"),
    (0, "Beginner"),
]

READINESS = [
    (90, "Interview Ready (Educational)", "Consistently strong practical performance across the assessed categories."),
    (75, "Job-Ready Foundations", "Solid practical foundations for junior SOC or security analyst training tracks."),
    (60, "Foundations Forming", "Core skills are working. Depth and consistency are the next milestones."),
    (40, "Developing", "Concepts are landing, applied analysis still needs repetition."),
    (0, "Early Learner", "Focus on fundamentals before moving to applied investigation work."),
]

MIN_CHALLENGES_FOR_READINESS = 3


def level_for(percent):
    for floor, label in LEVELS:
        if percent >= floor:
            return label
    return "Beginner"


def _normalise(text):
    text = unicodedata.normalize("NFKD", str(text or "")).lower()
    text = re.sub(r"[^a-z0-9\s/\.\-_]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _phrase_present(haystack, phrase):
    """Match a keyword as a prefix of a whole word.

    Keywords must start a word, so "ssh" never matches inside "flash", but any
    ending is accepted: "patch" matches "patched" and "patching", "authoriz"
    matches "authorize" and "authorization". Concept keywords are therefore
    written as stems on purpose.
    """
    phrase = _normalise(phrase)
    if not phrase:
        return False
    core = re.escape(phrase).replace(r"\ ", r"\s+")
    pattern = r"(?<![a-z0-9])" + core + r"[a-z]*"
    return re.search(pattern, haystack) is not None


def round2(value):
    return round(float(value) + 1e-9, 2)


# --------------------------------------------------------------------------
# per question graders
# --------------------------------------------------------------------------

def _grade_single(question, answer):
    points = question["points"]
    correct = question["correct"]
    chosen = answer if isinstance(answer, str) else None
    earned = points if chosen == correct else 0
    return earned, ("correct" if earned else "incorrect"), [], []


def _grade_multi(question, answer):
    points = question["points"]
    correct = set(question["correct"])
    chosen = set(a for a in answer if isinstance(a, str)) if isinstance(answer, list) else set()
    hits = len(chosen & correct)
    misfires = len(chosen - correct)
    ratio = (hits - misfires) / float(len(correct)) if correct else 0.0
    ratio = max(0.0, min(1.0, ratio))
    earned = round2(points * ratio)
    verdict = "correct" if ratio >= 0.999 else ("partial" if earned > 0 else "incorrect")
    labels = {o["id"]: o["label"] for o in question["options"]}
    missed = [labels[i] for i in question["correct"] if i not in chosen]
    wrong = [labels[i] for i in sorted(chosen - correct) if i in labels]
    return earned, verdict, missed, wrong


def _grade_keywords(question, answer):
    points = question["points"]
    text = _normalise(answer if isinstance(answer, str) else "")
    groups = question["concepts"]
    earned = 0.0
    matched, missed = [], []
    if len(text.split()) >= question.get("min_words", 3):
        for group in groups:
            if any(_phrase_present(text, kw) for kw in group["any"]):
                earned += group["points"]
                matched.append(group["label"])
            else:
                missed.append(group["label"])
    else:
        missed = [g["label"] for g in groups]
    earned = round2(min(points, earned))
    verdict = "correct" if not missed else ("partial" if earned > 0 else "incorrect")
    return earned, verdict, missed, matched


def _grade_classify(question, answer):
    points = question["points"]
    items = question["items"]
    answer = answer if isinstance(answer, dict) else {}
    per_item = points / float(len(items)) if items else 0
    earned = 0.0
    missed = []
    for item in items:
        given = answer.get(item["id"])
        if given == item["correct"]:
            earned += per_item
        else:
            label = next(
                (o["label"] for o in question["labels"] if o["id"] == item["correct"]),
                item["correct"],
            )
            missed.append("%s should be %s" % (item["ref"], label))
    earned = round2(earned)
    verdict = "correct" if not missed else ("partial" if earned > 0 else "incorrect")
    return earned, verdict, missed, []


GRADERS = {
    "single": _grade_single,
    "multi": _grade_multi,
    "keywords": _grade_keywords,
    "classify": _grade_classify,
}


def model_answer(question):
    if question["type"] == "single":
        return next(
            (o["label"] for o in question["options"] if o["id"] == question["correct"]),
            "",
        )
    if question["type"] == "multi":
        labels = {o["id"]: o["label"] for o in question["options"]}
        return "; ".join(labels[i] for i in question["correct"] if i in labels)
    if question["type"] == "keywords":
        return question.get("model_answer", "")
    if question["type"] == "classify":
        labels = {o["id"]: o["label"] for o in question["labels"]}
        return "; ".join(
            "%s = %s" % (i["ref"], labels.get(i["correct"], i["correct"]))
            for i in question["items"]
        )
    return ""


# --------------------------------------------------------------------------
# challenge grading
# --------------------------------------------------------------------------

def grade_challenge(challenge, answers):
    """answers: dict of question_id -> submitted value. Returns full breakdown."""
    answers = answers if isinstance(answers, dict) else {}
    results = []
    earned_total = 0.0
    max_total = 0.0

    for question in challenge["questions"]:
        grader = GRADERS[question["type"]]
        earned, verdict, missed, extra = grader(question, answers.get(question["id"]))
        earned_total += earned
        max_total += question["points"]
        results.append(
            {
                "id": question["id"],
                "prompt": question["prompt"],
                "type": question["type"],
                "earned": round2(earned),
                "points": question["points"],
                "verdict": verdict,
                "missed": missed,
                "notes": extra,
                "explanation": question["explanation"],
                "model_answer": model_answer(question),
            }
        )

    percent = round2(100.0 * earned_total / max_total) if max_total else 0.0
    strengths = [r["prompt"] for r in results if r["verdict"] == "correct"]
    gaps = [r["prompt"] for r in results if r["verdict"] != "correct"]

    return {
        "challenge_id": challenge["id"],
        "title": challenge["title"],
        "category": challenge["category"],
        "earned": round2(earned_total),
        "max_points": round2(max_total),
        "percent": percent,
        "level": level_for(percent),
        "questions": results,
        "right": strengths,
        "improve": gaps,
        "concept": challenge.get("concept", ""),
        "remediation": challenge.get("remediation", []),
    }


# --------------------------------------------------------------------------
# profile aggregation
# --------------------------------------------------------------------------

def best_attempts(user_id):
    """Best scoring attempt per challenge (a retry can only help)."""
    rows = db.query(
        """SELECT a.* FROM attempts a
           WHERE a.user_id = ?
           ORDER BY a.percent DESC, a.created_at DESC""",
        (user_id,),
    )
    best = {}
    for row in rows:
        if row["challenge_id"] not in best:
            best[row["challenge_id"]] = row
    return best


def build_profile(user_id):
    challenges = db.all_challenges()
    best = best_attempts(user_id)
    attempt_count = db.query(
        "SELECT COUNT(*) AS c FROM attempts WHERE user_id = ?", (user_id,), one=True
    )["c"]

    by_category = {}
    for key, name in db.CATEGORIES:
        by_category[key] = {
            "key": key,
            "name": name,
            "earned": 0.0,
            "max_points": 0.0,
            "percent": 0,
            "level": "Not assessed",
            "completed": 0,
            "total": 0,
            "assessed": False,
        }

    challenge_rows = []
    for ch in challenges:
        cat = by_category.setdefault(
            ch["category"],
            {"key": ch["category"], "name": ch["category"], "earned": 0.0,
             "max_points": 0.0, "percent": 0, "level": "Not assessed",
             "completed": 0, "total": 0, "assessed": False},
        )
        cat["total"] += 1
        attempt = best.get(ch["id"])
        row = {
            "id": ch["id"],
            "title": ch["title"],
            "category": ch["category"],
            "category_name": db.CATEGORY_NAMES.get(ch["category"], ch["category"]),
            "difficulty": ch.get("difficulty", "Easy"),
            "minutes": ch.get("minutes", 10),
            "summary": ch.get("summary", ""),
            "max_points": db.max_points_of(ch),
            "completed": attempt is not None,
            "percent": round2(attempt["percent"]) if attempt else None,
            "earned": round2(attempt["earned"]) if attempt else None,
            "attempt_id": attempt["id"] if attempt else None,
            "completed_at": attempt["created_at"] if attempt else None,
        }
        challenge_rows.append(row)
        if attempt:
            cat["completed"] += 1
            cat["earned"] += attempt["earned"]
            cat["max_points"] += attempt["max_points"]
            cat["assessed"] = True

    for cat in by_category.values():
        if cat["max_points"]:
            cat["percent"] = round2(100.0 * cat["earned"] / cat["max_points"])
            cat["level"] = level_for(cat["percent"])
        cat["earned"] = round2(cat["earned"])
        cat["max_points"] = round2(cat["max_points"])

    categories = [by_category[k] for k, _ in db.CATEGORIES if k in by_category]
    for key in by_category:
        if key not in db.CATEGORY_NAMES:
            categories.append(by_category[key])

    total_earned = sum(c["earned"] for c in categories)
    total_max = sum(c["max_points"] for c in categories)
    overall = round2(100.0 * total_earned / total_max) if total_max else 0.0

    total_challenges = len(challenge_rows)
    completed = [c for c in challenge_rows if c["completed"]]
    coverage = round2(100.0 * len(completed) / total_challenges) if total_challenges else 0.0

    assessed = [c for c in categories if c["assessed"]]
    ranked = sorted(assessed, key=lambda c: c["percent"])
    weaknesses = [c for c in ranked if c["percent"] < 70][:3]
    strengths = [c for c in reversed(ranked) if c["percent"] >= 70][:3]

    return {
        "overall_score": overall,
        "overall_level": level_for(overall) if completed else "Not assessed",
        "points_earned": round2(total_earned),
        "points_possible": round2(total_max),
        "challenges_total": total_challenges,
        "challenges_completed": len(completed),
        "attempts_logged": attempt_count,
        "coverage": coverage,
        "categories": categories,
        "challenges": challenge_rows,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "unassessed": [c for c in categories if not c["assessed"]],
        "readiness": readiness_for(overall, len(completed), total_challenges, assessed),
    }


def readiness_for(overall, completed, total, assessed_categories):
    """Career readiness = performance gated by how much of the assessment is done."""
    required = min(MIN_CHALLENGES_FOR_READINESS, total)
    if completed < required:
        return {
            "band": "Assessment Incomplete",
            "summary": "Complete at least %d challenges to generate a career readiness band."
            % required,
            "score": overall,
            "eligible": False,
            "requirement": required,
            "completed": completed,
            "consistency": None,
            "notes": [
                "Readiness is intentionally withheld until enough evidence exists.",
                "%d of %d challenges submitted so far." % (completed, total),
            ],
        }

    band, summary = READINESS[-1][1], READINESS[-1][2]
    for floor, label, text in READINESS:
        if overall >= floor:
            band, summary = label, text
            break

    percents = [c["percent"] for c in assessed_categories]
    spread = round2(max(percents) - min(percents)) if percents else 0.0
    consistency = "Even" if spread <= 15 else ("Uneven" if spread <= 30 else "Spiky")
    notes = [
        "Based on %d of %d challenges across %d skill categories."
        % (completed, total, len(assessed_categories)),
        "Category spread is %s points, profile reads as %s." % (spread, consistency.lower()),
        "Educational assessment only. Not a professional certification or hiring decision.",
    ]
    if spread > 30:
        notes.append("Level up the weakest category before adding new ones.")
    return {
        "band": band,
        "summary": summary,
        "score": overall,
        "eligible": True,
        "requirement": required,
        "completed": completed,
        "consistency": consistency,
        "spread": spread,
        "notes": notes,
    }
