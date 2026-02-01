import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'

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

  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  }

  return (
    <div
      className={`card border transition-all duration-500 hover:scale-105 hover:shadow-lg ${colorClasses[color]} ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${trend.positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {Icons.trending}
            <span>{trend.positive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      <div className="text-text-secondary text-sm mb-1">{title}</div>
      <div className={`text-3xl font-bold ${color === 'cyan' ? 'text-cyan-400' : color === 'green' ? 'text-green-400' : color === 'purple' ? 'text-purple-400' : color === 'orange' ? 'text-orange-400' : 'text-blue-400'}`}>
        {loading ? (
          <div className="h-9 w-16 bg-bg-tertiary rounded animate-pulse"></div>
        ) : (
          typeof value === 'number' ? displayValue.toLocaleString('ar-SA') : value
        )}
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
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  const content = (
    <div className={`flex items-start justify-between mb-4`}>
      <div className={`w-14 h-14 rounded-xl ${disabled ? 'bg-gray-500/10' : 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/10'} flex items-center justify-center text-cyan-400`}>
        {icon}
      </div>
      {!disabled && (
        <div className="text-cyan-400 opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-x-1">
          {Icons.arrow}
        </div>
      )}
    </div>
  )

  if (disabled) {
    return (
      <div
        className={`card opacity-50 cursor-not-allowed transition-all duration-500 ${animated ? 'opacity-50 translate-y-0' : 'opacity-0 translate-y-4'}`}
        style={{ transitionDelay: `${delay}ms` }}
      >
        {content}
        <div className="text-text-secondary text-sm mb-2">{title}</div>
        <div className="text-xl font-semibold">{subtitle}</div>
        <p className="text-text-secondary text-sm mt-2">{description}</p>
        <div className="mt-3 inline-block px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
          قريباً
        </div>
      </div>
    )
  }

  return (
    <Link
      to={to}
      className={`card block hover:shadow-cyan hover:border-cyan-500/30 transition-all duration-500 group hover:scale-[1.02] ${animated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {content}
      <div className="text-text-secondary text-sm mb-2">{title}</div>
      <div className="text-xl font-semibold group-hover:text-cyan-400 transition-colors">
        {subtitle}
      </div>
      <p className="text-text-secondary text-sm mt-2">{description}</p>
    </Link>
  )
}

// مكون المستخدمين المتصلين
function OnlineUsers({ users }: { users: any[] }) {
  return (
    <div className="space-y-3">
      {users.length === 0 ? (
        <div className="text-text-secondary text-center py-4">لا يوجد مستخدمين متصلين</div>
      ) : (
        users.slice(0, 5).map((user, index) => (
          <div
            key={user.id || index}
            className="flex items-center gap-3 p-3 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-bold">
                {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-bg-secondary animate-pulse"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{user.full_name || user.username}</div>
              <div className="text-text-secondary text-xs">
                {user.role === 'system_admin' ? 'مدير النظام' : 'موظف'}
              </div>
            </div>
            <div className="text-green-400 text-xs">متصل</div>
          </div>
        ))
      )}
      {users.length > 5 && (
        <div className="text-center text-text-secondary text-sm">
          +{users.length - 5} مستخدمين آخرين
        </div>
      )}
    </div>
  )
}

// مكون النشاط الأخير
function RecentActivity({ activities }: { activities: any[] }) {
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
        <div className="text-text-secondary text-center py-4">لا يوجد نشاط حديث</div>
      ) : (
        activities.slice(0, 5).map((activity, index) => (
          <div
            key={activity.id || index}
            className="flex items-start gap-3 p-3 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition-colors"
          >
            <div className={`w-2 h-2 rounded-full mt-2 ${getActionColor(activity.action)}`}></div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${getActionTextColor(activity.action)}`}>
                {translateAction(activity.action, activity.details)}
              </div>
              <div className="text-text-secondary text-xs mt-1">
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
      <div className="card bg-gradient-to-r from-bg-secondary to-bg-tertiary border border-cyan-500/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-300 bg-clip-text text-transparent mb-2">
              لوحة التحكم
            </h1>
            <p className="text-text-secondary">
              مرحباً بك في لوحة إدارة النظام
              {lastUpdate && (
                <span className="text-text-secondary/70 mr-2">
                  • آخر تحديث: {lastUpdate.toLocaleTimeString('ar-SA')}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg transition-all ${refreshing ? 'opacity-50' : ''}`}
          >
            <span className={refreshing ? 'animate-spin' : ''}>{Icons.refresh}</span>
            تحديث
          </button>
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
          icon={<span className="text-green-400">{Icons.online}</span>}
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
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cyan-400">المستخدمون المتصلون</h3>
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {stats.onlineUsers} متصل
            </div>
          </div>
          <OnlineUsers users={onlineUsersList} />
        </div>

        {/* النشاط الأخير */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cyan-400">النشاط الأخير</h3>
            <Link to="/admin/activity" className="text-cyan-400 text-sm hover:underline">
              عرض الكل ←
            </Link>
          </div>
          <RecentActivity activities={recentActivities} />
        </div>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* الوثائق حسب النوع */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4">الوثائق حسب النوع</h3>
          <div className="space-y-3">
            {Object.keys(documentsByType).length === 0 ? (
              <div className="text-text-secondary text-center py-4">لا توجد بيانات</div>
            ) : (
              Object.entries(documentsByType).map(([type, count]) => {
                const max = Math.max(...Object.values(documentsByType))
                const percentage = (count / max) * 100
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{type}</span>
                      <span className="text-cyan-400">{count}</span>
                    </div>
                    <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-1000"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* الوثائق الشهرية */}
        <div className="card">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4">الوثائق خلال الأشهر الأخيرة</h3>
          {monthlyData.length === 0 ? (
            <div className="text-text-secondary text-center py-4">لا توجد بيانات</div>
          ) : (
            <div className="h-32">
              <SimpleChart data={monthlyData} height={120} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
