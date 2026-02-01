from sqlalchemy import Integer, String, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("roles.id", ondelete="SET NULL"))
    email: Mapped[str | None] = mapped_column(String(150))
    phone: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default='true', nullable=False)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    last_login: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))
    must_change_password: Mapped[bool] = mapped_column(Boolean, server_default='true', nullable=False)
    analyze_scope: Mapped[str | None] = mapped_column(String(20))
    permissions: Mapped[dict | None] = mapped_column(JSONB)



