import { Navigate, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

function AdminRoute() {
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const controller = new AbortController()
        const t = setTimeout(() => controller.abort(), 5000)
        const res = await api.get('/auth/me', { signal: controller.signal })
        if (!cancelled) setOk(Boolean(res.data?.permissions?.manage_users))
        clearTimeout(t)
      } catch (e: any) {
        const status = e?.response?.status
        if (!cancelled) setOk(status !== 401) // مهلة/شبكة: اسمح بالعبور المؤقت
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
    </div>
  )
  if (!ok) return <Navigate to="/" replace />
  return <Outlet />
}

export default AdminRoute


