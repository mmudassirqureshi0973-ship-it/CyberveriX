"""
CyberVeriX - demo data
Creates the demo student account so the dashboard, profile and report pages
have something to show during a live demo. Safe to run repeatedly.
"""
import json

import auth
import db
import scoring

DEMO_EMAIL = "student@cyberverix.local"
DEMO_PASSWORD = "Cyber@1234"
DEMO_NAME = "Aisha Rahman"

# Answers for two challenges: one strong, one mixed. Used only for demo data.
DEMO_ANSWERS = {
    "net-recon-01": {
        "q1": ["o22", "o23", "o80", "o445", "o3306"],
        "q2": "a23",
        "q3": "Telnet sends credentials in cleartext so anyone sniffing the network can capture the password. It should be disabled and replaced with SSH.",
        "q4": "b2",
        "q5": "Check the Apache 2.4.29 version against known CVEs and patch it, then restrict MySQL to localhost with a firewall rule.",
    },
    "soc-triage-01": {
        "q1": {"a1": "benign", "a2": "incident", "a3": "suspicious", "a4": "suspicious",
               "a5": "benign", "a6": "incident"},
        "q2": "ALERT-6 first, 38 GB leaving the customer database server looks like data exfiltration and the impact would be severe.",
        "q3": "c2",
    },
    "fund-core-01": {
        "q1": "c2",
        "q2": "d1",
        "q3": "The missing patch is the vulnerability, the ransomware crew is the threat actor, and the risk is the likelihood of them exploiting it times the impact on the business.",
        "q4": "e2",
        "q5": ["p1", "p3", "p5"],
        "q6": "Least privilege means each account only gets the access it needs for its job, so a compromised helpdesk login cannot reach domain admin.",
    },
}


def seed_demo():
    row = db.query("SELECT * FROM users WHERE email = ?", (DEMO_EMAIL,), one=True)
    if row:
        return row["id"]
    user_id, error = auth.create_user(DEMO_NAME, DEMO_EMAIL, DEMO_PASSWORD)
    if error:
        return None
    import api  # imported here to avoid a circular import at module load

    for challenge_id, answers in DEMO_ANSWERS.items():
        challenge = db.get_challenge(challenge_id)
        if not challenge:
            continue
        clean = api.sanitise_answers(challenge, answers)
        result = scoring.grade_challenge(challenge, clean)
        db.execute(
            """INSERT INTO attempts (user_id, challenge_id, category, earned, max_points,
                                     percent, answers, breakdown, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (
                user_id, challenge_id, challenge["category"], result["earned"],
                result["max_points"], result["percent"], json.dumps(clean),
                json.dumps(result), db.now(),
            ),
        )
    return user_id
