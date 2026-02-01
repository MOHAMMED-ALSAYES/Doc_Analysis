"""
API endpoints للطلاب والدرجات
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.role import Role
from ...models.student import Student, StudentGrade
from ...models.document import Document
from ...services.student_extractor import student_extractor


router = APIRouter()


@router.post("/students")
def create_student(
    student_number: str,
    full_name: str,
    full_name_ar: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    grade_level: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """إنشاء طالب جديد"""
    # التحقق من وجود طالب بنفس الرقم
    existing = db.query(Student).filter(Student.student_number == student_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="يوجد طالب بنفس الرقم")
    
    now = datetime.now()
    student = Student(
        student_number=student_number,
        full_name=full_name,
        full_name_ar=full_name_ar,
        email=email,
        phone=phone,
        date_of_birth=datetime.fromisoformat(date_of_birth) if date_of_birth else None,
        grade_level=grade_level,
        department=department,
        created_at=now,
        updated_at=now,
    )
    
    db.add(student)
    db.commit()
    db.refresh(student)
    
    return {
        "id": student.id,
        "student_number": student.student_number,
        "full_name": student.full_name,
        "full_name_ar": student.full_name_ar,
        "email": student.email,
        "phone": student.phone,
        "grade_level": student.grade_level,
        "department": student.department,
        "total_grades": student.total_grades,
        "average_score": float(student.average_score) if student.average_score else None,
    }


@router.get("/students")
def list_students(
    search: Optional[str] = Query(None),
    student_number: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    grade_level: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """قائمة الطلاب مع البحث والفلترة"""
    query = db.query(Student)
    
    # البحث
    if search:
        search_filter = or_(
            Student.student_number.ilike(f"%{search}%"),
            Student.full_name.ilike(f"%{search}%"),
            Student.full_name_ar.ilike(f"%{search}%"),
            Student.email.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)
    
    # فلترة حسب رقم الطالب
    if student_number:
        query = query.filter(Student.student_number.ilike(f"%{student_number}%"))
    
    # فلترة حسب القسم
    if department:
        query = query.filter(Student.department == department)
    
    # فلترة حسب المرحلة
    if grade_level:
        query = query.filter(Student.grade_level == grade_level)
    
    # الترتيب
    query = query.order_by(Student.student_number)
    
    # العد
    total = query.count()
    
    # الصفحات
    students = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "students": [
            {
                "id": s.id,
                "student_number": s.student_number,
                "full_name": s.full_name,
                "full_name_ar": s.full_name_ar,
                "email": s.email,
                "phone": s.phone,
                "grade_level": s.grade_level,
                "department": s.department,
                "total_grades": s.total_grades,
                "average_score": float(s.average_score) if s.average_score else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in students
        ],
    }


@router.get("/students/{student_id}")
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """الحصول على بيانات طالب مع درجاته"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    
    # جلب الدرجات
    grades = db.query(StudentGrade).filter(StudentGrade.student_id == student_id).order_by(
        StudentGrade.exam_date.desc() if StudentGrade.exam_date else StudentGrade.created_at.desc()
    ).all()
    
    # جلب الوثائق المرتبطة
    documents = db.query(Document).join(
        Document.students
    ).filter(Student.id == student_id).all()
    
    return {
        "id": student.id,
        "student_number": student.student_number,
        "full_name": student.full_name,
        "full_name_ar": student.full_name_ar,
        "email": student.email,
        "phone": student.phone,
        "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
        "grade_level": student.grade_level,
        "department": student.department,
        "total_grades": student.total_grades,
        "average_score": float(student.average_score) if student.average_score else None,
        "grades": [
            {
                "id": g.id,
                "subject": g.subject,
                "exam_type": g.exam_type,
                "score": float(g.score) if g.score else None,
                "max_score": float(g.max_score) if g.max_score else None,
                "percentage": float(g.percentage) if g.percentage else None,
                "grade": g.grade,
                "exam_date": g.exam_date.isoformat() if g.exam_date else None,
                "semester": g.semester,
                "academic_year": g.academic_year,
                "notes": g.notes,
                "document_id": g.document_id,
            }
            for g in grades
        ],
        "documents": [
            {
                "id": d.id,
                "document_number": d.document_number,
                "title": d.title or d.suggested_title,
                "classification": d.ai_classification,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
    }


@router.get("/students/{student_id}/analysis")
def get_student_analysis(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """تحليل أداء الطالب مع الاتجاهات والإحصائيات"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    
    # جلب جميع الدرجات مرتبة حسب التاريخ
    grades = db.query(StudentGrade).filter(
        StudentGrade.student_id == student_id,
        StudentGrade.percentage.isnot(None)
    ).order_by(
        desc(StudentGrade.exam_date) if StudentGrade.exam_date else desc(StudentGrade.created_at)
    ).all()
    
    if not grades:
        return {
            "student_id": student_id,
            "student_number": student.student_number,
            "full_name": student.full_name,
            "message": "لا توجد درجات متاحة للتحليل",
            "trends": [],
            "statistics": {},
            "performance_by_subject": {},
            "time_series": []
        }
    
    # حساب الاتجاهات (تحسن/انخفاض)
    trends = []
    time_series = []
    
    # تجميع الدرجات حسب المادة
    grades_by_subject: Dict[str, List[Dict[str, Any]]] = {}
    for grade in grades:
        subject = grade.subject or "غير محدد"
        if subject not in grades_by_subject:
            grades_by_subject[subject] = []
        
        exam_date = grade.exam_date if grade.exam_date else grade.created_at
        grades_by_subject[subject].append({
            "date": exam_date.isoformat() if exam_date else None,
            "percentage": float(grade.percentage) if grade.percentage else 0,
            "score": float(grade.score) if grade.score else 0,
            "max_score": float(grade.max_score) if grade.max_score else 100,
            "exam_type": grade.exam_type,
        })
    
    # حساب الاتجاه لكل مادة
    performance_by_subject = {}
    for subject, subject_grades in grades_by_subject.items():
        if len(subject_grades) < 2:
            continue
        
        # ترتيب حسب التاريخ (من الأقدم للأحدث)
        sorted_grades = sorted(subject_grades, key=lambda x: x["date"] or "")
        
        first_percentage = sorted_grades[0]["percentage"]
        last_percentage = sorted_grades[-1]["percentage"]
        
        change = last_percentage - first_percentage
        change_percentage = (change / first_percentage * 100) if first_percentage > 0 else 0
        
        trend = "improving" if change > 0 else "declining" if change < 0 else "stable"
        
        performance_by_subject[subject] = {
            "first_score": first_percentage,
            "last_score": last_percentage,
            "change": round(change, 2),
            "change_percentage": round(change_percentage, 2),
            "trend": trend,
            "total_exams": len(subject_grades),
            "average": round(sum(g["percentage"] for g in subject_grades) / len(subject_grades), 2),
        }
        
        # إضافة للاتجاهات العامة
        trends.append({
            "subject": subject,
            "trend": trend,
            "change": round(change, 2),
            "change_percentage": round(change_percentage, 2),
        })
    
    # إحصائيات عامة
    all_percentages = [float(g.percentage) for g in grades if g.percentage is not None]
    
    if all_percentages:
        recent_count = min(5, len(all_percentages))
        recent_percentages = all_percentages[:recent_count]
        older_percentages = all_percentages[recent_count:] if len(all_percentages) > recent_count else []
        
        recent_avg = sum(recent_percentages) / len(recent_percentages)
        older_avg = sum(older_percentages) / len(older_percentages) if older_percentages else recent_avg
        
        overall_trend = "improving" if recent_avg > older_avg else "declining" if recent_avg < older_avg else "stable"
        overall_change = recent_avg - older_avg
    else:
        overall_trend = "stable"
        overall_change = 0
        recent_avg = 0
        older_avg = 0
    
    # سلسلة زمنية للرسم البياني
    for grade in reversed(grades):  # من الأقدم للأحدث
        exam_date = grade.exam_date if grade.exam_date else grade.created_at
        time_series.append({
            "date": exam_date.isoformat() if exam_date else None,
            "percentage": float(grade.percentage) if grade.percentage else 0,
            "subject": grade.subject or "غير محدد",
            "exam_type": grade.exam_type,
        })
    
    statistics = {
        "total_exams": len(grades),
        "overall_average": round(sum(all_percentages) / len(all_percentages), 2) if all_percentages else 0,
        "highest_score": round(max(all_percentages), 2) if all_percentages else 0,
        "lowest_score": round(min(all_percentages), 2) if all_percentages else 0,
        "recent_average": round(recent_avg, 2),
        "previous_average": round(older_avg, 2),
        "overall_trend": overall_trend,
        "overall_change": round(overall_change, 2),
        "subjects_count": len(grades_by_subject),
    }
    
    # ترتيب الاتجاهات حسب التغيير
    trends.sort(key=lambda x: abs(x["change"]), reverse=True)
    
    return {
        "student_id": student_id,
        "student_number": student.student_number,
        "full_name": student.full_name,
        "full_name_ar": student.full_name_ar,
        "department": student.department,
        "grade_level": student.grade_level,
        "statistics": statistics,
        "trends": trends,
        "performance_by_subject": performance_by_subject,
        "time_series": time_series,
        "grades_summary": {
            "total": len(grades),
            "improving_subjects": len([t for t in trends if t["trend"] == "improving"]),
            "declining_subjects": len([t for t in trends if t["trend"] == "declining"]),
            "stable_subjects": len([t for t in trends if t["trend"] == "stable"]),
        }
    }


@router.get("/students/search/{query}")
def search_students(
    query: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """بحث سريع عن الطلاب (للبحث المتقدم)"""
    search_filter = or_(
        Student.student_number.ilike(f"%{query}%"),
        Student.full_name.ilike(f"%{query}%"),
        Student.full_name_ar.ilike(f"%{query}%"),
    )
    
    students = db.query(Student).filter(search_filter).limit(20).all()
    
    return {
        "students": [
            {
                "id": s.id,
                "student_number": s.student_number,
                "full_name": s.full_name,
                "full_name_ar": s.full_name_ar,
                "average_score": float(s.average_score) if s.average_score else None,
            }
            for s in students
        ],
    }


@router.put("/students/{student_id}")
def update_student(
    student_id: int,
    full_name: Optional[str] = None,
    full_name_ar: Optional[str] = None,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    date_of_birth: Optional[str] = None,
    grade_level: Optional[str] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """تحديث بيانات طالب"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    
    if full_name:
        student.full_name = full_name
    if full_name_ar is not None:
        student.full_name_ar = full_name_ar
    if email is not None:
        student.email = email
    if phone is not None:
        student.phone = phone
    if date_of_birth:
        student.date_of_birth = datetime.fromisoformat(date_of_birth)
    if grade_level is not None:
        student.grade_level = grade_level
    if department is not None:
        student.department = department
    
    student.updated_at = datetime.now()
    
    db.commit()
    db.refresh(student)
    
    return {
        "id": student.id,
        "student_number": student.student_number,
        "full_name": student.full_name,
        "full_name_ar": student.full_name_ar,
        "email": student.email,
        "phone": student.phone,
        "grade_level": student.grade_level,
        "department": student.department,
    }


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """حذف طالب"""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="الطالب غير موجود")
    
    db.delete(student)
    db.commit()
    
    return {"message": "تم حذف الطالب بنجاح"}