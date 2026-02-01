import shutil
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import mimetypes

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.document import Document
from ...models.attachment import Attachment
from ...models.user import User
from ...models.role import Role
from ...services.storage import ensure_storage_structure, generate_document_number, _sanitize_component
from ...services.intelligent_processor import IntelligentDocumentProcessor
from ...core.config import settings
from ...services.audit import log_activity
from ...services.student_extractor import student_extractor
from ...models.student import Student, StudentGrade
from pathlib import Path


router = APIRouter()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source_type: Optional[str] = Form('file'),
    direction: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """
    رفع وثيقة جديدة مع معالجة ذكية:
    - استخراج النص (OCR)
    - تصنيف تلقائي
    - اقتراح عنوان
    - تخزين منظم
    """
    temp_dir_obj = None
    temp_file = None
    try:
        # التأكد من وجود هيكل المجلدات
        ensure_storage_structure(settings.file_storage_root)
        
        # توليد رقم وثيقة فريد
        document_number = generate_document_number()
        
        # حفظ الملف مؤقتاً في مجلد مؤقت في النظام
        import tempfile
        temp_dir_obj = tempfile.mkdtemp(prefix=f"doc_upload_{document_number}_")
        temp_dir = Path(temp_dir_obj)
        temp_file = temp_dir / f"{document_number}{Path(file.filename).suffix}"
        
        with temp_file.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        # معالجة ذكية شاملة
        processor = IntelligentDocumentProcessor(
            file_path=temp_file,
            document_number=document_number,
            source_type=source_type or 'file'
        )
        
        result = processor.process(user_provided_title=title)
        
        # حفظ البيانات في قاعدة البيانات
        # إعطاء الأولوية للاتجاه المحدد من المستخدم
        final_direction = direction or result.get('document_direction')
        
        now = datetime.now()
        doc = Document(
            uploader_id=current_user.id,
            document_number=document_number,
            title=result.get('title'),
            suggested_title=result.get('suggested_title'),
            content_text=result.get('ocr_text'),
            ai_classification=result.get('classification'),
            document_direction=final_direction,
            source_type=source_type,
            original_file_path=result['paths'].get('original'),
            pdf_path=result['paths'].get('pdf'),
            ocr_text_path=result['paths'].get('ocr_text'),
            ocr_accuracy=result.get('ocr_accuracy'),
            status='completed',
            version=1,
            created_at=now,
            updated_at=now,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # حفظ مرفق
        att = Attachment(
            document_id=doc.id,
            file_path=result['paths'].get('original'),
            file_type=result.get('file_extension', '').replace('.', ''),
            uploaded_by=current_user.id,
        )
        db.add(att)
        db.commit()
        
        # تسجيل النشاط
        try:
            log_activity(
                db,
                user_id=current_user.id,
                action="upload_document",
                details={
                    "filename": file.filename,
                    "document_number": document_number,
                    "classification": result.get('classification'),
                    "ocr_accuracy": result.get('ocr_accuracy'),
                },
                ip=request.client.host if request else None,
                document_id=doc.id
            )
        except Exception:
            pass

        # حذف الملف المؤقت والمجلد المؤقت
        try:
            if temp_file.exists():
                temp_file.unlink()
            if temp_dir_obj and Path(temp_dir_obj).exists():
                shutil.rmtree(temp_dir_obj)
        except:
            pass
        
        return {
            "id": doc.id,
            "document_number": document_number,
            "title": doc.title,
            "suggested_title": doc.suggested_title,
            "classification": doc.ai_classification,
            "document_direction": doc.document_direction,
            "ocr_accuracy": doc.ocr_accuracy,
            "status": doc.status,
            "processing_time": result.get('processing_time'),
        }
        
    except Exception as e:
        db.rollback()
        # حذف المجلد المؤقت في حالة الخطأ
        if temp_dir_obj and Path(temp_dir_obj).exists():
            try:
                shutil.rmtree(temp_dir_obj)
            except:
                pass
        print(f"[ERROR] خطأ في رفع الوثيقة: {e}")
        raise HTTPException(status_code=500, detail=f"فشل رفع الوثيقة: {str(e)}")


@router.get("/")
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    classification: Optional[str] = None,
    direction: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    """عرض قائمة الوثائق مع فلترة"""
    # التحقق من الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    q = db.query(Document)
    
    # فلترة حسب الصلاحيات
    if not merged.get("view_all_documents"):
        q = q.filter(Document.uploader_id == current_user.id)
    
    # فلترة حسب النوع
    if classification:
        q = q.filter(Document.ai_classification == classification)
    
    # فلترة حسب الاتجاه
    if direction:
        q = q.filter(Document.document_direction == direction)
    
    # فلترة حسب التاريخ
    if date_from:
        try:
            q = q.filter(Document.created_at >= datetime.fromisoformat(date_from))
        except:
            pass
    
    if date_to:
        try:
            q = q.filter(Document.created_at <= datetime.fromisoformat(date_to))
        except:
            pass
    
    docs = q.order_by(Document.id.desc()).limit(100).all()
    
    return [
        {
            "id": d.id,
            "document_number": d.document_number,
            "title": d.title or d.suggested_title,
            "classification": d.ai_classification,
            "direction": d.document_direction,
            "status": d.status,
            "ocr_accuracy": d.ocr_accuracy,
            "uploader_id": d.uploader_id,
            "created_at": d.created_at,
        }
        for d in docs
    ]


@router.get("/stats")
def get_document_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """إحصائيات الوثائق والنظام - محسّن للأداء بشكل كبير"""
    from datetime import datetime
    import traceback
    
    # تحديد الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    has_view_all = merged.get("view_all_documents", False)
    
    # إرجاع بيانات افتراضية بسرعة في حالة عدم وجود وثائق
    try:
        # استعلام سريع للتحقق من وجود وثائق (لا نستخدم limit في count)
        if has_view_all:
            total_docs_check = db.query(func.count(Document.id)).scalar() or 0
        else:
            total_docs_check = db.query(func.count(Document.id)).filter(Document.uploader_id == current_user.id).scalar() or 0
        
        # إذا لم توجد وثائق، إرجاع بيانات افتراضية بسرعة
        if total_docs_check == 0:
            return {
                "total_documents": 0,
                "this_month_documents": 0,
                "average_ocr_accuracy": 0,
                "classification_counts": {cls: 0 for cls in ['شهادة', 'تقرير', 'كتاب رسمي', 'نموذج', 'أخرى']},
                "direction_counts": {'صادر': 0, 'وارد': 0},
                "recent_documents": [],
                "total_users": db.query(func.count(User.id)).scalar() if has_view_all else None,
            }
        
        # بناء الفلتر الأساسي
        base_filter = [] if has_view_all else [Document.uploader_id == current_user.id]
        
        # إجمالي الوثائق - استعلام محسّن
        total_docs = total_docs_check
        
        # متوسط دقة OCR - استعلام منفصل بسيط
        if has_view_all:
            avg_ocr_q = db.query(func.avg(Document.ocr_accuracy))
        else:
            avg_ocr_q = db.query(func.avg(Document.ocr_accuracy)).filter(Document.uploader_id == current_user.id)
        avg_ocr = float(avg_ocr_q.scalar() or 0)
        
        # إجمالي الوثائق هذا الشهر - استعلام منفصل بسيط
        first_day_this_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if has_view_all:
            this_month_q = db.query(func.count(Document.id)).filter(Document.created_at >= first_day_this_month)
        else:
            this_month_q = db.query(func.count(Document.id)).filter(
                Document.uploader_id == current_user.id,
                Document.created_at >= first_day_this_month
            )
        this_month_docs = this_month_q.scalar() or 0
        
        # إحصائيات حسب التصنيف والاتجاه - استعلام واحد محسّن
        if has_view_all:
            agg_q = db.query(
                Document.ai_classification,
                Document.document_direction,
                func.count(Document.id).label('count')
            ).group_by(Document.ai_classification, Document.document_direction).all()
        else:
            agg_q = db.query(
                Document.ai_classification,
                Document.document_direction,
                func.count(Document.id).label('count')
            ).filter(Document.uploader_id == current_user.id).group_by(Document.ai_classification, Document.document_direction).all()
        
        # تجميع البيانات
        classification_counts = {cls: 0 for cls in ['شهادة', 'تقرير', 'كتاب رسمي', 'نموذج', 'أخرى']}
        direction_counts = {'صادر': 0, 'وارد': 0}
        
        for cls, direction, cnt in agg_q:
            # التصنيف
            cls_str = str(cls) if cls else 'أخرى'
            if cls_str in classification_counts:
                classification_counts[cls_str] += cnt
            elif not cls_str or cls_str.strip() == '':
                classification_counts['أخرى'] += cnt
            
            # الاتجاه
            if direction == 'صادر':
                direction_counts['صادر'] += cnt
            elif direction == 'وارد':
                direction_counts['وارد'] += cnt
        
        # آخر 5 وثائق - استعلام محسّن بدون تحميل كامل
        recent_docs = []
        if has_view_all:
            recent_q = db.query(
                Document.id,
                Document.document_number,
                Document.title,
                Document.suggested_title,
                Document.ai_classification,
                Document.created_at
            ).order_by(Document.id.desc()).limit(5)
        else:
            recent_q = db.query(
                Document.id,
                Document.document_number,
                Document.title,
                Document.suggested_title,
                Document.ai_classification,
                Document.created_at
            ).filter(Document.uploader_id == current_user.id).order_by(Document.id.desc()).limit(5)
        
        for d in recent_q.all():
            title = d.title or d.suggested_title
            if not title or title.strip() == '':
                title = "بدون عنوان"
            
            classification_value = None
            if d.ai_classification:
                cls = d.ai_classification.strip()
                if cls and cls not in ['other', 'أخرى', '']:
                    classification_value = cls
            
            recent_docs.append({
                "id": d.id,
                "document_number": d.document_number or "",
                "title": title,
                "classification": classification_value,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            })
        
        # إجمالي المستخدمين (فقط للمدير) - استعلام سريع
        total_users = None
        if has_view_all:
            total_users = db.query(func.count(User.id)).scalar()
        
        return {
            "total_documents": total_docs,
            "this_month_documents": this_month_docs,
            "average_ocr_accuracy": round(avg_ocr, 2),
            "classification_counts": classification_counts,
            "direction_counts": direction_counts,
            "recent_documents": recent_docs,
            "total_users": total_users,
        }
        
    except Exception as e:
        print(f"[ERROR] Error in get_document_stats: {e}")
        print(traceback.format_exc())
        # إرجاع بيانات افتراضية في حالة الخطأ
        return {
            "total_documents": 0,
            "this_month_documents": 0,
            "average_ocr_accuracy": 0,
            "classification_counts": {cls: 0 for cls in ['شهادة', 'تقرير', 'كتاب رسمي', 'نموذج', 'أخرى']},
            "direction_counts": {'صادر': 0, 'وارد': 0},
            "recent_documents": [],
            "total_users": None,
        }


@router.get("/analysis")
def get_document_analysis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    period: Optional[str] = None,  # 'day', 'week', 'month', 'year', or None for all
):
    """تحليل متقدم للوثائق - اتجاهات زمنية، أداء OCR، إحصائيات مفصلة"""
    from datetime import datetime, timedelta
    import traceback
    
    # تحديد الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    has_view_all = merged.get("view_all_documents", False)
    
    try:
        # بناء الفلتر الأساسي
        base_query = db.query(Document) if has_view_all else db.query(Document).filter(Document.uploader_id == current_user.id)
        
        # تحليل زمني - الوثائق حسب الفترة
        now = datetime.now()
        time_analysis = {
            'today': 0,
            'this_week': 0,
            'this_month': 0,
            'this_year': 0,
            'by_day': [],  # آخر 30 يوم
            'by_month': [],  # آخر 12 شهر
        }
        
        # اليوم
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        time_analysis['today'] = base_query.filter(Document.created_at >= today_start).count()
        
        # هذا الأسبوع
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        time_analysis['this_week'] = base_query.filter(Document.created_at >= week_start).count()
        
        # هذا الشهر
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        time_analysis['this_month'] = base_query.filter(Document.created_at >= month_start).count()
        
        # هذه السنة
        year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        time_analysis['this_year'] = base_query.filter(Document.created_at >= year_start).count()
        
        # حسب اليوم - آخر 30 يوم
        for i in range(29, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day.replace(hour=23, minute=59, second=59, microsecond=999999)
            count = base_query.filter(
                Document.created_at >= day_start,
                Document.created_at <= day_end
            ).count()
            time_analysis['by_day'].append({
                'date': day_start.strftime('%Y-%m-%d'),
                'label': day_start.strftime('%d/%m'),
                'count': count
            })
        
        # حسب الشهر - آخر 12 شهر
        for i in range(11, -1, -1):
            month = now - timedelta(days=30 * i)
            month_start = month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if i == 0:
                month_end = now
            else:
                next_month = month_start + timedelta(days=32)
                month_end = next_month.replace(day=1) - timedelta(seconds=1)
            
            count = base_query.filter(
                Document.created_at >= month_start,
                Document.created_at <= month_end
            ).count()
            time_analysis['by_month'].append({
                'date': month_start.strftime('%Y-%m'),
                'label': month_start.strftime('%b %Y'),
                'count': count
            })
        
        # تحليل أداء OCR
        ocr_analysis = {
            'average': 0.0,
            'distribution': {
                'excellent': 0,  # >= 90
                'good': 0,       # 70-89
                'fair': 0,       # 50-69
                'poor': 0,       # < 50
            },
            'by_classification': {},
            'trend': [],  # اتجاه دقة OCR مع الوقت
        }
        
        # متوسط دقة OCR
        avg_ocr = base_query.with_entities(func.avg(Document.ocr_accuracy)).scalar() or 0
        ocr_analysis['average'] = round(float(avg_ocr), 2)
        
        # توزيع دقة OCR
        docs_with_ocr = base_query.filter(Document.ocr_accuracy.isnot(None)).all()
        for doc in docs_with_ocr:
            acc = doc.ocr_accuracy or 0
            if acc >= 90:
                ocr_analysis['distribution']['excellent'] += 1
            elif acc >= 70:
                ocr_analysis['distribution']['good'] += 1
            elif acc >= 50:
                ocr_analysis['distribution']['fair'] += 1
            else:
                ocr_analysis['distribution']['poor'] += 1
        
        # دقة OCR حسب التصنيف
        ocr_by_class = base_query.with_entities(
            Document.ai_classification,
            func.avg(Document.ocr_accuracy).label('avg_ocr')
        ).filter(Document.ocr_accuracy.isnot(None)).group_by(Document.ai_classification).all()
        
        for cls, avg_ocr_cls in ocr_by_class:
            cls_str = str(cls) if cls else 'أخرى'
            ocr_analysis['by_classification'][cls_str] = round(float(avg_ocr_cls or 0), 2)
        
        # تحليل التصنيفات والاتجاهات
        classification_analysis = {
            'total_by_type': {},
            'by_direction': {},
        }
        
        # حسب التصنيف
        cls_counts = base_query.with_entities(
            Document.ai_classification,
            func.count(Document.id).label('count')
        ).group_by(Document.ai_classification).all()
        
        for cls, cnt in cls_counts:
            cls_str = str(cls) if cls else 'أخرى'
            classification_analysis['total_by_type'][cls_str] = cnt
        
        # حسب الاتجاه
        dir_counts = base_query.with_entities(
            Document.document_direction,
            func.count(Document.id).label('count')
        ).filter(Document.document_direction.isnot(None)).group_by(Document.document_direction).all()
        
        for direction, cnt in dir_counts:
            if direction:
                classification_analysis['by_direction'][direction] = cnt
        
        # تحليل المصدر (ملف vs سكانر)
        source_analysis = {
            'by_type': {},
            'ocr_comparison': {},
        }
        
        source_counts = base_query.with_entities(
            Document.source_type,
            func.count(Document.id).label('count'),
            func.avg(Document.ocr_accuracy).label('avg_ocr')
        ).group_by(Document.source_type).all()
        
        for source_type, cnt, avg_ocr_src in source_counts:
            source_str = str(source_type) if source_type else 'file'
            source_analysis['by_type'][source_str] = cnt
            source_analysis['ocr_comparison'][source_str] = round(float(avg_ocr_src or 0), 2)
        
        return {
            'time_analysis': time_analysis,
            'ocr_analysis': ocr_analysis,
            'classification_analysis': classification_analysis,
            'source_analysis': source_analysis,
        }
        
    except Exception as e:
        print(f"[ERROR] Error in get_document_analysis: {e}")
        print(traceback.format_exc())
        return {
            'time_analysis': {'today': 0, 'this_week': 0, 'this_month': 0, 'this_year': 0, 'by_day': [], 'by_month': []},
            'ocr_analysis': {'average': 0, 'distribution': {'excellent': 0, 'good': 0, 'fair': 0, 'poor': 0}, 'by_classification': {}, 'trend': []},
            'classification_analysis': {'total_by_type': {}, 'by_direction': {}},
            'source_analysis': {'by_type': {}, 'ocr_comparison': {}},
        }


@router.get("/analysis/recommendations")
def get_ai_recommendations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """توصيات ذكية بناءً على تحليل البيانات - تساعد المستخدم في اتخاذ القرار"""
    from datetime import datetime, timedelta
    import traceback
    
    # تحديد الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    has_view_all = merged.get("view_all_documents", False)
    base_query = db.query(Document) if has_view_all else db.query(Document).filter(Document.uploader_id == current_user.id)
    
    recommendations = []
    warnings = []
    insights = []
    
    try:
        total_docs = base_query.count()
        
        if total_docs == 0:
            return {
                'recommendations': [
                    {
                        'type': 'info',
                        'priority': 'medium',
                        'title': 'ابدأ برفع الوثائق',
                        'message': 'لا توجد وثائق في النظام حتى الآن. ابدأ برفع وثيقة أولى لرؤية التحليلات والتوصيات.',
                        'action': 'upload_document',
                        'icon': 'info'
                    }
                ],
                'warnings': [],
                'insights': []
            }
        
        # تحليل دقة OCR
        avg_ocr = base_query.with_entities(func.avg(Document.ocr_accuracy)).scalar() or 0
        avg_ocr = float(avg_ocr)
        
        poor_ocr_count = base_query.filter(Document.ocr_accuracy < 50).count()
        poor_ocr_percentage = (poor_ocr_count / total_docs * 100) if total_docs > 0 else 0
        
        if avg_ocr < 70:
            recommendations.append({
                'type': 'improvement',
                'priority': 'high',
                'title': 'تحسين دقة OCR',
                'message': f'متوسط دقة OCR هو {avg_ocr:.1f}%، وهو أقل من المستوى المطلوب. يُنصح بتحسين جودة الصور أو استخدام وضوح أعلى عند المسح.',
                'action': 'improve_ocr',
                'icon': 'warning'
            })
        
        if poor_ocr_percentage > 20:
            warnings.append({
                'type': 'warning',
                'priority': 'high',
                'title': 'نسبة عالية من الوثائق بجودة OCR منخفضة',
                'message': f'{poor_ocr_percentage:.1f}% من الوثائق لديها دقة OCR أقل من 50%. يُفضل إعادة مسح أو رفع هذه الوثائق بجودة أعلى.',
                'action': 'review_low_quality',
                'icon': 'error'
            })
        elif avg_ocr >= 85:
            insights.append({
                'type': 'success',
                'priority': 'low',
                'title': 'أداء ممتاز في OCR',
                'message': f'متوسط دقة OCR هو {avg_ocr:.1f}% - هذا مؤشر ممتاز! استمر في الحفاظ على جودة الصور.',
                'icon': 'success'
            })
        
        # تحليل الاتجاهات الزمنية
        now = datetime.now()
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
        last_month_end = this_month_start - timedelta(seconds=1)
        
        this_month_count = base_query.filter(Document.created_at >= this_month_start).count()
        last_month_count = base_query.filter(
            Document.created_at >= last_month_start,
            Document.created_at <= last_month_end
        ).count()
        
        if last_month_count > 0:
            growth_rate = ((this_month_count - last_month_count) / last_month_count) * 100
            
            if growth_rate < -30:
                warnings.append({
                    'type': 'warning',
                    'priority': 'medium',
                    'title': 'انخفاض في نشاط رفع الوثائق',
                    'message': f'عدد الوثائق هذا الشهر ({this_month_count}) أقل بنسبة {abs(growth_rate):.1f}% عن الشهر الماضي. قد تحتاج إلى مراجعة العملية.',
                    'action': 'review_activity',
                    'icon': 'warning'
                })
            elif growth_rate > 50:
                insights.append({
                    'type': 'success',
                    'priority': 'low',
                    'title': 'نمو ممتاز في النشاط',
                    'message': f'عدد الوثائق هذا الشهر ({this_month_count}) زاد بنسبة {growth_rate:.1f}% عن الشهر الماضي - مؤشر إيجابي!',
                    'icon': 'success'
                })
        
        # تحليل التوزيع حسب التصنيف
        classification_dist = base_query.with_entities(
            Document.ai_classification,
            func.count(Document.id).label('count')
        ).group_by(Document.ai_classification).all()
        
        if len(classification_dist) > 0:
            max_class_count = max(cnt for _, cnt in classification_dist)
            max_class_name = next((cls for cls, cnt in classification_dist if cnt == max_class_count), None)
            
            if max_class_name and max_class_count / total_docs > 0.6:
                insights.append({
                    'type': 'info',
                    'priority': 'low',
                    'title': 'تركيز على نوع محدد',
                    'message': f'{max_class_name} يشكل {max_class_count / total_docs * 100:.1f}% من جميع الوثائق. قد ترغب في تنويع أنواع الوثائق.',
                    'icon': 'info'
                })
        
        # تحليل المصدر (ملف vs سكانر)
        source_dist = base_query.with_entities(
            Document.source_type,
            func.count(Document.id).label('count'),
            func.avg(Document.ocr_accuracy).label('avg_ocr')
        ).group_by(Document.source_type).all()
        
        if len(source_dist) >= 2:
            source_stats = {str(src): {'count': cnt, 'avg_ocr': float(avg or 0)} for src, cnt, avg in source_dist}
            
            if 'file' in source_stats and 'scanner' in source_stats:
                file_ocr = source_stats['file']['avg_ocr']
                scanner_ocr = source_stats['scanner']['avg_ocr']
                
                if abs(file_ocr - scanner_ocr) > 15:
                    if scanner_ocr > file_ocr:
                        recommendations.append({
                            'type': 'improvement',
                            'priority': 'medium',
                            'title': 'استخدم السكانر لتحسين الدقة',
                            'message': f'دقة OCR من السكانر ({scanner_ocr:.1f}%) أفضل بكثير من الملفات ({file_ocr:.1f}%). يُنصح باستخدام السكانر عند الإمكان.',
                            'action': 'use_scanner',
                            'icon': 'tip'
                        })
        
        # تحليل التصنيفات غير المكتملة
        unclassified = base_query.filter(
            (Document.ai_classification == None) | 
            (Document.ai_classification == '') | 
            (Document.ai_classification == 'أخرى')
        ).count()
        
        if unclassified > 0 and unclassified / total_docs > 0.3:
            recommendations.append({
                'type': 'action',
                'priority': 'medium',
                'title': 'تصنيف الوثائق غير المصنفة',
                'message': f'{unclassified} وثيقة ({unclassified / total_docs * 100:.1f}%) غير مصنفة بشكل صحيح. يُنصح بمراجعة وتصنيف هذه الوثائق.',
                'action': 'classify_documents',
                'icon': 'action'
            })
        
        # تحليل الوثائق بدون عنوان
        no_title = base_query.filter(
            (Document.title == None) | (Document.title == '')
        ).count()
        
        if no_title > 0 and no_title / total_docs > 0.2:
            recommendations.append({
                'type': 'action',
                'priority': 'low',
                'title': 'إضافة عناوين للوثائق',
                'message': f'{no_title} وثيقة ({no_title / total_docs * 100:.1f}%) بدون عنوان. إضافة عناوين يساعد في البحث والتنظيم.',
                'action': 'add_titles',
                'icon': 'tip'
            })
        
        # تحليل التوزيع الزمني - اكتشاف أيام معينة نشطة
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        last_7_days = [today - timedelta(days=i) for i in range(7)]
        daily_counts = []
        
        for day in last_7_days:
            day_end = day + timedelta(days=1) - timedelta(seconds=1)
            count = base_query.filter(
                Document.created_at >= day,
                Document.created_at <= day_end
            ).count()
            daily_counts.append(count)
        
        if len(daily_counts) > 0:
            avg_daily = sum(daily_counts) / len(daily_counts)
            max_daily = max(daily_counts)
            
            if avg_daily > 0 and max_daily > avg_daily * 2:
                insights.append({
                    'type': 'info',
                    'priority': 'low',
                    'title': 'أنماط نشاط ملحوظة',
                    'message': f'يوجد تباين في النشاط اليومي. متوسط {avg_daily:.1f} وثيقة/يوم مع ذروة {max_daily} وثيقة. قد ترغب في توزيع العمل بشكل أكثر انتظاماً.',
                    'icon': 'info'
                })
        
        # ترتيب التوصيات حسب الأولوية
        priority_order = {'high': 3, 'medium': 2, 'low': 1}
        recommendations.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 0), reverse=True)
        warnings.sort(key=lambda x: priority_order.get(x.get('priority', 'low'), 0), reverse=True)
        
        return {
            'recommendations': recommendations[:5],  # أفضل 5 توصيات
            'warnings': warnings[:3],  # أفضل 3 تحذيرات
            'insights': insights[:3],  # أفضل 3 رؤى
        }
        
    except Exception as e:
        print(f"[ERROR] Error in get_ai_recommendations: {e}")
        print(traceback.format_exc())
        return {
            'recommendations': [],
            'warnings': [],
            'insights': []
        }


