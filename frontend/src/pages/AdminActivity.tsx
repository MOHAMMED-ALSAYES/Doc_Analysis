import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

type Row = {
  id: number
  user_id: number | null
  username?: string
  document_id: number | null
  action: string
  ip?: string
  timestamp?: string
  details?: any
}

function AdminActivity() {
  const { theme } = useTheme()
  const [rows, setRows] = useState<Row[]>([])
  const [username, setUsername] = useState('')
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const params = {
      username: username || undefined,
      action: action || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }
    try {
      const res = await api.get('/activity', { params })
      setRows(res.data)
      setMsg('')
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'فشل جلب السجل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()

    // تحديث تلقائي كل 10 ثوان فقط إذا لم تكن هناك فلاتر نشطة
    const hasFilters = username || action || dateFrom || dateTo

    if (!hasFilters) {
      const refreshInterval = setInterval(() => {
        load()
      }, 10000)
      return () => clearInterval(refreshInterval)
    }

    // إذا كانت هناك فلاتر، لا نحتاج cleanup
    return () => { }
  }, [username, action, dateFrom, dateTo])

  const clearFilters = () => {
    setUsername('')
    setAction('')
    setDateFrom('')
    setDateTo('')
  }

  // دالة لتنسيق التاريخ والوقت
  const formatDateTime = (timestamp?: string) => {
    if (!timestamp) return '—'
    try {
      // تحويل timestamp إلى Date object
      let date: Date

      // محاولة تحويل بصيغ مختلفة
      if (timestamp.includes('T')) {
        date = new Date(timestamp)
      } else if (timestamp.includes('-')) {
        date = new Date(timestamp + 'T00:00:00')
      } else {
        date = new Date(timestamp)
      }

      // التحقق من صحة التاريخ
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', timestamp)
        return timestamp // إرجاع القيمة الأصلية إذا كان التاريخ غير صحيح
      }

      // تنسيق التاريخ بالإنجليزية مع الشهر بالرقم
      const formatted = date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })

      return formatted || timestamp
    } catch (error) {
      console.error('Error formatting date:', error, timestamp)
      return timestamp || '—'
    }
  }

  // دالة لترجمة الإجراءات
  const translateAction = (action: string) => {
    const translations: Record<string, string> = {
      login: 'تسجيل دخول',
      logout: 'تسجيل خروج',
      create_user: 'إنشاء مستخدم',
      update_user: 'تعديل مستخدم',
      deactivate_user: 'تعطيل مستخدم',
      upload_document: 'رفع وثيقة',
      delete_document: 'حذف وثيقة',
      view_document: 'عرض وثيقة',
      download_document: 'تحميل وثيقة',
      Update: 'تحديث وثيقة',
      update_document: 'تحديث وثيقة',
      search: 'بحث',
      analyze: 'تحليل',
    }
    return translations[action] || action
  }

  // دالة لتحويل التفاصيل إلى نص مفهوم
  const formatDetails = (action: string, details: any) => {
    if (!details || Object.keys(details).length === 0) {
      return 'لا توجد تفاصيل'
    }

    const parts: string[] = []

    switch (action) {
      case 'login':
        if (details.username) parts.push(`المستخدم: ${details.username}`)
        break

      case 'logout':
        if (details.username) parts.push(`المستخدم: ${details.username}`)
        break

      case 'create_user':
        if (details.new_user) parts.push(`المستخدم الجديد: ${details.new_user}`)
        if (details.role) parts.push(`الدور: ${details.role === 'system_admin' ? 'مدير النظام' : 'موظف'}`)
        break

      case 'update_user':
        if (details.user) parts.push(`المستخدم: ${details.user}`)
        if (details.changes) parts.push(`التغييرات: ${details.changes}`)
        break

      case 'deactivate_user':
        if (details.user) parts.push(`المستخدم: ${details.user}`)
        break

      case 'upload_document':
        if (details.filename) parts.push(`اسم الملف: ${details.filename}`)
        if (details.document_number) parts.push(`رقم الوثيقة: ${details.document_number}`)
        if (details.size) parts.push(`الحجم: ${(details.size / 1024).toFixed(2)} KB`)
        break

      case 'delete_document':
        if (details.document_number) parts.push(`رقم الوثيقة: ${details.document_number}`)
        if (details.filename) parts.push(`اسم الملف: ${details.filename}`)
        break

      case 'view_document':
      case 'download_document':
        if (details.document_number) parts.push(`رقم الوثيقة: ${details.document_number}`)
        break

      case 'Update':
      case 'update_document':
        if (details.document_number) parts.push(`رقم الوثيقة: ${details.document_number}`)
        if (details.title) parts.push(`العنوان: ${details.title}`)
        break

      case 'search':
        if (details.query) parts.push(`البحث عن: ${details.query}`)
        if (details.results_count !== undefined) parts.push(`النتائج: ${details.results_count}`)
        break

      case 'analyze':
        if (details.document_id) parts.push(`رقم الوثيقة: ${details.document_id}`)
        if (details.type) parts.push(`نوع التحليل: ${details.type}`)
        break

      default:
        // عرض جميع الحقول
        for (const [key, value] of Object.entries(details)) {
          parts.push(`${key}: ${value}`)
        }
    }

    return parts.length > 0 ? parts.join(' • ') : 'لا توجد تفاصيل'
  }

  // فئات CSS مشتركة
  const inputClass = theme === 'dark'
    ? "w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
    : "w-full px-3 py-2 rounded-xl bg-white border-2 border-cyan-200 focus:border-cyan-500 focus:outline-none transition text-sm text-slate-700"

  const selectClass = theme === 'dark'
    ? "w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
    : "w-full px-3 py-2 rounded-xl bg-white border-2 border-cyan-200 focus:border-cyan-500 focus:outline-none transition text-sm text-slate-700"

  const labelClass = theme === 'dark' ? "block text-xs text-text-secondary mb-1" : "block text-xs text-slate-600 mb-1"

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
        <div className={`${theme === 'light' ? 'border-t-4 border-t-cyan-500 -mt-6 -mx-6 px-6 pt-6 mb-4' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>سجل النشاط</h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                عرض جميع العمليات والأنشطة في النظام • التحديث التلقائي (يتوقف عند استخدام الفلاتر)
              </p>
            </div>
            <div className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
              إجمالي السجلات: <span className={`font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{rows.length}</span>
            </div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="space-y-3">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>اسم المستخدم</label>
              <input
                className={inputClass}
                placeholder="أدخل اسم المستخدم..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>نوع الإجراء</label>
              <select
                className={selectClass}
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="">الكل</option>
                <option value="login">تسجيل دخول</option>
                <option value="logout">تسجيل خروج</option>
                <option value="create_user">إنشاء مستخدم</option>
                <option value="update_user">تعديل مستخدم</option>
                <option value="deactivate_user">تعطيل مستخدم</option>
                <option value="upload_document">رفع وثيقة</option>
                <option value="delete_document">حذف وثيقة</option>
                <option value="view_document">عرض وثيقة</option>
                <option value="download_document">تحميل وثيقة</option>
                <option value="Update">تحديث وثيقة</option>
                <option value="update_document">تحديث وثيقة</option>
                <option value="search">بحث</option>
                <option value="analyze">تحليل</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>من تاريخ</label>
              <input
                type="date"
                className={inputClass}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>إلى تاريخ</label>
              <input
                type="date"
                className={inputClass}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                className={`flex-1 px-4 py-2 rounded-xl transition-all ${theme === 'dark' ? 'btn-primary' : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-md'}`}
                onClick={load}
                disabled={loading}
              >
                {loading ? 'جارٍ البحث...' : 'بحث'}
              </button>
              <button
                className={`px-4 py-2 rounded-xl border transition-colors ${theme === 'dark' ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'}`}
                onClick={clearFilters}
                title="مسح الفلاتر"
              >
                مسح
              </button>
            </div>
          </div>
          {msg && (
            <div className={`px-4 py-3 rounded-xl text-sm ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-400' : 'bg-red-50 border border-red-300 text-red-600'}`}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* جدول السجل */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
        <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
          السجلات ({rows.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${theme === 'dark' ? 'text-text-secondary border-b border-[rgba(0,188,212,0.12)]' : 'text-slate-600 border-b-2 border-cyan-200 bg-cyan-50/50'}`}>
                <th className="text-right py-3 px-2">#</th>
                <th className="text-right py-3 px-2">المستخدم</th>
                <th className="text-right py-3 px-2">الإجراء</th>
                <th className="text-right py-3 px-2">التفاصيل</th>
                <th className="text-right py-3 px-2">الوثيقة</th>
                <th className="text-right py-3 px-2">IP</th>
                <th className="text-right py-3 px-2">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className={`${theme === 'dark' ? 'border-b border-[rgba(0,188,212,0.12)] hover:bg-base-900/50' : 'border-b border-cyan-100 hover:bg-cyan-50/50'} transition`}
                  >
                    <td className={`py-3 px-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{r.id}</td>
                    <td className="py-3 px-2">
                      <span className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600 font-medium'}>
                        {r.username || `#${r.user_id}` || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>
                        {translateAction(r.action)}
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-md">
                      <span className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                        {formatDetails(r.action, r.details)}
                      </span>
                    </td>
                    <td className={`py-3 px-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                      {r.document_id ? `#${r.document_id}` : '—'}
                    </td>
                    <td className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{r.ip || '—'}</td>
                    <td className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                      {formatDateTime(r.timestamp)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default AdminActivity
