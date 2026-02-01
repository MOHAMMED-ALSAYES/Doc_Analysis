"""
API endpoints للتقارير والإحصائيات
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, extract
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from ...core.db import get_db
from ...core.security import get_current_user
from ...models.user import User
from ...models.document import Document
from ...models.activity_log import ActivityLog
from ...models.role import Role


router = APIRouter()


@router.get("/dashboard")
def get_dashboard_stats(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    الحصول على إحصائيات Dashboard الرئيسية مع فلترة اختيارية
    """
    try:
        # الحصول على role للمستخدم
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        is_admin = role and role.name == 'system_admin'
        
        # التحقق من الصلاحيات
        has_view_reports = False
        if is_admin:
            has_view_reports = True
        else:
            # التحقق من صلاحية view_reports
            if role and role.permissions:
                has_view_reports = role.permissions.get('view_reports', False)
            if current_user.permissions:
                has_view_reports = current_user.permissions.get('view_reports', has_view_reports)
        
        if not has_view_reports:
            raise HTTPException(status_code=403, detail="You don't have permission to view reports")
        
        # فلترة أساسية - الموظفون يرون فقط وثائقهم
        base_filter = []
        if not is_admin:
            # الموظفون يرون فقط وثائقهم
            base_filter.append(Document.uploader_id == current_user.id)
        
        # فلترة حسب التاريخ
        date_filter = []
        if date_from:
            try:
                # Parse date in format YYYY-MM-DD
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_filter.append(Document.created_at >= from_date)
            except Exception as e:
                print(f"Error parsing date_from: {e}")
                pass
        
        if date_to:
            try:
                # Parse date in format YYYY-MM-DD
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                # أضف يوم كامل للتاريخ النهائي
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter.append(Document.created_at <= to_date)
            except Exception as e:
                print(f"Error parsing date_to: {e}")
                pass
        
        # فلترة حسب المستخدم (المدير فقط)
        user_filter = []
        if user_id and is_admin:
            user_filter.append(Document.uploader_id == user_id)
        
        # دمج الفلاتر
        all_filters = base_filter + date_filter + user_filter
        
        # بناء الاستعلام الأساسي مع الفلاتر
        base_query = db.query(Document)
        if all_filters:
            base_query = base_query.filter(and_(*all_filters))
        
        # 1. إجمالي عدد الوثائق
        total_documents = base_query.count()
        
        # 2. عدد الوثائق لكل تصنيف
        classification_query = db.query(
            Document.ai_classification,
            func.count(Document.id)
        )
        if all_filters:
            classification_query = classification_query.filter(and_(*all_filters))
        docs_by_classification = classification_query.group_by(Document.ai_classification).all()
        
        classification_stats = {
            classification or 'غير مصنف': count
            for classification, count in docs_by_classification
        }
        
        # 3. عدد الوثائق حسب الاتجاه
        direction_query = db.query(
            Document.document_direction,
            func.count(Document.id)
        )
        if all_filters:
            direction_query = direction_query.filter(and_(*all_filters))
        docs_by_direction = direction_query.group_by(Document.document_direction).all()
        
        direction_stats = {
            direction or 'غير محدد': count
            for direction, count in docs_by_direction
        }
        
        # 4. عدد الوثائق حسب المصدر
        source_query = db.query(
            Document.source_type,
            func.count(Document.id)
        )
        if all_filters:
            source_query = source_query.filter(and_(*all_filters))
        docs_by_source = source_query.group_by(Document.source_type).all()
        
        source_stats = {
            source or 'غير محدد': count
            for source, count in docs_by_source
        }
        
        # 5. متوسط دقة OCR
        ocr_query = db.query(func.avg(Document.ocr_accuracy)).filter(
            Document.ocr_accuracy.isnot(None)
        )
        if all_filters:
            ocr_query = ocr_query.filter(and_(*all_filters))
        avg_ocr_accuracy = ocr_query.scalar()
        
        # 6. الوثائق المرفوعة خلال آخر 7 أيام (مع الفلاتر)
        seven_days_ago = datetime.now() - timedelta(days=7)
        seven_days_filter = [Document.created_at >= seven_days_ago]
        if all_filters:
            seven_days_filter = all_filters + seven_days_filter
        recent_docs = db.query(func.count(Document.id)).filter(
            and_(*seven_days_filter)
        ).scalar() or 0
        
        # 7. الوثائق المرفوعة اليوم (مع الفلاتر)
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_filter = [func.date(Document.created_at) == func.date(datetime.now())]
        if all_filters:
            today_filter = all_filters + today_filter
        today_docs = db.query(func.count(Document.id)).filter(
            and_(*today_filter)
        ).scalar() or 0
        
        # 8. إجمالي عدد المستخدمين (للمدير فقط)
        total_users = db.query(func.count(User.id)).scalar() or 0 if is_admin else 1
        
        # 9. عدد المستخدمين النشطين (مع الفلاتر)
        active_users_query = db.query(func.count(func.distinct(Document.uploader_id)))
        if all_filters:
            active_users_query = active_users_query.filter(and_(*all_filters))
        active_users = active_users_query.scalar() or 0
        
        # 10. النشاط خلال آخر 30 يوم (يومياً) - مع الفلاتر
        thirty_days_ago = datetime.now() - timedelta(days=30)
        daily_activity_query = db.query(
            func.date(Document.created_at).label('date'),
            func.count(Document.id).label('count')
        )
        
        # إضافة فلترة 30 يوم + الفلاتر الأخرى
        activity_filters = [Document.created_at >= thirty_days_ago]
        if all_filters:
            # دمج فلترة 30 يوم مع الفلاتر الأخرى (لكن إزالة فلترة التاريخ المكررة)
            for f in all_filters:
                if hasattr(f, 'left'):
                    col_name = str(f.left)
                    if 'created_at' not in col_name or 'uploader_id' in col_name or 'user' in str(f):
                        activity_filters.append(f)
                else:
                    activity_filters.append(f)
        
        if activity_filters:
            daily_activity_query = daily_activity_query.filter(and_(*activity_filters))
        
        daily_activity = daily_activity_query.group_by(
            func.date(Document.created_at)
        ).order_by('date').all()
        
        activity_chart = [
            {'date': str(date), 'count': count}
            for date, count in daily_activity
        ]
        
        # 11. أكثر 5 مستخدمين نشاطاً (مع الفلاتر)
        top_users_query = db.query(
            User.username,
            User.full_name,
            func.count(Document.id).label('doc_count')
        ).join(
            Document, Document.uploader_id == User.id
        )
        if all_filters:
            top_users_query = top_users_query.filter(and_(*all_filters))
        top_users = top_users_query.group_by(
            User.id, User.username, User.full_name
        ).order_by(
            func.count(Document.id).desc()
        ).limit(5).all()
        
        top_users_stats = [
            {
                'username': username,
                'full_name': full_name,
                'document_count': doc_count
            }
            for username, full_name, doc_count in top_users
        ]
        
        # 12. توزيع الوثائق حسب الحالة
        status_query = db.query(
            Document.status,
            func.count(Document.id)
        )
        if all_filters:
            status_query = status_query.filter(and_(*all_filters))
        docs_by_status = status_query.group_by(Document.status).all()
        
        status_stats = {
            status: count
            for status, count in docs_by_status
        }
        
        return {
            'summary': {
                'total_documents': total_documents,
                'total_users': total_users,
                'active_users': active_users,
                'documents_today': today_docs,
                'documents_last_7_days': recent_docs,
                'avg_ocr_accuracy': round(float(avg_ocr_accuracy or 0), 2),
            },
            'classification_distribution': classification_stats,
            'direction_distribution': direction_stats,
            'source_distribution': source_stats,
            'status_distribution': status_stats,
            'daily_activity': activity_chart,
            'top_users': top_users_stats,
        }
    
    except Exception as e:
        print(f"خطأ في جلب إحصائيات Dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents-list")
