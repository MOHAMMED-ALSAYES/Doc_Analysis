from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.security import get_current_user, hash_password
from ...models.user import User
from ...models.role import Role
from ...schemas.user import UserCreate, UserRead
from ...services.audit import log_activity
from ...core.presence import get_online_user_ids


router = APIRouter()


def ensure_admin(user: User, db: Session):
    """التحقق من صلاحيات المدير - يفحص الدور وصلاحيات المستخدم الشخصية"""
    if not user.role_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No role assigned")
    
    role = db.get(Role, user.role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role not found")
    
    # دمج صلاحيات الدور مع صلاحيات المستخدم الشخصية
    merged_permissions = {}
    if role.permissions:
        merged_permissions.update(role.permissions)
    if user.permissions:
        merged_permissions.update(user.permissions)
    
    # إذا كان الدور system_admin، يتم منح الصلاحيات تلقائياً
    if role.name == 'system_admin':
        return  # مدير النظام لديه كل الصلاحيات
    
    # فحص صلاحية manage_users
    if not merged_permissions.get("manage_users"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


@router.post("/", response_model=UserRead)
def create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    ensure_admin(current_user, db)

    role = db.query(Role).filter(Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role_id=role.id,
        must_change_password=payload.must_change_password,
        analyze_scope=payload.analyze_scope,
    )
    
    # إضافة صلاحية view_reports تلقائياً للمستخدمين الجدد
    user_permissions = {}
    if payload.permissions is not None:
        user_permissions = payload.permissions.model_dump()
    
    # إضافة صلاحية view_reports إذا لم تكن موجودة
    if 'view_reports' not in user_permissions:
        user_permissions['view_reports'] = True
    
    user.permissions = user_permissions
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        log_activity(db, user_id=current_user.id, action="create_user", details={"new_user": user.username, "role": role.name}, ip=request.client.host if request else None)
    except Exception:
        pass

    return UserRead(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        role_name=role.name,
        is_active=True,
        must_change_password=user.must_change_password,
        analyze_scope=user.analyze_scope,
    )


@router.get("/", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_admin(current_user, db)
    users = db.query(User).all()
    role_map = {r.id: r.name for r in db.query(Role).all()}
    # presence
    online_ids = get_online_user_ids([u.id for u in users])
    result = []
    for u in users:
        is_online = (u.id in online_ids)
        item = UserRead(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            phone=u.phone,
            role_name=role_map.get(u.role_id, ""),
            is_active=u.is_active,
            must_change_password=bool(u.must_change_password),
            analyze_scope=u.analyze_scope,
            permissions=u.permissions or {},
            online=is_online,
        )
        result.append(item)
    return result


@router.put("/{user_id}")
def update_user(user_id: int, payload: dict, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    ensure_admin(current_user, db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # allowed fields
    full_name = payload.get("full_name")
    email = payload.get("email")
    phone = payload.get("phone")
    role_name = payload.get("role_name")
    is_active = payload.get("is_active")
    analyze_scope = payload.get("analyze_scope")
    must_change_password = payload.get("must_change_password")
    permissions = payload.get("permissions")
    
    if full_name is not None:
        user.full_name = full_name
    if email is not None:
        user.email = email
    if phone is not None:
        user.phone = phone
    if role_name is not None:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            raise HTTPException(status_code=400, detail="Invalid role")
        user.role_id = role.id
    if is_active is not None:
        user.is_active = bool(is_active)
    if analyze_scope is not None:
        user.analyze_scope = analyze_scope
    if must_change_password is not None:
        user.must_change_password = bool(must_change_password)
    if permissions is not None:
        user.permissions = permissions
    db.add(user)
    db.commit()
    try:
        log_activity(db, user_id=current_user.id, action="update_user", details={"user": user.username}, ip=request.client.host if request else None)
    except Exception:
        pass
    return {"status": "ok"}


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    ensure_admin(current_user, db)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # منع حذف نفسك
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    username = user.username
    
    try:
        # حذف سجلات النشاط الخاصة بالمستخدم أولاً
        from ...models.activity_log import ActivityLog
        db.query(ActivityLog).filter(ActivityLog.user_id == user_id).delete()
        
        # الآن يمكن حذف المستخدم
        db.delete(user)
        db.commit()
        
        # تسجيل عملية الحذف
        log_activity(db, user_id=current_user.id, action="delete_user", details={"user": username}, ip=request.client.host if request else None)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
    
    return {"status": "deleted"}


@router.post("/{user_id}/reset-password")
def reset_user_password(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    """إعادة تعيين كلمة مرور المستخدم من قبل المدير"""
    ensure_admin(current_user, db)
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # توليد كلمة مرور مؤقتة
    from ...core.security import generate_temporary_password, hash_password
    temp_password = generate_temporary_password()
    
    # تحديث كلمة المرور
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True  # إجبار المستخدم على تغيير كلمة المرور
    db.add(user)
    db.commit()
    
    # تسجيل النشاط
    try:
        log_activity(
            db, 
            user_id=current_user.id, 
            action="reset_user_password", 
            details={"target_user": user.username}, 
            ip=request.client.host if request else None
        )
    except Exception:
        pass
    
    # إرجاع كلمة المرور المؤقتة للمدير (في بيئة الإنتاج يجب إرسالها عبر قناة آمنة)
    return {
        "status": "ok",
        "temporary_password": temp_password,
        "message": "تم إعادة تعيين كلمة المرور بنجاح. يجب على المستخدم تغييرها عند تسجيل الدخول."
    }



