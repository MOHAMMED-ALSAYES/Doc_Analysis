"""Script للتحقق من تطابق قاعدة البيانات مع النماذج"""
from sqlalchemy import inspect, create_engine
from app.core.config import settings
from app.models import document, user, student, activity_log, document_permission, attachment, role, document_type

engine = create_engine(settings.database_url)
inspector = inspect(engine)

def check_table(table_name, model_class):
    """التحقق من تطابق جدول مع النموذج"""
    if not inspector.has_table(table_name):
        print(f"❌ الجدول {table_name} غير موجود")
        return False
    
    db_columns = {col['name'] for col in inspector.get_columns(table_name)}
    model_columns = set(model_class.__table__.columns.keys())
    
    missing_in_db = model_columns - db_columns
    extra_in_db = db_columns - model_columns
    
    if missing_in_db:
        print(f"❌ {table_name}: أعمدة مفقودة في DB: {missing_in_db}")
    if extra_in_db:
        print(f"⚠️  {table_name}: أعمدة إضافية في DB (قد تكون قديمة): {extra_in_db}")
    if not missing_in_db:
        print(f"✅ {table_name}: جميع أعمدة النموذج موجودة في DB")
    
    return len(missing_in_db) == 0

print("=" * 60)
print("فحص تطابق قاعدة البيانات مع النماذج")
print("=" * 60)

# التحقق من جميع الجداول
check_table('documents', document.Document)
check_table('users', user.User)
check_table('students', student.Student)
check_table('student_grades', student.StudentGrade)
check_table('activity_logs', activity_log.ActivityLog)
check_table('document_permissions', document_permission.DocumentPermission)
check_table('attachments', attachment.Attachment)
check_table('roles', role.Role)
check_table('document_types', document_type.DocumentType)

print("=" * 60)