def get_documents_list(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    الحصول على قائمة الوثائق مع التفاصيل للتقارير
    """
    try:
        # الحصول على role للمستخدم
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        is_admin = role and role.name == 'system_admin'
        
        # التحقق من الصلاحيات
        has_view_reports = False
        if is_admin:
            has_view_reports = True
        else:
            if role and role.permissions:
                has_view_reports = role.permissions.get('view_reports', False)
            if current_user.permissions:
                has_view_reports = current_user.permissions.get('view_reports', has_view_reports)
        
        if not has_view_reports:
            raise HTTPException(status_code=403, detail="You don't have permission to view reports")
        
        # فلترة أساسية - الموظفون يرون فقط وثائقهم
        base_filter = []
        if not is_admin:
            base_filter.append(Document.uploader_id == current_user.id)
        
        # فلترة حسب التاريخ
        date_filter = []
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_filter.append(Document.created_at >= from_date)
            except Exception as e:
                print(f"Error parsing date_from: {e}")
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter.append(Document.created_at <= to_date)
            except Exception as e:
                print(f"Error parsing date_to: {e}")
                pass
        
        # فلترة حسب المستخدم (المدير فقط)
        user_filter = []
        if user_id and is_admin:
            user_filter.append(Document.uploader_id == user_id)
        
        # دمج الفلاتر
        all_filters = base_filter + date_filter + user_filter
        
        # بناء الاستعلام
        query = db.query(Document)
        if all_filters:
            query = query.filter(and_(*all_filters))
        
        documents = query.order_by(Document.created_at.desc()).all()
        
        # جلب معلومات المستخدمين
        uploader_ids = list(set([doc.uploader_id for doc in documents if doc.uploader_id]))
        users_map = {}
        if uploader_ids:
            users = db.query(User).filter(User.id.in_(uploader_ids)).all()
            users_map = {u.id: u for u in users}
        
        # تحويل البيانات
        result = []
        for doc in documents:
            uploader = users_map.get(doc.uploader_id) if doc.uploader_id else None
            result.append({
                'id': doc.id,
                'document_number': doc.document_number,
                'title': doc.title or doc.suggested_title or 'بدون عنوان',
                'uploader_username': uploader.username if uploader else 'Unknown',
                'uploader_full_name': uploader.full_name if uploader else None,
                'created_at': doc.created_at.isoformat() if doc.created_at else None,
                'updated_at': doc.updated_at.isoformat() if doc.updated_at else None,
                'document_direction': doc.document_direction or 'غير محدد',
                'ai_classification': doc.ai_classification or 'غير مصنف',
                'source_type': doc.source_type or 'file',
                'status': doc.status or 'completed',
            })
        
        return {
            'count': len(result),
            'documents': result
        }
    
    except Exception as e:
        print(f"خطأ في جلب قائمة الوثائق: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/login-activity")
def get_login_activity(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    تقرير نشاط تسجيل الدخول
    """
    try:
        # فقط المدير يمكنه رؤية تقرير تسجيل الدخول
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        is_admin = role and role.name == 'system_admin'
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only system administrators can view login activity")
        
        # فلترة حسب التاريخ
        date_filter = []
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_filter.append(ActivityLog.timestamp >= from_date)
            except Exception as e:
                print(f"Error parsing date_from: {e}")
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter.append(ActivityLog.timestamp <= to_date)
            except Exception as e:
                print(f"Error parsing date_to: {e}")
                pass
        
        # جلب عمليات تسجيل الدخول
        login_query = db.query(ActivityLog).filter(ActivityLog.action == 'login')
        if date_filter:
            login_query = login_query.filter(and_(*date_filter))
        
        login_logs = login_query.order_by(ActivityLog.timestamp.desc()).all()
        
        # تحويل البيانات
        result = []
        for log in login_logs:
            user = db.get(User, log.user_id) if log.user_id else None
            result.append({
                'id': log.id,
                'username': user.username if user else 'Unknown',
                'full_name': user.full_name if user else None,
                'timestamp': log.timestamp.isoformat() if log.timestamp else None,
                'ip_address': log.ip_address,
            })
        
        return {
            'count': len(result),
            'logs': result
        }
    
    except Exception as e:
        print(f"خطأ في جلب نشاط تسجيل الدخول: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users-activity")
def get_users_activity(
    activity_type: str = 'both',  # 'login', 'documents', 'both'
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    تقرير نشاط جميع المستخدمين (للمدير فقط)
    """
    try:
        # فقط المدير يمكنه رؤية تقرير نشاط المستخدمين
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        is_admin = role and role.name == 'system_admin'
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only system administrators can view users activity")
        
        # فلترة حسب التاريخ
        date_filter = []
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_filter.append(ActivityLog.timestamp >= from_date)
            except Exception as e:
                print(f"Error parsing date_from: {e}")
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter.append(ActivityLog.timestamp <= to_date)
            except Exception as e:
                print(f"Error parsing date_to: {e}")
                pass
        
        # جلب جميع المستخدمين
        all_users = db.query(User).all()
        
        result = []
        for user in all_users:
            user_data = {
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'full_name': user.full_name,
                },
                'activities': {'count': 0, 'items': []},
                'documents': {'count': 0, 'items': []}
            }
            
            # جلب نشاط تسجيل الدخول
            if activity_type in ['both', 'login']:
                login_query = db.query(ActivityLog).filter(ActivityLog.user_id == user.id)
                login_query = login_query.filter(ActivityLog.action == 'login')
                if date_filter:
                    login_query = login_query.filter(and_(*date_filter))
                
                login_activities = login_query.order_by(ActivityLog.timestamp.desc()).all()
                user_data['activities']['items'] = [
                    {
                        'id': activity.id,
                        'action': activity.action,
                        'details': activity.action_details or {},
                        'timestamp': activity.timestamp.isoformat() if activity.timestamp else None,
                        'ip_address': activity.ip_address,
                        'document_id': activity.document_id,
                    }
                    for activity in login_activities
                ]
                user_data['activities']['count'] = len(login_activities)
            
            # جلب الوثائق التي رفعها المستخدم
            if activity_type in ['both', 'documents']:
                doc_date_filters = []
                if date_from:
                    try:
                        from_date = datetime.strptime(date_from, '%Y-%m-%d')
                        from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                        doc_date_filters.append(Document.created_at >= from_date)
                    except:
                        pass
                
                if date_to:
                    try:
                        to_date = datetime.strptime(date_to, '%Y-%m-%d')
                        to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                        doc_date_filters.append(Document.created_at <= to_date)
                    except:
                        pass
                
                documents_query = db.query(Document).filter(Document.uploader_id == user.id)
                if doc_date_filters:
                    documents_query = documents_query.filter(and_(*doc_date_filters))
                
                documents = documents_query.order_by(Document.created_at.desc()).all()
                user_data['documents']['items'] = [
                    {
                        'id': doc.id,
                        'document_number': doc.document_number,
                        'title': doc.title or doc.suggested_title or 'بدون عنوان',
                        'created_at': doc.created_at.isoformat() if doc.created_at else None,
                        'document_direction': doc.document_direction or 'غير محدد',
                        'ai_classification': doc.ai_classification or 'غير مصنف',
                    }
                    for doc in documents
                ]
                user_data['documents']['count'] = len(documents)
            
            # إضافة المستخدم فقط إذا كان لديه نشاط
            if user_data['activities']['count'] > 0 or user_data['documents']['count'] > 0:
                result.append(user_data)
        
        return {
            'activity_type': activity_type,
            'total_users': len(result),
            'users': result
        }
    
    except Exception as e:
        print(f"خطأ في جلب نشاط المستخدمين: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-activity")
def get_user_activity(
    user_id: int,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    تقرير نشاط مستخدم محدد (للمدير فقط)
    """
    try:
        # فقط المدير يمكنه رؤية تقرير نشاط المستخدمين
        role = db.get(Role, current_user.role_id) if current_user.role_id else None
        is_admin = role and role.name == 'system_admin'
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only system administrators can view user activity")
        
        # التحقق من وجود المستخدم
        target_user = db.get(User, user_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # فلترة حسب التاريخ
        date_filter = []
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                date_filter.append(ActivityLog.timestamp >= from_date)
            except Exception as e:
                print(f"Error parsing date_from: {e}")
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                date_filter.append(ActivityLog.timestamp <= to_date)
            except Exception as e:
                print(f"Error parsing date_to: {e}")
                pass
        
        # جلب نشاط المستخدم
        activity_query = db.query(ActivityLog).filter(ActivityLog.user_id == user_id)
        if date_filter:
            activity_query = activity_query.filter(and_(*date_filter))
        
        activities = activity_query.order_by(ActivityLog.timestamp.desc()).all()
        
        # جلب الوثائق التي رفعها المستخدم
        documents_query = db.query(Document).filter(Document.uploader_id == user_id)
        if date_filter:
            documents_query = documents_query.filter(and_(*[f for f in date_filter if 'timestamp' in str(f).lower() or 'created_at' in str(f)]))
        
        # تحويل فلترة timestamp إلى created_at
        doc_date_filters = []
        if date_from:
            try:
                from_date = datetime.strptime(date_from, '%Y-%m-%d')
                from_date = from_date.replace(hour=0, minute=0, second=0, microsecond=0)
                doc_date_filters.append(Document.created_at >= from_date)
            except:
                pass
        
        if date_to:
            try:
                to_date = datetime.strptime(date_to, '%Y-%m-%d')
                to_date = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
                doc_date_filters.append(Document.created_at <= to_date)
            except:
                pass
        
        if doc_date_filters:
            documents_query = documents_query.filter(and_(*doc_date_filters))
        
        documents = documents_query.order_by(Document.created_at.desc()).all()
        
        # تحويل البيانات
        activities_list = []
        for activity in activities:
            activities_list.append({
                'id': activity.id,
                'action': activity.action,
                'details': activity.action_details or {},
                'timestamp': activity.timestamp.isoformat() if activity.timestamp else None,
                'ip_address': activity.ip_address,
                'document_id': activity.document_id,
            })
        
        documents_list = []
        for doc in documents:
            documents_list.append({
                'id': doc.id,
                'document_number': doc.document_number,
                'title': doc.title or doc.suggested_title or 'بدون عنوان',
                'created_at': doc.created_at.isoformat() if doc.created_at else None,
                'document_direction': doc.document_direction or 'غير محدد',
                'ai_classification': doc.ai_classification or 'غير مصنف',
            })
        
        return {
            'user': {
                'id': target_user.id,
                'username': target_user.username,
                'full_name': target_user.full_name,
            },
            'activities': {
                'count': len(activities_list),
                'items': activities_list
            },
            'documents': {
                'count': len(documents_list),
                'items': documents_list
            }
        }
    
    except Exception as e:
        print(f"خطأ في جلب نشاط المستخدم: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity-summary")
def get_activity_summary(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    ملخص النشاط خلال فترة معينة
    """
    try:
        start_date = datetime.now() - timedelta(days=days)
        
        # عدد العمليات لكل نوع
        activity_by_action = db.query(
            ActivityLog.action,
            func.count(ActivityLog.id)
        ).filter(
            ActivityLog.timestamp >= start_date
        ).group_by(ActivityLog.action).all()
        
        action_stats = {
            action: count
            for action, count in activity_by_action
        }
        
        # النشاط اليومي
        daily_activity = db.query(
            func.date(ActivityLog.timestamp).label('date'),
            func.count(ActivityLog.id).label('count')
        ).filter(
            ActivityLog.timestamp >= start_date
        ).group_by(
            func.date(ActivityLog.timestamp)
        ).order_by('date').all()
        
        daily_chart = [
            {'date': str(date), 'count': count}
            for date, count in daily_activity
        ]
        
        # أكثر المستخدمين نشاطاً
        top_active_users = db.query(
            User.username,
            User.full_name,
            func.count(ActivityLog.id).label('activity_count')
        ).join(
            ActivityLog, ActivityLog.user_id == User.id
        ).filter(
            ActivityLog.timestamp >= start_date
        ).group_by(
            User.id, User.username, User.full_name
        ).order_by(
            func.count(ActivityLog.id).desc()
        ).limit(10).all()
        
        user_activity = [
            {
                'username': username,
                'full_name': full_name,
                'activity_count': count
            }
            for username, full_name, count in top_active_users
        ]
        
        return {
            'period_days': days,
            'action_distribution': action_stats,
            'daily_activity': daily_chart,
            'top_active_users': user_activity,
        }
    
    except Exception as e:
        print(f"خطأ في جلب ملخص النشاط: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents-by-month")
def get_documents_by_month(
    year: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    عدد الوثائق لكل شهر في سنة معينة
    """
    try:
        if not year:
            year = datetime.now().year
        
        monthly_data = db.query(
            extract('month', Document.created_at).label('month'),
            func.count(Document.id).label('count')
        ).filter(
            extract('year', Document.created_at) == year
        ).group_by(
            extract('month', Document.created_at)
        ).order_by('month').all()
        
        # أسماء الأشهر بالعربية
        month_names = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ]
        
        # إنشاء بيانات لجميع الأشهر (حتى لو كانت صفر)
        result = []
        monthly_dict = {int(month): count for month, count in monthly_data}
        
        for i in range(1, 13):
            result.append({
                'month': i,
                'month_name': month_names[i-1],
                'count': monthly_dict.get(i, 0)
            })
        
        return {
            'year': year,
            'monthly_data': result,
            'total': sum(item['count'] for item in result)
        }
    
    except Exception as e:
        print(f"خطأ في جلب الوثائق حسب الشهر: {e}")
        raise HTTPException(status_code=500, detail=str(e))

