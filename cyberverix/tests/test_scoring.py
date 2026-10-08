"""
CyberVeriX unit tests for the scoring engine.
Standard library only:

    python -m unittest discover -s tests -v
"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

os.environ["CYBERVERIX_DB"] = os.path.join(tempfile.gettempdir(), "cyberverix_test.db")

import api  # noqa: E402
import auth  # noqa: E402
import db  # noqa: E402
import scoring  # noqa: E402


class LevelTests(unittest.TestCase):
    def test_band_edges(self):
        self.assertEqual(scoring.level_for(0), "Beginner")
        self.assertEqual(scoring.level_for(39.9), "Beginner")
        self.assertEqual(scoring.level_for(40), "Developing")
        self.assertEqual(scoring.level_for(59.9), "Developing")
        self.assertEqual(scoring.level_for(60), "Intermediate")
        self.assertEqual(scoring.level_for(74.9), "Intermediate")
        self.assertEqual(scoring.level_for(75), "Strong")
        self.assertEqual(scoring.level_for(89.9), "Strong")
        self.assertEqual(scoring.level_for(90), "Advanced")
        self.assertEqual(scoring.level_for(100), "Advanced")


class SingleChoiceTests(unittest.TestCase):
    question = {
        "id": "q", "type": "single", "points": 4, "prompt": "p", "explanation": "e",
        "options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
        "correct": "b",
    }

    def test_correct(self):
        earned, verdict, _, _ = scoring._grade_single(self.question, "b")
        self.assertEqual((earned, verdict), (4, "correct"))

    def test_wrong_and_missing(self):
        self.assertEqual(scoring._grade_single(self.question, "a")[0], 0)
        self.assertEqual(scoring._grade_single(self.question, None)[0], 0)
        self.assertEqual(scoring._grade_single(self.question, ["b"])[0], 0)


class MultiChoiceTests(unittest.TestCase):
    question = {
        "id": "q", "type": "multi", "points": 6, "prompt": "p", "explanation": "e",
        "options": [{"id": i, "label": i.upper()} for i in ["a", "b", "c", "d"]],
        "correct": ["a", "b", "c"],
    }

    def test_all_correct(self):
        earned, verdict, missed, _ = scoring._grade_multi(self.question, ["a", "b", "c"])
        self.assertEqual((earned, verdict, missed), (6.0, "correct", []))

    def test_partial(self):
        earned, verdict, missed, _ = scoring._grade_multi(self.question, ["a", "b"])
        self.assertEqual(verdict, "partial")
        self.assertAlmostEqual(earned, 4.0, places=2)
        self.assertEqual(missed, ["C"])

    def test_wrong_pick_costs(self):
        earned, _, _, wrong = scoring._grade_multi(self.question, ["a", "b", "c", "d"])
        self.assertAlmostEqual(earned, 4.0, places=2)
        self.assertEqual(wrong, ["D"])

    def test_never_negative(self):
        self.assertEqual(scoring._grade_multi(self.question, ["d"])[0], 0)


class KeywordTests(unittest.TestCase):
    question = {
        "id": "q", "type": "keywords", "points": 6, "prompt": "p", "explanation": "e",
        "min_words": 4,
        "concepts": [
            {"label": "cleartext", "points": 3, "any": ["cleartext", "plain text"]},
            {"label": "disable it", "points": 3, "any": ["disable", "turn off"]},
        ],
    }

    def test_full_credit(self):
        earned, verdict, missed, matched = scoring._grade_keywords(
            self.question, "Telnet is cleartext so we should disable the service")
        self.assertEqual((earned, verdict, missed), (6.0, "correct", []))
        self.assertEqual(len(matched), 2)

    def test_partial_credit(self):
        earned, verdict, missed, _ = scoring._grade_keywords(
            self.question, "The protocol sends everything in plain text over the wire")
        self.assertEqual((earned, verdict), (3.0, "partial"))
        self.assertEqual(missed, ["disable it"])

    def test_too_short_scores_zero(self):
        earned, verdict, _, _ = scoring._grade_keywords(self.question, "cleartext disable")
        self.assertEqual((earned, verdict), (0, "incorrect"))

    def test_word_boundaries(self):
        # "disabled" contains "disable" as a prefix and should still count,
        # but an unrelated word must not trigger a match.
        self.assertEqual(scoring._grade_keywords(
            self.question, "we turn off the daemon because it is plain text traffic")[0], 6.0)
        self.assertEqual(scoring._grade_keywords(
            self.question, "the server was very fast and the network was quiet today")[0], 0)


class ClassifyTests(unittest.TestCase):
    question = {
        "id": "q", "type": "classify", "points": 12, "prompt": "p", "explanation": "e",
        "labels": [{"id": "b", "label": "Benign"}, {"id": "i", "label": "Incident"}],
        "items": [
            {"id": "1", "ref": "A-1", "text": "t", "correct": "b"},
            {"id": "2", "ref": "A-2", "text": "t", "correct": "i"},
            {"id": "3", "ref": "A-3", "text": "t", "correct": "i"},
        ],
    }

    def test_all_correct(self):
        earned, verdict, missed, _ = scoring._grade_classify(
            self.question, {"1": "b", "2": "i", "3": "i"})
        self.assertEqual((earned, verdict, missed), (12.0, "correct", []))

    def test_per_item_credit(self):
        earned, verdict, missed, _ = scoring._grade_classify(
            self.question, {"1": "b", "2": "b", "3": "i"})
        self.assertAlmostEqual(earned, 8.0, places=2)
        self.assertEqual(verdict, "partial")
        self.assertEqual(missed, ["A-2 should be Incident"])


class PasswordTests(unittest.TestCase):
    def test_hash_is_salted_and_verifiable(self):
        first = auth.hash_password("Passw0rd!")
        second = auth.hash_password("Passw0rd!")
        self.assertNotEqual(first, second, "each hash must use a fresh salt")
        self.assertNotIn("Passw0rd!", first, "the password must never appear in storage")
        self.assertTrue(auth.verify_password("Passw0rd!", first))
        self.assertFalse(auth.verify_password("passw0rd!", first))
        self.assertFalse(auth.verify_password("Passw0rd!", "garbage"))

    def test_registration_validation(self):
        self.assertEqual(auth.validate_registration("Ada Lovelace", "ada@lab.local", "Passw0rd!"), [])
        self.assertTrue(auth.validate_registration("A", "nope", "short"))


class ChallengeLibraryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()
        cls.challenges = db.all_challenges()

    def test_library_loads(self):
        self.assertGreaterEqual(len(self.challenges), 6)

    def test_every_category_has_a_challenge(self):
        covered = {c["category"] for c in self.challenges}
        for key, _ in db.CATEGORIES:
            self.assertIn(key, covered, "category %s has no challenge" % key)

    def test_challenge_shape_is_valid(self):
        for ch in self.challenges:
            for field in ("id", "title", "category", "difficulty", "scenario", "questions", "concept"):
                self.assertIn(field, ch, "%s is missing %s" % (ch.get("id"), field))
            self.assertTrue(ch["questions"], "%s has no questions" % ch["id"])
            for q in ch["questions"]:
                self.assertIn(q["type"], scoring.GRADERS, "unknown question type in %s" % ch["id"])
                self.assertGreater(q["points"], 0)
                self.assertTrue(q["explanation"])
                if q["type"] in ("single", "multi"):
                    ids = [o["id"] for o in q["options"]]
                    self.assertEqual(len(ids), len(set(ids)), "duplicate option ids in %s" % ch["id"])
                    correct = q["correct"] if isinstance(q["correct"], list) else [q["correct"]]
                    for c in correct:
                        self.assertIn(c, ids, "answer key %s not in options (%s)" % (c, ch["id"]))
                if q["type"] == "keywords":
                    self.assertEqual(sum(g["points"] for g in q["concepts"]), q["points"],
                                     "concept points must add up to the question points in %s" % ch["id"])
                if q["type"] == "classify":
                    labels = [l["id"] for l in q["labels"]]
                    for item in q["items"]:
                        self.assertIn(item["correct"], labels)

    def test_model_answers_score_full_marks(self):
        """The published model answer for every written question must actually score."""
        for ch in self.challenges:
            for q in ch["questions"]:
                if q["type"] != "keywords":
                    continue
                earned, verdict, missed, _ = scoring._grade_keywords(q, q["model_answer"])
                self.assertEqual(verdict, "correct",
                                 "%s %s model answer only scored %s (missed %s)" %
                                 (ch["id"], q["id"], earned, missed))

    def test_public_payload_hides_answers(self):
        for ch in self.challenges:
            blob = repr(api.public_challenge(ch))
            self.assertNotIn("'correct'", blob)
            self.assertNotIn("'concepts'", blob)
            self.assertNotIn("'explanation'", blob)


class ProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.path.exists(db.DB_PATH):
            os.remove(db.DB_PATH)
        db.init_db()
        cls.user_id, _ = auth.create_user("Test Student", "unit@lab.local", "Passw0rd!")
        cls.fresh_id, _ = auth.create_user("Fresh Student", "fresh@lab.local", "Passw0rd!")

    def submit(self, challenge_id, answers):
        challenge = db.get_challenge(challenge_id)
        clean = api.sanitise_answers(challenge, answers)
        result = scoring.grade_challenge(challenge, clean)
        import json
        db.execute(
            """INSERT INTO attempts (user_id, challenge_id, category, earned, max_points,
                                     percent, answers, breakdown, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (self.user_id, challenge_id, challenge["category"], result["earned"],
             result["max_points"], result["percent"], json.dumps(clean),
             json.dumps(result), db.now()))
        return result

    def test_empty_profile(self):
        """A user with no submissions gets zeroes, not an estimate."""
        profile = scoring.build_profile(self.fresh_id)
        self.assertEqual(profile["overall_score"], 0.0)
        self.assertEqual(profile["challenges_completed"], 0)
        self.assertFalse(profile["readiness"]["eligible"])
        self.assertEqual(profile["readiness"]["band"], "Assessment Incomplete")

    def test_best_attempt_wins_and_readiness_unlocks(self):
        self.submit("fund-core-01", {"q1": "c2", "q2": "d1", "q4": "e2", "q5": ["p1", "p3", "p5"]})
        low = scoring.build_profile(self.user_id)["overall_score"]
        self.submit("fund-core-01", {"q1": "c1", "q2": "d2"})
        after_bad_retry = scoring.build_profile(self.user_id)["overall_score"]
        self.assertEqual(low, after_bad_retry, "a worse retry must not lower the score")

        self.submit("net-recon-01", {"q2": "a23", "q4": "b2"})
        self.submit("soc-triage-01", {"q3": "c2"})
        profile = scoring.build_profile(self.user_id)
        self.assertEqual(profile["challenges_completed"], 3)
        self.assertEqual(profile["attempts_logged"], 4)
        self.assertTrue(profile["readiness"]["eligible"])
        self.assertLessEqual(profile["overall_score"], 100)
        self.assertGreaterEqual(profile["overall_score"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
