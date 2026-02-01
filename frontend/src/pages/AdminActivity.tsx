import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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
    return () => {}
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

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400 mb-1">سجل النشاط</h1>
            <p className="text-text-secondary text-sm">
              عرض جميع العمليات والأنشطة في النظام • التحديث التلقائي (يتوقف عند استخدام الفلاتر)
            </p>
          </div>
          <div className="text-text-secondary text-sm">
            إجمالي السجلات: <span className="text-cyan-400 font-bold">{rows.length}</span>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="space-y-3">
        <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">اسم المستخدم</label>
              <input
                className="w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
                placeholder="أدخل اسم المستخدم..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">نوع الإجراء</label>
              <select
                className="w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
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
              <label className="block text-xs text-text-secondary mb-1">من تاريخ</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">إلى تاريخ</label>
              <input
                type="date"
                className="w-full px-3 py-2 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
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
                className="px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 transition-colors"
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

      {/* جدول السجل */}
      <div className="card">
        <h2 className="text-lg font-semibold text-cyan-400 mb-4">
          السجلات ({rows.length})
        </h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary border-b border-[rgba(0,188,212,0.12)]">
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
                  <td colSpan={7} className="py-8 text-center text-text-secondary">
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[rgba(0,188,212,0.12)] hover:bg-base-900/50 transition"
                  >
                    <td className="py-3 px-2 text-text-secondary">{r.id}</td>
                    <td className="py-3 px-2">
                      <span className="text-cyan-400">
                        {r.username || `#${r.user_id}` || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="inline-block px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs">
                        {translateAction(r.action)}
                      </span>
                    </td>
                    <td className="py-3 px-2 max-w-md">
                      <span className="text-text-secondary text-sm">
                        {formatDetails(r.action, r.details)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-text-secondary">
                      {r.document_id ? `#${r.document_id}` : '—'}
                    </td>
                    <td className="py-3 px-2 text-text-secondary text-xs">{r.ip || '—'}</td>
                    <td className="py-3 px-2 text-text-secondary text-xs">
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
