from sqlalchemy.orm import Session
from ..models.role import Role
from ..models.user import User
from .security import hash_password
from .config import settings


DEFAULT_ROLES = {
    "system_admin": {
        "manage_system": True,
        "manage_users": True,
        "manage_permissions": True,
        "view_all_documents": True,
        "analyze_all": True,
        "view_all_analytics": True,
        "manage_backups": True,
        "view_activity_logs": True,
    },
    "employee": {
        "view_own_documents": True,
        "manage_own_documents": True,
        "search_own_documents": True,
    },
}


def seed_roles_and_admin(db: Session):
    """إنشاء الأدوار ومستخدم admin الافتراضي"""
    try:
        # roles
        for name, perms in DEFAULT_ROLES.items():
            role = db.query(Role).filter(Role.name == name).first()
            if not role:
                role = Role(name=name, permissions=perms)
                db.add(role)
                db.commit()
                print(f"[OK] تم إنشاء الدور: {name}")
        
        admin_role = db.query(Role).filter(Role.name == "system_admin").first()
        
        # admin user - always use admin123 as default for simplicity
        admin_username = "admin"
        admin_password = "admin123"
        
        user = db.query(User).filter(User.username == admin_username).first()
        if not user:
            u = User(
                username=admin_username,
                full_name="System Administrator",
                password_hash=hash_password(admin_password),
                role_id=admin_role.id if admin_role else None,
                must_change_password=True,
                analyze_scope="all",
            )
            db.add(u)
            db.commit()
            print(f"[OK] تم إنشاء مستخدم admin: {admin_username} | كلمة المرور: {admin_password}")
        else:
            # تحديث كلمة المرور دائماً للتأكد
            user.password_hash = hash_password(admin_password)
            db.commit()
            print(f"[OK] تم تحديث كلمة مرور admin: {admin_username} | كلمة المرور: {admin_password}")
    except Exception as e:
        print(f"[WARN]  تحذير: لم يتم إنشاء الأدوار/المستخدمين: {e}")
        print("قد تحتاج إلى تشغيل migrations أولاً: alembic upgrade head")
        db.rollback()



