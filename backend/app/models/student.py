from sqlalchemy import Integer, String, Date, TIMESTAMP, Numeric, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from datetime import datetime

from .base import Base

if TYPE_CHECKING:
    from .document import Document


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    full_name_ar: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_of_birth: Mapped[Date | None] = mapped_column(Date(), nullable=True)
    grade_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    department: Mapped[str | None] = mapped_column(String(200), nullable=True)
    total_grades: Mapped[int] = mapped_column(Integer, nullable=False, server_default='0')
    average_score: Mapped[float | None] = mapped_column(Numeric(precision=5, scale=2), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(), nullable=True)

    # العلاقات
    documents: Mapped[list["Document"]] = relationship(
        "Document",
        secondary="student_documents",
        back_populates="students"
    )
    grades: Mapped[list["StudentGrade"]] = relationship("StudentGrade", back_populates="student", cascade="all, delete-orphan")


class StudentGrade(Base):
    __tablename__ = "student_grades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey('students.id', ondelete='CASCADE'), nullable=False)
    document_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('documents.id', ondelete='SET NULL'), nullable=True)
    subject: Mapped[str | None] = mapped_column(String(200), nullable=True)
    exam_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric(precision=5, scale=2), nullable=True)
    max_score: Mapped[float | None] = mapped_column(Numeric(precision=5, scale=2), nullable=True, server_default='100')
    percentage: Mapped[float | None] = mapped_column(Numeric(precision=5, scale=2), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(10), nullable=True)
    exam_date: Mapped[Date | None] = mapped_column(Date(), nullable=True)
    semester: Mapped[str | None] = mapped_column(String(50), nullable=True)
    academic_year: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(), nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(), nullable=True)

    # العلاقات
    student: Mapped["Student"] = relationship("Student", back_populates="grades")
