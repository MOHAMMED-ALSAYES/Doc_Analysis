from sqlalchemy import Integer, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class DocumentPermission(Base):
    __tablename__ = "document_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    document_id: Mapped[int] = mapped_column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    can_view: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    can_download: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    can_edit_metadata: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    can_share: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    can_analyze: Mapped[bool] = mapped_column(Boolean, server_default='false', nullable=False)
    granted_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    granted_at: Mapped[str | None] = mapped_column(TIMESTAMP())



