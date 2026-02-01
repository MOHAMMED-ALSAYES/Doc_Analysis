"""remove categories, add ACL and multi-student linkage

Revision ID: 0002_no_categories_acl_students
Revises: 0001_initial
Create Date: 2025-10-30 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0002_no_categories_acl_students'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users: add must_change_password and analyze_scope
    op.add_column('users', sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('users', sa.Column('analyze_scope', sa.String(length=20), server_default='own'))

    # documents: drop category_id and student_id (switch to many-to-many)
    # استخدام op.execute مباشرة لتجنب مشاكل batch_alter_table
    
    # حذف constraints بشكل آمن
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_id_fkey;
            ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_student_id_fkey;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """)
    
    # حذف indexes بشكل آمن
    op.execute("DROP INDEX IF EXISTS ix_documents_category;")
    op.execute("DROP INDEX IF EXISTS ix_documents_student;")
    
    # حذف الأعمدة بشكل آمن
    op.execute("""
        DO $$ 
        BEGIN
            ALTER TABLE documents DROP COLUMN IF EXISTS category_id;
            ALTER TABLE documents DROP COLUMN IF EXISTS student_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """)

    # ai_analytics: drop department_id
    op.execute("""
        DO $$ 
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_analytics') THEN
                ALTER TABLE ai_analytics DROP CONSTRAINT IF EXISTS ai_analytics_department_id_fkey;
                ALTER TABLE ai_analytics DROP COLUMN IF EXISTS department_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END $$;
    """)

    # drop categories table if exists
    op.execute("DROP TABLE IF EXISTS categories CASCADE;")

    # drop user_department_permissions if exists
    op.execute("DROP INDEX IF EXISTS uq_user_dept;")
    op.execute("DROP TABLE IF EXISTS user_department_permissions CASCADE;")

    # document_permissions table (document-level ACL)
    op.create_table(
        'document_permissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('can_view', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('can_download', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('can_edit_metadata', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('can_delete', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('can_share', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('can_analyze', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('granted_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('granted_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )
    op.create_index('ix_doc_perms_user', 'document_permissions', ['user_id'])
    op.create_index('ix_doc_perms_doc', 'document_permissions', ['document_id'])
    op.create_index('uq_doc_perms_user_doc', 'document_permissions', ['user_id', 'document_id'], unique=True)

    # document_students table (multi-student per document)
    op.create_table(
        'document_students',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('extracted_full_name', sa.String(length=200), nullable=True),
        sa.Column('extracted_student_number', sa.String(length=50), nullable=True),
        sa.Column('match_confidence', sa.Numeric(3, 2), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )
    op.create_index('ix_doc_students_doc', 'document_students', ['document_id'])
    op.create_index('ix_doc_students_student', 'document_students', ['student_id'])
    op.create_index('ix_doc_students_number', 'document_students', ['extracted_student_number'])
    op.execute("CREATE INDEX IF NOT EXISTS ix_doc_students_name_trgm ON document_students USING GIN (lower(extracted_full_name) gin_trgm_ops);")


def downgrade() -> None:
    # drop new tables
    try:
        op.drop_index('ix_doc_students_name_trgm')
    except Exception:
        pass
    op.drop_index('ix_doc_students_number', table_name='document_students')
    op.drop_index('ix_doc_students_student', table_name='document_students')
    op.drop_index('ix_doc_students_doc', table_name='document_students')
    op.drop_table('document_students')

    op.drop_index('uq_doc_perms_user_doc', table_name='document_permissions')
    op.drop_index('ix_doc_perms_doc', table_name='document_permissions')
    op.drop_index('ix_doc_perms_user', table_name='document_permissions')
    op.drop_table('document_permissions')

    # restore columns on documents (student_id)
    with op.batch_alter_table('documents') as batch_op:
        batch_op.add_column(sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=True))
        op.create_index('ix_documents_student', 'documents', ['student_id'])

    # restore ai_analytics.department_id (without FK to categories)
    with op.batch_alter_table('ai_analytics') as batch_op:
        batch_op.add_column(sa.Column('department_id', sa.Integer(), nullable=True))

    # users: remove added columns
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('analyze_scope')
        batch_op.drop_column('must_change_password')

    # note: categories and user_department_permissions are not recreated in downgrade



