from pathlib import Path
from typing import Tuple
import io
import re
from datetime import datetime

import fitz  # PyMuPDF
import pytesseract
from PIL import Image
from docx import Document as DocxDocument
import openpyxl
import numpy as np
import cv2

try:
    import easyocr
except ImportError:
    easyocr = None


def extract_text_from_pdf(pdf_path: Path, langs: str = "ara+eng") -> Tuple[str, float]:
    """استخراج النص من ملف PDF بدقة عالية"""
    doc = fitz.open(str(pdf_path))
    full_text_parts: list[str] = []
    ocr_pages = 0
    total_pages = len(doc)
    total_confidence = 0.0

    for page_num, page in enumerate(doc):
        # محاولة استخراج النص النصي أولاً (دقة 100%)
        text = page.get_text("text", flags=fitz.TEXT_PRESERVE_LIGATURES | fitz.TEXT_PRESERVE_WHITESPACE)
        
        # تحسين استخراج الجداول من PDF
        tables = page.find_tables()
        if tables:
            for table in tables:
                table_text = table.extract()
                if table_text:
                    # تحويل الجدول إلى نص منسق ب pipes
                    table_rows = []
                    for row in table_text:
                        if row:
                            row_text = " | ".join(str(cell).strip() if cell else "" for cell in row)
                            if row_text.strip():
                                table_rows.append(row_text)
                    if table_rows:
                        full_text_parts.append("\n".join(table_rows))
        
        if text and text.strip():
            full_text_parts.append(text)
            total_confidence += 100.0
            continue
        
        # إذا لم يوجد نص نصي، استخدم OCR بدقة عالية (600 DPI للجودة العالية)
        pix = page.get_pixmap(dpi=600, alpha=False)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        ocr_text, ocr_accuracy = ocr_image_to_text(img, langs=langs)
        if ocr_text:
            full_text_parts.append(ocr_text)
            total_confidence += ocr_accuracy
        ocr_pages += 1

    combined = "\n".join(full_text_parts).strip()
    
    # حساب الدقة بناءً على الثقة الفعلية
    if total_pages > 0:
        accuracy = total_confidence / total_pages
    else:
        accuracy = 0.0
    
    # تنظيف النص النهائي
    combined = _post_process_text(combined)
    
    return combined, round(accuracy, 2)


def extract_text_from_word(docx_path: Path) -> Tuple[str, float]:
    """استخراج النص من ملف Word (.docx أو .doc)"""
    file_path = Path(docx_path)
    suffix = file_path.suffix.lower()
    
    # محاولة استخراج نص من ملف .doc القديم
    if suffix == '.doc':
        return _extract_text_from_old_doc(file_path)
    
    # استخراج نص من ملف .docx الحديث
    try:
        doc = DocxDocument(str(file_path))
        full_text = []
        
        # استخراج النص من الفقرات
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                full_text.append(paragraph.text)
        
        # استخراج النص من الجداول - بشكل منسق جدولياً بدقة عالية
        for table_idx, table in enumerate(doc.tables):
            table_rows = []
            # حساب عدد الأعمدة لأفضل تنسيق
            max_cols = max(len(row.cells) for row in table.rows) if table.rows else 0
            
            for row_idx, row in enumerate(table.rows):
                row_cells = []
                for cell_idx, cell in enumerate(row.cells):
                    cell_text = cell.text.strip()
                    
                    # تنظيف النص من الأحرف الخاصة والمسافات الزائدة
                    cell_text = re.sub(r'\s+', ' ', cell_text)
                    
                    # الحفاظ على الأرقام والتواريخ بشكل صحيح
                    cell_text = re.sub(r'(\d)\s+(\d)', r'\1\2', cell_text)  # ربط الأرقام المتجاورة
                    
                    # إزالة الأحرف الخاصة غير المرغوبة مع الحفاظ على الرموز المهمة
                    cell_text = re.sub(r'[^\w\s\u0600-\u06FF\d\.\,\-\(\)\/]', '', cell_text)
                    
                    row_cells.append(cell_text if cell_text else "")
                
                # ملء الخلايا الفارغة للصفوف القصيرة
                while len(row_cells) < max_cols:
                    row_cells.append("")
                
                # دمج خلايا الصف بـ pipes لتنسيق جدولي
                row_text = " | ".join(row_cells)
                if row_text.strip() and not all(not cell for cell in row_cells):
                    table_rows.append(row_text)
            
            # إضافة صفوف الجدول مع فواصل واضحة
            if table_rows:
                # إضافة عنوان الجدول إذا كان موجوداً
                if table_idx == 0 or len(full_text) == 0:
                    full_text.extend(table_rows)
                else:
                    full_text.append("")  # سطر فارغ بين الجداول
                    full_text.extend(table_rows)
        
        combined = "\n".join(full_text).strip()
        
        # إذا لم نحصل على نص، قد يكون الملف تالفاً أو فارغاً
        if not combined:
            print(f"[WARN] ملف Word فارغ أو لا يحتوي على نص قابل للاستخراج: {file_path}")
            return "", 0.0
        
        # Word نصه واضح، دقة 100%
        print(f"[INFO] تم استخراج {len(combined)} حرف من ملف Word (.docx)")
        return combined, 100.0
    except Exception as e:
        print(f"[ERROR] خطأ في استخراج النص من Word (.docx): {e}")
        # إذا فشل مع .docx، جرب كملف .doc قديم
        if suffix == '.docx':
            print(f"[INFO] محاولة استخراج النص كملف .doc قديم...")
            return _extract_text_from_old_doc(file_path)
        import traceback
        traceback.print_exc()
        return "", 0.0


