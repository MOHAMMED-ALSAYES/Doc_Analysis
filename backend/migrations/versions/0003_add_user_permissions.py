"""add users.permissions jsonb

Revision ID: 0003_add_user_permissions
Revises: 0002_no_categories_acl_students
Create Date: 2025-11-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '0003_add_user_permissions'
down_revision = '0002_no_categories_acl_students'
branch_labels = None
depends_on = None


def upgrade() -> None:
    try:
        op.add_column('users', sa.Column('permissions', postgresql.JSONB(), nullable=True))
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column('users', 'permissions')
    except Exception:
        pass


