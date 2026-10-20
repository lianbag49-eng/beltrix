"""Ourbit initial schema, independent of future model edits."""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column('email', sa.String(254), nullable=False, unique=True),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('password_hash', sa.Text(), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.Column('telegram_id', sa.BigInteger(), unique=True),
        sa.CheckConstraint('id BETWEEN 1 AND 3'),
        sa.CheckConstraint("role IN ('admin','reviewer','analyst')"))
    op.create_table('sessions',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('login_limits',
        sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('resets_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('kols',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('channel_id', sa.String(64), unique=True, nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('subscribers', sa.BigInteger()),
        sa.Column('source_url', sa.Text(), nullable=False),
        sa.Column('latest_published_at', sa.DateTime(timezone=True)),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('videos', sa.JSON(), nullable=False),
        sa.Column('analysis', sa.JSON(), nullable=False),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('stage', sa.String(20), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False))
    op.create_table('discoveries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('query', sa.String(100), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('result', sa.JSON(), nullable=False))
    op.create_table('proposals',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('kol_id', sa.Integer(), sa.ForeignKey('kols.id'), nullable=False),
        sa.Column('author_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('generator', sa.String(80), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True)),
        sa.Column('review_note', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('actor_id', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('action', sa.String(80), nullable=False),
        sa.Column('target', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_table('telegram_updates',
        sa.Column('update_id', sa.BigInteger(), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_proposals_status', 'proposals', ['status'])
    op.create_index('ix_discoveries_actor_time', 'discoveries', ['created_by','created_at'])
    op.create_index('ix_kols_verified', 'kols', ['verified_at'])


def downgrade():
    # Rollbacks must preserve CRM and approval evidence.
    raise RuntimeError('Destructive downgrade is disabled; restore an audited backup explicitly.')
