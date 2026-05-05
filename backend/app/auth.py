import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.config import get_settings


PWD_CONTEXT = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
USERNAME_PATTERN = re.compile(r'^[a-z0-9]{3,120}$')
PASSWORD_POLICY = re.compile(r'^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$')
WORKSPACE_SLUG_PATTERN = re.compile(r'[^a-z0-9-]+')


class AuthError(ValueError):
    pass


def hash_password(password: str) -> str:
    return PWD_CONTEXT.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return PWD_CONTEXT.verify(password, password_hash)


def validate_password(password: str) -> None:
    if not PASSWORD_POLICY.match(password):
        raise AuthError('Password must be at least 8 chars, include 1 uppercase, and 1 symbol')


def normalize_username(username: str) -> str:
    normalized = username.strip().lower().replace(' ', '')
    if not USERNAME_PATTERN.match(normalized):
        raise AuthError('Username must be lowercase letters/numbers, 3-120 chars')
    return normalized


def generate_username(first_name: str, last_name: str) -> str:
    base = f'{first_name}{last_name}'.strip().lower().replace(' ', '')
    if not base:
        raise AuthError('Username cannot be empty')
    if not USERNAME_PATTERN.match(base):
        raise AuthError('Username must be lowercase letters/numbers, 3-120 chars')
    return base


def generate_workspace_slug(name: str) -> str:
    base = name.strip().lower().replace(' ', '-')
    base = WORKSPACE_SLUG_PATTERN.sub('-', base).strip('-')
    if not base:
        raise AuthError('Workspace name cannot be empty')
    return base[:120]


def issue_access_token(user_id: str, workspace_id: str, role_name: str) -> str:
    settings = get_settings()
    payload = {
        'sub': user_id,
        'workspace_id': workspace_id,
        'role': role_name,
        'iat': datetime.now(timezone.utc),
        'exp': datetime.now(timezone.utc) + timedelta(hours=1),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm='HS256')


def decode_token(token: str) -> dict:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=['HS256'])


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()
