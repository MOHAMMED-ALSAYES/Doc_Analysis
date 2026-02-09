import { useState } from 'react'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'

function Login() {
  const { theme } = useTheme()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { username, password })
      const token = res.data.access_token
      const mustChangePassword = res.data.must_change_password
      localStorage.setItem('token', token)

      // إذا كان يجب تغيير كلمة المرور، انتقل لصفحة التغيير
      if (mustChangePassword) {
        navigate('/change-password', { replace: true })
        return
      }

      // التحقق من نوع المستخدم أولاً قبل التوجيه
      try {
        const meRes = await api.get('/auth/me')
        const isAdmin = Boolean(meRes.data?.permissions?.manage_users)

        // توجيه حسب نوع المستخدم
        if (isAdmin) {
          navigate('/admin', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } catch (meErr: any) {
        // في حالة فشل التحقق، نذهب للصفحة الرئيسية
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'فشل تسجيل الدخول')
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* خلفية متدرجة مع تأثيرات */}
      {theme === 'dark' ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-base-950 via-base-900 to-base-950"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute inset-0 opacity-5" style={{
            backgroundImage: 'linear-gradient(rgba(0,188,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,188,212,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>
        </>
      ) : (
        <>
          {/* خلفية متدرجة للوضع الفاتح */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-cyan-100"></div>

          {/* تأثيرات دائرية متحركة - الوضع الفاتح */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-gradient-to-br from-cyan-300/40 to-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-300/40 to-blue-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-purple-200/30 to-indigo-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }}></div>
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-gradient-to-br from-teal-200/25 to-emerald-200/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s', animationDuration: '4.5s' }}></div>

          {/* خطوط شبكية - الوضع الفاتح */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'linear-gradient(rgba(14,116,144,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(14,116,144,0.4) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }}></div>

          {/* طبقة توهج إضافية */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-200/20 via-transparent to-blue-200/20 pointer-events-none"></div>
        </>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* شعار البرنامج */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            {/* تأثير متوهج - خلف الشعار */}
            <div className={`absolute -inset-1 rounded-2xl blur animate-pulse -z-10 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-blue-500 opacity-30' : 'bg-gradient-to-r from-cyan-400 to-blue-400 opacity-40'}`}></div>
            {/* الشعار */}
            <div className={`relative z-10 w-28 h-28 rounded-2xl ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/20' : 'bg-white border-2 border-cyan-300/50 shadow-2xl shadow-cyan-300/30'} flex items-center justify-center backdrop-blur-sm overflow-hidden`}>
              <img
                src="/Image/icon.png"
                alt="شعار مركز الاستشارات والتنمية"
                className="w-24 h-24 rounded-xl object-contain"
              />
            </div>
          </div>
          <h1 className={`text-3xl font-bold mt-6 mb-2 ${theme === 'dark' ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400' : 'text-cyan-700'}`}>
            نظام أرشفة وتحليل البيانات
          </h1>
          <p className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>مركز الاستشارات والتنمية</p>
        </div>

        {/* بطاقة تسجيل الدخول */}
        <div className={`card relative backdrop-blur-xl ${theme === 'dark' ? 'bg-base-800/80 border-2 border-cyan-500/20 shadow-2xl shadow-cyan-500/10' : 'bg-white/95 border-2 border-cyan-200/50 shadow-2xl shadow-cyan-200/40'}`}>
          <div className={`absolute -inset-0.5 rounded-xl blur opacity-50 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20' : 'bg-gradient-to-r from-cyan-300/30 via-blue-300/30 to-purple-300/30'}`}></div>

          <div className="relative">
            <div className="text-center mb-8">
              <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>تسجيل الدخول</h2>
              <p className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>أدخل بياناتك للوصول إلى حسابك</p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              {/* حقل اسم المستخدم */}
              <div className="space-y-2">
                <label className={`block text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>
                  اسم المستخدم
                </label>
                <div className="relative">
                  <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    className={`w-full pl-12 pr-4 py-3 rounded-xl border-2 focus:outline-none transition-all ${theme === 'dark' ? 'bg-base-900/50 border-[rgba(0,188,212,0.15)] focus:border-cyan-500 text-text-primary placeholder:text-text-secondary/50' : 'bg-slate-50 border-slate-200 focus:border-cyan-500 text-slate-800 placeholder:text-slate-400'}`}
                    placeholder="أدخل اسم المستخدم"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    autoComplete="username"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* حقل كلمة المرور */}
              <div className="space-y-2">
                <label className={`block text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    className={`w-full pl-12 pr-12 py-3 rounded-xl border-2 focus:outline-none transition-all ${theme === 'dark' ? 'bg-base-900/50 border-[rgba(0,188,212,0.15)] focus:border-cyan-500 text-text-primary placeholder:text-text-secondary/50' : 'bg-slate-50 border-slate-200 focus:border-cyan-500 text-slate-800 placeholder:text-slate-400'}`}
                    placeholder="أدخل كلمة المرور"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    autoComplete="current-password"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-text-secondary hover:text-cyan-400' : 'text-slate-400 hover:text-cyan-600'}`}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* رسالة خطأ */}
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 flex items-start gap-3 animate-slideDown">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-red-400 text-sm font-medium">خطأ في تسجيل الدخول</p>
                    <p className="text-red-300/80 text-xs mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* زر تسجيل الدخول */}
              <button
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>جارٍ الدخول...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>دخول</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* شاشة تحميل */}
          {loading && (
            <div className="absolute inset-0 bg-base-900/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-r-blue-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
                </div>
                <p className="text-text-secondary text-sm font-medium">يتم التحقق، انتظر قليلًا…</p>
              </div>
            </div>
          )}
        </div>

        {/* نص إضافي في الأسفل */}
        <p className={`text-center text-xs mt-6 ${theme === 'dark' ? 'text-text-secondary/60' : 'text-slate-400'}`}>
          © 2024 مركز الاستشارات والتنمية. جميع الحقوق محفوظة
        </p>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

export default Login


