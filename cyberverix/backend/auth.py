"""
CyberVeriX - authentication
PBKDF2-HMAC-SHA256 password hashing + opaque random session tokens.
Passwords are never stored or logged in plain text.
"""
import binascii
import hashlib
import hmac
import os
import re
import secrets

import db

ITERATIONS = 200_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        ITERATIONS, binascii.hexlify(salt).decode(), binascii.hexlify(digest).decode()
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), binascii.unhexlify(salt_hex), int(iters)
        )
        return hmac.compare_digest(digest, binascii.unhexlify(hash_hex))
    except Exception:
        return False


def validate_registration(full_name, email, password):
    """Returns a list of human readable validation errors."""
    errors = []
    if not full_name or len(full_name.strip()) < 2:
        errors.append("Full name must be at least 2 characters.")
    if len(full_name or "") > 80:
        errors.append("Full name must be under 80 characters.")
    if not email or not EMAIL_RE.match(email.strip().lower()):
        errors.append("Enter a valid email address.")
    if not password or len(password) < 8:
        errors.append("Password must be at least 8 characters.")
    if password and len(password) > 200:
        errors.append("Password must be under 200 characters.")
    if password and password.isalpha():
        errors.append("Password needs at least one number or symbol.")
    return errors


def create_user(full_name, email, password):
    email = email.strip().lower()
    existing = db.query("SELECT id FROM users WHERE email = ?", (email,), one=True)
    if existing:
        return None, "An account with that email already exists."
    user_id = db.execute(
        "INSERT INTO users (full_name, email, password_hash, created_at) VALUES (?,?,?,?)",
        (full_name.strip(), email, hash_password(password), db.now()),
    )
    return user_id, None


def authenticate(email, password):
    row = db.query(
        "SELECT * FROM users WHERE email = ?", ((email or "").strip().lower(),), one=True
    )
    if not row or not verify_password(password or "", row["password_hash"]):
        return None
    return row


def start_session(user_id):
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)",
        (token, user_id, db.now()),
    )
    return token


def end_session(token):
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))


def user_for_token(token):
    if not token:
        return None
    return db.query(
        """SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ?""",
        (token,),
        one=True,
    )


def public_user(row):
    return {"id": row["id"], "full_name": row["full_name"], "email": row["email"]}
