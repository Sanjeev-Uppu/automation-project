
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import RegisterRequest, ChangePasswordRequest


class AuthService:

    @staticmethod
    async def get_user_by_email(
        db: AsyncSession,
        email: str,
    ) -> User | None:
        result = await db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_user_by_id(
        db: AsyncSession,
        user_id: UUID,
    ) -> User | None:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    @classmethod
    async def register_user(
        cls,
        db: AsyncSession,
        data: RegisterRequest,
    ) -> User:
        existing_user = await cls.get_user_by_email(
            db,
            str(data.email),
        )

        if existing_user:
            raise ValueError("An account with this email already exists.")

        user = User(
            full_name=data.full_name,
            email=str(data.email).lower(),
            password_hash=hash_password(data.password),
            is_active=True,
        )

        db.add(user)

        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            await db.rollback()
            raise ValueError("An account with this email already exists.")

        return user

    @classmethod
    async def authenticate_user(
        cls,
        db: AsyncSession,
        email: str,
        password: str,
    ) -> User | None:
        user = await cls.get_user_by_email(db, email)

        if not user:
            return None

        if not user.is_active:
            return None

        if not verify_password(password, user.password_hash):
            return None

        return user

    @classmethod
    async def change_password(
        cls,
        db: AsyncSession,
        user: User,
        data: ChangePasswordRequest,
    ) -> None:
        if not verify_password(
            data.current_password,
            user.password_hash,
        ):
            raise ValueError("Current password is incorrect.")

        if data.current_password == data.new_password:
            raise ValueError(
                "New password must be different from the current password."
            )

        user.password_hash = hash_password(data.new_password)

        await db.commit()
        await db.refresh(user)