@router.get("/{document_id}")
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """عرض تفاصيل وثيقة واحدة"""
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # التحقق من الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    # إذا لم يكن لديه صلاحية view_all، يجب أن يكون صاحب الوثيقة
    if not merged.get("view_all_documents") and doc.uploader_id != current_user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
    
    # قراءة النص المستخرج
    ocr_text = ""
    if doc.ocr_text_path and Path(doc.ocr_text_path).exists():
        try:
            with open(doc.ocr_text_path, 'r', encoding='utf-8') as f:
                ocr_text = f.read()
        except:
            pass
    
    # جلب معلومات المستخدم الذي رفع الوثيقة
    uploader = None
    if doc.uploader_id:
        uploader_obj = db.get(User, doc.uploader_id)
        if uploader_obj:
            uploader = {
                "id": uploader_obj.id,
                "username": uploader_obj.username,
                "full_name": getattr(uploader_obj, 'full_name', None),
            }
    
    return {
        "id": doc.id,
        "document_number": doc.document_number,
        "title": doc.title,
        "suggested_title": doc.suggested_title,
        "content_text": ocr_text or doc.content_text,
        "classification": doc.ai_classification,
        "direction": doc.document_direction,
        "original_date": doc.original_date,
        "source_type": doc.source_type,
        "ocr_accuracy": doc.ocr_accuracy,
        "status": doc.status,
        "original_file_path": doc.original_file_path,
        "pdf_path": doc.pdf_path,
        "uploader_id": doc.uploader_id,
        "uploader": uploader,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }


