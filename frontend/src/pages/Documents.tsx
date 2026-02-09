import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

type Doc = {
  id: number
  document_number: string
  title: string
  classification?: string
  direction?: string
  status: string
  ocr_accuracy?: number
  uploader_id?: number
  created_at?: string
  updated_at?: string
  source_type?: string
  original_file_path?: string
  content_text?: string
  suggested_title?: string
}

function Documents() {
  const { theme } = useTheme()
  const [docs, setDocs] = useState<Doc[]>([])
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // فلاتر
  const [filterType, setFilterType] = useState('')
  const [filterDirection, setFilterDirection] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // التعديل
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editClassification, setEditClassification] = useState('')
  const [editDirection, setEditDirection] = useState('')
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<any>(null)
  const [extractingStudents, setExtractingStudents] = useState(false)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
    }
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const extractStudents = async () => {
    if (!selectedDoc?.id) return

    setExtractingStudents(true)
    try {
      const res = await api.post(`/documents/${selectedDoc.id}/extract-students`)
      showToast(`تم استخراج ${res.data.extracted_count} طالب وربط ${res.data.linked_count} درجة بنجاح`)
      // إعادة تحميل بيانات الوثيقة
      viewDocument(selectedDoc.id)
    } catch (e: any) {
      console.error('Extract students error:', e)
      const errorMsg = e?.response?.data?.detail || e?.message || 'فشل استخراج بيانات الطلاب'
      showToast(`خطأ: ${errorMsg}`, 'error')
    } finally {
      setExtractingStudents(false)
    }
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current)
      }
    }
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.get('/documents/', {
        params: {
          classification: filterType || undefined,
          direction: filterDirection || undefined,
          date_from: filterDateFrom || undefined,
          date_to: filterDateTo || undefined,
        },
      })
      setDocs(res.data)
      setMsg('')
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'فشل جلب الوثائق')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const viewDocument = async (id: number) => {
    try {
      const res = await api.get(`/documents/${id}`)
      setSelectedDoc(res.data)
      setIsEditing(false)
      setEditTitle(res.data.title || '')
      setEditClassification(res.data.classification || '')
      setEditDirection(res.data.direction || '')
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'فشل جلب تفاصيل الوثيقة')
    }
  }

  const saveEdit = async () => {
    if (!selectedDoc) return
    try {
      await api.put(`/documents/${selectedDoc.id}`, {
        title: editTitle,
        classification: editClassification,
        direction: editDirection,
      })
      showToast('تم تحديث البيانات الوصفية بنجاح')
      setIsEditing(false)
      viewDocument(selectedDoc.id) // إعادة تحميل
      load() // تحديث القائمة
    } catch (e: any) {
      showToast('فشل التحديث: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  const deleteDocument = async () => {
    if (!selectedDoc) return
    if (!window.confirm('هل أنت متأكد من حذف هذه الوثيقة؟ لا يمكن التراجع عن هذا الإجراء.')) return

    try {
      await api.delete(`/documents/${selectedDoc.id}`)
      showToast('تم حذف الوثيقة بنجاح')
      setSelectedDoc(null)
      load() // تحديث القائمة
    } catch (e: any) {
      console.error("Delete error:", e)
      showToast('فشل الحذف: ' + (e?.response?.data?.detail || 'قد لا تملك صلاحية الحذف'), 'error')
    }
  }

  const handlePrintPreview = () => {
    if (!selectedDoc) {
      alert('الرجاء اختيار وثيقة أولاً')
      return
    }
    setShowPrintPreview(true)
  }

  const getDisplayPath = (path: string | null | undefined): string => {
    if (!path) return ''
    // تحويل المسار من Docker (/storage/...) إلى المسار المحلي (D:\...)
    if (path.startsWith('/storage/')) {
      const relativePath = path.replace('/storage/', '')
      return `D:\\مركز الاستشارات والتنمية\\${relativePath.replace(/\//g, '\\')}`
    }
    return path
  }

  const copyOriginalPath = async () => {
    if (!selectedDoc?.original_file_path) return
    try {
      const displayPath = getDisplayPath(selectedDoc.original_file_path)
      await navigator.clipboard.writeText(displayPath)
      showToast('تم نسخ المسار بنجاح')
    } catch (err) {
      showToast('تعذر النسخ، حاول مرة أخرى.', 'error')
    }
  }

  const printDocument = () => {
    if (!selectedDoc) return
    const formattedContent = formatOCRTextAsHtml(selectedDoc.content_text)
    const printWindow = window.open('', '_blank', 'width=900,height=1100')
    if (!printWindow) {
      alert('فشل فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.')
      return
    }

    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة - ${selectedDoc.document_number}</title>
        <style>
          body {
            font-family: 'Tajawal', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            margin: 0;
            padding: 40px 0;
            background: #f5f7fb;
            color: #1f2933;
            line-height: 1.9;
          }
          .print-wrapper {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: #fff;
            border-radius: 24px;
            border: 1px solid rgba(0,0,0,0.05);
            box-shadow: 0 25px 60px rgba(15,23,42,0.15);
            padding: 40px 48px 55px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid rgba(0,188,212,0.35);
            padding-bottom: 24px;
          }
          .title {
            font-size: 28px;
            font-weight: 700;
            color: #00838f;
            margin-bottom: 12px;
          }
          .doc-number {
            font-size: 14px;
            color: #607d8b;
            letter-spacing: 1px;
          }
          .metadata {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin: 35px 0;
            font-size: 14px;
          }
          .metadata-label {
            font-weight: 600;
            color: #6c7a89;
            font-size: 12px;
            text-transform: uppercase;
          }
          .metadata-value {
            color: #004d61;
            font-size: 16px;
            font-weight: 600;
          }
          .content {
            margin-top: 10px;
            padding: 32px;
            background: linear-gradient(135deg, rgba(0,188,212,0.08), rgba(255,255,255,0.95));
            border: 1px solid rgba(0,188,212,0.2);
            border-radius: 22px;
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.5);
          }
          .content-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #006064;
            position: relative;
          }
          .content-title::after {
            content: '';
            display: block;
            width: 80px;
            height: 3px;
            background: linear-gradient(90deg, #00bcd4, transparent);
            margin-top: 8px;
          }
          .content-text {
            line-height: 2.2;
            color: #1e293b;
            font-size: 16px;
            white-space: normal;
          }
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .print-wrapper {
              margin: 0;
              width: auto;
              min-height: auto;
              border-radius: 0;
              border: none;
              box-shadow: none;
              padding: 30px 28px;
            }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
            <div class="header">
              <div class="title">${selectedDoc.title || 'وثيقة بدون عنوان'}</div>
              <div class="doc-number">رقم الوثيقة: ${selectedDoc.document_number}</div>
          </div>
          <div class="metadata">
            <div>
                <div class="metadata-label">التصنيف</div>
                <div class="metadata-value">${selectedDoc.classification || 'غير محدد'}</div>
            </div>
            <div>
                <div class="metadata-label">الاتجاه</div>
                <div class="metadata-value">${selectedDoc.direction || 'غير محدد'}</div>
            </div>
            <div>
                <div class="metadata-label">دقة OCR</div>
                <div class="metadata-value">${selectedDoc.ocr_accuracy || 0}%</div>
            </div>
            <div>
                <div class="metadata-label">المصدر</div>
                <div class="metadata-value">${selectedDoc.source_type === 'file' ? 'ملف' : 'سكانر'}</div>
            </div>
            <div>
                <div class="metadata-label">تاريخ الرفع</div>
                <div class="metadata-value">${formatDate(selectedDoc.created_at)}</div>
            </div>
          </div>
          <div class="content">
            <div class="content-title">المحتوى</div>
              <div class="content-text">${formattedContent || 'لا يوجد نص مستخرج'}</div>
          </div>
        </div>
        <div class="no-print" style="text-align:center;margin-top:30px;">
          <button onclick="window.print()" style="padding:12px 32px;font-size:17px;background:#00BCD4;color:#fff;border:none;border-radius:999px;cursor:pointer;box-shadow:0 15px 30px rgba(0,188,212,0.35);">طباعة الآن</button>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const clearFilters = () => {
    setFilterType('')
    setFilterDirection('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; color: string }> = {
      completed: { text: 'مكتمل', color: 'bg-green-500/20 text-green-400' },
      processing: { text: 'قيد المعالجة', color: 'bg-yellow-500/20 text-yellow-400' },
      pending: { text: 'قيد الانتظار', color: 'bg-gray-500/20 text-gray-400' },
      failed: { text: 'فشل', color: 'bg-red-500/20 text-red-400' },
    }
    const badge = statusMap[status] || statusMap.pending
    return (
      <span className={`inline-block px-2 py-1 rounded-lg text-xs ${badge.color}`}>
        {badge.text}
      </span>
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  type FormatOptions = { stripDiacritics?: boolean }

  const stripArabicDiacritics = (input: string) =>
    input.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')

  const formatOCRText = (
    text: string | null | undefined,
    options: FormatOptions = { stripDiacritics: true }
  ): string => {
    if (!text) return 'لا يوجد نص مستخرج'

    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')

    let lines = cleaned.split('\n').map(line => line.trim()).filter((line: string) => line.length > 0)

    const merged: string[] = []
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        merged.push(lines[i])
      } else if (lines[i].length < 20 && merged.length > 0) {
        merged[merged.length - 1] += ' ' + lines[i]
      } else {
        merged.push(lines[i])
      }
    }

    cleaned = merged.join('\n')

    cleaned = cleaned
      .replace(/([.!?؛،:])([^\s])/g, '$1 $2')
      .replace(/([.!?])\s+([A-Zأ-ي])/g, '$1\n\n$2')

    cleaned = cleaned.trim().replace(/\n{3,}/g, '\n\n')

    // إضافة مسافات بين الأرقام والحروف إذا كانت ملاصقة
    cleaned = cleaned
      .replace(/(\d)(?=[^\s\d])/g, '$1 ')
      .replace(/([^\s\d])(?=\d)/g, '$1 ')

    // معالجة حالات مثل "نوالالرجوي" (تكرار "ال" المتتالية)
    cleaned = cleaned.replace(/ال(?=ال[\u0600-\u06FF])/g, 'ال ')

    if (options.stripDiacritics !== false) {
      cleaned = stripArabicDiacritics(cleaned)
    }

    return cleaned || 'لا يوجد نص مستخرج'
  }

  const formatOCRTextAsHtml = (text: string | null | undefined): string => {
    const formatted = formatOCRText(text)
    const paragraphs = formatted
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('')
    return paragraphs || '<p>لا يوجد نص مستخرج</p>'
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>عرض الوثائق</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>
          عرض وإدارة جميع الوثائق المرفوعة
        </p>
      </div>

      {/* الفلاتر */}
      <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
        <h2 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>فلترة الوثائق</h2>
        <div className="space-y-3">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>نوع الوثيقة</label>
              <select
                className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">الكل</option>
                <option value="شهادة">شهادة</option>
                <option value="تقرير">تقرير</option>
                <option value="كتاب رسمي">كتاب رسمي</option>
                <option value="نموذج">نموذج</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>الاتجاه</label>
              <select
                className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
              >
                <option value="">الكل</option>
                <option value="صادر">صادر</option>
                <option value="وارد">وارد</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>من تاريخ</label>
              <input
                type="date"
                className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>إلى تاريخ</label>
              <input
                type="date"
                className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                className="btn-primary flex-1"
                onClick={load}
                disabled={loading}
              >
                {loading ? 'جارٍ البحث...' : 'بحث'}
              </button>
              <button
                className={`px-4 py-2 rounded-xl border transition-colors ${theme === 'dark' ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300'}`}
                onClick={clearFilters}
                title="مسح الفلاتر"
              >
                مسح
              </button>
            </div>
          </div>
          {msg && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* جدول الوثائق */}
      <div className="card">
        <h2 className="text-lg font-semibold text-cyan-400 mb-4">
          الوثائق ({docs.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${theme === 'dark' ? 'text-text-secondary border-[rgba(0,188,212,0.12)]' : 'text-slate-600 border-slate-200'}`}>
                <th className="text-right py-3 px-2">رقم الوثيقة</th>
                <th className="text-right py-3 px-2">العنوان</th>
                <th className="text-right py-3 px-2">التصنيف</th>
                <th className="text-right py-3 px-2">الاتجاه</th>
                <th className="text-right py-3 px-2">دقة OCR</th>
                <th className="text-right py-3 px-2">الحالة</th>
                <th className="text-right py-3 px-2">التاريخ</th>
                <th className="text-left py-3 px-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-text-secondary">
                    لا توجد وثائق
                  </td>
                </tr>
              ) : (
                docs.map((d) => (
                  <tr
                    key={d.id}
                    className={`border-b transition ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:bg-base-900/50' : 'border-slate-100 hover:bg-slate-50'}`}
                  >
                    <td className="py-3 px-2">
                      <span className="font-mono text-cyan-400">{d.document_number}</span>
                    </td>
                    <td className="py-3 px-2 max-w-xs truncate">{d.title || '—'}</td>
                    <td className="py-3 px-2">
                      {d.classification ? (
                        <span className="inline-block px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs">
                          {d.classification}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {d.direction ? (
                        <span className={`inline-block px-2 py-1 rounded-lg text-xs ${d.direction === 'صادر'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-green-500/10 text-green-400'
                          }`}>
                          {d.direction}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-2">
                      {d.ocr_accuracy ? (
                        <span className={`text-xs ${d.ocr_accuracy >= 90
                          ? 'text-green-400'
                          : d.ocr_accuracy >= 70
                            ? 'text-yellow-400'
                            : 'text-red-400'
                          }`}>
                          {d.ocr_accuracy}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-2">{getStatusBadge(d.status)}</td>
                    <td className="py-3 px-2 text-text-secondary text-xs">
                      {formatDate(d.created_at)}
                    </td>
                    <td className="py-3 px-2 text-left">
                      <button
                        className="px-3 py-1.5 rounded-lg border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition text-xs"
                        onClick={() => viewDocument(d.id)}
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* عرض تفاصيل الوثيقة */}
      {selectedDoc && (
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>
              تفاصيل الوثيقة: {selectedDoc.document_number}
            </h2>
            <button
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors text-sm"
              onClick={() => setSelectedDoc(null)}
            >
              إغلاق
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* البيانات الوصفية */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-cyan-400 mb-3">
                  البيانات الوصفية
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">رقم الوثيقة:</span>
                    <span className="text-cyan-400 font-mono">{selectedDoc.document_number}</span>
                  </div>
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">العنوان:</span>
                    <span className="text-cyan-400">{selectedDoc.title || '—'}</span>
                  </div>
                  {selectedDoc.suggested_title && selectedDoc.suggested_title !== selectedDoc.title && (
                    <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                      <span className="text-text-secondary">العنوان المقترح:</span>
                      <span className="text-text-secondary">{selectedDoc.suggested_title}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">التصنيف:</span>
                    <span className="inline-block px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs">
                      {selectedDoc.classification || 'غير محدد'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">الاتجاه:</span>
                    {selectedDoc.direction ? (
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs ${selectedDoc.direction === 'صادر'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-green-500/10 text-green-400'
                        }`}>
                        {selectedDoc.direction}
                      </span>
                    ) : (
                      <span className="text-text-secondary">—</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">دقة OCR:</span>
                    <div>
                      <span className={`font-semibold ${selectedDoc.ocr_accuracy >= 90
                        ? 'text-green-400'
                        : selectedDoc.ocr_accuracy >= 70
                          ? 'text-yellow-400'
                          : 'text-red-400'
                        }`}>
                        {selectedDoc.ocr_accuracy || 0}%
                      </span>
                      <div className="w-full bg-base-900 h-1 rounded mt-1">
                        <div
                          className={`h-1 rounded ${selectedDoc.ocr_accuracy >= 90
                            ? 'bg-green-400'
                            : selectedDoc.ocr_accuracy >= 70
                              ? 'bg-yellow-400'
                              : 'bg-red-400'
                            }`}
                          style={{ width: `${selectedDoc.ocr_accuracy || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">المصدر:</span>
                    <span className="text-cyan-400">
                      {selectedDoc.source_type === 'file' ? 'ملف' : 'سكانر'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 py-2 border-b border-[rgba(0,188,212,0.06)]">
                    <span className="text-text-secondary">تاريخ الرفع:</span>
                    <span className="text-cyan-400">{formatDate(selectedDoc.created_at)}</span>
                  </div>
                  <div className="grid grid-cols-2 py-2">
                    <span className="text-text-secondary">آخر تحديث:</span>
                    <span className="text-text-secondary">{formatDate(selectedDoc.updated_at)}</span>
                  </div>
                </div>
                {selectedDoc.original_file_path && (
                  <div className="mt-4 p-3 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.15)]">
                    <div className="text-xs text-text-secondary mb-2">مسار الملف الأصلي</div>
                    <div className="text-xs font-mono text-cyan-400 break-all bg-base-900/70 px-3 py-2 rounded-lg border border-[rgba(0,188,212,0.12)]" dir="ltr" style={{ textAlign: 'left' }}>
                      {getDisplayPath(selectedDoc.original_file_path)}
                    </div>
                    <button
                      className="mt-3 text-sm px-3 py-2 rounded-xl border border-[rgba(0,188,212,0.15)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                      onClick={copyOriginalPath}
                    >
                      نسخ المسار
                    </button>
                  </div>
                )}
              </div>

              {/* أزرار الإجراءات */}
              <div className="pt-4 border-t border-[rgba(0,188,212,0.12)] space-y-2">
                {!isEditing ? (
                  <>
                    <button
                      className="w-full px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                      onClick={handlePrintPreview}
                    >
                      طباعة الوثيقة
                    </button>
                    {selectedDoc?.classification === 'كشف درجات' && (
                      <button
                        className="w-full px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition"
                        onClick={extractStudents}
                        disabled={extractingStudents}
                      >
                        {extractingStudents ? 'جارٍ الاستخراج...' : 'استخراج بيانات الطلاب'}
                      </button>
                    )}
                    <button
                      className="w-full px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                      onClick={() => setIsEditing(true)}
                    >
                      تعديل البيانات الوصفية
                    </button>
                    <button
                      className="w-full px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition mt-2"
                      onClick={deleteDocument}
                    >
                      حذف الوثيقة
                    </button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>العنوان</label>
                      <input
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>التصنيف</label>
                      <select
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                        value={editClassification}
                        onChange={(e) => setEditClassification(e.target.value)}
                      >
                        <option value="">غير محدد</option>
                        <option value="شهادة">شهادة</option>
                        <option value="تقرير">تقرير</option>
                        <option value="كتاب رسمي">كتاب رسمي</option>
                        <option value="نموذج">نموذج</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>الاتجاه</label>
                      <select
                        className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                        value={editDirection}
                        onChange={(e) => setEditDirection(e.target.value)}
                      >
                        <option value="">غير محدد</option>
                        <option value="صادر">صادر</option>
                        <option value="وارد">وارد</option>
                      </select>
                    </div>
                    <div className="pt-2 border-t border-[rgba(0,188,212,0.12)] space-y-2">
                      <button
                        className="btn-primary w-full"
                        onClick={saveEdit}
                      >
                        حفظ التعديلات
                      </button>
                      <button
                        className="w-full px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
                        onClick={() => setIsEditing(false)}
                      >
                        إلغاء
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                      <p className="text-xs text-yellow-400">
                        ملاحظة: لا يمكن تعديل محتوى الوثيقة الأصلية (محمي)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* النص المستخرج */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary mb-3">
                النص المستخرج (OCR)
              </h3>
              <div className="p-4 rounded-xl bg-base-900 max-h-96 overflow-y-auto border border-[rgba(0,188,212,0.12)]">
                <div
                  className="text-sm text-text-secondary whitespace-pre-wrap font-sans leading-relaxed"
                  style={{
                    fontFamily: "'Segoe UI', 'Tajawal', 'Arial', sans-serif",
                    direction: 'rtl',
                    textAlign: 'right',
                    lineHeight: '1.8',
                    wordBreak: 'break-word',
                    wordWrap: 'break-word',
                  }}
                >
                  {formatOCRText(selectedDoc.content_text)}
                </div>
              </div>
              {selectedDoc.content_text && (
                <div className={`mt-2 text-xs text-center ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                  إجمالي الأحرف: {selectedDoc.content_text.length.toLocaleString('ar')} •
                  إجمالي الكلمات: {selectedDoc.content_text.split(/\s+/).filter((w: string) => w.length > 0).length.toLocaleString('ar')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPrintPreview && selectedDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-base-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-cyan-500/20">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,188,212,0.15)]">
              <div>
                <p className="text-xs text-text-secondary">معاينة قبل الطباعة</p>
                <h3 className="text-xl font-semibold text-cyan-400">
                  {selectedDoc.title || 'وثيقة بدون عنوان'}
                </h3>
              </div>
              <button
                className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
                onClick={() => setShowPrintPreview(false)}
              >
                إغلاق
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-4 text-sm leading-relaxed text-text-secondary">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-text-secondary text-xs mb-1">رقم الوثيقة</p>
                  <p className="font-mono text-cyan-400 text-base">{selectedDoc.document_number}</p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs mb-1">التصنيف</p>
                  <p className="inline-block px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs">
                    {selectedDoc.classification || 'غير محدد'}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs mb-1">الاتجاه</p>
                  <p className="inline-block px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 text-xs">
                    {selectedDoc.direction || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs mb-1">تاريخ الرفع</p>
                  <p className="text-cyan-300">{formatDate(selectedDoc.created_at)}</p>
                </div>
              </div>
              <div className="border border-[rgba(0,188,212,0.15)] rounded-2xl p-4 bg-base-900/60">
                <p className="text-text-secondary text-xs mb-2">النص المستخرج</p>
                <div className="whitespace-pre-wrap leading-8 text-base">
                  {formatOCRText(selectedDoc.content_text)}
                </div>
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3 px-6 py-4 border-t border-[rgba(0,188,212,0.15)] bg-base-900/60">
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setShowPrintPreview(false)
                  setTimeout(printDocument, 100)
                }}
              >
                إرسال للطابعة
              </button>
              <button
                className="flex-1 px-4 py-2 rounded-2xl border border-[rgba(0,188,212,0.15)] hover:border-cyan-400 text-text-secondary hover:text-cyan-300 transition"
                onClick={() => setShowPrintPreview(false)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl">
          <div
            className={`rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur bg-gradient-to-r ${toast.type === 'success'
              ? 'from-emerald-500/15 to-emerald-400/10 border-emerald-400/30'
              : 'from-rose-500/15 to-rose-400/10 border-rose-400/30'
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${toast.type === 'success' ? 'bg-emerald-300' : 'bg-rose-300'
                  } animate-pulse`}
              ></div>
              <div>
                <p
                  className={`text-sm font-semibold ${toast.type === 'success' ? 'text-emerald-200' : 'text-rose-200'
                    }`}
                >
                  {toast.type === 'success' ? 'تم التنفيذ بنجاح' : 'حدث خطأ'}
                </p>
                <p className="text-sm text-text-primary/80 mt-0.5">{toast.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Documents