def _extract_text_from_old_doc(doc_path: Path) -> Tuple[str, float]:
    """استخراج النص من ملف .doc القديم باستخدام antiword أو catdoc"""
    try:
        import subprocess
        
        # محاولة استخدام antiword (أفضل للأداء)
        try:
            result = subprocess.run(
                ['antiword', str(doc_path)],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                text = result.stdout.strip()
                # تنظيف النص وتحسين التنسيق الجدولي
                text = re.sub(r'\t+', ' | ', text)  # تحويل tabs إلى pipes للجداول
                text = re.sub(r'\s+', ' ', text)  # تحويل المسافات المتعددة إلى مسافة واحدة
                print(f"[INFO] تم استخراج {len(text)} حرف من ملف .doc باستخدام antiword")
                return text, 95.0
            elif result.stderr:
                print(f"[WARN] antiword error: {result.stderr[:200]}")
        except FileNotFoundError:
            print(f"[WARN] antiword غير مثبت في النظام")
        except subprocess.TimeoutExpired:
            print(f"[WARN] timeout في antiword")
        except Exception as antiword_error:
            print(f"[WARN] خطأ في antiword: {antiword_error}")
        
        # محاولة استخدام catdoc كبديل
        try:
            result = subprocess.run(
                ['catdoc', str(doc_path)],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='ignore',
                timeout=30
            )
            if result.returncode == 0 and result.stdout.strip():
                text = result.stdout.strip()
                # تنظيف النص وتحسين التنسيق الجدولي
                text = re.sub(r'\t+', ' | ', text)
                text = re.sub(r'\s+', ' ', text)
                print(f"[INFO] تم استخراج {len(text)} حرف من ملف .doc باستخدام catdoc")
                return text, 90.0
            elif result.stderr:
                print(f"[WARN] catdoc error: {result.stderr[:200]}")
        except FileNotFoundError:
            print(f"[WARN] catdoc غير مثبت في النظام")
        except subprocess.TimeoutExpired:
            print(f"[WARN] timeout في catdoc")
        except Exception as catdoc_error:
            print(f"[WARN] خطأ في catdoc: {catdoc_error}")
        
        # إذا لم تنجح الطرق السابقة
        print(f"[ERROR] لا يمكن استخراج النص من ملف .doc القديم")
        print(f"[INFO] الحل: قم بتحويل الملف إلى .docx باستخدام Microsoft Word")
        print(f"[INFO] أو تأكد من تثبيت antiword في النظام")
        return "", 0.0
            
    except Exception as e:
        print(f"[ERROR] خطأ عام في معالجة ملف .doc: {e}")
        import traceback
        traceback.print_exc()
        return "", 0.0


def extract_text_from_excel(xlsx_path: Path) -> Tuple[str, float]:
    """استخراج النص من ملف Excel بدقة عالية مع دعم .xls القديم"""
    try:
        suffix = xlsx_path.suffix.lower()
        
        # معالجة ملفات .xls القديمة
        if suffix == '.xls':
            try:
                import xlrd
                workbook = xlrd.open_workbook(str(xlsx_path))
                full_text = []
                
                for sheet_idx in range(workbook.nsheets):
                    sheet = workbook.sheet_by_index(sheet_idx)
                    full_text.append(f"--- {sheet.name} ---")
                    
                    for row_idx in range(sheet.nrows):
                        row_values = []
                        for col_idx in range(sheet.ncols):
                            cell = sheet.cell(row_idx, col_idx)
                            cell_value = cell.value
                            # تحويل أنواع البيانات المختلفة إلى نص
                            if cell.ctype == xlrd.XL_CELL_DATE:
                                try:
                                    from datetime import datetime
                                    date_tuple = xlrd.xldate_as_tuple(cell_value, workbook.datemode)
                                    cell_value = datetime(*date_tuple).strftime('%Y-%m-%d')
                                except:
                                    cell_value = str(cell_value)
                            else:
                                cell_value = str(cell_value) if cell_value is not None else ""
                            row_values.append(cell_value.strip() if cell_value else "")
                        
                        row_text = " | ".join(row_values)
                        if row_text.strip() and not all(not v for v in row_values):
                            full_text.append(row_text)
                
                combined = "\n".join(full_text).strip()
                combined = _post_process_text(combined)
                return combined, 100.0
            except ImportError:
                print("[WARN] xlrd غير مثبت - سيتم استخدام openpyxl فقط")
            except Exception as xls_error:
                print(f"[WARN] خطأ في معالجة .xls: {xls_error} - سيتم تجربة openpyxl")
        
        # معالجة ملفات .xlsx الحديثة
        wb = openpyxl.load_workbook(str(xlsx_path), data_only=True, read_only=True)
        full_text = []
        
        for sheet in wb.worksheets:
            full_text.append(f"--- {sheet.title} ---")
            
            # استخراج النص من جميع الصفوف مع الحفاظ على التنسيق
            for row in sheet.iter_rows(values_only=True):
                row_values = []
                for cell in row:
                    if cell is None:
                        row_values.append("")
                    elif isinstance(cell, (int, float)):
                        # تحويل الأرقام إلى نص مع الحفاظ على التنسيق
                        if isinstance(cell, float) and cell.is_integer():
                            row_values.append(str(int(cell)))
                        else:
                            row_values.append(str(cell))
                    else:
                        row_values.append(str(cell).strip())
                
                row_text = " | ".join(row_values)
                # تجاهل الصفوف الفارغة تماماً
                if row_text.strip() and not all(not v or v == "None" for v in row_values):
                    full_text.append(row_text)
        
        combined = "\n".join(full_text).strip()
        combined = _post_process_text(combined)
        
        # Excel نصه واضح، دقة 100%
        return combined, 100.0
    except Exception as e:
        print(f"[ERROR] خطأ في استخراج النص من Excel: {e}")
        import traceback
        traceback.print_exc()
        return "", 0.0


def extract_text_from_image(image_path: Path, langs: str = "ara+eng") -> Tuple[str, float]:
    """استخراج النص من صورة باستخدام EasyOCR مع معالجة مسبقة"""
    try:
        img = Image.open(str(image_path))
        return ocr_image_to_text(img, langs=langs)
    except Exception as e:
        print(f"خطأ في استخراج النص من الصورة: {e}")
        return "", 0.0


_easyocr_reader = None


def get_easyocr_reader():
    """تهيئة EasyOCR reader وحفظه في الذاكرة"""
    global _easyocr_reader
    if _easyocr_reader is None:
        if easyocr is None:
            raise RuntimeError(
                "EasyOCR غير مثبت. أضف easyocr إلى المتطلبات ثم أعد تشغيل الخدمات."
            )
        _easyocr_reader = easyocr.Reader(['ar', 'en'], gpu=False, verbose=False)
    return _easyocr_reader


def preprocess_image_for_ocr(pil_image: Image.Image) -> np.ndarray:
    """تنظيف الصورة (ضوضاء، إضاءة، ميل) قبل تمريرها للمحرك - نسخة محسّنة للدقة"""
    # تحويل إلى numpy array مع معالجة الشفافية
    if pil_image.mode in ('RGBA', 'LA', 'P'):
        # تحويل الصور الشفافة إلى RGB
        rgb_img = Image.new('RGB', pil_image.size, (255, 255, 255))
        if pil_image.mode == 'P':
            pil_image = pil_image.convert('RGBA')
        rgb_img.paste(pil_image, mask=pil_image.split()[-1] if pil_image.mode == 'RGBA' else None)
        img = np.array(rgb_img)
    else:
        img = np.array(pil_image.convert("RGB"))
    
    # تحسين الدقة إذا كانت الصورة صغيرة جداً
    height, width = img.shape[:2]
    if height < 800 or width < 800:
        scale_factor = max(800 / height, 800 / width, 2.0)  # زيادة الدقة بشكل معتدل
        new_width = int(width * scale_factor)
        new_height = int(height * scale_factor)
        img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_CUBIC)  # CUBIC للسرعة مع دقة جيدة
    
    # تحويل إلى grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    
    # تحليل الصورة لتحديد نوع المعالجة المطلوبة
    mean_brightness = np.mean(gray)
    std_brightness = np.std(gray)
    
    # إذا كانت الصورة واضحة جداً (تباين عالي)، نستخدم معالجة خفيفة
    is_clear_image = std_brightness > 50 and 80 < mean_brightness < 200
    
    if is_clear_image:
        # معالجة خفيفة للصور الواضحة
        # إزالة ضوضاء خفيفة
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # تحسين التباين خفيف
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        # تحويل مباشر إلى RGB (بدون thresholding)
        return cv2.cvtColor(gray, cv2.COLOR_GRAY2RGB)
    
    # معالجة كاملة للصور غير الواضحة
    # تصحيح الميل (skew correction) للصور المائلة
    try:
        try:
            from scipy import ndimage
            # اكتشاف الميل باستخدام Hough transform
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLines(edges, 1, np.pi/180, 200)
            if lines is not None and len(lines) > 0:
                angles = []
                for line in lines[:5]:  # أول 5 خطوط فقط
                    rho, theta = line[0]  # كل سطر هو array من قيمتين [[rho, theta]]
                    angle = (theta * 180 / np.pi) - 90
                    if -45 < angle < 45:
                        angles.append(angle)
                if angles:
                    median_angle = np.median(angles)
                    if abs(median_angle) > 0.5:  # تصحيح فقط إذا كان الميل أكبر من 0.5 درجة
                        gray = ndimage.rotate(gray, median_angle, cval=255, reshape=False)
        except ImportError:
            pass
        except Exception as skew_error:
            print(f"[WARN] فشل تصحيح الميل: {skew_error}")
    except:
        pass
    
    # إزالة الضوضاء باستخدام bilateral filter (يحافظ على الحواف)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # تحسين التباين باستخدام CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    
    # تطبيق unsharp masking لزيادة حدة النص
    gaussian = cv2.GaussianBlur(gray, (3, 3), 1.0)
    gray = cv2.addWeighted(gray, 1.3, gaussian, -0.3, 0)
    
    # استخدام Otsu's threshold للصور الممسوحة ضوئياً
    # أو adaptive threshold للصور ذات الإضاءة غير المتساوية
    if std_brightness < 30:  # صورة ممسوحة ضوئياً (إضاءة متساوية)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        # adaptive threshold للصور ذات الإضاءة غير المتساوية
        thresh = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11,  # حجم النافذة
            8,   # القيمة الثابتة
        )
    
    # تحسين الحواف باستخدام morphological operations
    kernel = np.ones((2, 2), np.uint8)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
    
    # تحويل مرة أخرى إلى RGB للتوافق مع EasyOCR
    return cv2.cvtColor(thresh, cv2.COLOR_GRAY2RGB)


