from typing import Any

import jwt
from jwt import InvalidTokenError

from app.core.config import get_settings
from app.core.errors import Unauthorized


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        if payload.get("sub"):
            return payload
    except InvalidTokenError:
        pass

    # Nouvelles clés / JWT ECC : validation via l'API Auth (pas besoin du secret HS256)
    try:
        from app.repositories.db import get_admin_client

        result = get_admin_client().auth.get_user(token)
        user = getattr(result, "user", None)
        if user and getattr(user, "id", None):
            return {"sub": user.id, "email": getattr(user, "email", None)}
    except Exception:
        pass

    raise Unauthorized("Session expirée ou jeton invalide.")
