from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


class AppError(HTTPException):
    def __init__(self, status_code: int, message: str, code: str = "error"):
        super().__init__(status_code=status_code, detail={"message": message, "code": code})


class NotFound(AppError):
    def __init__(self, message: str = "Ressource introuvable."):
        super().__init__(404, message, "not_found")


class Forbidden(AppError):
    def __init__(self, message: str = "Vous n'avez pas la permission d'effectuer cette action."):
        super().__init__(403, message, "forbidden")


class Unauthorized(AppError):
    def __init__(self, message: str = "Authentification requise."):
        super().__init__(401, message, "unauthorized")


class BadRequest(AppError):
    def __init__(self, message: str = "Requête invalide."):
        super().__init__(400, message, "bad_request")


async def unhandled_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"message": "Une erreur interne s'est produite.", "code": "internal"},
    )
