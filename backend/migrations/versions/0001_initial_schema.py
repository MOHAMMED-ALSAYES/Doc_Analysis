"""initial schema

Revision ID: 0001_initial
Revises: 
Create Date: 2025-10-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # roles
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=50), nullable=False, unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('permissions', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb")),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
    )

    # users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('username', sa.String(length=100), nullable=False, unique=True),
        sa.Column('full_name', sa.String(length=200)),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role_id', sa.Integer(), sa.ForeignKey('roles.id', ondelete='SET NULL')),
        sa.Column('email', sa.String(length=150), unique=True),
        sa.Column('phone', sa.String(length=20)),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('last_login', sa.TIMESTAMP(timezone=True)),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # document_types
    op.create_table(
        'document_types',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # categories
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # students
    op.create_table(
        'students',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_number', sa.String(length=50), unique=True),
        sa.Column('full_name', sa.String(length=200)),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('categories.id')),
        sa.Column('registered_at', sa.Date()),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text())),
    )

    # documents
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('uploader_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('document_number', sa.String(length=100), nullable=False, unique=True),
        sa.Column('type_id', sa.Integer(), sa.ForeignKey('document_types.id')),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id')),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=True),
        sa.Column('title', sa.String(length=400)),
        sa.Column('content_text', sa.Text()),
        sa.Column('original_date', sa.Date()),
        sa.Column('pdf_path', sa.String(length=500)),
        sa.Column('image_path', sa.String(length=500)),
        sa.Column('status', sa.String(length=20), server_default='active'),
        sa.Column('version', sa.Integer(), server_default='1'),
        sa.Column('ocr_accuracy', sa.Numeric(5, 2)),
        sa.Column('ai_classification', sa.String(length=200)),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP()),
    )
    op.create_index('ix_documents_document_number', 'documents', ['document_number'], unique=True)
    op.create_index('ix_documents_type', 'documents', ['type_id'])
    op.create_index('ix_documents_category', 'documents', ['category_id'])
    op.create_index('ix_documents_student', 'documents', ['student_id'])
    op.create_index('ix_documents_status', 'documents', ['status'])

    # attachments
    op.create_table(
        'attachments',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE')),
        sa.Column('file_path', sa.String(length=500)),
        sa.Column('file_type', sa.String(length=50)),
        sa.Column('uploaded_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('uploaded_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # document_tags
    op.create_table(
        'document_tags',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE')),
        sa.Column('tag', sa.String(length=100)),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )
    op.create_index('ix_document_tags_doc', 'document_tags', ['document_id'])
    op.create_index('ix_document_tags_tag', 'document_tags', ['tag'])

    # user_department_permissions
    op.create_table(
        'user_department_permissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('categories.id', ondelete='CASCADE')),
        sa.Column('can_view', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('can_upload', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('can_manage', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('granted_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )
    op.create_index('uq_user_dept', 'user_department_permissions', ['user_id', 'department_id'], unique=True)

    # document_backups
    op.create_table(
        'document_backups',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('original_document_id', sa.Integer(), sa.ForeignKey('documents.id')),
        sa.Column('backup_reason', sa.String(length=100)),
        sa.Column('backed_up_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('backup_time', sa.TIMESTAMP(), server_default=sa.text('now()')),
        sa.Column('title_snapshot', sa.String(length=400)),
        sa.Column('content_snapshot', sa.Text()),
        sa.Column('pdf_path_snapshot', sa.String(length=500)),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('priority_level', sa.String(length=20), server_default='normal'),
        sa.Column('retention_days', sa.Integer(), server_default='30'),
        sa.Column('checksum', sa.String(length=128)),
    )

    # ai_analytics
    op.create_table(
        'ai_analytics',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('analysis_type', sa.String(length=100)),
        sa.Column('department_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=True),
        sa.Column('metric_value', sa.Numeric()),
        sa.Column('metric_description', sa.Text()),
        sa.Column('previous_value', sa.Numeric()),
        sa.Column('trend', sa.String(length=20)),
        sa.Column('change_percentage', sa.Numeric()),
        sa.Column('confidence', sa.Numeric()),
        sa.Column('recommendation', sa.Text()),
        sa.Column('alert_level', sa.String(length=20)),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # ocr_accuracy_analytics
    op.create_table(
        'ocr_accuracy_analytics',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE')),
        sa.Column('overall_accuracy', sa.Numeric(5, 2)),
        sa.Column('arabic_accuracy', sa.Numeric(5, 2)),
        sa.Column('english_accuracy', sa.Numeric(5, 2)),
        sa.Column('error_types', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('problem_pages', postgresql.ARRAY(sa.Integer())),
        sa.Column('improvement_suggestions', sa.Text()),
        sa.Column('analyzed_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # document_search_index
    op.create_table(
        'document_search_index',
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id'), primary_key=True),
        sa.Column('search_vector', postgresql.TSVECTOR()),
        sa.Column('auto_tags', postgresql.ARRAY(sa.Text())),
        sa.Column('named_entities', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('search_title', sa.String(length=400)),
        sa.Column('search_content', sa.Text()),
        sa.Column('dates_in_document', postgresql.ARRAY(sa.Date())),
        sa.Column('ranking_score', sa.Numeric()),
        sa.Column('last_searched_at', sa.TIMESTAMP()),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_ds_vector ON document_search_index USING GIN (search_vector);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ds_title_trgm ON document_search_index USING GIN (search_title gin_trgm_ops);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ds_content_trgm ON document_search_index USING GIN (search_content gin_trgm_ops);")

    # activity_logs
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id'), nullable=True),
        sa.Column('action', sa.String(length=50)),
        sa.Column('action_details', postgresql.JSONB(astext_type=sa.Text())),
        sa.Column('ip_address', sa.String(length=45)),
        sa.Column('timestamp', sa.TIMESTAMP(), server_default=sa.text('now()')),
    )

    # analysis_records
    op.create_table(
        'analysis_records',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id')),
        sa.Column('metric_type', sa.String(length=100)),
        sa.Column('value', sa.Numeric()),
        sa.Column('trend', sa.String(length=20)),
        sa.Column('analyzed_at', sa.TIMESTAMP(), server_default=sa.text('now()')),
        sa.Column('notes', sa.Text()),
    )


def downgrade() -> None:
    op.drop_table('analysis_records')
    op.drop_table('activity_logs')
    op.drop_index('ix_ds_content_trgm', table_name='document_search_index')
    op.drop_index('ix_ds_title_trgm', table_name='document_search_index')
    op.drop_index('ix_ds_vector', table_name='document_search_index')
    op.drop_table('document_search_index')
    op.drop_table('ocr_accuracy_analytics')
    op.drop_table('ai_analytics')
    op.drop_table('document_backups')
    op.drop_index('uq_user_dept', table_name='user_department_permissions')
    op.drop_table('user_department_permissions')
    op.drop_index('ix_document_tags_tag', table_name='document_tags')
    op.drop_index('ix_document_tags_doc', table_name='document_tags')
    op.drop_table('document_tags')
    op.drop_table('attachments')
    op.drop_index('ix_documents_status', table_name='documents')
    op.drop_index('ix_documents_student', table_name='documents')
    op.drop_index('ix_documents_category', table_name='documents')
    op.drop_index('ix_documents_type', table_name='documents')
    op.drop_index('ix_documents_document_number', table_name='documents')
    op.drop_table('documents')
    op.drop_table('students')
    op.drop_table('categories')
    op.drop_table('document_types')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')
    op.drop_table('roles')


