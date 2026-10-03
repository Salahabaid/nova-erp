from datetime import datetime, timezone

import httpx

from app.core.config import get_settings
from app.core.errors import BadRequest, Unauthorized
from app.core.rbac import MODULE_PERMS
from app.repositories.db import confirm_auth_user, get_admin_client, one, unwrap


def _auth():
    return get_admin_client().auth


def login(email: str, password: str) -> dict:
    try:
        result = _auth().sign_in_with_password({"email": email, "password": password})
    except Exception as exc:
        raise Unauthorized("Email ou mot de passe incorrect.") from exc
    if not result.session:
        raise Unauthorized("Email ou mot de passe incorrect.")
    db = get_admin_client()
    db.table("profiles").update({"last_login_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", result.user.id
    ).execute()
    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "expires_in": result.session.expires_in,
        "token_type": "bearer",
    }


def register(payload: dict) -> dict:
    db = get_admin_client()
    existing = unwrap(db.table("profiles").select("id").limit(1).execute())
    try:
        result = _auth().sign_up(
            {
                "email": payload["email"],
                "password": payload["password"],
                "options": {
                    "data": {
                        "first_name": payload["first_name"],
                        "last_name": payload["last_name"],
                    }
                },
            }
        )
    except Exception as exc:
        raise BadRequest("Impossible de créer le compte. Cet email est peut-être déjà utilisé.") from exc
    if not result.user:
        raise BadRequest("Impossible de créer le compte.")
    confirm_auth_user(result.user.id)
    # trigger creates profile; ensure names + first user role
    role_slug = "super_admin" if not existing else "employee"
    role = one(db.table("roles").select("id").eq("slug", role_slug).limit(1).execute())
    db.table("profiles").update(
        {
            "first_name": payload["first_name"],
            "last_name": payload["last_name"],
            "email": payload["email"],
            "role_id": role["id"],
            "status": "active",
        }
    ).eq("id", result.user.id).execute()
    if result.session:
        return {
            "access_token": result.session.access_token,
            "refresh_token": result.session.refresh_token,
            "expires_in": result.session.expires_in,
            "token_type": "bearer",
        }
    return login(payload["email"], payload["password"])


def me(user) -> dict:
    company = unwrap(get_admin_client().table("company_settings").select("*").limit(1).execute())
    settings = company[0] if company else {}
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.profile.get("first_name"),
        "last_name": user.profile.get("last_name"),
        "phone": user.profile.get("phone"),
        "avatar_url": user.profile.get("avatar_url"),
        "role": user.profile.get("roles"),
        "role_slug": user.role_slug,
        "permissions": sorted(user.permissions),
        "modules": {k: any(p in user.permissions or user.role_slug == "super_admin" for p in v) for k, v in MODULE_PERMS.items()}
        if user.role_slug != "super_admin"
        else {k: True for k in MODULE_PERMS},
        "onboarding_completed": bool(settings.get("onboarding_completed")),
        "company": settings,
    }


def refresh_session(refresh_token: str) -> dict:
    try:
        result = _auth().refresh_session(refresh_token)
    except Exception as exc:
        raise Unauthorized("Session expirée. Reconnectez-vous.") from exc
    if not result.session:
        raise Unauthorized("Session expirée. Reconnectez-vous.")
    return {
        "access_token": result.session.access_token,
        "refresh_token": result.session.refresh_token,
        "expires_in": result.session.expires_in,
        "token_type": "bearer",
    }


def change_password(user, password: str, access_token: str | None = None) -> None:
    try:
        get_admin_client().auth.admin.update_user_by_id(user.id, {"password": password})
        return
    except Exception:
        pass
    if not access_token:
        raise BadRequest("Impossible de modifier le mot de passe.")
    settings = get_settings()
    response = httpx.put(
        f"{settings.supabase_url}/auth/v1/user",
        headers={"Authorization": f"Bearer {access_token}", "apikey": settings.supabase_anon_key},
        json={"password": password},
        timeout=20,
    )
    if response.status_code >= 400:
        raise BadRequest("Impossible de modifier le mot de passe.")


def invite_user(payload: dict) -> dict:
    db = get_admin_client()
    uid = None
    try:
        result = db.auth.admin.create_user(
            {
                "email": payload["email"],
                "password": payload["password"],
                "email_confirm": True,
                "user_metadata": {
                    "first_name": payload["first_name"],
                    "last_name": payload["last_name"],
                },
            }
        )
        uid = result.user.id
    except Exception:
        try:
            result = _auth().sign_up(
                {
                    "email": payload["email"],
                    "password": payload["password"],
                    "options": {
                        "data": {
                            "first_name": payload["first_name"],
                            "last_name": payload["last_name"],
                        }
                    },
                }
            )
        except Exception as exc:
            raise BadRequest("Impossible de créer l'utilisateur.") from exc
        if not result.user:
            raise BadRequest("Impossible de créer l'utilisateur.")
        uid = result.user.id
        confirm_auth_user(uid)
    db.table("profiles").update(
        {
            "first_name": payload["first_name"],
            "last_name": payload["last_name"],
            "email": payload["email"],
            "role_id": payload["role_id"],
            "status": "active",
        }
    ).eq("id", uid).execute()
    return one(db.table("profiles").select("*, roles(id, slug, name)").eq("id", uid).limit(1).execute())
