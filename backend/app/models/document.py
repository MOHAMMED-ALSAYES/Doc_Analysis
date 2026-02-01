from sqlalchemy import Integer, String, Text, Date, TIMESTAMP, Numeric, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from .base import Base

if TYPE_CHECKING:
    from .student import Student


# جدول الربط بين الطلاب والوثائق
student_document_association = Table(
    'student_documents',
    Base.metadata,
    Column('student_id', Integer, ForeignKey('students.id', ondelete='CASCADE'), primary_key=True),
    Column('document_id', Integer, ForeignKey('documents.id', ondelete='CASCADE'), primary_key=True),
)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uploader_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    document_number: Mapped[str] = mapped_column(String(100), unique=True)
    type_id: Mapped[int | None] = mapped_column(Integer)
    
    # معلومات أساسية
    title: Mapped[str | None] = mapped_column(String(400))
    suggested_title: Mapped[str | None] = mapped_column(String(400))  # العنوان المقترح تلقائياً
    content_text: Mapped[str | None] = mapped_column(Text())
    
    # التصنيف والبيانات الوصفية
    ai_classification: Mapped[str | None] = mapped_column(String(200))  # شهادة، تقرير، كتاب رسمي، إلخ
    document_direction: Mapped[str | None] = mapped_column(String(20))  # صادر / وارد
    original_date: Mapped[str | None] = mapped_column(Date())  # تاريخ الوثيقة الأصلي
    source_type: Mapped[str | None] = mapped_column(String(20))  # file / scanner
    
    # المسارات
    original_file_path: Mapped[str | None] = mapped_column(String(500))  # الملف الأصلي
    pdf_path: Mapped[str | None] = mapped_column(String(500))  # نسخة PDF
    image_path: Mapped[str | None] = mapped_column(String(500))  # صورة معاينة
    ocr_text_path: Mapped[str | None] = mapped_column(String(500))  # النص المستخرج
    
    # الحالة والجودة
    status: Mapped[str] = mapped_column(String(20))  # pending, processing, completed, failed
    version: Mapped[int] = mapped_column(Integer)
    ocr_accuracy: Mapped[float | None] = mapped_column(Numeric(5, 2))
    
    # التواريخ
    created_at: Mapped[str | None] = mapped_column(TIMESTAMP())
    updated_at: Mapped[str | None] = mapped_column(TIMESTAMP())
    
    # العلاقات
    students: Mapped[list["Student"]] = relationship(
        "Student",
        secondary="student_documents",
        back_populates="documents"
    )



