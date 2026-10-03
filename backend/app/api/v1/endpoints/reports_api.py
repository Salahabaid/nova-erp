from fastapi import APIRouter
from fastapi.responses import Response

from app.core.deps import UserDep
from app.services.reports import generate, to_csv, to_pdf, to_xlsx

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/{kind}")
def report(
    kind: str,
    user: UserDep,
    date_from: str | None = None,
    date_to: str | None = None,
    customer_id: str | None = None,
    product_id: str | None = None,
    export: str | None = None,
):
    user.require("reports.read")
    data = generate(kind, date_from, date_to, customer_id, product_id)
    if export == "csv":
        return Response(
            content=to_csv(data),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={kind}.csv"},
        )
    if export == "xlsx":
        return Response(
            content=to_xlsx(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={kind}.xlsx"},
        )
    if export == "pdf":
        return Response(
            content=to_pdf(data),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={kind}.pdf"},
        )
    return data
