import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

// أيقونات SVG مخصصة
const Icons = {
  users: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  activity: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  documents: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  shield: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  online: (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  arrow: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  refresh: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  trending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )
}

// مكون بطاقة الإحصائيات مع أنيميشن
function StatCard({
  title,
  value,
  icon,
  color = 'cyan',
  trend,
  loading = false,
  delay = 0
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color?: 'cyan' | 'green' | 'purple' | 'orange' | 'blue'
  trend?: { value: number; positive: boolean }
  loading?: boolean
  delay?: number
}) {
  const { theme } = useTheme()
  const [animated, setAnimated] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (typeof value === 'number' && animated && !loading) {
      const duration = 1000
      const steps = 30
      const increment = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, duration / steps)
      return () => clearInterval(timer)
    }
  }, [value, animated, loading])

  // ألوان للوضع الداكن
  const darkColorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }

  // ألوان الأيقونات للوضع الفاتح (تدرج سماوي)
  const lightIconColor = {
    cyan: 'text-cyan-500',
    green: 'text-teal-500',
    purple: 'text-blue-500',
    orange: 'text-cyan-400',
    blue: 'text-blue-500'
  }

  // ألوان القيم للوضع الفاتح
  const lightValueColor = {
    cyan: 'text-cyan-600',
    green: 'text-teal-600',
    purple: 'text-blue-600',
    orange: 'text-cyan-600',
    blue: 'text-blue-600'
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 transition-all duration-500 hover:scale-105 ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${theme === 'dark' ? `card ${darkColorClasses[color]}` : 'bg-white border-cyan-200 shadow-lg hover:shadow-xl hover:border-cyan-400'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-12 h-12 flex items-center justify-center ${theme === 'dark' ? darkColorClasses[color] : lightIconColor[color]}`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${trend.positive ? (theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600') : (theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}`}>
              {Icons.trending}
              <span>{trend.positive ? '+' : ''}{trend.value}%</span>
            </div>
          )}
        </div>
        <div className={`text-sm mb-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{title}</div>
        <div className={`text-3xl font-bold ${theme === 'dark' ? (color === 'cyan' ? 'text-cyan-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : color === 'orange' ? 'text-orange-400' : 'text-blue-400') : lightValueColor[color]}`}>
          {loading ? (
            <div className={`h-9 w-16 rounded animate-pulse ${theme === 'dark' ? 'bg-bg-tertiary' : 'bg-slate-200'}`}></div>
          ) : (
            typeof value === 'number' ? displayValue.toLocaleString('ar-SA') : value
          )}
        </div>
      </div>
    </div>
  )
}

// مكون الرسم البياني البسيط
function SimpleChart({ data, height = 100 }: { data: number[], height?: number }) {
  const max = Math.max(...data, 1)

  return (
    <div className="flex items-end gap-1 h-full" style={{ height }}>
      {data.map((value, index) => (
        <div
          key={index}
          className="flex-1 bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t transition-all duration-500 hover:from-cyan-400 hover:to-cyan-300"
          style={{
            height: `${(value / max) * 100}%`,
            animationDelay: `${index * 50}ms`
          }}
          title={`${value}`}
        />
      ))}
    </div>
  )
}

// مكون بطاقة الإدارة
function AdminCard({
  to,
  icon,
  title,
  subtitle,
  description,
  disabled = false,
  delay = 0
}: {
  to: string
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  disabled?: boolean
  delay?: number
}) {
  const { theme } = useTheme()
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const content = (
    <div className={`flex items-start justify-between mb-4`}>
      <div className={`w-14 h-14 flex items-center justify-center ${disabled ? 'text-slate-400' : (theme === 'dark' ? 'text-cyan-400' : 'text-cyan-500')}`}>
        {icon}
      </div>
      {!disabled && (
        <div className={`opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-x-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
          {Icons.arrow}
        </div>
      )}
    </div>
  )

  if (disabled) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl opacity-60 cursor-not-allowed transition-all duration-500 p-5 ${theme === 'light' ? 'bg-slate-50 border-2 border-slate-200' : 'card'} ${animated ? 'opacity-60 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ transitionDelay: `${delay}ms` }}
      >
        {content}
        <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>{title}</div>
        <div className={`text-xl font-semibold ${theme === 'dark' ? '' : 'text-slate-500'}`}>{subtitle}</div>
        <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>{description}</p>
        <div className={`mt-3 inline-block px-2 py-1 text-xs rounded-full ${theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-amber-100 text-amber-600'}`}>
          قريباً
        </div>
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={`relative overflow-hidden block transition-all duration-500 group hover:scale-[1.02] rounded-xl border-2 ${theme === 'dark' ? 'card hover:shadow-cyan hover:border-cyan-500/30' : 'bg-white border-cyan-200 shadow-lg hover:shadow-xl hover:border-cyan-400'} ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="relative p-5">
        {content}
        <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{title}</div>
        <div className={`text-xl font-semibold transition-colors ${theme === 'dark' ? 'group-hover:text-cyan-400' : 'text-cyan-700 group-hover:text-cyan-600'}`}>
          {subtitle}
        </div>
        <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{description}</p>
      </div>
    </Link>
  )
}

// مكون المستخدمين المتصلين
function OnlineUsers({ users }: { users: any[] }) {
  const { theme } = useTheme()
  return (
    <div className="space-y-3">
      {users.length === 0 ? (
        <div className={`text-center py-4 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>لا يوجد مستخدمين متصلين</div>
      ) : (
        users.slice(0, 5).map((user, index) => (
          <div
            key={user.id || index}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-bg-tertiary/50 hover:bg-bg-tertiary' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 animate-pulse ${theme === 'dark' ? 'border-bg-secondary' : 'border-white'}`}></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className={`font-medium truncate ${theme === 'dark' ? '' : 'text-slate-700'}`}>{user.full_name || user.username}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                {user.role === 'system_admin' ? 'مدير النظام' : 'موظف'}
              </div>
            </div>
            <div className={`text-xs ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>متصل</div>
          </div>
        ))
      )}
      {users.length > 5 && (
        <div className={`text-center text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
          +{users.length - 5} مستخدمين آخرين
        </div>
      )}
    </div>
  )
}

// مكون النشاط الأخير
function RecentActivity({ activities }: { activities: any[] }) {
  const { theme } = useTheme()
  // ترجمة العمليات إلى العربية
  const translateAction = (action: string, details?: any): string => {
    const translations: { [key: string]: string } = {
      // عمليات المستخدمين
      'login': 'تسجيل دخول',
      'logout': 'تسجيل خروج',
      'create_user': 'إنشاء مستخدم جديد',
      'update_user': 'تعديل بيانات مستخدم',
      'delete_user': 'حذف مستخدم',
      'change_password': 'تغيير كلمة المرور',
      'reset_password': 'إعادة تعيين كلمة المرور',
      'toggle_user': 'تفعيل/إلغاء تفعيل مستخدم',

      // عمليات الوثائق
      'upload_document': 'رفع وثيقة جديدة',
      'upload': 'رفع وثيقة',
      'view_document': 'عرض وثيقة',
      'view': 'عرض وثيقة',
      'update_document': 'تعديل وثيقة',
      'delete_document': 'حذف وثيقة',
      'download_document': 'تحميل وثيقة',
      'download': 'تحميل وثيقة',
      'print_document': 'طباعة وثيقة',
      'print': 'طباعة وثيقة',

      // عمليات الصلاحيات
      'grant_permission': 'منح صلاحية',
      'revoke_permission': 'سحب صلاحية',

      // عمليات البحث
      'search': 'بحث في الوثائق',
      'advanced_search': 'بحث متقدم',

      // عمليات أخرى
      'export': 'تصدير بيانات',
      'import': 'استيراد بيانات',
      'backup': 'إنشاء نسخة احتياطية',
      'restore': 'استعادة نسخة احتياطية',
    }

    // البحث عن الترجمة
    const lowerAction = action.toLowerCase().trim()
    let translated = translations[lowerAction]

    // إذا لم توجد ترجمة مباشرة، نحاول البحث عن كلمات مفتاحية
    if (!translated) {
      if (lowerAction.includes('login')) translated = 'تسجيل دخول'
      else if (lowerAction.includes('logout')) translated = 'تسجيل خروج'
      else if (lowerAction.includes('upload')) translated = 'رفع وثيقة'
      else if (lowerAction.includes('download')) translated = 'تحميل وثيقة'
      else if (lowerAction.includes('delete')) translated = 'حذف'
      else if (lowerAction.includes('update') || lowerAction.includes('edit')) translated = 'تعديل'
      else if (lowerAction.includes('create') || lowerAction.includes('add')) translated = 'إضافة'
      else if (lowerAction.includes('view') || lowerAction.includes('read')) translated = 'عرض'
      else if (lowerAction.includes('search')) translated = 'بحث'
      else if (lowerAction.includes('print')) translated = 'طباعة'
      else if (lowerAction.includes('permission')) translated = 'تعديل صلاحيات'
      else translated = action // إذا لم توجد ترجمة، نعرض النص الأصلي
    }

    // إضافة تفاصيل إضافية إذا وجدت
    if (details) {
      if (details.new_user) translated += `: ${details.new_user}`
      else if (details.user) translated += `: ${details.user}`
      else if (details.document_title) translated += `: ${details.document_title}`
      else if (details.query) translated += `: "${details.query}"`
    }

    return translated
  }

  const getActionColor = (action: string) => {
    const lowerAction = action.toLowerCase()
    if (lowerAction.includes('create') || lowerAction.includes('upload') || lowerAction.includes('add') || lowerAction.includes('login'))
      return 'bg-green-500'
    if (lowerAction.includes('delete') || lowerAction.includes('remove') || lowerAction.includes('revoke'))
      return 'bg-red-500'
    if (lowerAction.includes('update') || lowerAction.includes('edit') || lowerAction.includes('change'))
      return 'bg-yellow-500'
    if (lowerAction.includes('download') || lowerAction.includes('view') || lowerAction.includes('print'))
      return 'bg-blue-500'
    return 'bg-cyan-500'
  }

  const getActionTextColor = (action: string) => {
    const lowerAction = action.toLowerCase()
    if (lowerAction.includes('create') || lowerAction.includes('upload') || lowerAction.includes('add') || lowerAction.includes('login'))
      return 'text-green-400'
    if (lowerAction.includes('delete') || lowerAction.includes('remove') || lowerAction.includes('revoke'))
      return 'text-red-400'
    if (lowerAction.includes('update') || lowerAction.includes('edit') || lowerAction.includes('change'))
      return 'text-yellow-400'
    if (lowerAction.includes('download') || lowerAction.includes('view') || lowerAction.includes('print'))
      return 'text-blue-400'
    return 'text-cyan-400'
  }

  // تنسيق التاريخ
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'غير محدد'
    try {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return 'غير محدد'
      return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'غير محدد'
    }
  }

  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <div className={`text-center py-4 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>لا يوجد نشاط حديث</div>
      ) : (
        activities.slice(0, 5).map((activity, index) => (
          <div
            key={activity.id || index}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${theme === 'dark' ? 'bg-bg-tertiary/50 hover:bg-bg-tertiary' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            <div className={`w-2 h-2 rounded-full mt-2 ${theme === 'dark' ? getActionColor(activity.action) : 'bg-cyan-500'}`}></div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${theme === 'dark' ? getActionTextColor(activity.action) : 'text-slate-700'}`}>
                {translateAction(activity.action, activity.details)}
              </div>
              <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                {activity.full_name || activity.username || 'مستخدم'} • {formatDate(activity.timestamp)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function AdminDashboard() {
  const { theme } = useTheme()
  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    totalDocuments: 0,
    todayOperations: 0,
    documentsThisMonth: 0,
    documentsLastMonth: 0
  })
  const [onlineUsersList, setOnlineUsersList] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [documentsByType, setDocumentsByType] = useState<{ [key: string]: number }>({})
  const [monthlyData, setMonthlyData] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)

      // جلب البيانات بالتوازي
      const [usersRes, statsRes, activityRes, dashboardRes] = await Promise.allSettled([
        api.get('/users/'),
        api.get('/documents/stats'),
        api.get('/activity?limit=10'),
        api.get('/reports/dashboard')
      ])

      // معالجة المستخدمين
      if (usersRes.status === 'fulfilled') {
        const users = usersRes.value.data
        setStats(prev => ({ ...prev, totalUsers: users.length }))

        // المستخدمين المتصلين (لديهم last_activity في آخر 15 دقيقة)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000)
        const online = users.filter((u: any) =>
          u.last_activity && new Date(u.last_activity) > fifteenMinutesAgo
        )
        setOnlineUsersList(online)
        setStats(prev => ({ ...prev, onlineUsers: online.length }))
      }

      // معالجة إحصائيات الوثائق
      if (statsRes.status === 'fulfilled') {
        const docStats = statsRes.value.data
        setStats(prev => ({
          ...prev,
          totalDocuments: docStats.total || 0,
          documentsThisMonth: docStats.this_month || 0,
          documentsLastMonth: docStats.last_month || 0
        }))

        // الوثائق حسب النوع
        if (docStats.by_type) {
          setDocumentsByType(docStats.by_type)
        }
      }

      // معالجة النشاط
      if (activityRes.status === 'fulfilled') {
        const activities = activityRes.value.data
        setRecentActivities(Array.isArray(activities) ? activities : activities.items || [])

        // حساب العمليات اليوم
        const today = new Date().toDateString()
        const todayOps = (Array.isArray(activities) ? activities : activities.items || [])
          .filter((a: any) => new Date(a.created_at).toDateString() === today)
        setStats(prev => ({ ...prev, todayOperations: todayOps.length }))
      }

      // معالجة لوحة التقارير
      if (dashboardRes.status === 'fulfilled') {
        const dashboard = dashboardRes.value.data
        if (dashboard.monthly_documents) {
          setMonthlyData(dashboard.monthly_documents.map((m: any) => m.count || 0))
        }
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()

    // تحديث تلقائي كل دقيقة
    const interval = setInterval(fetchDashboardData, 60000)
    return () => clearInterval(interval)
  }, [])

  // حساب نسبة التغير
  const getTrend = () => {
    if (stats.documentsLastMonth === 0) return null
    const change = ((stats.documentsThisMonth - stats.documentsLastMonth) / stats.documentsLastMonth) * 100
    return { value: Math.round(change), positive: change >= 0 }
  }

  return (
    <div className="space-y-6">
      {/* رأس لوحة المدير */}
      <div className={`relative overflow-hidden rounded-xl border-2 ${theme === 'dark' ? 'card bg-gradient-to-r from-bg-secondary to-bg-tertiary border-cyan-500/20' : 'bg-white border-cyan-200 shadow-lg'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent' : 'text-cyan-600'}`}>
                لوحة التحكم
              </h1>
              <p className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>
                مرحباً بك في لوحة إدارة النظام
                {lastUpdate && (
                  <span className={`mr-2 ${theme === 'dark' ? 'text-text-secondary/70' : 'text-slate-400'}`}>
                    • آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={fetchDashboardData}
              disabled={refreshing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${refreshing ? 'opacity-50' : ''} ${theme === 'dark' ? 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-transparent' : 'bg-white border-cyan-400 hover:bg-cyan-50 text-cyan-600'}`}
            >
              <span className={refreshing ? 'animate-spin' : ''}>{Icons.refresh}</span>
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* الإحصائيات السريعة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي المستخدمين"
          value={stats.totalUsers}
          icon={Icons.users}
          color="cyan"
          loading={loading}
          delay={0}
        />
        <StatCard
          title="المستخدمون المتصلون"
          value={stats.onlineUsers}
          icon={Icons.online}
          color="green"
          loading={loading}
          delay={100}
        />
        <StatCard
          title="إجمالي الوثائق"
          value={stats.totalDocuments}
          icon={Icons.documents}
          color="purple"
          trend={getTrend() || undefined}
          loading={loading}
          delay={200}
        />
        <StatCard
          title="العمليات اليوم"
          value={stats.todayOperations}
          icon={Icons.activity}
          color="orange"
          loading={loading}
          delay={300}
        />
      </div>

      {/* بطاقات الإدارة */}
      <div className="grid md:grid-cols-3 gap-6">
        <AdminCard
          to="/admin/users"
          icon={Icons.users}
          title="إدارة المستخدمين"
          subtitle="إنشاء وتعديل المستخدمين"
          description="إضافة مستخدمين جدد، تعديل الصلاحيات، وإدارة الحسابات"
          delay={400}
        />
        <AdminCard
          to="/admin/activity"
          icon={Icons.activity}
          title="سجل النشاط"
          subtitle="مراقبة جميع العمليات"
          description="عرض سجل كامل لجميع العمليات والأنشطة في النظام"
          delay={500}
        />
        <AdminCard
          to="#"
          icon={Icons.shield}
          title="صلاحيات الوثائق"
          subtitle="منح/سحب الصلاحيات"
          description="إدارة صلاحيات الوصول للوثائق"
          disabled
          delay={600}
        />
      </div>

      {/* قسم البيانات التفصيلية */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* المستخدمين المتصلين */}
        <div className={`relative overflow-hidden rounded-xl border-2 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'card'}`}>
          {/* خط علوي ملون */}
          {theme === 'light' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-teal-500 to-cyan-600"></div>
          )}
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>المستخدمون المتصلون</h3>
              <div className={`flex items-center gap-2 text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${theme === 'dark' ? 'bg-green-400' : 'bg-green-500'}`}></div>
                {stats.onlineUsers} متصل
              </div>
            </div>
            <OnlineUsers users={onlineUsersList} />
          </div>
        </div>

        {/* النشاط الأخير */}
        <div className={`relative overflow-hidden rounded-xl border-2 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'card'}`}>
          {/* خط علوي ملون */}
          {theme === 'light' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500"></div>
          )}
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>النشاط الأخير</h3>
              <Link to="/admin/activity" className={`text-sm hover:underline ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                عرض الكل ←
              </Link>
            </div>
            <RecentActivity activities={recentActivities} />
          </div>
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* الوثائق حسب النوع */}
        <div className={`relative overflow-hidden rounded-xl border-2 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'card'}`}>
          {/* خط علوي ملون */}
          {theme === 'light' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500"></div>
          )}
          <div className="relative p-5">
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>الوثائق حسب النوع</h3>
            <div className="space-y-3">
              {Object.keys(documentsByType).length === 0 ? (
                <div className={`text-center py-4 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>لا توجد بيانات</div>
              ) : (
                Object.entries(documentsByType).map(([type, count]) => {
                  const max = Math.max(...Object.values(documentsByType))
                  const percentage = (count / max) * 100
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className={theme === 'dark' ? '' : 'text-slate-600'}>{type}</span>
                        <span className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>{count}</span>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-bg-tertiary' : 'bg-slate-100'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-cyan-400' : 'bg-gradient-to-r from-cyan-500 to-cyan-400'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* الوثائق الشهرية */}
        <div className={`relative overflow-hidden rounded-xl border-2 ${theme === 'light' ? 'bg-white border-slate-200 shadow-lg' : 'card'}`}>
          {/* خط علوي ملون */}
          {theme === 'light' && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-cyan-500 to-teal-500"></div>
          )}
          <div className="relative p-5">
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>الوثائق خلال الأشهر الأخيرة</h3>
            {monthlyData.length === 0 ? (
              <div className={`text-center py-4 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>لا توجد بيانات</div>
            ) : (
              <div className="h-32">
                <SimpleChart data={monthlyData} height={120} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
