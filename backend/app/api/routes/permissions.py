from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import Role
from ...models.document import Document
from ...models.document_permission import DocumentPermission
from ...services.audit import log_activity


router = APIRouter()


def ensure_can_manage_permissions(user: User, db: Session):
    role = db.get(Role, user.role_id) if user.role_id else None
    if not role or not (role.permissions or {}).get("manage_permissions"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


class GrantPayload(BaseModel):
    user_id: int
    can_view: bool = True
    can_download: bool = False
    can_edit_metadata: bool = False
    can_delete: bool = False
    can_share: bool = False
    can_analyze: bool = False


@router.get("/{document_id}")
def list_permissions(document_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_can_manage_permissions(current_user, db)
    if not db.get(Document, document_id):
        raise HTTPException(status_code=404, detail="Document not found")
    perms = db.query(DocumentPermission).filter(DocumentPermission.document_id == document_id).all()
    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "can_view": p.can_view,
            "can_download": p.can_download,
            "can_edit_metadata": p.can_edit_metadata,
            "can_delete": p.can_delete,
            "can_share": p.can_share,
            "can_analyze": p.can_analyze,
        }
        for p in perms
    ]


@router.post("/{document_id}/grant")
def grant_permission(document_id: int, payload: GrantPayload, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    ensure_can_manage_permissions(current_user, db)
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # upsert-like: find existing
    p = db.query(DocumentPermission).filter(DocumentPermission.document_id == document_id, DocumentPermission.user_id == payload.user_id).first()
    if not p:
        p = DocumentPermission(document_id=document_id, user_id=payload.user_id)
    p.can_view = payload.can_view
    p.can_download = payload.can_download
    p.can_edit_metadata = payload.can_edit_metadata
    p.can_delete = payload.can_delete
    p.can_share = payload.can_share
    p.can_analyze = payload.can_analyze
    p.granted_by = current_user.id
    db.add(p)
    db.commit()
    db.refresh(p)
    try:
        log_activity(db, user_id=current_user.id, action="grant_permission", details={"document_id": document_id, "to_user": payload.user_id, "flags": payload.model_dump()}, ip=request.client.host if request else None, document_id=document_id)
    except Exception:
        pass
    return {"status": "ok", "id": p.id}


@router.delete("/{document_id}/revoke/{user_id}")
def revoke_permission(document_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user), request: Request = None):
    ensure_can_manage_permissions(current_user, db)
    p = db.query(DocumentPermission).filter(DocumentPermission.document_id == document_id, DocumentPermission.user_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Permission not found")
    db.delete(p)
    db.commit()
    try:
        log_activity(db, user_id=current_user.id, action="revoke_permission", details={"document_id": document_id, "from_user": user_id}, ip=request.client.host if request else None, document_id=document_id)
    except Exception:
        pass
    return {"status": "revoked"}



