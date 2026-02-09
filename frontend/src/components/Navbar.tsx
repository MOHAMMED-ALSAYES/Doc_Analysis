import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

// أيقونات SVG للشمس والقمر
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
  </svg>
)

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()

  // يجب استدعاء جميع الـ hooks قبل أي return مشروط
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [canViewReports, setCanViewReports] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null)

  useEffect(() => {
    // لا نفعل شيء في صفحة login أو change-password
    if (location.pathname === '/login' || location.pathname === '/change-password') {
      return () => { } // يجب أن نُرجع cleanup function دائماً
    }

    const checkPermissions = async () => {
      try {
        const res = await api.get('/auth/me')
        const roleFromApi = res?.data?.role
        const roleName = typeof roleFromApi === 'string' ? roleFromApi : (roleFromApi?.name || res?.data?.role_name)
        const isAdmin = roleName === 'system_admin' || res?.data?.is_admin === true
        let permissions: any = res?.data?.permissions
        // permissions may come as JSON string or array
        if (typeof permissions === 'string') {
          try { permissions = JSON.parse(permissions) } catch { /* ignore */ }
        }
        const canManage = Array.isArray(permissions)
          ? permissions.includes('manage_users')
          : Boolean(permissions?.manage_users)
        setCanManageUsers(Boolean(canManage))
        const canReports = Array.isArray(permissions)
          ? (permissions.includes('view_reports') || permissions.includes('create_reports'))
          : Boolean(permissions?.view_reports || permissions?.create_reports || res?.data?.can_view_reports)
        setCanViewReports(isAdmin || canReports)
        setCurrentUser({
          username: res.data?.username,
          full_name: res.data?.full_name,
        })
        // تحديث حالة الاتصال
        api.post('/auth/ping').catch(() => { })
      } catch {
        setCanManageUsers(false)
        setCanViewReports(false)
        setCurrentUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkPermissions()

    // تحديث حالة الاتصال كل 20 ثانية
    const pingInterval = setInterval(() => {
      api.post('/auth/ping').catch(() => { })
    }, 20000)

    return () => {
      clearInterval(pingInterval)
    }
  }, [location.pathname])

  // Hide navbar on login and change-password pages
  if (location.pathname === '/login' || location.pathname === '/change-password') return null

  const logout = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-xl transition-all duration-200 ${theme === 'dark'
      ? (isActive ? 'bg-theme-card text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--accent-primary)]')
      : (isActive ? 'bg-white/25 text-white font-bold' : 'text-white hover:bg-white/15')
    }`

  return (
    <header className="navbar-theme">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className={`flex items-center gap-2 font-semibold text-lg ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>
          <img src="/Image/icon.png" alt="شعار المركز" className="w-8 h-8 rounded object-contain" />
          <span>مركز الاستشارات والتنمية</span>
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? (
            <div className={`px-4 py-2 text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-white/70'}`}>جارٍ التحميل...</div>
          ) : (
            <>
              {!canManageUsers && <>
                <NavLink to="/" className={linkClass}>الرئيسية</NavLink>
                <NavLink to="/upload" className={linkClass}>رفع وثيقة</NavLink>
                <NavLink to="/documents" className={linkClass}>عرض الوثائق</NavLink>
                <NavLink to="/search" className={linkClass}>بحث متقدم</NavLink>
                <NavLink to="/analyze" className={linkClass}>التحليل</NavLink>
                {canViewReports && <NavLink to="/reports" className={linkClass}>التقارير</NavLink>}
              </>}
              {canManageUsers && <>
                <NavLink to="/admin" className={linkClass}>لوحة المدير</NavLink>
                <NavLink to="/admin/users" className={linkClass}>إدارة المستخدمين</NavLink>
                <NavLink to="/admin/activity" className={linkClass}>سجل النشاط</NavLink>
                <NavLink to="/admin/reports" className={linkClass}>التقارير</NavLink>
              </>}
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {/* زر تبديل الوضع */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-xl transition-all duration-300 ${theme === 'dark' ? 'theme-toggle' : 'bg-white/20 text-white hover:bg-white/30'}`}
            title={theme === 'dark' ? 'تبديل للوضع الفاتح' : 'تبديل للوضع الداكن'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {currentUser && (
            <div className="text-sm">
              <span className={theme === 'dark' ? 'text-text-secondary' : 'text-white'}>مرحباً، </span>
              <span className={`font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>
                {currentUser.full_name || currentUser.username}
              </span>
            </div>
          )}
          <button onClick={logout} className={`px-4 py-2 rounded-xl transition-all ${theme === 'dark' ? 'btn-primary' : 'bg-white text-cyan-600 hover:bg-white/90 font-semibold'}`}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar


