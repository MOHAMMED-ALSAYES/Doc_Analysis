import React, { useState, useRef, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

type SearchResult = {
  id: number
  document_number: string
  title: string
  classification?: string
  direction?: string
  snippet?: string
  score?: number
  created_at?: string
  uploader?: {
    id: number
    username: string
    full_name?: string
  }
}

type StudentResult = {
  id: number
  student_number: string
  full_name: string
  full_name_ar?: string
  average_score?: number
}

function Search() {
  const { theme } = useTheme()
  const [activeTab, setActiveTab] = useState<'documents' | 'students'>('documents')
  const [query, setQuery] = useState('')
  const [searchField, setSearchField] = useState<'all' | 'title' | 'content'>('all')
  const [filterType, setFilterType] = useState('')
  const [filterDirection, setFilterDirection] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [studentResults, setStudentResults] = useState<StudentResult[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [studentAnalysis, setStudentAnalysis] = useState<any>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchTime, setSearchTime] = useState(0)
  const [msg, setMsg] = useState('')
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current)
    }
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current)
      }
      if (searchRef.current) {
        clearTimeout(searchRef.current)
      }
    }
  }, [])

  const search = useCallback(async () => {
    if (activeTab === 'students') {
      return searchStudents()
    }

    if (!query.trim() && !filterType && !filterDirection) {
      setMsg('الرجاء إدخال كلمة بحث أو اختيار فلتر')
      setResults([])
      return
    }

    setLoading(true)
    setMsg('')
    const startTime = performance.now()

    try {
      const res = await api.post('/search/', {
        query: query.trim() || undefined,
        search_field: searchField,
        classification: filterType || undefined,
        direction: filterDirection || undefined,
      })

      setResults(res.data.results || [])
      const endTime = performance.now()
      setSearchTime((endTime - startTime) / 1000)
    } catch (e: any) {
      console.error('Search error:', e)
      const errorMsg = e?.response?.data?.detail || e?.message || 'فشل البحث'
      setMsg(`خطأ: ${errorMsg}`)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [query, filterType, filterDirection, searchField, activeTab])

  const searchStudents = useCallback(async () => {
    if (!query.trim()) {
      setMsg('الرجاء إدخال رقم الطالب أو الاسم')
      setStudentResults([])
      return
    }

    setLoading(true)
    setMsg('')
    const startTime = performance.now()

    try {
      const res = await api.get(`/api/students/search/${encodeURIComponent(query.trim())}`)
      setStudentResults(res.data.students || [])
      const endTime = performance.now()
      setSearchTime((endTime - startTime) / 1000)
    } catch (e: any) {
      console.error('Student search error:', e)
      const errorMsg = e?.response?.data?.detail || e?.message || 'فشل البحث'
      setMsg(`خطأ: ${errorMsg}`)
      setStudentResults([])
    } finally {
      setLoading(false)
    }
  }, [query])

  const viewStudent = async (studentId: number) => {
    setLoadingAnalysis(true)
    try {
      // تحميل بيانات الطالب والتحليل في نفس الوقت
      const [studentRes, analysisRes] = await Promise.all([
        api.get(`/api/students/${studentId}`),
        api.get(`/api/students/${studentId}/analysis`).catch(() => null) // إذا فشل التحليل، لا نفشل كل شيء
      ])
      setSelectedStudent(studentRes.data)
      setStudentAnalysis(analysisRes?.data || null)
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'فشل جلب بيانات الطالب')
      setSelectedStudent(null)
      setStudentAnalysis(null)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  // البحث التلقائي عند الكتابة (debounced)
  useEffect(() => {
    // تنظيف timer السابق
    if (searchRef.current) {
      clearTimeout(searchRef.current)
    }

    if (activeTab === 'students') {
      // للطلاب: ابحث فقط عند وجود نص
      if (query.trim()) {
        searchRef.current = setTimeout(() => {
          searchStudents()
        }, 500)
      } else {
        setStudentResults([])
        setMsg('')
        setSearchTime(0)
      }
    } else {
      // للوثائق: ابحث عند وجود نص أو فلتر
      if (query.trim() || filterType || filterDirection) {
        searchRef.current = setTimeout(() => {
          search()
        }, 500)
      } else {
        setResults([])
        setMsg('')
        setSearchTime(0)
      }
    }

    return () => {
      if (searchRef.current) {
        clearTimeout(searchRef.current)
      }
    }
  }, [query, filterType, filterDirection, searchField, activeTab, search, searchStudents])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // إلغاء debounce والبحث فوراً عند الضغط على Enter
      if (searchRef.current) {
        clearTimeout(searchRef.current)
      }
      search()
    }
  }

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text
    const regex = new RegExp(`(${query})`, 'gi')
    return text.replace(regex, '<mark class="bg-cyan-500/30 text-cyan-400">$1</mark>')
  }

  const viewDocument = async (id: number) => {
    try {
      const res = await api.get(`/documents/${id}`)
      setSelectedDoc(res.data)
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'فشل جلب تفاصيل الوثيقة')
    }
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

    let lines = cleaned.split('\n').map(line => line.trim()).filter(line => line.length > 0)

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

  const handlePrintPreview = () => {
    if (!selectedDoc) {
      alert('الرجاء اختيار وثيقة أولاً')
      return
    }
    setShowPrintPreview(true)
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
            ${selectedDoc.uploader ? `
            <div>
                <div class="metadata-label">رفع بواسطة</div>
                <div class="metadata-value">${selectedDoc.uploader.full_name || selectedDoc.uploader.username}</div>
            </div>
            ` : ''}
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
      showToast('تم نسخ المسار إلى الحافظة')
    } catch (err) {
      showToast('تعذر النسخ، انسخ المسار يدوياً.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>البحث المتقدم</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>
          ابحث في محتوى الوثائق، العناوين، أو ابحث عن الطلاب ودرجاتهم
        </p>
      </div>

      {/* التبويبات */}
      <div className={`rounded-xl p-4 ${theme === 'dark' ? 'card' : 'bg-white border border-slate-200 shadow-sm'}`}>
        <div className={`flex gap-2 border-b ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)]' : 'border-slate-200'}`}>
          <button
            className={`px-6 py-3 font-semibold transition ${activeTab === 'documents'
              ? `border-b-2 ${theme === 'dark' ? 'text-cyan-400 border-cyan-400' : 'text-cyan-600 border-cyan-600'}`
              : `${theme === 'dark' ? 'text-text-secondary hover:text-cyan-400' : 'text-slate-500 hover:text-cyan-600'}`
              }`}
            onClick={() => {
              setActiveTab('documents')
              setQuery('')
              setResults([])
              setStudentResults([])
              setSelectedStudent(null)
            }}
          >
            بحث الوثائق
          </button>
          <button
            className={`px-6 py-3 font-semibold transition ${activeTab === 'students'
              ? `border-b-2 ${theme === 'dark' ? 'text-cyan-400 border-cyan-400' : 'text-cyan-600 border-cyan-600'}`
              : `${theme === 'dark' ? 'text-text-secondary hover:text-cyan-400' : 'text-slate-500 hover:text-cyan-600'}`
              }`}
            onClick={() => {
              setActiveTab('students')
              setQuery('')
              setResults([])
              setStudentResults([])
              setSelectedStudent(null)
            }}
          >
            بحث الطلاب
          </button>
        </div>
      </div>

      {/* مربع البحث */}
      <div className="card">
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <input
              type="text"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none transition text-lg ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
              placeholder={activeTab === 'students' ? 'ابحث برقم الطالب أو الاسم...' : 'ابحث في الوثائق...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
          </div>
          <button
            className="btn-primary px-8"
            onClick={search}
            disabled={loading}
          >
            {loading ? 'جارٍ البحث...' : 'بحث'}
          </button>
        </div>

        {/* خيارات البحث - للوثائق فقط */}
        {activeTab === 'documents' && (
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>البحث في</label>
              <select
                className={`w-full px-3 py-2 rounded-xl border focus:outline-none transition text-sm ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800'}`}
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as any)}
              >
                <option value="all">الكل (عنوان + محتوى)</option>
                <option value="title">العنوان فقط</option>
                <option value="content">المحتوى فقط</option>
              </select>
            </div>
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
                <option value="كشف درجات">كشف درجات</option>
                <option value="اختبار">اختبار</option>
                <option value="فاتورة">فاتورة</option>
                <option value="عقد">عقد</option>
                <option value="محضر اجتماع">محضر اجتماع</option>
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
            <div className="flex items-end">
              <button
                className="w-full px-3 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition text-sm"
                onClick={() => {
                  setQuery('')
                  setSearchField('all')
                  setFilterType('')
                  setFilterDirection('')
                  setResults([])
                }}
              >
                مسح الكل
              </button>
            </div>
          </div>
        )}

        {msg && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {msg}
          </div>
        )}
      </div>

      {/* النتائج */}
      {results.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cyan-400">
              النتائج ({results.length})
            </h2>
            <span className="text-text-secondary text-sm">
              وقت البحث: {searchTime.toFixed(2)} ثانية
            </span>
          </div>

          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className={`p-4 rounded-xl border transition ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500/50' : 'bg-white border-slate-200 hover:border-cyan-400 shadow-sm'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-cyan-400 mb-1">
                      {result.title || `وثيقة ${result.document_number}`}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-text-secondary">
                        {result.document_number}
                      </span>
                      {result.classification && (
                        <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                          {result.classification}
                        </span>
                      )}
                      {result.direction && (
                        <span className={`px-2 py-0.5 rounded ${result.direction === 'صادر'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-green-500/10 text-green-400'
                          }`}>
                          {result.direction}
                        </span>
                      )}
                      {result.score && (
                        <span className="text-text-secondary">
                          الصلة: {(result.score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition text-xs"
                    onClick={() => viewDocument(result.id)}
                  >
                    عرض
                  </button>
                </div>
                {result.snippet && (
                  <div
                    className={`text-sm mt-2 p-3 rounded-lg ${theme === 'dark' ? 'text-text-secondary bg-base-900' : 'text-slate-600 bg-slate-50'}`}
                    dangerouslySetInnerHTML={{
                      __html: highlightText(result.snippet, query),
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* نتائج البحث عن الطلاب */}
      {activeTab === 'students' && studentResults.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-cyan-400">
              نتائج البحث ({studentResults.length})
            </h2>
            <span className="text-text-secondary text-sm">
              وقت البحث: {searchTime.toFixed(2)} ثانية
            </span>
          </div>

          <div className="space-y-3">
            {studentResults.map((student) => (
              <div
                key={student.id}
                className="p-4 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500/50 transition cursor-pointer"
                onClick={() => viewStudent(student.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-cyan-400 mb-1">
                      {student.full_name_ar || student.full_name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-text-secondary">
                        رقم الطالب: {student.student_number}
                      </span>
                      {student.average_score !== null && student.average_score !== undefined && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                          المعدل: {student.average_score.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      viewStudent(student.id)
                    }}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* بدون نتائج */}
      {!loading && (
        <>
          {activeTab === 'documents' && results.length === 0 && query && (
            <div className="card text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/10 to-purple-400/5 border-2 border-dashed border-purple-500/30 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-purple-400/50 rounded-full"></div>
              </div>
              <div className="text-text-secondary">
                لم يتم العثور على نتائج لـ "<span className="text-cyan-400">{query}</span>"
              </div>
              <div className="text-text-secondary text-sm mt-2">
                جرب استخدام كلمات بحث مختلفة أو مسح الفلاتر
              </div>
            </div>
          )}
          {activeTab === 'students' && studentResults.length === 0 && query && (
            <div className="card text-center py-12">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/10 to-purple-400/5 border-2 border-dashed border-purple-500/30 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-purple-400/50 rounded-full"></div>
              </div>
              <div className="text-text-secondary">
                لم يتم العثور على طالب بـ "<span className="text-cyan-400">{query}</span>"
              </div>
              <div className="text-text-secondary text-sm mt-2">
                جرب البحث برقم الطالب أو الاسم
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast Notifications */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 px-6 py-4 rounded-xl shadow-2xl border-2 transition-all duration-300 ${toast.type === 'success'
            ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/50 text-green-300'
            : 'bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/50 text-red-300'
            }`}
          style={{ animation: 'slideUp 0.3s ease-out' }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* عرض تفاصيل الطالب */}
      {selectedStudent && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-cyan-400">
              بيانات الطالب: {selectedStudent.full_name_ar || selectedStudent.full_name}
            </h2>
            <button
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors text-sm"
              onClick={() => {
                setSelectedStudent(null)
                setStudentAnalysis(null)
              }}
            >
              إغلاق
            </button>
          </div>

          {/* تحليل الأداء */}
          {loadingAnalysis && (
            <div className="text-center py-8 text-text-secondary">جارٍ تحميل التحليل...</div>
          )}

          {studentAnalysis && !loadingAnalysis && studentAnalysis.statistics && (
            <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
              <h3 className="text-lg font-semibold text-cyan-400 mb-4">تحليل الأداء</h3>

              {/* إحصائيات عامة */}
              <div className="grid md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <div className="text-xs text-text-secondary mb-1">المعدل العام</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {studentAnalysis.statistics.overall_average.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <div className="text-xs text-text-secondary mb-1">أعلى درجة</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {studentAnalysis.statistics.highest_score.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <div className="text-xs text-text-secondary mb-1">أقل درجة</div>
                  <div className="text-2xl font-bold text-orange-400">
                    {studentAnalysis.statistics.lowest_score.toFixed(2)}%
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <div className="text-xs text-text-secondary mb-1">عدد الاختبارات</div>
                  <div className="text-2xl font-bold text-purple-400">
                    {studentAnalysis.statistics.total_exams}
                  </div>
                </div>
              </div>

              {/* الاتجاه العام */}
              {studentAnalysis.statistics.overall_trend && (
                <div className="mb-4 p-4 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-cyan-400">الاتجاه العام</div>
                    <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${studentAnalysis.statistics.overall_trend === 'improving'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : studentAnalysis.statistics.overall_trend === 'declining'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                      {studentAnalysis.statistics.overall_trend === 'improving' ? 'تحسن' :
                        studentAnalysis.statistics.overall_trend === 'declining' ? 'انخفاض' : 'مستقر'}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-text-secondary">المعدل الأخير: </span>
                      <span className="text-white font-semibold">{studentAnalysis.statistics.recent_average.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">المعدل السابق: </span>
                      <span className="text-white font-semibold">{studentAnalysis.statistics.previous_average.toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">التغيير: </span>
                      <span className={`font-semibold ${studentAnalysis.statistics.overall_change > 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                        {studentAnalysis.statistics.overall_change > 0 ? '+' : ''}{studentAnalysis.statistics.overall_change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* الأداء حسب المادة */}
              {studentAnalysis.performance_by_subject && Object.keys(studentAnalysis.performance_by_subject).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-cyan-400 mb-3">الأداء حسب المادة</h4>
                  <div className="space-y-2">
                    {Object.entries(studentAnalysis.performance_by_subject).map(([subject, perf]: [string, any]) => (
                      <div key={subject} className="p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-white">{subject}</div>
                          <div className={`px-2 py-1 rounded text-xs ${perf.trend === 'improving' ? 'bg-emerald-500/20 text-emerald-400' :
                            perf.trend === 'declining' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                            {perf.trend === 'improving' ? 'تحسن' :
                              perf.trend === 'declining' ? 'انخفاض' : 'مستقر'}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-text-secondary">الأولى: </span>
                            <span className="text-white">{perf.first_score.toFixed(2)}%</span>
                          </div>
                          <div>
                            <span className="text-text-secondary">الأخيرة: </span>
                            <span className="text-white">{perf.last_score.toFixed(2)}%</span>
                          </div>
                          <div>
                            <span className="text-text-secondary">التغيير: </span>
                            <span className={`font-semibold ${perf.change > 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}>
                              {perf.change > 0 ? '+' : ''}{perf.change.toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <span className="text-text-secondary">المعدل: </span>
                            <span className="text-cyan-400 font-semibold">{perf.average.toFixed(2)}%</span>
                          </div>
                          <div>
                            <span className="text-text-secondary">عدد الاختبارات: </span>
                            <span className="text-white">{perf.total_exams}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ملخص التحسينات */}
              {studentAnalysis.grades_summary && (
                <div className="p-4 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <h4 className="text-sm font-semibold text-cyan-400 mb-3">ملخص التطور</h4>
                  <div className="grid md:grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-400">{studentAnalysis.grades_summary.improving_subjects}</div>
                      <div className="text-xs text-text-secondary mt-1">مواد متحسنة</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-400">{studentAnalysis.grades_summary.stable_subjects}</div>
                      <div className="text-xs text-text-secondary mt-1">مواد مستقرة</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{studentAnalysis.grades_summary.declining_subjects}</div>
                      <div className="text-xs text-text-secondary mt-1">مواد منخفضة</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* البيانات الأساسية */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">البيانات الأساسية</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-text-secondary mb-1">رقم الطالب</div>
                  <div className="font-mono text-cyan-400">{selectedStudent.student_number}</div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary mb-1">الاسم الكامل</div>
                  <div className="text-white">{selectedStudent.full_name_ar || selectedStudent.full_name}</div>
                </div>
                {selectedStudent.email && (
                  <div>
                    <div className="text-xs text-text-secondary mb-1">البريد الإلكتروني</div>
                    <div className="text-white">{selectedStudent.email}</div>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div>
                    <div className="text-xs text-text-secondary mb-1">الهاتف</div>
                    <div className="text-white">{selectedStudent.phone}</div>
                  </div>
                )}
                {selectedStudent.grade_level && (
                  <div>
                    <div className="text-xs text-text-secondary mb-1">المرحلة الدراسية</div>
                    <div className="text-white">{selectedStudent.grade_level}</div>
                  </div>
                )}
                {selectedStudent.department && (
                  <div>
                    <div className="text-xs text-text-secondary mb-1">القسم</div>
                    <div className="text-white">{selectedStudent.department}</div>
                  </div>
                )}
                {selectedStudent.average_score !== null && selectedStudent.average_score !== undefined && (
                  <div>
                    <div className="text-xs text-text-secondary mb-1">المعدل التراكمي</div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {selectedStudent.average_score.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* الدرجات */}
            <div>
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">الدرجات ({selectedStudent.grades?.length || 0})</h3>
              {selectedStudent.grades && selectedStudent.grades.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedStudent.grades.map((grade: any) => (
                    <div
                      key={grade.id}
                      className="p-3 rounded-lg bg-base-900 border border-[rgba(0,188,212,0.12)]"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-cyan-400">
                          {grade.subject || 'بدون مادة'}
                        </div>
                        {grade.grade && (
                          <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs">
                            {grade.grade}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {grade.score !== null && (
                          <span className="text-white">
                            {grade.score.toFixed(2)} / {grade.max_score || 100}
                          </span>
                        )}
                        {grade.percentage !== null && (
                          <span className="text-emerald-400">
                            {grade.percentage.toFixed(2)}%
                          </span>
                        )}
                        {grade.exam_type && (
                          <span className="text-text-secondary text-xs">
                            {grade.exam_type}
                          </span>
                        )}
                      </div>
                      {grade.exam_date && (
                        <div className="text-xs text-text-secondary mt-1">
                          {new Date(grade.exam_date).toLocaleDateString('ar-IQ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-secondary text-center py-8">
                  لا توجد درجات مسجلة
                </div>
              )}
            </div>
          </div>

          {/* الوثائق المرتبطة */}
          {selectedStudent.documents && selectedStudent.documents.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[rgba(0,188,212,0.12)]">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">
                الوثائق المرتبطة ({selectedStudent.documents.length})
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                {selectedStudent.documents.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg bg-base-900 border border-[rgba(0,188,212,0.12)] hover:border-cyan-500/50 transition cursor-pointer"
                    onClick={() => {
                      setSelectedDoc({ id: doc.id })
                      viewDocument(doc.id)
                      setSelectedStudent(null)
                      setStudentAnalysis(null)
                    }}
                  >
                    <div className="font-semibold text-cyan-400 mb-1">
                      {doc.title || `وثيقة ${doc.document_number}`}
                    </div>
                    <div className="text-xs text-text-secondary">
                      {doc.document_number} • {doc.classification || 'بدون تصنيف'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                    <span className="text-text-secondary">رفع بواسطة:</span>
                    <div className="flex flex-col">
                      <span className="text-cyan-400 font-semibold">
                        {selectedDoc.uploader?.full_name || selectedDoc.uploader?.username || 'غير معروف'}
                      </span>
                      {selectedDoc.uploader?.username && selectedDoc.uploader?.full_name && (
                        <span className="text-xs text-text-secondary mt-0.5">
                          ({selectedDoc.uploader.username})
                        </span>
                      )}
                    </div>
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

              {/* أزرار الإجراءات */}
              <div className="pt-4 border-t border-[rgba(0,188,212,0.12)] space-y-2">
                <button
                  className="w-full px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                  onClick={handlePrintPreview}
                >
                  طباعة الوثيقة
                </button>
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
          <div className={`rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border ${theme === 'dark' ? 'bg-base-800 border-cyan-500/20' : 'bg-white border-cyan-200'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${theme === 'dark' ? 'border-[rgba(0,188,212,0.15)]' : 'border-slate-100'}`}>
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
            <div className={`p-6 overflow-y-auto max-h-[70vh] space-y-4 text-sm leading-relaxed ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>
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
                {selectedDoc.uploader && (
                  <div>
                    <p className="text-text-secondary text-xs mb-1">رفع بواسطة</p>
                    <p className="text-cyan-300">
                      {selectedDoc.uploader.full_name || selectedDoc.uploader.username}
                    </p>
                  </div>
                )}
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
    </div>
  )
}

export default Search
