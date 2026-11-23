"""Add per-user Jira ticket bookmarks."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a91b2c3d4e5f"
down_revision = "efc43863504e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ticket_bookmarks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "jira_issue_id",
            sa.String(length=64),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["jira_issue_id"],
            ["tickets.jira_issue_id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "jira_issue_id",
            name="uq_ticket_bookmarks_user_ticket",
        ),
    )

    op.create_index(
        "ix_ticket_bookmarks_user_id",
        "ticket_bookmarks",
        ["user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_ticket_bookmarks_user_id",
        table_name="ticket_bookmarks",
    )
    op.drop_table("ticket_bookmarks")