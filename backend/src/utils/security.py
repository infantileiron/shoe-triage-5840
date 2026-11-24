import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from src.config.settings import SIGNING_KEY


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 310_000)
    return f'{salt}${digest.hex()}'


def matches(password, encoded):
    return hmac.compare_digest(password_hash(password, encoded.split('$', 1)[0]), encoded)


def issue(username):
    expires = datetime.now(timezone.utc) + timedelta(hours=8)
    return jwt.encode({'sub': username, 'exp': expires}, SIGNING_KEY, algorithm='HS256')


def subject(token):
    return jwt.decode(token, SIGNING_KEY, algorithms=['HS256'],
                      options={'require': ['sub', 'exp']})['sub']
