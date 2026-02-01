from typing import Any, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from ..models.activity_log import ActivityLog


def log_activity(
    db: Session,
    *,
    user_id: Optional[int],
    action: str,
    details: Optional[dict[str, Any]] = None,
    ip: Optional[str] = None,
    document_id: Optional[int] = None,
) -> None:
    try:
        entry = ActivityLog(
            user_id=user_id,
            document_id=document_id,
            action=action,
            action_details=details or {},
            ip_address=ip,
            timestamp=datetime.now(),
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


