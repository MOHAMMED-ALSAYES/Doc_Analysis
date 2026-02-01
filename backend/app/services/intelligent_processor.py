"""
خدمة المعالجة الذكية للوثائق
تتضمن: OCR، تصنيف تلقائي، استخراج البيانات، توليد عنوان
"""
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
import re

from .ocr import extract_text_smart, classify_document_smart, suggest_title_from_text
from .convert import convert_to_pdf
from .storage import build_document_paths, save_text_file, get_file_info
from .ai_classifier import ai_classifier
from .student_extractor import student_extractor


class IntelligentDocumentProcessor:
    """معالج ذكي للوثائق"""
    
    def __init__(self, file_path: Path, document_number: str, source_type: str = 'file'):
        self.file_path = file_path
        self.document_number = document_number
        self.source_type = source_type
        self.file_extension = file_path.suffix.lower()
        
        # سيتم بناء المسارات بعد التصنيف (في process)
        self.paths = None
    
    def process(self, user_provided_title: str = None) -> Dict[str, Any]:
        """
        معالجة كاملة للوثيقة:
        1. نسخ الملف الأصلي
        2. استخراج النص (OCR)
        3. تصنيف تلقائي
        4. اقتراح عنوان
        5. استخراج البيانات الوصفية
        6. تحويل إلى PDF
        7. إنشاء معاينة
        
        Returns: dict مع جميع البيانات والمسارات
        """
        result = {
            'document_number': self.document_number,
            'source_type': self.source_type,
            'file_extension': self.file_extension,
            'paths': {},
            'ocr_text': '',
            'ocr_accuracy': 0.0,
            'suggested_title': '',
            'classification': 'other',
            'document_direction': None,
            'extracted_date': None,
            'file_info': {},
            'processing_time': 0.0,
        }
        
        start_time = datetime.now()
        
        import shutil
        import tempfile
        from ..core.config import settings
        
        temp_file = None
        temp_dir_obj = None
        
        try:
            # ===== المرحلة 1: حفظ الملف مؤقتاً في مجلد مؤقت في النظام =====
            print(f"[1/7] حفظ الملف مؤقتاً...")
            # استخدام tempfile module لإنشاء مجلد مؤقت في النظام (وليس في المسار الرئيسي)
            try:
                temp_dir_obj = tempfile.mkdtemp(prefix=f"doc_processing_{self.document_number}_")
                temp_dir = Path(temp_dir_obj)
                temp_file = temp_dir / f"{self.document_number}{self.file_extension}"
                
                # نسخ الملف من المصدر إلى temp
                if str(self.file_path) != str(temp_file):
                    shutil.copy2(self.file_path, temp_file)
                    print(f"   [OK] تم حفظ الملف المؤقت: {temp_file.name}")
                else:
                    # إذا كان الملف في temp بالفعل، استخدمه مباشرة
                    temp_file = self.file_path
                    print(f"   [OK] الملف في temp بالفعل")
            except Exception as temp_error:
                print(f"   [WARN] خطأ في إنشاء المجلد المؤقت: {temp_error}")
                # استخدام الملف الموجود مباشرة إذا فشل إنشاء temp
                temp_file = self.file_path
                temp_dir_obj = None
                print(f"   [INFO]  استخدام الملف الموجود مباشرة: {temp_file}")
            
            # ===== المرحلة 2: استخراج النص باستخدام OCR =====
            print(f" [2/7] استخراج النص من: {self.file_path.name}")
            try:
                text, accuracy = extract_text_smart(temp_file)
                result['ocr_text'] = text
                result['ocr_accuracy'] = accuracy
                print(f"   [OK] تم استخراج {len(text)} حرف | دقة OCR: {accuracy}%")
            except Exception as ocr_error:
                print(f"   [WARN] خطأ في استخراج النص: {ocr_error}")
                text = ""
                result['ocr_text'] = ""
                result['ocr_accuracy'] = 0.0
            
            # ===== المرحلة 3: التصنيف التلقائي بالذكاء الاصطناعي =====
            print(f"🤖 [3/7] تصنيف الوثيقة بالذكاء الاصطناعي...")
            
            # استخدام المصنف الذكي (AI Classifier) فقط - بدون منطق إضافي
            try:
                ai_result = ai_classifier.classify_document(text, user_provided_title)
                result['classification'] = ai_result.get('classification') or 'أخرى'
                result['document_direction'] = ai_result.get('direction')
                result['ai_confidence'] = ai_result.get('confidence', 0.0)
                print(f"   [OK] التصنيف: {result['classification']} | الاتجاه: {result.get('document_direction', 'غير محدد')} | الثقة: {result['ai_confidence']}%")
            except Exception as ai_error:
                print(f"   [WARN] خطأ في التصنيف: {ai_error}")
                result['classification'] = 'أخرى'
                result['document_direction'] = None
                result['ai_confidence'] = 0.0
            
            # ===== المرحلة 4: استخراج التاريخ =====
            try:
                extracted_date = ai_classifier.extract_date(text)
                if extracted_date:
                    result['extracted_date'] = extracted_date.strftime('%Y-%m-%d')
                    print(f"   [OK] التاريخ المستخرج: {result['extracted_date']}")
            except Exception as date_error:
                print(f"   [WARN] خطأ في استخراج التاريخ: {date_error}")
            
            # ===== المرحلة 5: اقتراح العنوان =====
            print(f" [4/7] اقتراح العنوان...")
            try:
                if user_provided_title:
                    result['title'] = user_provided_title
                    result['suggested_title'] = None
                    print(f"   [OK] العنوان من المستخدم: {user_provided_title}")
                else:
                    suggested = ai_classifier.suggest_title(text, result['classification'])
                    result['suggested_title'] = suggested
                    result['title'] = suggested
                    print(f"   [OK] العنوان المقترح: {suggested}")
            except Exception as title_error:
                print(f"   [WARN] خطأ في اقتراح العنوان: {title_error}")
                result['title'] = f"{result['classification']}_{self.document_number}"
                result['suggested_title'] = result['title']
            
            # تحديد اسم الملف النهائي
            final_title = result.get('title') or f"{result['classification']}_{self.document_number}"
            result['stored_filename'] = final_title
            
            # ===== المرحلة 6: بناء المسارات النهائية =====
            print(f" [5/7] بناء المسارات حسب التصنيف: {result['classification']} | المصدر: {self.source_type}")
            self.paths = build_document_paths(
                self.document_number,
                self.file_extension,
                classification=result['classification'],
                source_type=self.source_type,
                file_title=final_title,
            )
            print(f"   [OK] المسار النهائي: {self.paths['original_file'].parent}")
            
            # ===== المرحلة 7: نقل الملف من temp إلى المكان النهائي =====
            print(f" [6/7] نقل الملف إلى المجلد المنظم...")
            try:
                # التأكد من أن المسار النهائي مختلف عن temp
                temp_file_str = str(temp_file.resolve())
                final_file_str = str(self.paths['original_file'].resolve())
                
                print(f"   المسار المؤقت: {temp_file_str}")
                print(f"   المسار النهائي: {final_file_str}")
                
                if temp_file_str.lower() != final_file_str.lower():
                    # التأكد من وجود المجلد الوجهة
                    final_dir = self.paths['original_file'].parent
                    final_dir.mkdir(parents=True, exist_ok=True)
                    
                    # التأكد من أن الملف المؤقت موجود
                    if not temp_file.exists():
                        raise FileNotFoundError(f"الملف المؤقت غير موجود: {temp_file}")
                    
                    # نسخ الملف
                    print(f"   جارٍ نسخ الملف من temp إلى المجلد المنظم...")
                    shutil.copy2(temp_file, self.paths['original_file'])
                    
                    # التأكد من أن الملف تم نسخه بنجاح
                    if not self.paths['original_file'].exists():
                        raise FileNotFoundError(f"فشل نسخ الملف إلى: {self.paths['original_file']}")
                    
                    result['paths']['original'] = str(self.paths['original_file'])
                    result['file_info'] = get_file_info(self.paths['original_file'])
                    print(f"   [OK] تم نقل الملف بنجاح إلى: {self.paths['original_file'].name}")
                    print(f"   [OK] حجم الملف: {result['file_info'].get('size', 0)} بايت")
                else:
                    print(f"   [WARN] المسار النهائي مطابق لـ temp، استخدام الملف الموجود")
                    result['paths']['original'] = str(temp_file)
                    result['file_info'] = get_file_info(temp_file)
            except Exception as copy_error:
                import traceback
                error_details = traceback.format_exc()
                print(f"   [ERROR] خطأ في نقل الملف: {copy_error}")
                print(f"   تفاصيل الخطأ:\n{error_details}")
                raise
            
            # ===== حفظ النص المستخرج (فقط في قاعدة البيانات، لا يتم حفظه في ملف) =====
            # النص المستخرج سيتم حفظه في قاعدة البيانات فقط
            result['paths']['ocr_text'] = None
            print(f"   [INFO]  النص المستخرج سيتم حفظه في قاعدة البيانات فقط (لا يتم حفظه في ملف)")
            
            # ===== تحويل إلى PDF - لا يتم حفظه (يتم فقط للعرض المؤقت) =====
            print(f"📑 [7/7] معالجة PDF...")
            if self.file_extension != '.pdf':
                # لا نقوم بتحويل أو حفظ PDF - الملف الأصلي فقط يُحفظ
                result['paths']['pdf'] = None
                print(f"   [INFO]  الملف الأصلي فقط سيتم حفظه (لا يتم تحويل أو حفظ PDF)")
            else:
                # إذا كان PDF بالفعل، نستخدم الملف الأصلي
                result['paths']['pdf'] = str(self.paths['original_file'])
                print(f"   [OK] الملف PDF بالفعل")
            
            # حذف الملف المؤقت والمجلد المؤقت بعد اكتمال كل المراحل
            if temp_file and temp_file.exists() and str(temp_file) != str(self.paths.get('original_file', '')):
                try:
                    temp_file.unlink()
                    print(f"   [OK] تم حذف الملف المؤقت")
                except Exception as cleanup_error:
                    print(f"   [WARN] لم يتم حذف الملف المؤقت: {cleanup_error}")
            
            # حذف المجلد المؤقت بالكامل
            if temp_dir_obj and Path(temp_dir_obj).exists():
                try:
                    shutil.rmtree(temp_dir_obj)
                    print(f"   [OK] تم حذف المجلد المؤقت")
                except Exception as cleanup_error:
                    print(f"   [WARN] لم يتم حذف المجلد المؤقت: {cleanup_error}")
            
            # حساب وقت المعالجة
            end_time = datetime.now()
            result['processing_time'] = (end_time - start_time).total_seconds()
            
            print(f"[SUCCESS] تمت معالجة الوثيقة بنجاح في {result['processing_time']:.2f} ثانية")
            print(f"   [INFO] النتيجة النهائية:")
            print(f"      - العنوان: {result.get('title', 'غير محدد')}")
            print(f"      - التصنيف: {result.get('classification', 'غير محدد')}")
            print(f"      - دقة OCR: {result.get('ocr_accuracy', 0)}%")
            print(f"      - حجم النص: {len(result.get('ocr_text', ''))} حرف")
            
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"[ERROR] خطأ في معالجة الوثيقة: {e}")
            print(f"   تفاصيل الخطأ:\n{error_trace}")
            result['error'] = str(e)
            
            # حذف المجلد المؤقت في حالة الخطأ
            if temp_dir_obj and Path(temp_dir_obj).exists():
                try:
                    shutil.rmtree(temp_dir_obj)
                except:
                    pass
        
        return result
    
    def _translate_type(self, type_en: str) -> str:
        """ترجمة نوع الوثيقة"""
        translations = {
            'certificate': 'شهادة',
            'report': 'تقرير',
            'official_letter': 'كتاب رسمي',
            'form': 'نموذج',
            'other': 'أخرى',
        }
        return translations.get(type_en, 'أخرى')
    
    def _translate_direction(self, direction: str) -> str:
        """ترجمة اتجاه الوثيقة"""
        if direction == 'outgoing':
            return 'صادر'
        elif direction == 'incoming':
            return 'وارد'
        return None



        return result
    
    def _translate_type(self, type_en: str) -> str:
        """ترجمة نوع الوثيقة"""
        translations = {
            'certificate': 'شهادة',
            'report': 'تقرير',
            'official_letter': 'كتاب رسمي',
            'form': 'نموذج',
            'other': 'أخرى',
        }
        return translations.get(type_en, 'أخرى')
    
    def _translate_direction(self, direction: str) -> str:
        """ترجمة اتجاه الوثيقة"""
        if direction == 'outgoing':
            return 'صادر'
        elif direction == 'incoming':
            return 'وارد'
        return None


