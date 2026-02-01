"""fix students table columns

Revision ID: 0006_fix_students_table
Revises: 0005_add_documents_columns
Create Date: 2025-11-26 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '0006_fix_students_table'
down_revision = '0005_add_documents_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if not inspector.has_table('students'):
        print("⚠️  جدول students غير موجود - تخطي")
        return
    
    existing_columns = [col['name'] for col in inspector.get_columns('students')]
    
    # إضافة الأعمدة المفقودة باستخدام op.execute بشكل آمن
    columns_to_add = {
        'full_name_ar': "ALTER TABLE students ADD COLUMN IF NOT EXISTS full_name_ar VARCHAR(200);",
        'email': "ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(200);",
        'phone': "ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);",
        'date_of_birth': "ALTER TABLE students ADD COLUMN IF NOT EXISTS date_of_birth DATE;",
        'grade_level': "ALTER TABLE students ADD COLUMN IF NOT EXISTS grade_level VARCHAR(50);",
        'department': "ALTER TABLE students ADD COLUMN IF NOT EXISTS department VARCHAR(200);",
        'total_grades': "ALTER TABLE students ADD COLUMN IF NOT EXISTS total_grades INTEGER NOT NULL DEFAULT 0;",
        'average_score': "ALTER TABLE students ADD COLUMN IF NOT EXISTS average_score NUMERIC(5, 2);",
        'created_at': "ALTER TABLE students ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;",
        'updated_at': "ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;",
    }
    
    for col_name, sql in columns_to_add.items():
        if col_name not in existing_columns:
            op.execute(sql)
    
    # حذف الأعمدة القديمة بشكل آمن
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE students DROP CONSTRAINT IF EXISTS students_department_id_fkey;
            ALTER TABLE students DROP COLUMN IF EXISTS registered_at;
            ALTER TABLE students DROP COLUMN IF EXISTS department_id;
            ALTER TABLE students DROP COLUMN IF EXISTS metadata;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """)


def downgrade() -> None:
    # في حالة التراجع، لا نعيد الأعمدة القديمة
    pass

