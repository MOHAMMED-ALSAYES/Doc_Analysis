from .celery_app import celery_app
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from pathlib import Path

from ..core.config import settings
from ..models.document import Document
from ..services.convert import convert_to_pdf
from ..services.ocr import extract_text_from_pdf


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


@celery_app.task(name="health.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="documents.process")
def process_document(document_id: int) -> str:
    db: Session = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if not doc:
            return "missing"
        # Ensure PDF exists (convert if needed)
        if not doc.pdf_path:
            # try convert from originals path pattern
            # Here we assume first attachment saved as original in originals/yyyy/mm/document_number/original.ext
            yyyy = doc.created_at.year if doc.created_at else None
            # If created_at is None, fallback to current year/month
            # In real code, store original path in attachments; simplified here
        
        if doc.pdf_path:
            text, acc = extract_text_from_pdf(Path(doc.pdf_path), settings.tesseract_langs)
            doc.content_text = text
            doc.ocr_accuracy = acc
            doc.status = "active"
            db.add(doc)
            db.commit()
            return "ok"
        return "skipped"
    finally:
        db.close()