@router.put("/{document_id}")
def update_document(
    document_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """تعديل البيانات الوصفية للوثيقة (العنوان فقط، ليس المحتوى!)"""
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # التحقق من الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = {}
    if role and role.permissions:
        merged.update(role.permissions)
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    # مدير النظام يمكنه تعديل أي وثيقة
    if role and role.name == 'system_admin':
        pass  # السماح بالتعديل
    else:
        # يجب أن يكون صاحب الوثيقة ولديه صلاحية manage_own_documents
        is_owner = doc.uploader_id == current_user.id
        can_manage = merged.get("manage_own_documents")
        
        if not (is_owner and can_manage):
            raise HTTPException(status_code=403, detail="ليس لديك صلاحية لتعديل هذه الوثيقة")
    
    # السماح فقط بتعديل البيانات الوصفية (ليس المحتوى!)
    allowed_fields = ['title', 'classification', 'direction', 'original_date']
    
    def rename_original_file(new_title: str):
        if not new_title or not doc.original_file_path:
            return
        old_path_str = doc.original_file_path
        file_path = Path(old_path_str)
        if not file_path.exists():
            raise HTTPException(status_code=400, detail="تعذر العثور على الملف الأصلي لإعادة تسميته")
        safe_name = _sanitize_component(new_title, doc.document_number)
        if len(safe_name) > 200:
            safe_name = safe_name[:200]
        extension = file_path.suffix
        candidate = safe_name or doc.document_number
        counter = 1
        new_path = file_path.with_name(f"{candidate}{extension}")
        while new_path.exists() and new_path != file_path:
            suffix = f"_{counter}"
            trimmed = candidate
            max_len = 200 - len(suffix)
            if len(trimmed) > max_len:
                trimmed = trimmed[:max_len]
            new_path = file_path.with_name(f"{trimmed}{suffix}{extension}")
            counter += 1
        if new_path == file_path:
            return
        try:
            file_path.rename(new_path)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"تعذر إعادة تسمية الملف الأصلي: {exc}")
        doc.original_file_path = str(new_path)
        db.query(Attachment).filter(
            Attachment.document_id == doc.id,
            Attachment.file_path == old_path_str
        ).update({"file_path": str(new_path)}, synchronize_session=False)

    def move_document_to_classification(new_classification: str):
        if not new_classification:
            doc.ai_classification = new_classification
            return
        if not doc.original_file_path:
            doc.ai_classification = new_classification
            return
        file_path = Path(doc.original_file_path)
        if not file_path.exists():
            raise HTTPException(status_code=400, detail="تعذر العثور على الملف الأصلي لنقله إلى التصنيف الجديد")
        root = Path(settings.file_storage_root)
        try:
            relative_dir = file_path.parent.relative_to(root)
        except ValueError:
            # المسار خارج الجذر المنظم، نكتفي بتحديث التصنيف
            doc.ai_classification = new_classification
            return
        parts = list(relative_dir.parts)
        if len(parts) < 2:
            doc.ai_classification = new_classification
            return
        source_folder = parts[0]
        current_classification = parts[1]
        target_classification = _sanitize_component(new_classification, "أخرى")
        if current_classification == target_classification:
            doc.ai_classification = new_classification
            return
        new_relative_parts = [source_folder, target_classification] + parts[2:]
        new_dir = root.joinpath(*new_relative_parts)
        if new_dir.exists():
            raise HTTPException(status_code=400, detail="المجلد الهدف موجود بالفعل - لا يمكن نقل الوثيقة")
        new_dir.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.move(str(file_path.parent), str(new_dir))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"تعذر نقل الوثيقة إلى التصنيف الجديد: {exc}")
        old_path_str = doc.original_file_path
        new_file_path = new_dir / file_path.name
        doc.original_file_path = str(new_file_path)
        db.query(Attachment).filter(
            Attachment.document_id == doc.id,
            Attachment.file_path == old_path_str
        ).update({"file_path": str(new_file_path)}, synchronize_session=False)
        doc.ai_classification = new_classification

    if 'title' in payload:
        new_title = payload['title']
        if new_title and new_title != doc.title:
            rename_original_file(new_title)
        doc.title = new_title
    if 'classification' in payload:
        move_document_to_classification(payload['classification'])
    if 'direction' in payload:
        doc.document_direction = payload['direction']
    if 'original_date' in payload:
        doc.original_date = payload['original_date']
    
    doc.updated_at = datetime.now()
    db.add(doc)
    db.commit()
    
    try:
        log_activity(
            db,
            user_id=current_user.id,
            action="Update",
            details={
                "document_number": doc.document_number,
                "title": doc.title or "بدون عنوان"
            },
            ip=request.client.host if request else None,
            document_id=doc.id
        )
    except:
        pass
    
    return {"status": "ok"}


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """حذف وثيقة"""
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # التحقق من الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = (role.permissions if role and role.permissions else {}).copy()
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    is_owner = doc.uploader_id == current_user.id
    can_delete = merged.get("delete_own_documents")
    
    if not (is_owner and can_delete):
        raise HTTPException(status_code=403, detail="Forbidden")
    
    document_number = doc.document_number
    
    # حذف من قاعدة البيانات (الملفات تبقى للنسخ الاحتياطي)
    db.delete(doc)
    db.commit()
    
    try:
        log_activity(
            db,
            user_id=current_user.id,
            action="delete_document",
            details={"document_number": document_number},
            ip=request.client.host if request else None,
        )
    except:
        pass
    
    return {"status": "deleted"}


