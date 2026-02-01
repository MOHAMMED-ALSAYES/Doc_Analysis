import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function Protected() {
  const token = localStorage.getItem('token')
  const location = useLocation()
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    if (!token) {
      setReady(true)
      setOk(false)
      return
    }
    let cancelled = false
    let pingInterval: NodeJS.Timeout
    
    ;(async () => {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 5000)
        await api.get('/auth/me', { signal: controller.signal })
        if (!cancelled) {
          setOk(true)
          // إرسال ping فوراً بعد التحقق من المستخدم
          api.post('/auth/ping').catch(() => {})
        }
        clearTimeout(t)
      } catch (e: any) {
        const status = e?.response?.status
        if (status === 401) {
          localStorage.removeItem('token')
          if (!cancelled) setOk(false)
        } else {
          // خطأ مؤقت (مهلة/شبكة) لا نطرد المستخدم
          if (!cancelled) setOk(Boolean(token))
        }
      } finally {
        // small defer to smooth UX
        if (!cancelled) setReady(true)
      }
    })()
    
    // إرسال ping كل 20 ثانية (أقل من TTL البالغ 120 ثانية)
    pingInterval = setInterval(() => { 
      api.post('/auth/ping').catch(() => {})
    }, 20000)
    
    return () => { 
      cancelled = true
      if (pingInterval) clearInterval(pingInterval)
    }
  }, [token])

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
    </div>
  )
  if (!ok) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export default Protected



