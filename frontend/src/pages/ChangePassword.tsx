import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useNavigate } from 'react-router-dom'

function ChangePassword() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // إرسال ping للحفاظ على حالة الاتصال
  useEffect(() => {
    // إرسال ping فوراً
    api.post('/auth/ping').catch(() => {})
    
    // إرسال ping كل 30 ثانية
    const pingInterval = setInterval(() => {
      api.post('/auth/ping').catch(() => {})
    }, 30000)
    
    return () => clearInterval(pingInterval)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // التحقق من المدخلات
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('جميع الحقول مطلوبة')
      return
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      
      // نجح التغيير - انتقل للصفحة الرئيسية
      alert('تم تغيير كلمة المرور بنجاح!')
      
      // التحقق من نوع المستخدم للتوجيه الصحيح
      try {
        const meRes = await api.get('/auth/me')
        const isAdmin = Boolean(meRes.data?.permissions?.manage_users)
        navigate(isAdmin ? '/admin' : '/', { replace: true })
      } catch {
        navigate('/', { replace: true })
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'فشل تغيير كلمة المرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-base-900">
      <div className="w-full max-w-md">
        <div className="card">
          {/* أيقونة تحذير */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center text-3xl">
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center mb-2 text-cyan-400">
            تغيير كلمة المرور
          </h1>
          <p className="text-center text-text-secondary mb-6">
            يجب عليك تغيير كلمة المرور المؤقتة قبل المتابعة
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                كلمة المرور الحالية
              </label>
              <input
                type="password"
                className="w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
                placeholder="أدخل كلمة المرور المؤقتة"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                className="w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
                placeholder="6 أحرف على الأقل"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">
                تأكيد كلمة المرور الجديدة
              </label>
              <input
                type="password"
                className="w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
                placeholder="أعد إدخال كلمة المرور الجديدة"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'جارٍ التغيير...' : 'تغيير كلمة المرور'}
            </button>
          </form>

          <div className="mt-4 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
            <p className="text-xs text-text-secondary text-center">
              نصيحة: استخدم كلمة مرور قوية تحتوي على أحرف وأرقام
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChangePassword

