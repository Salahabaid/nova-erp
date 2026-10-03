from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import UserDep, get_bearer_token
from app.schemas.common import AuthLogin, AuthRefresh, AuthRegister, InviteUser, PasswordChange, UserUpdate
from app.services import auth_service
from app.services.crud import list_rows, update_row
from app.repositories.db import Table, unwrap

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(body: AuthLogin):
    return auth_service.login(body.email, body.password)


@router.post("/register")
def register(body: AuthRegister):
    return auth_service.register(body.model_dump())


@router.post("/refresh")
def refresh(body: AuthRefresh):
    return auth_service.refresh_session(body.refresh_token)


@router.get("/me")
def me(user: UserDep):
    return auth_service.me(user)


@router.post("/password")
def password(body: PasswordChange, user: UserDep, token: Annotated[str, Depends(get_bearer_token)]):
    auth_service.change_password(user, body.password, token)
    return {"message": "Mot de passe mis à jour."}


@router.get("/users")
def users(user: UserDep, page: int = 1, page_size: int = 20, search: str | None = None):
    user.require("users.manage")
    return list_rows(
        "profiles",
        page=page,
        page_size=page_size,
        search=search,
        search_columns=["first_name", "last_name", "email"],
        select="*, roles(id, slug, name)",
    )


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate, user: UserDep):
    user.require("users.manage")
    return update_row("profiles", user_id, body.model_dump(exclude_none=True), user.id)


@router.post("/users")
def create_user(body: InviteUser, user: UserDep):
    user.require("users.manage")
    return auth_service.invite_user(body.model_dump())


@router.get("/directory")
def directory(user: UserDep):
    return unwrap(Table("profiles").q().select("id, first_name, last_name, email").eq("status", "active").execute())


@router.patch("/me")
def update_me(body: UserUpdate, user: UserDep):
    data = {k: v for k, v in body.model_dump(exclude_none=True).items() if k in {"first_name", "last_name", "phone", "avatar_url"}}
    return update_row("profiles", user.id, data, user.id)


@router.get("/roles")
def roles(user: UserDep):
    user.require("users.manage", "settings.read")
    return unwrap(Table("roles").q().select("*, role_permissions(permissions(*))").execute())
