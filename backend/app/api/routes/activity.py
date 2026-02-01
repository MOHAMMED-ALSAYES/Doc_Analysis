from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import Role
from ...models.activity_log import ActivityLog


router = APIRouter()


def ensure_can_view_logs(user: User, db: Session):
    role = db.get(Role, user.role_id) if user.role_id else None
    # مدير النظام يمكنه عرض السجلات دائماً
    if role and role.name == 'system_admin':
        return
    if not role or not (role.permissions or {}).get("view_activity_logs"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("")
def list_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    username: Optional[str] = None,
    action: Optional[str] = None,
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = 100,
):
    ensure_can_view_logs(current_user, db)
    q = db.query(ActivityLog)
    
    # البحث باسم المستخدم
    if username:
        users = db.query(User).filter(User.username.ilike(f"%{username}%")).all()
        if users:
            user_ids = [u.id for u in users]
            q = q.filter(ActivityLog.user_id.in_(user_ids))
        else:
            # إذا لم يُوجد مستخدم بهذا الاسم، نُرجع قائمة فارغة
            return []
    
    if action:
        q = q.filter(ActivityLog.action == action)
    
    # فلترة حسب التاريخ
    if date_from:
        try:
            # تحويل من YYYY-MM-DD إلى datetime
            dtf = datetime.strptime(date_from, "%Y-%m-%d")
            q = q.filter(ActivityLog.timestamp >= dtf)
        except Exception:
            pass
    
    if date_to:
        try:
            # تحويل من YYYY-MM-DD إلى datetime وإضافة 23:59:59
            dtt = datetime.strptime(date_to, "%Y-%m-%d")
            dtt = dtt.replace(hour=23, minute=59, second=59)
            q = q.filter(ActivityLog.timestamp <= dtt)
        except Exception:
            pass
    
    rows = q.order_by(ActivityLog.id.desc()).limit(limit).all()
    
    # جلب أسماء المستخدمين
    user_ids = [r.user_id for r in rows if r.user_id]
    users_map = {}
    if user_ids:
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        users_map = {u.id: {"username": u.username, "full_name": u.full_name} for u in users}
    
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "username": users_map.get(r.user_id, {}).get("username") if r.user_id else None,
            "full_name": users_map.get(r.user_id, {}).get("full_name") if r.user_id else None,
            "document_id": r.document_id,
            "action": r.action,
            "details": r.action_details,
            "ip": r.ip_address,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


