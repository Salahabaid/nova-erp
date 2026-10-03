from typing import Annotated, Any

from fastapi import Depends, Header

from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_access_token
from app.repositories.db import get_admin_client, unwrap


class CurrentUser:
    def __init__(self, profile: dict[str, Any], permissions: set[str], role_slug: str):
        self.id: str = profile["id"]
        self.profile = profile
        self.permissions = permissions
        self.role_slug = role_slug
        self.email: str = profile.get("email") or ""

    def require(self, *codes: str) -> None:
        if self.role_slug == "super_admin":
            return
        if not any(code in self.permissions for code in codes):
            raise Forbidden()


def get_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized()
    return authorization.split(" ", 1)[1].strip()


def get_current_user(token: Annotated[str, Depends(get_bearer_token)]) -> CurrentUser:
    payload = decode_access_token(token)
    user_id = payload["sub"]
    db = get_admin_client()

    result = (
        db.table("profiles")
        .select("*, roles(id, slug, name)")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    rows = unwrap(result)
    if not rows:
        raise Unauthorized("Profil utilisateur introuvable.")
    profile = rows[0]
    if profile.get("status") != "active":
        raise Forbidden("Compte inactif.")

    role = profile.get("roles") or {}
    role_id = profile.get("role_id")
    role_slug = role.get("slug") if isinstance(role, dict) else "employee"

    perms: set[str] = set()
    if role_id:
        rp = (
            db.table("role_permissions")
            .select("permissions(code)")
            .eq("role_id", role_id)
            .execute()
        )
        for row in unwrap(rp):
            perm = row.get("permissions") or {}
            if perm.get("code"):
                perms.add(perm["code"])

    return CurrentUser(profile, perms, role_slug or "employee")


UserDep = Annotated[CurrentUser, Depends(get_current_user)]
