from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.document import Document
from ...models.user import User
from ...models.role import Role
from ...services.audit import log_activity


router = APIRouter()


@router.post("/")
def search_documents(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    بحث متقدم في الوثائق:
    - البحث في العنوان والمحتوى
    - فلترة حسب النوع والاتجاه
    - دعم البحث الكامل في النص
    """
    try:
        query = payload.get('query', '').strip()
        search_field = payload.get('search_field', 'all')
        classification = payload.get('classification')
        direction = payload.get('direction')
        
        # التحقق من الصلاحيات
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        merged = {}
        if role and role.permissions:
            merged.update(role.permissions)
        if getattr(current_user, 'permissions', None):
            merged.update(current_user.permissions)
    except Exception as e:
        print(f"خطأ في معالجة البحث: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    # بناء الاستعلام مع join للمستخدم
    q = db.query(Document, User).outerjoin(User, Document.uploader_id == User.id)
    
    # فلترة حسب الصلاحيات
    if not merged.get("view_all_documents"):
        q = q.filter(Document.uploader_id == current_user.id)
    
    # فلترة حسب النوع
    if classification:
        q = q.filter(Document.ai_classification == classification)
    
    # فلترة حسب الاتجاه
    if direction:
        q = q.filter(Document.document_direction == direction)
    
    # البحث في النص
    if query:
        like_pattern = f"%{query}%"
        if search_field == "title":
            q = q.filter(
                or_(
                    Document.title.ilike(like_pattern),
                    Document.suggested_title.ilike(like_pattern)
                )
            )
        elif search_field == "content":
            q = q.filter(Document.content_text.ilike(like_pattern))
        else:  # all
            q = q.filter(
                or_(
                    Document.title.ilike(like_pattern),
                    Document.suggested_title.ilike(like_pattern),
                    Document.content_text.ilike(like_pattern)
                )
            )
    
    results = q.order_by(Document.id.desc()).limit(100).all()
    
    # تسجيل عملية البحث
    try:
        log_activity(
            db,
            user_id=current_user.id,
            action="search",
            details={
                "query": query,
                "search_field": search_field,
                "results_count": len(results),
            }
        )
    except:
        pass
    
    # بناء النتائج مع مقتطفات ومعلومات المستخدم
    response = []
    for d, uploader in results:
        snippet = ""
        if query and d.content_text:
            # استخراج مقتطف من النص حول الكلمة المبحوث عنها
            idx = d.content_text.lower().find(query.lower())
            if idx != -1:
                start = max(0, idx - 100)
                end = min(len(d.content_text), idx + 100)
                snippet = "..." + d.content_text[start:end] + "..."
        
        response.append({
            "id": d.id,
            "document_number": d.document_number,
            "title": d.title or d.suggested_title,
            "classification": d.ai_classification,
            "direction": d.document_direction,
            "snippet": snippet,
            "score": 1.0,  # يمكن تحسينها لاحقاً باستخدام full-text search
            "created_at": d.created_at,
            "uploader": {
                "id": uploader.id if uploader else None,
                "username": uploader.username if uploader else "غير معروف",
                "full_name": uploader.full_name if uploader else None,
            } if uploader else None,
        })
    
    return {"results": response, "count": len(response)}


@router.get("/")
def search_documents_get(
    q: Optional[str] = Query(None),
    in_field: str = Query("all", regex="^(all|title|content)$"),
    document_number: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """بحث بسيط (GET) - للتوافق مع الكود القديم"""
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    qry = db.query(Document)
    if not merged.get("view_all_documents"):
        qry = qry.filter(Document.uploader_id == current_user.id)

    if document_number:
        like = f"%{document_number}%"
        qry = qry.filter(Document.document_number.ilike(like))

    if date_from:
        qry = qry.filter(Document.original_date >= date_from)
    if date_to:
        qry = qry.filter(Document.original_date <= date_to)

    if q:
        like = f"%{q}%"
        if in_field == "title":
            qry = qry.filter(Document.title.ilike(like))
        elif in_field == "content":
            qry = qry.filter(Document.content_text.ilike(like))
        else:
            qry = qry.filter((Document.title.ilike(like)) | (Document.content_text.ilike(like)))

    results = qry.order_by(Document.id.desc()).limit(100).all()
    return [
        {
            "id": d.id,
            "document_number": d.document_number,
            "title": d.title,
            "original_date": d.original_date,
            "status": d.status,
        }
        for d in results
    ]
