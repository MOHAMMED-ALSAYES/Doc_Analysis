from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import traceback

from ...core.db import get_db
from ...core.security import verify_password, create_access_token, hash_password, get_current_user
from ...models.user import User
from ...models.role import Role
from ...schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest
from ...core.presence import mark_online
from ...services.audit import log_activity


router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        # البحث عن المستخدم
        user = db.query(User).filter(User.username == data.username).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # التحقق من كلمة المرور
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # التحقق من أن المستخدم نشط
        if not user.is_active:
            raise HTTPException(status_code=401, detail="User is inactive")
        
        # إنشاء token
        try:
            token = create_access_token({"sub": user.id})
        except Exception as e:
            print(f"[ERROR] Failed to create access token: {e}")
            print(traceback.format_exc())
            raise HTTPException(status_code=500, detail="Failed to create access token")
        
        # تحديث حالة الاتصال (غير ضروري للعمل الأساسي)
        try:
            mark_online(user.id)
        except Exception as e:
            print(f"[WARN] Failed to mark user online: {e}")
            # لا نفشل تسجيل الدخول إذا فشل تحديث حالة الاتصال
        
        # تسجيل النشاط (غير ضروري للعمل الأساسي)
        try:
            log_activity(db, user_id=user.id, action="login", details={"username": user.username})
        except Exception as e:
            print(f"[WARN] Failed to log activity: {e}")
            # لا نفشل تسجيل الدخول إذا فشل تسجيل النشاط
        
        return TokenResponse(access_token=token, must_change_password=bool(user.must_change_password))
    except HTTPException:
        # إعادة رفع HTTPException كما هي
        raise
    except Exception as e:
        print(f"[ERROR] Login error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.add(current_user)
    db.commit()
    return {"status": "ok"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    # merge role permissions with user overrides
    merged = {}
    if role and role.permissions:
        merged.update(role.permissions)
    if current_user.permissions:
        merged.update(current_user.permissions)
    # system_admin ضمانًا لصلاحيات الإدارة حتى لو كان JSON الدور ناقصًا
    if role and role.name == 'system_admin':
        merged['manage_users'] = True
        merged['view_activity_logs'] = True
        merged['manage_permissions'] = True
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "must_change_password": bool(current_user.must_change_password),
        "role_id": current_user.role_id,
        "role_name": role.name if role else None,
        "permissions": merged,
    }


@router.post("/ping")
def ping_presence(current_user: User = Depends(get_current_user)):
    try:
        mark_online(current_user.id)
    except Exception:
        pass
    return {"ok": True}