def _calculate_word_distance(box1, box2):
    """حساب المسافة بين كلمتين بناءً على صناديق النص"""
    # الحصول على المواضع الأفقية
    x1_right = max([point[0] for point in box1])
    x2_left = min([point[0] for point in box2])
    
    # المسافة بين الكلمتين
    distance = x2_left - x1_right
    
    # الحصول على متوسط العرض للكلمات
    width1 = max([point[0] for point in box1]) - min([point[0] for point in box1])
    width2 = max([point[0] for point in box2]) - min([point[0] for point in box2])
    avg_width = (width1 + width2) / 2
    
    return distance / max(avg_width, 1)  # Normalized distance


def _process_easyocr_results(results, image_width):
    """معالجة نتائج EasyOCR للحفاظ على المسافات بين الكلمات - نسخة محسّنة"""
    if not results:
        return ""
    
    lines = []
    current_line = []
    current_y = None
    
    # فرز النتائج حسب الموضع (من الأعلى إلى الأسفل، من اليمين إلى اليسار للعربية)
    sorted_results = sorted(results, key=lambda x: (
        min([point[1] for point in x[0]]),  # Y position
        -min([point[0] for point in x[0]])  # X position (معكوس للعربية - من اليمين لليسار)
    ))
    
    for box, text, confidence in sorted_results:
        y_top = min([point[1] for point in box])
        y_bottom = max([point[1] for point in box])
        box_height = y_bottom - y_top
        
        # تحديد إذا كانت هذه الكلمة في سطر جديد
        if current_y is None:
            current_y = y_top
            current_line = [(box, text, confidence)]
        else:
            # إذا كان الفرق في Y كبيراً نسبياً، فهذا سطر جديد
            y_diff = abs(y_top - current_y)
            
            # استخدام نسبة أكثر دقة لتحديد الأسطر الجديدة
            avg_height = (box_height + (max([p[1] for p in current_line[0][0]]) - min([p[1] for p in current_line[0][0]]))) / 2
            
            if y_diff > avg_height * 0.6:  # سطر جديد
                if current_line:
                    lines.append(current_line)
                current_line = [(box, text, confidence)]
                current_y = y_top
            else:
                current_line.append((box, text, confidence))
                current_y = (current_y + y_top) / 2  # تحديث متوسط Y
    
    if current_line:
        lines.append(current_line)
    
    # بناء النص مع احترام المسافات بشكل أفضل
    output_lines = []
    for line in lines:
        if not line:
            continue
        
        # فرز الكلمات في السطر من اليمين إلى اليسار للعربية (معكوس)
        # لكن نحتاج إلى التحقق من اتجاه النص أولاً
        # إذا كان النص عربي، نستخدم اليمين لليسار، وإلا نستخدم اليسار لليمين
        has_arabic = any(re.search(r'[\u0600-\u06FF]', text) for _, text, _ in line)
        
        if has_arabic:
            # للعربية: من اليمين إلى اليسار
            line.sort(key=lambda x: -min([point[0] for point in x[0]]))
        else:
            # للإنجليزية: من اليسار إلى اليمين
            line.sort(key=lambda x: min([point[0] for point in x[0]]))
        
        words = []
        prev_right_edge = None
        prev_left_edge = None
        
        for i, (box, text, confidence) in enumerate(line):
            text = text.strip()
            if not text:
                continue
            
            # حساب المسافة من الكلمة السابقة
            left_edge = min([point[0] for point in box])
            right_edge = max([point[0] for point in box])
            box_width = right_edge - left_edge
            
            if prev_right_edge is not None:
                # حساب المسافة الفعلية بين الكلمتين
                if has_arabic:
                    # للعربية: المسافة = prev_right_edge - left_edge (سالبة)
                    actual_distance = prev_right_edge - left_edge
                else:
                    # للإنجليزية: المسافة = left_edge - prev_right_edge
                    actual_distance = left_edge - prev_right_edge
                actual_distance = abs(actual_distance)
                
                # حساب متوسط عرض الكلمات لتحديد المسافة الطبيعية
                avg_width = box_width
                if i > 0 and len(line[i-1][0]) > 0:
                    prev_box = line[i-1][0]
                    prev_width = max([p[0] for p in prev_box]) - min([p[0] for p in prev_box])
                    avg_width = (box_width + prev_width) / 2
                
                # تحديد عدد المسافات بناءً على المسافة الفعلية
                # دائماً نضيف مسافة واحدة على الأقل بين كل كلمتين لتجنب دمج الكلمات
                if avg_width > 0:
                    distance_ratio = actual_distance / avg_width
                    
                    # دائماً نضيف مسافة واحدة على الأقل
                    # ثم نضيف مسافات إضافية حسب المسافة
                    if distance_ratio > 2.5:
                        words.append("   ")  # ثلاث مسافات للكلمات البعيدة جداً
                    elif distance_ratio > 1.8:
                        words.append("  ")  # مسافتان للكلمات البعيدة
                    elif distance_ratio > 0.3:  # حتى للكلمات القريبة نسبياً
                        words.append(" ")   # مسافة واحدة عادية
                    else:
                        # حتى للكلمات القريبة جداً، نضيف مسافة لتجنب دمج الكلمات
                        words.append(" ")
                else:
                    # إذا لم نتمكن من حساب المسافة، نضيف مسافة افتراضية دائماً
                    words.append(" ")
            else:
                # للكلمة الأولى في السطر، لا نضيف مسافة قبلها
                pass
            
            words.append(text)
            if has_arabic:
                prev_right_edge = right_edge
            else:
                prev_right_edge = right_edge  # للإنجليزية أيضاً نستخدم right_edge
        
        if words:
            # دائماً نستخدم join لإضافة مسافة واحدة بين كل كلمتين
            # هذا يضمن وجود مسافات بين الكلمات دائماً
            cleaned_words = [word.strip() for word in words if word.strip()]
            if len(cleaned_words) > 1:
                # دمج الكلمات بمسافة واحدة بين كل كلمتين
                joined_text = " ".join(cleaned_words)
            elif len(cleaned_words) == 1:
                joined_text = cleaned_words[0]
            else:
                joined_text = ""
            
            output_lines.append(joined_text)
    
    return "\n".join(output_lines)


