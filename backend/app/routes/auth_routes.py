
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_csrf_token,
    cookie_secure,
    token_expiry_seconds,
)
from app.dependencies.auth import (
    get_current_user,
    get_db_session,
    require_csrf,
)
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

ACCESS_COOKIE = "access_token"
CSRF_COOKIE = "csrf_token"


def set_auth_cookies(response: Response, user: User) -> None:
    token = create_access_token(user.id)
    csrf_token = create_csrf_token()

    common_cookie_options = {
        "secure": cookie_secure(),
        "samesite": "lax",
        "path": "/",
    }

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=token,
        max_age=token_expiry_seconds(),
        httponly=True,
        **common_cookie_options,
    )

    response.set_cookie(
        key=CSRF_COOKIE,
        value=csrf_token,
        max_age=token_expiry_seconds(),
        httponly=False,
        **common_cookie_options,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_COOKIE,
        path="/",
        secure=cookie_secure(),
        httponly=True,
        samesite="lax",
    )

    response.delete_cookie(
        key=CSRF_COOKIE,
        path="/",
        secure=cookie_secure(),
        httponly=False,
        samesite="lax",
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        user = await AuthService.register_user(db, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    set_auth_cookies(response, user)

    return AuthResponse(
        message="Registration successful.",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=AuthResponse,
)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db_session),
):
    user = await AuthService.authenticate_user(
        db,
        str(data.email),
        data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    set_auth_cookies(response, user)

    return AuthResponse(
        message="Login successful.",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/logout",
)
async def logout(
    response: Response,
    _: None = Depends(require_csrf),
):
    clear_auth_cookies(response)

    return {"message": "Logged out successfully."}


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return UserResponse.model_validate(current_user)


@router.post(
    "/change-password",
)
async def change_password(
    data: ChangePasswordRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_csrf),
):
    try:
        await AuthService.change_password(
            db,
            current_user,
            data,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    # Invalidate the current login after changing the password.
    clear_auth_cookies(response)

    return {
        "message": "Password changed successfully. Please log in again."
    }
