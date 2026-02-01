"""add missing columns to documents

Revision ID: 0005_add_documents_columns
Revises: 0004_add_students_tables
Create Date: 2025-11-26 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = '0005_add_documents_columns'
down_revision = '0004_add_students_tables'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # التحقق من وجود جدول documents
    if not inspector.has_table('documents'):
        print("⚠️  جدول documents غير موجود - تخطي إضافة الأعمدة")
        return
    
    existing_columns = [col['name'] for col in inspector.get_columns('documents')]
    
    # إضافة الأعمدة المفقودة
    if 'suggested_title' not in existing_columns:
        op.add_column('documents', sa.Column('suggested_title', sa.String(length=400), nullable=True))
        print("✅ تم إضافة العمود: suggested_title")
    
    if 'document_direction' not in existing_columns:
        op.add_column('documents', sa.Column('document_direction', sa.String(length=20), nullable=True))
        print("✅ تم إضافة العمود: document_direction")
    
    if 'source_type' not in existing_columns:
        op.add_column('documents', sa.Column('source_type', sa.String(length=20), nullable=True))
        print("✅ تم إضافة العمود: source_type")
    
    if 'original_file_path' not in existing_columns:
        op.add_column('documents', sa.Column('original_file_path', sa.String(length=500), nullable=True))
        print("✅ تم إضافة العمود: original_file_path")
    
    if 'ocr_text_path' not in existing_columns:
        op.add_column('documents', sa.Column('ocr_text_path', sa.String(length=500), nullable=True))
        print("✅ تم إضافة العمود: ocr_text_path")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    
    if not inspector.has_table('documents'):
        return
    
    existing_columns = [col['name'] for col in inspector.get_columns('documents')]
    
    if 'ocr_text_path' in existing_columns:
        op.drop_column('documents', 'ocr_text_path')
    if 'original_file_path' in existing_columns:
        op.drop_column('documents', 'original_file_path')
    if 'source_type' in existing_columns:
        op.drop_column('documents', 'source_type')
    if 'document_direction' in existing_columns:
        op.drop_column('documents', 'document_direction')
    if 'suggested_title' in existing_columns:
        op.drop_column('documents', 'suggested_title')


