import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
import hashlib

from ..core.config import settings


def ensure_storage_structure(root: str) -> None:
    """
    إنشاء هيكل المجلدات الأساسي:
    D:\مركز الاستشارات والتنمية\
        ├── from_file\         (سيحتوي على الملفات الأصلية القادمة من الجهاز)
        ├── from_scanner\      (سيحتوي على الملفات الأصلية القادمة من السكانر)
        └── backups\           (نسخ احتياطية)
    
    * مجلدات التصنيف (شهادات، تقارير، ...) تُنشأ عند أول رفع حسب الحاجة.
    * فقط الملف الأصلي يحفظ داخل from_file/from_scanner بشكل منظم.
    * لا يتم حفظ ملفات system (PDF، OCR text، thumbnails) أو temp أو logs.
    """
    base_paths = [
        Path(root, "from_file"),
        Path(root, "from_scanner"),
        Path(root, "backups"),
    ]
    
    for path in base_paths:
        path.mkdir(parents=True, exist_ok=True)
    
    print(f"[OK] تم إنشاء هيكل التخزين الأساسي في: {root}")
    print("  [INFO]  الملفات الأصلية فقط تحفظ داخل from_file/from_scanner حسب المصدر.")


def generate_document_number() -> str:
    """
    توليد رقم وثيقة فريد بصيغة: YYYYMMDD-HHMMSS
    مثال: 20251113-143025
    """
    now = datetime.now()
    return now.strftime("%Y%m%d-%H%M%S")


def _sanitize_component(value: str, fallback: str) -> str:
    """
    تنظيف النص ليصبح صالحاً كجزء من المسار أو اسم ملف.
    يحافظ على الأحرف العربية والأرقام ويستبدل الأحرف الخاصة فقط.
    """
    value = (value or "").strip()
    if not value:
        return fallback
    import re
    # إزالة الأحرف غير المسموحة فقط (يحافظ على العربية والإنجليزية والأرقام)
    # الأحرف المسموحة: أحرف عربية/إنجليزية، أرقام، مسافات، شرطات، نقاط
    sanitized = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value)
    # استبدال المسافات المتعددة بمسافة واحدة (لا نحولها إلى شرطة سفلية)
    sanitized = re.sub(r"\s+", " ", sanitized)
    sanitized = sanitized.strip("._ ")
    # إزالة النقاط في النهاية (مشاكل في Windows)
    sanitized = sanitized.rstrip('.')
    return sanitized or fallback


def build_document_paths(
    document_number: str,
    file_extension: str,
    classification: Optional[str] = None,
    source_type: str = "file",
    file_title: Optional[str] = None,
) -> Dict[str, Path]:
    """
    بناء مسارات منظمة للملف الأصلي وبقية الملفات.
    
    :param document_number: رقم الوثيقة الفريد
    :param file_extension: الامتداد الأصلي للملف
    :param classification: التصنيف (شهادة، تقرير، ...)
    :param source_type: 'file' أو 'scanner'
    :param file_title: الاسم النهائي للملف (يتم تنظيفه ليصبح اسم الملف)
    """
    now = datetime.now()
    year = now.strftime("%Y")
    month = now.strftime("%m")
    day = now.strftime("%d")
    root = Path(settings.file_storage_root)
    
    safe_classification = _sanitize_component(classification or "أخرى", "أخرى")
    source_folder = "from_scanner" if source_type == "scanner" else "from_file"
    
    # تنظيف اسم الملف مع الحفاظ على الأحرف العربية
    if file_title:
        # تنظيف اسم الملف: إزالة الأحرف الخاصة فقط، الحفاظ على العربية
        file_base = _sanitize_component(file_title, document_number)
        # تقليل طول الاسم إذا كان طويلاً جداً (Windows limit: 255 chars)
        if len(file_base) > 200:
            file_base = file_base[:200]
    else:
        file_base = document_number
    
    # بناء المسار النهائي (فقط الملف الأصلي)
    original_dir = root / source_folder / safe_classification / year / month / day / document_number
    original_dir.mkdir(parents=True, exist_ok=True)
    
    # بناء اسم الملف النهائي مع الامتداد
    final_original_file = original_dir / f"{file_base}{file_extension}"
    paths = {
        'original_dir': original_dir,
        'original_file': final_original_file,
        'pdf_file': None,  # لا يتم حفظ PDF
        'ocr_text_file': None,  # لا يتم حفظ OCR text في ملف
        'thumbnail_file': None,  # لا يتم حفظ thumbnails
        'images_dir': None,  # لا يتم حفظ images
        'source_folder': source_folder,
        'classification': safe_classification,
        'final_filename': final_original_file.name,
    }
    
    return paths


def save_uploaded_file(uploaded_file, destination: Path) -> str:
    """
    حفظ الملف المرفوع وحساب checksum
    Returns: MD5 checksum
    """
    md5_hash = hashlib.md5()
    
    with open(destination, 'wb') as f:
        # قراءة وحفظ الملف على دفعات
        for chunk in iter(lambda: uploaded_file.read(8192), b''):
            if not chunk:
                break
            md5_hash.update(chunk)
            f.write(chunk)
    
    return md5_hash.hexdigest()


def save_text_file(text: str, destination: Path) -> None:
    """حفظ النص المستخرج في ملف"""
    with open(destination, 'w', encoding='utf-8') as f:
        f.write(text)


def create_manifest(doc_number: str, paths: Dict[str, Path], metadata: dict) -> None:
    """
    إنشاء ملف manifest.json في مجلد الوثيقة
    يحتوي على جميع المعلومات والمسارات
    """
    import json
    
    manifest = {
        'document_number': doc_number,
        'created_at': datetime.now().isoformat(),
        'paths': {k: str(v) for k, v in paths.items()},
        'metadata': metadata,
    }
    
    manifest_path = paths['original_dir'] / 'manifest.json'
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def get_file_info(file_path: Path) -> dict:
    """الحصول على معلومات الملف"""
    stats = file_path.stat()
    return {
        'size': stats.st_size,
        'created': datetime.fromtimestamp(stats.st_ctime).isoformat(),
        'modified': datetime.fromtimestamp(stats.st_mtime).isoformat(),
    }
