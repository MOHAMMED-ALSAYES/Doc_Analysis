from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import secrets
import string

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from ..models.user import User


pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except Exception:
        # أي خلل في التجزئة يعتبر فشل تحقق بدل رفع 500
        return False


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(subject: dict, expires_seconds: Optional[int] = None) -> str:
    to_encode: dict[str, Any] = subject.copy()
    expire = datetime.now(timezone.utc) + timedelta(seconds=expires_seconds or settings.jwt_access_expires)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.jwt_refresh_expires)
    payload = {**subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token subject")
    user: User | None = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive or missing user")
    return user


def generate_temporary_password(length: int = 12) -> str:
    """توليد كلمة مرور مؤقتة آمنة"""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))