@router.post("/{document_id}/extract-students")
def extract_students_from_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """استخراج بيانات الطلاب من وثيقة وربطها"""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="الوثيقة غير موجودة")
    
    # الحصول على مسار الملف
    if not document.original_file_path:
        raise HTTPException(status_code=400, detail="الوثيقة لا تحتوي على ملف")
    
    file_path = Path(document.original_file_path)
    if not file_path.exists():
        # محاولة مع المسار الكامل
        file_path = Path(settings.file_storage_root) / document.original_file_path.lstrip('/')
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="الملف غير موجود على القرص")
    
    # استخراج بيانات الطلاب
    students_data = student_extractor.extract_from_file(
        file_path,
        ocr_text=document.content_text
    )
    
    if not students_data:
        return {
            "message": "لم يتم العثور على بيانات طلاب في الوثيقة",
            "extracted_count": 0,
            "linked_count": 0,
        }
    
    # ربط الطلاب بالوثيقة وإنشاء/تحديث السجلات
    linked_count = 0
    now = datetime.now()
    
    for student_data in students_data:
        student_number = student_data.get('student_number')
        full_name = student_data.get('full_name')
        
        if not student_number or not full_name:
            continue
        
        # البحث عن طالب موجود أو إنشاء جديد
        student = db.query(Student).filter(Student.student_number == student_number).first()
        
        if not student:
            # إنشاء طالب جديد
            student = Student(
                student_number=student_number,
                full_name=full_name,
                created_at=now,
                updated_at=now,
            )
            db.add(student)
            db.commit()
            db.refresh(student)
        
        # ربط الطالب بالوثيقة
        if student not in document.students:
            document.students.append(student)
        
        # إنشاء/تحديث الدرجة (قد تكون درجة لمادة محددة أو درجة عامة)
        score = student_data.get('score')
        subject = student_data.get('subject')
        
        if score is not None:
            # البحث عن درجة موجودة لنفس الطالب والوثيقة والمادة
            grade_query = db.query(StudentGrade).filter(
                StudentGrade.student_id == student.id,
                StudentGrade.document_id == document_id
            )
            
            # إذا كانت هناك مادة محددة، نبحث عن نفس المادة
            if subject:
                grade_query = grade_query.filter(StudentGrade.subject == subject)
            else:
                # إذا لم تكن هناك مادة، نبحث عن درجة بدون مادة
                grade_query = grade_query.filter(StudentGrade.subject.is_(None))
            
            grade = grade_query.first()
            
            if not grade:
                max_score = student_data.get('max_score', 100)
                percentage = student_data.get('percentage')
                if percentage is None and max_score > 0:
                    percentage = (score / max_score) * 100
                
                # التعامل مع حالة "لم يختبر"
                notes = student_data.get('notes', None)
                grade_letter = None
                if percentage is not None:
                    grade_letter = student_extractor.calculate_grade(percentage)
                elif notes and 'لم يختبر' in notes:
                    grade_letter = 'غياب'  # أو يمكن استخدام رمز آخر
                
                grade = StudentGrade(
                    student_id=student.id,
                    document_id=document_id,
                    subject=subject,
                    score=score,
                    max_score=max_score,
                    percentage=percentage,
                    grade=grade_letter,
                    notes=notes,
                    created_at=now,
                    updated_at=now,
                )
                db.add(grade)
                linked_count += 1
            else:
                # تحديث الدرجة الموجودة
                grade.score = score
                grade.max_score = student_data.get('max_score', 100)
                percentage = student_data.get('percentage')
                if percentage is None and grade.max_score > 0:
                    percentage = (score / grade.max_score) * 100
                grade.percentage = percentage
                grade.grade = student_extractor.calculate_grade(percentage) if percentage else None
                grade.subject = subject  # تحديث المادة أيضاً
                grade.updated_at = now
                linked_count += 1
    
    # تحديث إحصائيات الطلاب
    for student in document.students:
        # الحصول على جميع درجات الطالب (من جميع الوثائق)
        all_grades = db.query(StudentGrade).filter(StudentGrade.student_id == student.id).all()
        
        # حساب المعدل من درجات المواد الفردية فقط (تجاهل "المجموع الكلي" و"النسبة الإجمالية")
        subject_grades = [g for g in all_grades if g.subject and 
                         g.subject not in ['المجموع الكلي', 'النسبة الإجمالية', 'Total', 'Overall Percentage']]
        
        student.total_grades = len(subject_grades) if subject_grades else len(all_grades)
        
        # حساب المعدل
        avg = None
        if subject_grades:
            # حساب المعدل من درجات المواد الفردية
            percentages = [g.percentage for g in subject_grades if g.percentage is not None]
            if percentages:
                avg = sum(percentages) / len(percentages)
        elif all_grades:
            # إذا لم تكن هناك درجات للمواد، استخدم جميع الدرجات
            percentages = [g.percentage for g in all_grades if g.percentage is not None]
            if percentages:
                avg = sum(percentages) / len(percentages)
        
        if avg is not None:
            student.average_score = avg
        
        student.updated_at = now
    
    db.commit()
    
    return {
        "message": "تم استخراج وربط بيانات الطلاب بنجاح",
        "extracted_count": len(students_data),
        "linked_count": linked_count,
    }


