"""
CyberVeriX - rule based coaching engine
Generates weak-skill identification, next-step recommendations and short
personalised feedback with no external AI dependency.

An optional LLM provider can be layered on later behind the same function
signatures; the platform is designed to work fully offline.
"""
import db
import scoring

LEARNING_MAP = {
    "network": [
        "Nmap service and version detection flags (-sV, -sC, -p-)",
        "Which services should never be exposed to untrusted networks",
        "Network segmentation and host firewall rules",
    ],
    "web": [
        "OWASP Top 10 2021, especially A01 Broken Access Control",
        "Security response headers (CSP, HSTS, X-Content-Type-Options)",
        "Cookie flags: HttpOnly, Secure, SameSite",
    ],
    "soc": [
        "Alert triage: true positive vs false positive reasoning",
        "Writing analyst notes that justify a classification",
        "Detection of beaconing and suspicious DNS patterns",
    ],
    "windows": [
        "Key Windows Security event IDs: 4624, 4625, 4672, 4720, 1102",
        "Sysmon event IDs 1, 3, 7, 11 and process ancestry",
        "PowerShell logging and encoded command analysis",
    ],
    "incident": [
        "Incident severity and escalation criteria",
        "Containment before eradication: order of operations",
        "Timeline building from multiple evidence sources",
    ],
    "fundamentals": [
        "CIA triad applied to real scenarios",
        "Threat vs vulnerability vs risk vocabulary",
        "Preventive, detective and corrective control types",
    ],
}

TONE = {
    "Advanced": "Excellent work",
    "Strong": "Strong result",
    "Intermediate": "Solid attempt",
    "Developing": "Getting there",
    "Beginner": "Rough start",
}


def _first_name(full_name):
    return (full_name or "Student").strip().split(" ")[0]


def next_challenge(profile, exclude=None):
    """Pick the highest value next challenge using simple explainable rules."""
    rows = [c for c in profile["challenges"] if c["id"] != exclude]
    if not rows:
        return None

    weak_keys = [w["key"] for w in profile["weaknesses"]]

    # 1. an untouched challenge inside a weak category
    for key in weak_keys:
        for row in rows:
            if row["category"] == key and not row["completed"]:
                return dict(row, reason="Untouched challenge in your weakest category (%s)."
                            % db.CATEGORY_NAMES.get(key, key))
    # 2. any untouched challenge, easiest first
    order = {"Easy": 0, "Medium": 1, "Hard": 2}
    untouched = sorted(
        [r for r in rows if not r["completed"]], key=lambda r: order.get(r["difficulty"], 1)
    )
    if untouched:
        row = untouched[0]
        return dict(row, reason="Expands your profile into a category you have not been assessed on.")
    # 3. everything done: retry the weakest score
    weakest = sorted([r for r in rows if r["completed"]], key=lambda r: r["percent"])
    if weakest and weakest[0]["percent"] < 90:
        row = weakest[0]
        return dict(row, reason="Your lowest score so far (%s%%). A retry keeps your best result."
                    % row["percent"])
    return dict(rows[0], reason="All challenges cleared. Replay to keep the skills warm.")


def learning_areas(profile, limit=4):
    areas = []
    for cat in profile["weaknesses"]:
        for topic in LEARNING_MAP.get(cat["key"], [])[:2]:
            areas.append({"category": cat["name"], "topic": topic})
    for cat in profile["unassessed"]:
        topics = LEARNING_MAP.get(cat["key"], [])
        if topics:
            areas.append({"category": cat["name"], "topic": topics[0]})
    return areas[:limit]


def challenge_feedback(user, result, profile):
    """Short personalised paragraph shown on the results page."""
    name = _first_name(user["full_name"])
    cat_name = db.CATEGORY_NAMES.get(result["category"], result["category"])
    level = result["level"]
    opener = TONE.get(level, "Result logged")
    hit = len(result["right"])
    total = len(result["questions"])

    lines = ["%s, %s. You scored %s of %s points (%s%%) on %s." % (
        name, opener.lower(), result["earned"], result["max_points"], result["percent"],
        result["title"])]

    if hit == total:
        lines.append("Every question in this %s challenge landed. Push into a harder category next."
                     % cat_name.lower())
    elif hit == 0:
        lines.append("Nothing scored full marks here, so treat %s as a study target rather than a retry."
                     % cat_name.lower())
    else:
        weakest = min(
            (q for q in result["questions"] if q["verdict"] != "correct"),
            key=lambda q: (q["earned"] / q["points"]) if q["points"] else 0,
        )
        lines.append("Your %s reasoning is developing. The weakest answer was \"%s\"." % (
            cat_name.lower(), weakest["prompt"]))

    topics = LEARNING_MAP.get(result["category"], [])
    if result["percent"] < 75 and topics:
        lines.append("Recommended topic: %s." % topics[0])

    nxt = next_challenge(profile, exclude=result["challenge_id"])
    if nxt:
        lines.append("Next up: %s (%s). %s" % (nxt["title"], nxt["difficulty"], nxt["reason"]))
    return " ".join(lines)


def profile_feedback(user, profile):
    """Short personalised paragraph shown on the dashboard and report."""
    name = _first_name(user["full_name"])
    if not profile["challenges_completed"]:
        return ("%s, your profile is empty. Complete one challenge in any category and "
                "CyberVeriX will start building your skill breakdown." % name)

    parts = ["%s, your CyberVeriX score is %s out of 100 (%s) from %d of %d challenges." % (
        name, profile["overall_score"], profile["overall_level"],
        profile["challenges_completed"], profile["challenges_total"])]

    if profile["strengths"]:
        parts.append("Strongest area: %s at %s%%." % (
            profile["strengths"][0]["name"], profile["strengths"][0]["percent"]))
    if profile["weaknesses"]:
        weak = profile["weaknesses"][0]
        parts.append("Weakest area: %s at %s%%, and that is where the next points are cheapest."
                     % (weak["name"], weak["percent"]))
    if profile["unassessed"]:
        parts.append("%d categories are still unassessed, so the score is provisional."
                     % len(profile["unassessed"]))
    return " ".join(parts)


def build_coaching(user, profile):
    return {
        "feedback": profile_feedback(user, profile),
        "next_challenge": next_challenge(profile),
        "learning_areas": learning_areas(profile),
    }
