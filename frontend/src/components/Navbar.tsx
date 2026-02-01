import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // يجب استدعاء جميع الـ hooks قبل أي return مشروط
  const [canManageUsers, setCanManageUsers] = useState(false)
  const [canViewReports, setCanViewReports] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ username: string; full_name?: string } | null>(null)
  
  useEffect(() => {
    // لا نفعل شيء في صفحة login أو change-password
    if (location.pathname === '/login' || location.pathname === '/change-password') {
      return () => {} // يجب أن نُرجع cleanup function دائماً
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
        api.post('/auth/ping').catch(() => {})
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
      api.post('/auth/ping').catch(() => {})
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
    `px-3 py-2 rounded-xl ${isActive ? 'bg-base-800 text-cyan-400' : 'text-text-secondary hover:text-cyan-400'}`

  return (
    <header className="border-b border-[rgba(0,188,212,0.12)] bg-base-900/70 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-cyan-400 font-semibold text-lg">
          <img src="/Image/icon.png" alt="شعار المركز" className="w-8 h-8 rounded object-contain" />
          <span>مركز الاستشارات والتنمية</span>
        </Link>
        <nav className="flex items-center gap-2">
          {loading ? (
            <div className="px-4 py-2 text-text-secondary text-sm">جارٍ التحميل...</div>
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
          {currentUser && (
            <div className="text-sm">
              <span className="text-text-secondary">مرحباً، </span>
              <span className="text-cyan-400 font-semibold">
                {currentUser.full_name || currentUser.username}
              </span>
            </div>
          )}
          <button onClick={logout} className="btn-primary">
            تسجيل الخروج
          </button>
        </div>
      </div>
    </header>
  )
}

export default Navbar