@router.get("/{document_id}/download/original")
def download_original_file(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    تحميل الملف الأصلي بتنسيقه الأصلي (PDF, Word, Excel, صورة)
    يحافظ على التنسيق الكامل للوثيقة
    """
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # التحقق من الصلاحيات
    role = db.get(Role, current_user.role_id) if current_user.role_id else None
    merged = {}
    if role and role.permissions:
        merged.update(role.permissions)
    if getattr(current_user, 'permissions', None):
        merged.update(current_user.permissions)
    
    # مدير النظام أو صاحب الوثيقة أو لديه صلاحية view_all_documents
    if role and role.name == 'system_admin':
        pass
    elif doc.uploader_id == current_user.id:
        pass
    elif merged.get("view_all_documents"):
        pass
    else:
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية لتحميل هذه الوثيقة")
    
    # التحقق من وجود الملف
    if not doc.original_file_path:
        raise HTTPException(status_code=404, detail="الملف الأصلي غير موجود")
    
    file_path = Path(doc.original_file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="الملف غير موجود على الخادم")
    
    # تحديد نوع MIME
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = 'application/octet-stream'
    
    # تحديد اسم الملف للتحميل
    filename = f"{doc.document_number}{file_path.suffix}"
    
    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=filename,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache"
        }
    )
