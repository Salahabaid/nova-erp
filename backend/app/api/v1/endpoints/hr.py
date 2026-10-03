from fastapi import APIRouter, File, Form, UploadFile

from app.core.config import get_settings
from app.core.deps import UserDep
from app.core.errors import BadRequest
from app.repositories.db import Table, get_admin_client
from app.schemas.common import EmployeeIn, TaskIn
from app.services.crud import create_row, delete_row, get_row, list_rows, update_row

employees = APIRouter(prefix="/employees", tags=["employees"])
tasks = APIRouter(prefix="/tasks", tags=["tasks"])
documents = APIRouter(prefix="/documents", tags=["documents"])


@employees.get("")
def list_employees(user: UserDep, page: int = 1, page_size: int = 20, search: str | None = None, status: str | None = None):
    user.require("employees.read")
    return list_rows(
        "employees",
        page=page,
        page_size=page_size,
        search=search,
        search_columns=["first_name", "last_name", "email", "position", "department"],
        filters={"status": status},
    )


@employees.post("")
def create_employee(body: EmployeeIn, user: UserDep):
    user.require("employees.write")
    return create_row("employees", body.model_dump(), user.id)


@employees.patch("/{item_id}")
def update_employee(item_id: str, body: EmployeeIn, user: UserDep):
    user.require("employees.write")
    return update_row("employees", item_id, body.model_dump(), user.id)


@employees.delete("/{item_id}")
def delete_employee(item_id: str, user: UserDep):
    user.require("employees.write")
    delete_row("employees", item_id, user.id)
    return {"message": "Employé supprimé."}


@tasks.get("")
def list_tasks(user: UserDep, status: str | None = None, assignee_id: str | None = None):
    user.require("tasks.read")
    filters = {"status": status, "assignee_id": assignee_id}
    if user.role_slug == "employee":
        filters["assignee_id"] = user.id
    items, _ = Table("tasks").list(
        select="*, profiles(first_name, last_name), employees(first_name, last_name)",
        filters=filters,
        page=1,
        page_size=100,
        order="created_at",
    )
    return {"items": items}


@tasks.post("")
def create_task(body: TaskIn, user: UserDep):
    user.require("tasks.write")
    return create_row("tasks", body.model_dump(), user.id)


@tasks.patch("/{item_id}")
def update_task(item_id: str, body: dict, user: UserDep):
    user.require("tasks.write")
    return update_row("tasks", item_id, body, user.id)


@tasks.delete("/{item_id}")
def delete_task(item_id: str, user: UserDep):
    user.require("tasks.write")
    delete_row("tasks", item_id, user.id)
    return {"message": "Tâche supprimée."}


@documents.get("")
def list_documents(user: UserDep, page: int = 1, page_size: int = 20, related_type: str | None = None):
    user.require("documents.read")
    return list_rows(
        "documents",
        page=page,
        page_size=page_size,
        search=None,
        search_columns=[],
        filters={"related_type": related_type},
        select="*, profiles(first_name, last_name)",
    )


@documents.post("")
async def upload_document(
    user: UserDep,
    file: UploadFile = File(...),
    related_type: str | None = Form(default=None),
    related_id: str | None = Form(default=None),
):
    user.require("documents.write")
    settings = get_settings()
    content = await file.read()
    if len(content) > 8 * 1024 * 1024:
        raise BadRequest("Fichier trop volumineux (8 Mo max).")
    path = f"docs/{user.id}/{file.filename}"
    db = get_admin_client()
    db.storage.from_(settings.storage_bucket).upload(path, content, {"content-type": file.content_type or "application/octet-stream", "upsert": "true"})
    public = db.storage.from_(settings.storage_bucket).get_public_url(path)
    return create_row(
        "documents",
        {
            "name": file.filename,
            "file_url": public,
            "mime_type": file.content_type,
            "size_bytes": len(content),
            "related_type": related_type,
            "related_id": related_id,
            "uploaded_by": user.id,
        },
        user.id,
    )


@documents.delete("/{item_id}")
def delete_document(item_id: str, user: UserDep):
    user.require("documents.write")
    delete_row("documents", item_id, user.id)
    return {"message": "Document supprimé."}
