
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from dotenv import load_dotenv
from pwdlib import PasswordHash

load_dotenv()

password_hasher = PasswordHash.recommended()

JWT_ALGORITHM = "HS256"


def get_secret_key() -> str:
    secret = os.getenv("AUTH_SECRET_KEY", "")

    if len(secret) < 32:
        raise RuntimeError(
            "AUTH_SECRET_KEY must be configured with at least 32 characters."
        )

    return secret


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password, password_hash)
    except Exception:
        return False


def create_access_token(user_id: UUID) -> str:
    expires_minutes = int(
        os.getenv("AUTH_TOKEN_EXPIRE_MINUTES", "480")
    )

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }

    return jwt.encode(
        payload,
        get_secret_key(),
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(
            token,
            get_secret_key(),
            algorithms=[JWT_ALGORITHM],
        )

        if payload.get("type") != "access":
            return None

        UUID(payload["sub"])

        return payload

    except (jwt.InvalidTokenError, ValueError, KeyError, TypeError):
        return None


def create_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def verify_csrf_token(cookie_token: str | None, header_token: str | None) -> bool:
    if not cookie_token or not header_token:
        return False

    return secrets.compare_digest(cookie_token, header_token)


def cookie_secure() -> bool:
    return os.getenv("AUTH_COOKIE_SECURE", "false").lower() == "true"


def token_expiry_seconds() -> int:
    return int(os.getenv("AUTH_TOKEN_EXPIRE_MINUTES", "480")) * 60
