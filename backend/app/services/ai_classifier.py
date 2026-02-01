"""
خدمة التصنيف الذكي للوثائق باستخدام Machine Learning
"""
import re
from typing import Dict, Optional, Tuple
from datetime import datetime


class DocumentAIClassifier:
    """
    مُصنِّف ذكي للوثائق باستخدام قواعد ذكية وتحليل النصوص
    في المستقبل يمكن استبداله بنموذج ML مدرب
    """
    
    # الكلمات المفتاحية لكل تصنيف
    CLASSIFICATION_KEYWORDS = {
        'شهادة': [
            # كلمات مميزة جداً للشهادات
            'يشهد', 'نشهد', 'this is to certify', 'certified that',
            'certificate of', 'شهادة تخرج', 'شهادة حضور', 'شهادة مشاركة',
            'شهادة إتمام', 'شهادة إنجاز', 'certificate of completion',
            'certificate of participation', 'certificate of achievement',
            'حاصل على', 'has completed', 'has successfully completed',
            'has attended', 'has participated', 'has graduated',
            'تخرج', 'graduation', 'graduated', 'بكالوريوس', 'ماجستير', 'دكتوراه',
            'bachelor', 'master', 'doctorate', 'phd',
            'دبلوم', 'diploma', 'دورة تدريبية', 'training course',
            'certificate', 'شهادة'
        ],
        'تقرير': [
            # كلمات مميزة للتقارير
            'تقرير', 'report', 'تقرير شامل', 'comprehensive report',
            'تقرير مفصل', 'detailed report', 'annual report', 'تقرير سنوي',
            'monthly report', 'تقرير شهري', 'quarterly report', 'تقرير ربع سنوي',
            'الإحصاء', 'statistics', 'stats',
            'الخلاصة', 'summary', 'executive summary', 'التوصيات', 'recommendations',
            'الأداء', 'performance',
            'الفترة', 'period', 'الربع', 'quarter', 'السنوي', 'annual',
            'الشهري', 'monthly',
            'الجدول', 'table', 'الرسوم البيانية', 'charts', 'graphs'
        ],
        'بحث': [
            # كلمات مميزة للبحوث الأكاديمية والعلمية
            'بحث', 'ورقة بحثية', 'research', 'research paper', 'paper',
            'اعداد الطالب', 'إعداد الطالب', 'prepared by', 'submitted by',
            'تحت اشراف', 'تحت إشراف', 'supervised by', 'under supervision',
            'الدكتور', 'د/', 'dr.', 'professor', 'prof.',
            'خوارزمية', 'خوارزميات', 'algorithm', 'algorithms',
            'إطار عمل', 'framework', 'منهجية', 'methodology',
            'النتائج', 'results', 'findings', 'التحليل', 'analysis',
            'الملخص', 'abstract', 'مقدمة', 'introduction',
            'الدراسة', 'study', 'دراسة', 'الدراسات السابقة', 'literature review',
            'المراجع', 'references', 'bibliography', 'sources',
            'الاستنتاجات', 'conclusions', 'الخاتمة', 'conclusion',
            'البيانات', 'data', 'تحليل البيانات', 'data analysis',
            'التجربة', 'experiment', 'التجارب', 'experiments',
            'النموذج', 'model', 'النماذج', 'models',
            'المقارنة', 'comparison', 'التقييم', 'evaluation',
            'الأداء', 'performance', 'الكفاءة', 'efficiency',
            'مفتوح المصدر', 'open source', 'open-source',
            'mining', 'تعدين', 'pattern', 'أنماط', 'نمط',
            'java', 'python', 'بايثون', 'programming', 'برمجة',
            'database', 'قاعدة بيانات', 'قواعد البيانات'
        ],
        'كتاب رسمي': [
            # كلمات مميزة للكتب الرسمية
            'كتاب رسمي', 'official letter', 'official document',
            'خطاب رسمي', 'formal letter', 'الكتاب الرسمي',
            'السيد', 'السيدة', 'المحترم', 'المحترمة',
            'dear sir', 'dear madam', 'dear', 'respectfully',
            'تحية طيبة', 'greetings', 'الموضوع', 'subject',
            're:', 'regarding', 'concerning', 'بخصوص', 'فيما يخص',
            'الرجاء', 'please', 'نرجو', 'نأمل', 'we hope',
            'نفيدكم', 'we inform you', 'نحيطكم علماً', 'we would like to inform',
            'التوقيع', 'signature', 'الختم', 'seal', 'stamp',
            'المدير', 'director', 'العميد', 'dean', 'الرئيس', 'president',
            'المدير العام', 'general manager', 'رئيس القسم', 'department head',
            'official', 'رسمي', 'letter', 'كتاب'
        ],
        'نموذج': [
            'نموذج', 'form', 'استمارة', 'طلب', 'application',
            'نموذج طلب', 'application form', 'استمارة طلب',
            'ملء البيانات', 'تعبئة', 'fill', 'complete',
            'الحقول المطلوبة', 'required fields', 'إرفاق',
            'attach', 'المستندات', 'documents', 'مرفقات',
            'بيانات شخصية', 'personal information', 'معلومات',
            'تفاصيل', 'details', 'التوقيع', 'signature',
            'الختم', 'stamp', 'نموذج التسجيل', 'registration form'
        ],
        'فاتورة': [
            'فاتورة', 'invoice', 'إيصال', 'receipt', 'المبلغ',
            'السعر', 'الإجمالي', 'total', 'ضريبة', 'tax',
            'الدفع', 'payment', 'رقم الفاتورة'
        ],
        'عقد': [
            'عقد', 'contract', 'اتفاقية', 'agreement', 'الطرف الأول',
            'الطرف الثاني', 'البنود', 'المادة', 'الشروط',
            'الالتزامات', 'المدة', 'الفسخ', 'التجديد'
        ],
        'محضر اجتماع': [
            'محضر', 'اجتماع', 'meeting', 'minutes', 'الحضور',
            'الغياب', 'جدول الأعمال', 'القرارات', 'التوصيات',
            'المناقشة', 'الأعضاء'
        ],
        'كشف درجات': [
            # كلمات مفتاحية مميزة جداً لكشوف الدرجات فقط
            'كشف درجات', 'جدول درجات', 'كشف النتائج', 'كشف نتائج',
            'grade sheet', 'score sheet', 'results sheet', 'transcript',
            # درجات ونتائج مميزة للكشوف فقط
            'نتائج امتحان', 'درجات الطلاب', 'نتائج الطلاب',
            'المجموع الكلي', 'المعدل التراكمي', 'النسبة المئوية',
            'التقدير العام', 'ترتيب الطلاب', 'رقم الجلوس',
            # مصطلحات كشوف الدرجات الحصرية
            'ناجح', 'راسب', 'passed', 'failed', 'pass', 'fail',
            'ranking', 'الترتيب', 'rank',
            'final grade', 'المجموع', 'average', 'المعدل',
            'mark', 'marks', 'درجة نهائية', 'الدرجة النهائية'
            # ملاحظة: تم إزالة الكلمات العامة مثل 'طالب', 'اسم', 'رقم' لتجنب التصنيف الخاطئ
        ],
        'اختبار': [
            # كلمات مميزة للاختبارات فقط (تجنب الكلمات المشتركة مع النماذج)
            'ورقة امتحان', 'exam paper', 'test paper', 'ورقة اختبار',
            'exam questions', 'test questions', 'أسئلة الاختبار',
            'السؤال الأول', 'السؤال الثاني', 'question 1', 'question 2',
            'نموذج الإجابة', 'answer key', 'مفتاح الإجابة',
            'answer sheet', 'exam sheet', 'test sheet',
            'اختبار نهائي', 'final exam', 'midterm exam', 'نصفي', 'نهائي',
            'exam time', 'exam duration', 'وقت الامتحان', 'مدة الامتحان',
            'العلامة الكاملة', 'total marks', 'full mark',
            'اختبارات', 'exams', 'tests', 'quiz'
        ]
    }
    
    # الكلمات المفتاحية للاتجاه
    DIRECTION_KEYWORDS = {
        'وارد': [
            'وارد', 'incoming', 'مستلم', 'received', 'إلى',
            'السيد المدير', 'عميد', 'رئيس', 'من الخارج'
        ],
        'صادر': [
            'صادر', 'outgoing', 'مُرسل', 'sent', 'من',
            'نحيطكم', 'نفيدكم', 'نخبركم', 'نرسل', 'إلى الخارج'
        ]
    }
    
    def classify_document(self, text: str, title: Optional[str] = None) -> Dict:
        """
        تصنيف الوثيقة تلقائياً بناءً على محتواها
        
        Args:
            text: نص الوثيقة المستخرج
            title: عنوان الوثيقة (اختياري)
            
        Returns:
            Dict يحتوي على التصنيف والاتجاه والثقة
        """
        if not text or len(text.strip()) < 10:
            return {
                'classification': None,
                'direction': None,
                'confidence': 0.0
            }
        
        # دمج العنوان مع النص للتحليل الأفضل
        full_text = f"{title or ''} {text}".lower()
        
        # تصنيف نوع الوثيقة
        classification, class_confidence = self._classify_type(full_text)
        
        # تحديد اتجاه الوثيقة
        direction, dir_confidence = self._classify_direction(full_text)
        
        # حساب الثقة الإجمالية
        overall_confidence = (class_confidence + dir_confidence) / 2
        
        return {
            'classification': classification,
            'direction': direction,
            'confidence': round(overall_confidence, 2)
        }
    
    def _classify_type(self, text: str) -> Tuple[Optional[str], float]:
        """تصنيف نوع الوثيقة"""
        scores = {}
        
        # أوزان خاصة لأنواع معينة من الكلمات المفتاحية
        # كلمات مفتاحية قوية جداً (تأثير كبير) - كلمات مميزة جداً
        very_strong_keywords = {
            'بحث': [
                'اعداد الطالب', 'إعداد الطالب', 'تحت اشراف', 'تحت إشراف',
                'supervised by', 'prepared by', 'submitted by',
                'ورقة بحثية', 'research paper', 'بحث علمي',
                'خوارزمية', 'خوارزميات', 'algorithm', 'algorithms',
                'إطار عمل', 'framework', 'مفتوح المصدر', 'open source',
                'mining', 'تعدين', 'pattern', 'أنماط',
                'literature review', 'الدراسات السابقة'
            ],
            'كشف درجات': [
                'كشف درجات', 'جدول درجات', 'grade sheet', 'score sheet', 
                'results sheet', 'كشف النتائج', 'transcript',
                'معدل تراكمي', 'المجموع الكلي', 'ترتيب الطلاب',
                'نتائج الطلاب', 'درجات الطلاب', 'رقم الجلوس'
            ],
            'اختبار': [
                'ورقة امتحان', 'exam paper', 'test paper', 'exam questions',
                'answer key', 'مفتاح الإجابة', 'نموذج الإجابة', 'answer sheet',
                'exam sheet', 'test sheet', 'final exam', 'midterm exam'
            ],
            'نموذج': [
                'نموذج طلب', 'application form', 'استمارة طلب',
                'registration form', 'نموذج التسجيل', 'fill form', 'complete form'
            ],
            'شهادة': [
                'يشهد', 'نشهد', 'this is to certify', 'certified that',
                'certificate of', 'شهادة تخرج', 'has completed', 'has graduated'
            ],
            'تقرير': [
                'تقرير سنوي', 'annual report', 'تقرير شامل', 'comprehensive report',
                'executive summary'
            ],
            'كتاب رسمي': [
                'كتاب رسمي', 'official letter', 'خطاب رسمي', 'formal letter',
                'نحيطكم علماً', 'we inform you', 'نفيدكم', 'regarding'
            ],
        }
        
        # كلمات مفتاحية قوية (تأثير متوسط)
        strong_keywords = {
            'بحث': [
                'بحث', 'research', 'الدكتور', 'د/', 'dr.', 'professor', 'prof.',
                'منهجية', 'methodology', 'مقدمة', 'introduction',
                'النتائج', 'results', 'findings', 'التحليل', 'analysis',
                'الملخص', 'abstract', 'الاستنتاجات', 'conclusions',
                'المراجع', 'references', 'bibliography',
                'التجربة', 'experiment', 'النموذج', 'model',
                'java', 'python', 'بايثون', 'programming', 'برمجة',
                'database', 'قاعدة بيانات'
            ],
            'كشف درجات': [
                'نتائج امتحان', 'ناجح', 'راسب', 'passed', 'failed',
                'ranking', 'الترتيب', 'average', 'المعدل', 'التقدير العام'
            ],
            'اختبار': [
                'السؤال الأول', 'السؤال الثاني', 'question 1', 'question 2',
                'exam time', 'exam duration', 'وقت الامتحان'
            ],
            'نموذج': [
                'ملء البيانات', 'fill', 'complete', 'personal information',
                'بيانات شخصية', 'required fields', 'الحقول المطلوبة'
            ],
            'شهادة': [
                'certificate', 'شهادة', 'حاصل على', 'تخرج', 'graduation',
                'بكالوريوس', 'ماجستير', 'دكتوراه', 'diploma'
            ],
            'تقرير': [
                'تقرير', 'report', 'الخلاصة', 'summary',
                'التوصيات', 'recommendations'
            ],
            'كتاب رسمي': [
                'الموضوع', 'subject', 'الرجاء', 'please', 'نرجو', 'نأمل',
                'المدير', 'العميد', 'الرئيس', 'السيد', 'المحترم'
            ],
            'فاتورة': [
                'المبلغ', 'السعر', 'الإجمالي', 'total', 'ضريبة', 'tax',
                'الدفع', 'payment', 'فاتورة', 'invoice'
            ],
            'عقد': [
                'البنود', 'المادة', 'الشروط', 'الالتزامات', 'المدة',
                'terms', 'conditions', 'clause', 'article'
            ],
            'محضر اجتماع': [
                'الحضور', 'الغياب', 'جدول الأعمال', 'القرارات', 'التوصيات',
                'attendance', 'agenda', 'decisions', 'recommendations'
            ],
        }
        
        # كلمات ضعيفة (تأثير أقل) - كلمات عامة
        weak_keywords = {
            'كشف درجات': ['name', 'اسم', 'number', 'رقم', 'list', 'statement', 'كشف'],
        }
        
        for doc_type, keywords in self.CLASSIFICATION_KEYWORDS.items():
            score = 0
            very_strong_count = 0
            strong_count = 0
            weak_count = 0
            
            for keyword in keywords:
                keyword_lower = keyword.lower()
                count = text.count(keyword_lower)
                
                # التحقق من الكلمات القوية جداً
                if doc_type in very_strong_keywords and keyword_lower in [k.lower() for k in very_strong_keywords[doc_type]]:
                    very_strong_count += count
                    score += count * 10  # وزن كبير جداً للكلمات القوية جداً
                # التحقق من الكلمات القوية
                elif doc_type in strong_keywords and keyword_lower in [k.lower() for k in strong_keywords[doc_type]]:
                    strong_count += count
                    score += count * 5  # وزن كبير للكلمات القوية
                # التحقق من الكلمات الضعيفة
                elif doc_type in weak_keywords and keyword_lower in [k.lower() for k in weak_keywords[doc_type]]:
                    weak_count += count
                    score += count * 0.3  # وزن صغير جداً للكلمات الضعيفة
                else:
                    score += count
            
            scores[doc_type] = score
        
        # اختيار التصنيف بأعلى نقاط
        if not scores or max(scores.values()) == 0:
            return None, 0.0
        
        best_type = max(scores, key=scores.get)
        max_score = scores[best_type]
        
        # شروط خاصة لـ "نموذج" - يجب أن يحتوي على كلمات قوية مميزة للنماذج
        if best_type == 'نموذج':
            # يجب أن يحتوي على كلمات قوية جداً للنماذج
            has_very_strong = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('نموذج', [])
            )
            
            # أو كلمات قوية للنماذج
            has_strong = any(
                kw.lower() in text.lower() 
                for kw in strong_keywords.get('نموذج', [])
            )
            
            # يجب أن يحتوي على حقول نموذجية (fields)
            has_form_fields = bool(re.search(r'(حقل|field|required|مطلوب|fill|ملء|تعبئة)', text.lower()))
            
            # يجب ألا يحتوي على كلمات اختبار قوية جداً
            has_exam_very_strong = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('اختبار', [])
            )
            
            if not has_very_strong and not (has_strong and has_form_fields):
                # إذا لم تكن كلمات قوية، نزيل "نموذج" ونبحث عن تصنيف آخر
                scores['نموذج'] = 0
                if scores and max(scores.values()) > 0:
                    best_type = max(scores, key=scores.get)
                    max_score = scores[best_type]
                else:
                    return 'أخرى', 0.0
            elif has_exam_very_strong and not has_very_strong:
                # إذا كانت تحتوي على كلمات اختبار قوية جداً بدون كلمات نموذج قوية جداً
                if scores.get('اختبار', 0) > max_score * 0.8:
                    best_type = 'اختبار'
                    max_score = scores.get('اختبار', 0)
        
        # شروط خاصة لـ "اختبار" - يجب أن يحتوي على كلمات قوية مميزة
        if best_type == 'اختبار':
            # يجب أن يحتوي على كلمات قوية جداً للاختبار
            has_very_strong = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('اختبار', [])
            )
            
            # أو كلمات قوية مع أسئلة فعلية
            has_strong = any(
                kw.lower() in text.lower() 
                for kw in strong_keywords.get('اختبار', [])
            )
            
            # يجب أن يحتوي على أسئلة فعلية (كلمات مثل "السؤال" مع أرقام)
            has_questions = bool(re.search(r'(السؤال|question)\s*[:\d]', text.lower()))
            
            # يجب ألا يحتوي على كلمات نموذج قوية جداً
            has_form_very_strong = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('نموذج', [])
            )
            
            if not has_very_strong and not (has_strong and has_questions):
                # إذا لم تكن كلمات قوية، قد تكون نموذج أو نوع آخر
                if has_form_very_strong and scores.get('نموذج', 0) > 0:
                    # إذا كانت كلمات النموذج القوية موجودة، نصنفها كنموذج
                    best_type = 'نموذج'
                    max_score = scores.get('نموذج', 0)
                else:
                    # إذا لم تكن كلمات قوية، نزيل "اختبار" ونبحث عن تصنيف آخر
                    scores['اختبار'] = 0
                    if scores and max(scores.values()) > 0:
                        best_type = max(scores, key=scores.get)
                        max_score = scores[best_type]
                    else:
                        return 'أخرى', 0.0
            elif has_form_very_strong and not has_questions:
                # إذا كانت تحتوي على كلمات نموذج قوية جداً بدون أسئلة
                if scores.get('نموذج', 0) > max_score * 0.7:
                    best_type = 'نموذج'
                    max_score = scores.get('نموذج', 0)
        
        # شروط خاصة لـ "شهادة" - يجب أن تحتوي على كلمات قوية مميزة
        if best_type == 'شهادة':
            # يجب أن تحتوي على كلمات قوية جداً للشهادات
            has_very_strong = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('شهادة', [])
            )
            
            # أو كلمات شهادة قوية مع كلمات إتمام
            has_cert_pattern = bool(
                re.search(r'(شهادة|certificate).*(تخرج|completion|participation|achievement)', text.lower()) or
                re.search(r'(يشهد|نشهد|certified|certify)', text.lower())
            )
            
            if not has_very_strong and not has_cert_pattern:
                # إذا لم تكن كلمات قوية، نزيل "شهادة" ونبحث عن تصنيف آخر
                scores['شهادة'] = 0
                if scores and max(scores.values()) > 0:
                    best_type = max(scores, key=scores.get)
                    max_score = scores[best_type]
                else:
                    return 'أخرى', 0.0
        
        # شروط خاصة لـ "تقرير" - يجب أن يحتوي على كلمات قوية مميزة
        if best_type == 'تقرير':
            # يجب أن يحتوي على كلمات تقرير قوية
            has_report_keywords = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('تقرير', []) + 
                          strong_keywords.get('تقرير', [])
            )
            
            # أو نمط تقرير (كلمة تقرير مع كلمات مثل: تحليل، نتائج، توصيات)
            has_report_pattern = bool(
                re.search(r'(تقرير|report).*(تحليل|analysis|نتائج|results|توصيات|recommendations)', text.lower())
            )
            
            if not has_report_keywords and not has_report_pattern:
                # إذا لم تكن كلمات قوية، نزيل "تقرير" ونبحث عن تصنيف آخر
                scores['تقرير'] = 0
                if scores and max(scores.values()) > 0:
                    best_type = max(scores, key=scores.get)
                    max_score = scores[best_type]
                else:
                    return 'أخرى', 0.0
        
        # شروط خاصة لـ "كتاب رسمي" - يجب أن يحتوي على كلمات قوية مميزة
        if best_type == 'كتاب رسمي':
            # يجب أن يحتوي على كلمات كتاب رسمي قوية
            has_letter_keywords = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('كتاب رسمي', []) + 
                          strong_keywords.get('كتاب رسمي', [])
            )
            
            # أو نمط كتاب رسمي (السيد/المحترم + الموضوع/الرجاء)
            has_letter_pattern = bool(
                (re.search(r'(السيد|السيدة|المحترم|dear)', text.lower()) and
                 re.search(r'(الموضوع|subject|الرجاء|please|نرجو)', text.lower())) or
                re.search(r'(كتاب رسمي|official letter|خطاب رسمي)', text.lower())
            )
            
            if not has_letter_keywords and not has_letter_pattern:
                # إذا لم تكن كلمات قوية، نزيل "كتاب رسمي" ونبحث عن تصنيف آخر
                scores['كتاب رسمي'] = 0
                if scores and max(scores.values()) > 0:
                    best_type = max(scores, key=scores.get)
                    max_score = scores[best_type]
                else:
                    return 'أخرى', 0.0
        
        # شروط خاصة لـ \"كشف درجات\" - يجب أن يحتوي على كلمات قوية مميزة
        # ويجب ألا يكون بحث أكاديمي
        if best_type == 'كشف درجات':
            # التحقق أولاً إذا كانت الوثيقة بحث أكاديمي
            is_research = any(
                kw.lower() in text.lower() 
                for kw in very_strong_keywords.get('بحث', [])
            )
            
            if is_research:
                # إذا كانت بحث، لا يمكن أن تكون كشف درجات
                scores['كشف درجات'] = 0
                if scores.get('بحث', 0) > 0:
                    best_type = 'بحث'
                    max_score = scores.get('بحث', 0)
                elif scores and max(scores.values()) > 0:
                    best_type = max(scores, key=scores.get)
                    max_score = scores[best_type]
                else:
                    return 'أخرى', 0.0
            else:
                # يجب أن يحتوي على كلمة قوية جداً واحدة على الأقل
                has_very_strong = any(
                    kw.lower() in text.lower() 
                    for kw in very_strong_keywords.get('كشف درجات', [])
                )
                
                # أو وجود جداول (علامة | أو tabs) مع كلمات درجات
                has_table = ('|' in text or '\t' in text) and bool(
                    re.search(r'(درجات|grade|score|marks|نتائج)', text.lower())
                )
                
                if not has_very_strong and not has_table:
                    # إذا لم تكن كلمات قوية، نزيل \"كشف درجات\" ونبحث عن تصنيف آخر
                    scores['كشف درجات'] = 0
                    if scores and max(scores.values()) > 0:
                        best_type = max(scores, key=scores.get)
                        max_score = scores[best_type]
                    else:
                        return 'أخرى', 0.0
        
        # شروط خاصة لـ \"بحث\" - إعطاء أولوية عالية إذا وجدت كلمات قوية
        if best_type != 'بحث':
            # التحقق إذا كانت الوثيقة تحتوي على كلمات بحث قوية جداً
            research_very_strong = sum(
                1 for kw in very_strong_keywords.get('بحث', [])
                if kw.lower() in text.lower()
            )
            
            if research_very_strong >= 2:
                # إذا وجدت كلمتين قويتين أو أكثر للبحث، نصنفها كبحث
                best_type = 'بحث'
                max_score = scores.get('بحث', max_score)
        
        
        total_score = sum(scores.values())
        
        # حساب نسبة الثقة - تحسين الحساب
        if total_score > 0:
            # الثقة تعتمد على نسبة النقاط الأعلى من المجموع
            confidence = min((max_score / total_score) * 100, 100)
            
            # إعطاء ثقة أكبر للأنواع التي لها كلمات قوية جداً
            if best_type in very_strong_keywords:
                very_strong_kws_found = sum(
                    1 for kw in very_strong_keywords[best_type]
                    if kw.lower() in text.lower()
                )
                if very_strong_kws_found > 0:
                    confidence = min(confidence + (very_strong_kws_found * 5), 100)
        else:
            confidence = 0.0
        
        # إذا كانت النقاط منخفضة جداً، نرجع "أخرى"
        if max_score < 3:
            return 'أخرى', 0.0
        
        # حد أدنى للثقة قبل التصنيف (حسب نوع الوثيقة)
        min_confidence_threshold = {
            'بحث': 30,
            'كشف درجات': 40,
            'اختبار': 35,
            'نموذج': 35,
            'شهادة': 40,
            'تقرير': 35,
            'كتاب رسمي': 35,
            'فاتورة': 30,
            'عقد': 30,
            'محضر اجتماع': 30,
        }.get(best_type, 30)
        
        if confidence < min_confidence_threshold:
            return 'أخرى', confidence
        
        return best_type, confidence
    
    def _classify_direction(self, text: str) -> Tuple[Optional[str], float]:
        """تحديد اتجاه الوثيقة (صادر/وارد)"""
        scores = {}
        
        for direction, keywords in self.DIRECTION_KEYWORDS.items():
            score = 0
            for keyword in keywords:
                count = text.count(keyword.lower())
                score += count
            
            scores[direction] = score
        
        if not scores or max(scores.values()) == 0:
            return None, 0.0
        
        best_direction = max(scores, key=scores.get)
        max_score = scores[best_direction]
        total_score = sum(scores.values())
        
        confidence = min(max_score / (total_score + 1) * 100, 100)
        
        if confidence < 15:
            return None, confidence
        
        return best_direction, confidence
    
    def suggest_title(self, text: str, classification: Optional[str] = None) -> str:
        """
        اقتراح عنوان للوثيقة بناءً على محتواها
        
        Args:
            text: نص الوثيقة
            classification: التصنيف (اختياري)
            
        Returns:
            عنوان مقترح
        """
        if not text or len(text.strip()) < 10:
            return "وثيقة بدون عنوان"
        
        # أخذ أول سطور من النص
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        if not lines:
            return "وثيقة بدون عنوان"
        
        # استخراج أول جملة ذات معنى
        first_line = lines[0]
        
        # إزالة التواريخ والأرقام من البداية
        first_line = re.sub(r'^[\d\s/\-:]+', '', first_line)
        
        # إزالة الرموز غير المرغوبة
        first_line = re.sub(r'[^\w\s\u0600-\u06FF]', ' ', first_line)
        
        # تقصير العنوان إذا كان طويلاً
        words = first_line.split()
        if len(words) > 10:
            first_line = ' '.join(words[:10]) + '...'
        
        # إضافة نوع الوثيقة للعنوان
        if classification and classification != 'أخرى':
            title = f"{classification}: {first_line}"
        else:
            title = first_line
        
        # التأكد من أن العنوان ليس فارغاً
        if not title.strip():
            return "وثيقة بدون عنوان"
        
        return title[:200]  # حد أقصى 200 حرف
    
    def extract_date(self, text: str) -> Optional[datetime]:
        """
        استخراج التاريخ من نص الوثيقة
        
        Args:
            text: نص الوثيقة
            
        Returns:
            datetime object أو None
        """
        # أنماط التواريخ المختلفة
        date_patterns = [
            r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})',  # 2024-01-15
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{4})',  # 15/01/2024
            r'(\d{1,2})[/-](\d{1,2})[/-](\d{2})',  # 15/01/24
        ]
        
        for pattern in date_patterns:
            matches = re.findall(pattern, text)
            if matches:
                try:
                    parts = matches[0]
                    # محاولة تحويل إلى تاريخ
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                    else:  # DD-MM-YYYY
                        day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                        if year < 100:  # تحويل سنة من رقمين
                            year += 2000
                    
                    return datetime(year, month, day)
                except (ValueError, IndexError):
                    continue
        
        return None


# إنشاء instance عام
ai_classifier = DocumentAIClassifier()

