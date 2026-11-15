
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.models.user import User
from app.services.auth_service import AuthService


async def get_db_session(
    request: Request,
) -> AsyncGenerator[AsyncSession, None]:
    database = getattr(request.app.state, "database", None)

    if database is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not available.",
        )

    async with database.session_factory() as session:
        yield session


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> User:
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    from uuid import UUID

    user_id = UUID(payload["sub"])

    user = await AuthService.get_user_by_id(db, user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is not available.",
        )

    return user


async def require_csrf(request: Request) -> None:
    from app.core.security import verify_csrf_token

    valid = verify_csrf_token(
        request.cookies.get("csrf_token"),
        request.headers.get("X-CSRF-Token"),
    )

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid CSRF token.",
        )