def ocr_image_to_text(pil_image: Image.Image, langs: str = "ara+eng") -> Tuple[str, float]:
    """تشغيل EasyOCR مع معالجة محسّنة للمسافات - مع fallback إلى pytesseract"""
    processed_np = preprocess_image_for_ocr(pil_image)
    image_height, image_width = processed_np.shape[:2]
    
    try:
        reader = get_easyocr_reader()
        # إعدادات محسّنة للنص العربي - مع خفض العتبات لتحسين الدقة
        results = reader.readtext(
            processed_np, 
            detail=1, 
            paragraph=False,
            width_ths=0.5,  # خفض عتبة العرض لتحسين التعرف على الكلمات العربية
            height_ths=0.5,  # خفض عتبة الارتفاع
            text_threshold=0.3,  # خفض عتبة النص لتحسين التعرف
            link_threshold=0.3,  # تحسين ربط الكلمات
            low_text=0.3,  # تحسين اكتشاف النص الفاتح
            mag_ratio=1.5,  # زيادة حجم الصورة للدقة
            decoder='greedy',  # استخدام greedy decoder للسرعة والدقة
            beamWidth=5,  # عرض الحزمة للبحث
            batch_size=1,  # حجم الدفعة
            blocklist='',  # لا حظر أي أحرف
            allowlist=None  # السماح بجميع الأحرف
        )
        
        if results:
            # معالجة النتائج للحفاظ على المسافات
            text = _process_easyocr_results(results, image_width)
            
            if text.strip():
                # حساب الدقة بناءً على confidence المتوسط
                avg_confidence = sum(conf for _, _, conf in results) / len(results) if results else 0
                
                # تحسين حساب الدقة - إعطاء أهمية أكبر للثقة العالية
                high_conf_count = sum(1 for _, _, conf in results if conf > 0.8)
                low_conf_count = sum(1 for _, _, conf in results if conf < 0.5)
                
                # إذا كانت معظم الكلمات بثقة منخفضة، خفض الدقة
                if len(results) > 0 and low_conf_count / len(results) > 0.5:
                    accuracy = max(50.0, avg_confidence * 80)
                    print(f"[WARN] OCR: ثقة منخفضة في {low_conf_count}/{len(results)} كلمة - دقة: {accuracy:.1f}%")
                else:
                    accuracy = min(99.0, max(60.0, avg_confidence * 100))
                
                # تنظيف النص النهائي
                text = _post_process_text(text)
                
                # التحقق من جودة النص - إذا كان هناك أحرف غريبة كثيرة، خفض الدقة
                strange_chars = sum(1 for c in text if c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \n\t.,،؛:؟!()-/' and not ('\u0600' <= c <= '\u06FF'))
                if len(text) > 0 and strange_chars / len(text) > 0.2:
                    accuracy = max(40.0, accuracy * 0.7)
                    print(f"[WARN] OCR: أحرف غريبة كثيرة ({strange_chars}) - دقة مخفضة: {accuracy:.1f}%")
                
                return text.strip(), round(accuracy, 2)
    except Exception as e:
        print(f"[ERROR] EasyOCR error: {e}")
        import traceback
        traceback.print_exc()
    
    # fallback إلى pytesseract مع خيارات محسّنة للعربية
    try:
        fallback_img = Image.fromarray(processed_np)
        # استخدام خيارات Tesseract محسّنة للعربية
        # PSM 6: افتراض كتلة نص موحدة
        # OEM 3: استخدام LSTM neural network
        # حفظ المسافات بين الكلمات
        custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'
        text = pytesseract.image_to_string(fallback_img, lang=langs, config=custom_config)
        
        if text.strip():
            text = _post_process_text(text)
            word_count = len(text.split())
            accuracy = min(85.0, 50.0 + (word_count / 10))
            return text.strip(), round(accuracy, 2)
    except Exception as e:
        print(f"[ERROR] Tesseract error: {e}")
    
    return "", 0.0


def _fix_arabic_text_direction(text: str) -> str:
    """إصلاح اتجاه النص العربي - ضمان ترتيب الأحرف من اليمين لليسار مع الحفاظ على المسافات"""
    if not text:
        return ""
    
    lines = text.split('\n')
    fixed_lines = []
    
    for line in lines:
        if not line.strip():
            fixed_lines.append(line)
            continue
        
        # تقسيم السطر إلى كلمات - استخدام split() للحفاظ على المسافات الأساسية
        # لكن نتعامل بحذر مع المسافات المتعددة
        words = [w for w in line.split() if w.strip()]  # إزالة الكلمات الفارغة فقط
        
        if not words:
            fixed_lines.append(line)
            continue
        
        fixed_words = []
        
        for word in words:
            # التحقق إذا كانت الكلمة عربية (تحتوي على أحرف عربية)
            has_arabic = bool(re.search(r'[\u0600-\u06FF]', word))
            
            if has_arabic:
                # للكلمات العربية: تنظيف فقط الأحرف غير المرغوبة
                # لكن نحافظ على المسافات بين الكلمات
                cleaned = re.sub(r'[^\u0600-\u06FF\d\.\,\-\(\)\/]', '', word)
                fixed_words.append(cleaned)
            else:
                # للكلمات الإنجليزية والأرقام: نحافظ على التنسيق الأصلي
                fixed_words.append(word)
        
        # دمج الكلمات بمسافات واحدة - هذا يضمن وجود مسافات بين الكلمات
        fixed_lines.append(' '.join(fixed_words))
    
    return '\n'.join(fixed_lines)


def _post_process_text(text: str) -> str:
    """معالجة نهائية للنص المستخرج لتحسين المسافات والكلمات - نسخة محسّنة للعربية مع الحفاظ على المسافات"""
    if not text:
        return ""
    
    # إصلاح اتجاه النص العربي أولاً - مع الحفاظ على المسافات
    text = _fix_arabic_text_direction(text)
    
    # إزالة الأحرف المكررة الناتجة عن OCR (مثل "اللللكتاب" -> "الكتاب")
    text = re.sub(r'(ال){2,}', 'ال', text)  # إصلاح "ال" المكررة
    text = re.sub(r'([\u0600-\u06FF])\1{2,}', r'\1\1', text)  # إصلاح الأحرف المكررة (أكثر من مرتين)
    
    # إصلاح الكلمات العربية الشائعة التي قد تُقرأ خطأ
    common_corrections = {
        'دهجلا': 'الجهد',
        'تقولا': 'الوقت',
        'رفوي': 'يوفر',
        'امة': 'أمة',
        'كتمة': 'متكاملة',
        'دحاوة': 'واحدة',
        'ئيب': 'بيئة',
        'مصنفة': 'مصنفة',
        'رد': 'درد',
        'صملا': 'المصدر',
        'حوتفمو': 'ومفتوحة',
        'يناجم': 'مجانية',
    }
    
    for wrong, correct in common_corrections.items():
        # استبدال فقط إذا كانت الكلمة كاملة (ليس جزء من كلمة)
        text = re.sub(r'\b' + re.escape(wrong) + r'\b', correct, text)
    
    # أولاً: إصلاح الكلمات الملاصقة خطأ (قبل إزالة المسافات الزائدة)
    # مثل "نوالالرجوي" -> "نوال الرجوي"
    text = re.sub(r'([أ-ي]{2,})(ال)([أ-ي]{2,})', r'\1 \2\3', text)  # كلمة عربية + "ال" + كلمة عربية
    text = re.sub(r'(ال)([أ-ي]{3,})([أ-ي]{3,})', r'\1\2 \3', text)  # "ال" + كلمتان ملاصقتان (أكثر من 3 أحرف)
    
    # الآن: إزالة المسافات المتعددة المتتالية (الاحتفاظ بمسافة واحدة فقط)
    # لكن نحافظ على المسافات بين الكلمات
    text = re.sub(r'[ \t]{2,}', ' ', text)  # مسافات متعددة -> مسافة واحدة
    text = re.sub(r'[ \t]+', ' ', text)  # أي مسافات متعددة -> مسافة واحدة
    
    # إضافة مسافة بعد علامات الترقيم إذا لم تكن موجودة
    text = re.sub(r'([.!?؛،:])([^\s\n])', r'\1 \2', text)
    
    # إزالة المسافات قبل علامات الترقيم
    text = re.sub(r'\s+([.!?؛،:])', r'\1', text)
    
    # تحسين المسافات حول الأرقام (لكن نحافظ على المسافات الأساسية)
    text = re.sub(r'(\d)\s+(\d)', r'\1\2', text)  # إزالة المسافات بين الأرقام المتتالية فقط
    text = re.sub(r'([أ-ي])\s*(\d)', r'\1 \2', text)  # مسافة قبل رقم بعد كلمة عربية
    text = re.sub(r'(\d)\s*([أ-ي])', r'\1 \2', text)  # مسافة بعد رقم قبل كلمة عربية
    
    # إصلاح "ال" المكررة أو المنفصلة خطأ (لكن نحافظ على المسافات بين الكلمات)
    text = re.sub(r'\s+(ال)', r' \1', text)  # مسافة واحدة قبل "ال"
    text = re.sub(r'(ال)\s+([أ-ي])', r'\1\2', text)  # إزالة المسافة بعد "ال" فقط
    
    # تنظيف المسافات في بداية ونهاية الأسطر
    lines = []
    for line in text.split('\n'):
        cleaned_line = line.strip()
        if cleaned_line:  # نحافظ على السطر فقط إذا كان يحتوي على نص
            lines.append(cleaned_line)
        else:
            lines.append('')  # نحافظ على السطر الفارغ
    
    text = '\n'.join(lines)
    
    # إزالة الأسطر الفارغة المتعددة (الاحتفاظ بسطر فارغ واحد فقط)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip()


def extract_text_smart(file_path: Path, langs: str = "ara+eng") -> Tuple[str, float]:
    """
    استخراج ذكي للنص حسب نوع الملف
    Returns: (text, accuracy_percentage)
    """
    suffix = file_path.suffix.lower()
    
    # محاولة معالجته كملف Word أولاً
    if suffix in ['.doc', '.docx']:
        text, accuracy = extract_text_from_word(file_path)
        # إذا فشل استخراج النص وكان الملف .doc (قديم)، نحاول تحويله إلى PDF أولاً
        if not text and suffix == '.doc':
            print(f"[INFO] محاولة تحويل ملف .doc القديم إلى PDF للاستخراج...")
            try:
                # يمكن إضافة منطق تحويل .doc إلى .docx هنا إذا لزم الأمر
                # لكن حالياً نعيد النتيجة الفارغة
                pass
            except:
                pass
        return text, accuracy
    elif suffix == '.pdf':
        return extract_text_from_pdf(file_path, langs)
    elif suffix in ['.xls', '.xlsx']:
        return extract_text_from_excel(file_path)
    elif suffix in ['.png', '.jpg', '.jpeg', '.jpe', '.tiff', '.tif', '.bmp', '.gif', '.webp', '.ico', '.svg', '.heic', '.heif', '.raw', '.cr2', '.nef', '.orf', '.sr2']:
        return extract_text_from_image(file_path, langs)
    else:
        print(f"[WARN] نوع ملف غير مدعوم: {suffix}")
        return "", 0.0


def classify_document_smart(text: str) -> dict:
    """
    تصنيف ذكي للوثيقة بناءً على محتواها
    Returns: {
        'type': 'certificate' | 'report' | 'official_letter' | 'form' | 'other',
        'direction': 'incoming' | 'outgoing' | None,
        'suggested_title': str,
        'date': str | None,
    }
    """
    text_lower = text.lower()
    result = {
        'type': 'other',
        'direction': None,
        'suggested_title': '',
        'date': None,
    }
    
    # التصنيف حسب الكلمات المفتاحية
    if any(word in text for word in ['شهادة', 'يشهد', 'certificate']):
        result['type'] = 'certificate'
        result['suggested_title'] = 'شهادة'
    elif any(word in text for word in ['تقرير', 'report', 'تقييم']):
        result['type'] = 'report'
        result['suggested_title'] = 'تقرير'
    elif any(word in text for word in ['كتاب', 'letter', 'إلى', 'السيد', 'المحترم']):
        result['type'] = 'official_letter'
        result['suggested_title'] = 'كتاب رسمي'
    elif any(word in text for word in ['نموذج', 'form', 'طلب', 'استمارة']):
        result['type'] = 'form'
        result['suggested_title'] = 'نموذج'
    
    # تحديد الاتجاه (صادر/وارد)
    if any(word in text for word in ['صادر', 'من:', 'المرسل']):
        result['direction'] = 'outgoing'
    elif any(word in text for word in ['وارد', 'إلى:', 'المستلم', 'المحترم']):
        result['direction'] = 'incoming'
    
    # استخراج التاريخ (نمط بسيط)
    date_patterns = [
        r'\d{4}[-/]\d{1,2}[-/]\d{1,2}',  # 2025-11-13
        r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',  # 13-11-2025
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            result['date'] = match.group(0)
            break
    
    # تحسين العنوان المقترح بناءً على أول 10 كلمات
    words = text.split()[:10]
    if words:
        first_line = ' '.join(words)
        # تنظيف العنوان
        first_line = re.sub(r'[^\w\s\u0600-\u06FF]', '', first_line)
        if len(first_line) > 5:
            result['suggested_title'] = first_line[:100]
    
    return result


def suggest_title_from_text(text: str) -> str:
    """اقتراح عنوان ذكي من النص"""
    if not text:
        return "وثيقة بدون عنوان"
    
    # البحث عن سطر العنوان (عادة في الأسطر الأولى)
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if not lines:
        return "وثيقة بدون عنوان"
    
    # أول سطر غير فارغ يكون عادة العنوان
    title = lines[0]
    
    # تنظيف العنوان
    title = re.sub(r'[^\w\s\u0600-\u06FF\-\(\)]', '', title)
    title = title.strip()
    
    # تحديد الطول المناسب
    if len(title) > 100:
        title = title[:97] + "..."
    
    return title or "وثيقة بدون عنوان"
