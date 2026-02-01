import axios from 'axios'

// في وضع التطوير، استخدم URL مباشر للـ backend
// في وضع الإنتاج، استخدم متغير البيئة أو proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV
  ? 'http://localhost:8000'
  : '/api')

export const api = axios.create({
  baseURL: API_BASE_URL,
})

api.defaults.timeout = 30000 // زيادة المهلة إلى 30 ثانية للاستعلامات الثقيلة

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // فقط إعادة التوجيه عند 401 إذا لم نكن بالفعل في صفحة تسجيل الدخول
    if (err?.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token')
      // استخدام window.location.replace لتجنب إضافة التاريخ
      window.location.replace('/login')
    }
    return Promise.reject(err)
  }
)



