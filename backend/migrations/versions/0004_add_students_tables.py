"""add students and student_grades tables

Revision ID: 0004_add_students_tables
Revises: 0003_add_user_permissions
Create Date: 2025-01-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0004_add_students_tables'
down_revision = '0003_add_user_permissions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # التحقق من وجود الجداول أولاً
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # إنشاء جدول students
    if 'students' not in existing_tables:
        op.create_table(
            'students',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('student_number', sa.String(length=100), nullable=False),
            sa.Column('full_name', sa.String(length=200), nullable=False),
            sa.Column('full_name_ar', sa.String(length=200), nullable=True),
            sa.Column('email', sa.String(length=200), nullable=True),
            sa.Column('phone', sa.String(length=50), nullable=True),
            sa.Column('date_of_birth', sa.Date(), nullable=True),
            sa.Column('grade_level', sa.String(length=50), nullable=True),
            sa.Column('department', sa.String(length=200), nullable=True),
            sa.Column('total_grades', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('average_score', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
            sa.Column('updated_at', sa.TIMESTAMP(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('student_number')
        )
    else:
        # إضافة العمود full_name_ar إذا كان الجدول موجوداً والعمود غير موجود
        existing_columns = [col['name'] for col in inspector.get_columns('students')]
        if 'full_name_ar' not in existing_columns:
            op.add_column('students', sa.Column('full_name_ar', sa.String(length=200), nullable=True))
        if 'total_grades' not in existing_columns:
            op.add_column('students', sa.Column('total_grades', sa.Integer(), nullable=False, server_default='0'))
    
    # إنشاء جدول student_grades
    if 'student_grades' not in existing_tables:
        op.create_table(
            'student_grades',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('document_id', sa.Integer(), nullable=True),
            sa.Column('subject', sa.String(length=200), nullable=True),
            sa.Column('exam_type', sa.String(length=100), nullable=True),
            sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('max_score', sa.Numeric(precision=5, scale=2), nullable=True, server_default='100'),
            sa.Column('percentage', sa.Numeric(precision=5, scale=2), nullable=True),
            sa.Column('grade', sa.String(length=10), nullable=True),
            sa.Column('exam_date', sa.Date(), nullable=True),
            sa.Column('semester', sa.String(length=50), nullable=True),
            sa.Column('academic_year', sa.String(length=50), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(), nullable=True),
            sa.Column('updated_at', sa.TIMESTAMP(), nullable=True),
            sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
    
    # إنشاء جدول الربط student_documents
    if 'student_documents' not in existing_tables:
        op.create_table(
            'student_documents',
            sa.Column('student_id', sa.Integer(), nullable=False),
            sa.Column('document_id', sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('student_id', 'document_id')
        )


def downgrade() -> None:
    op.drop_table('student_documents')
    op.drop_table('student_grades')
    op.drop_table('students')



