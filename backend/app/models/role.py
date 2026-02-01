from sqlalchemy import Integer, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    permissions: Mapped[dict] = mapped_column(JSONB, server_default='{}', nullable=False)
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP(timezone=True))



