import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

type Stats = {
  total_documents: number
  this_month_documents: number
  average_ocr_accuracy: number
  classification_counts: Record<string, number>
  direction_counts: Record<string, number>
  recent_documents: Array<{
    id: number
    document_number: string
    title: string
    classification?: string
    created_at?: string
  }>
  total_users?: number
}

function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await api.get('/documents/stats', {
          timeout: 60000 // 60 ثانية
        })
        setStats(res.data)
      } catch (e: any) {
        console.error('Failed to load stats:', e)
        console.error('Error details:', {
          message: e.message,
          code: e.code,
          status: e.response?.status,
          statusText: e.response?.statusText,
          data: e.response?.data
        })
        // في حالة الخطأ، نعرض بيانات افتراضية بدلاً من null
        setStats({
          total_documents: 0,
          this_month_documents: 0,
          average_ocr_accuracy: 0,
          classification_counts: {
            'شهادة': 0,
            'تقرير': 0,
            'كتاب رسمي': 0,
            'نموذج': 0,
            'أخرى': 0
          },
          direction_counts: {'صادر': 0, 'وارد': 0},
          recent_documents: [],
          total_users: undefined,
        } as Stats)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ar-IQ', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const viewDocument = (docId: number) => {
    navigate(`/documents?id=${docId}`)
  }

  return (
    <div className="space-y-6">
      {/* ترحيب */}
      <div className="card">
        <h1 className="text-3xl font-bold text-cyan-400 mb-2">مرحباً بك في نظام أرشفة وتحليل البيانات</h1>
        <p className="text-text-secondary">مركز الاستشارات والتنمية - رفع، تحليل، وإدارة الوثائق بكل سهولة</p>
      </div>

      {/* إحصائيات سريعة - رؤوس الأقلام */}
      {stats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي الوثائق */}
          <div className="card relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-secondary font-medium">إجمالي الوثائق</div>
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-cyan-400 mb-1">{(stats.total_documents || 0).toLocaleString('ar')}</div>
              <div className="text-xs text-text-secondary">وثيقة في النظام</div>
            </div>
          </div>

          {/* وثائق هذا الشهر */}
          <div className="card relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-secondary font-medium">هذا الشهر</div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-400 mb-1">{(stats.this_month_documents || 0).toLocaleString('ar')}</div>
              <div className="text-xs text-text-secondary">وثيقة جديدة</div>
            </div>
          </div>

          {/* متوسط دقة OCR */}
          <div className="card relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/20 to-transparent rounded-full blur-2xl"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-text-secondary font-medium">متوسط دقة OCR</div>
                <div className="w-10 h-10 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-green-400 mb-1">{(stats.average_ocr_accuracy || 0)}%</div>
              <div className="text-xs text-text-secondary">مستوى الدقة</div>
            </div>
          </div>

          {/* إجمالي المستخدمين (للمدير فقط) */}
          {stats.total_users !== undefined && stats.total_users !== null ? (
            <div className="card relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-text-secondary font-medium">إجمالي المستخدمين</div>
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-purple-400 mb-1">{(stats.total_users || 0).toLocaleString('ar')}</div>
                <div className="text-xs text-text-secondary">مستخدم نشط</div>
              </div>
            </div>
          ) : (
            <div className="card relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/20 to-transparent rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-text-secondary font-medium">وثائق صادرة</div>
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-bold text-teal-400 mb-1">{((stats.direction_counts && stats.direction_counts['صادر']) || 0).toLocaleString('ar')}</div>
                <div className="text-xs text-text-secondary">وثيقة صادرة</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* معلومات إضافية */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* التصنيفات */}
          <div className="card">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">التصنيفات</h3>
            <div className="space-y-3">
              {stats.classification_counts && Object.entries(stats.classification_counts).map(([classification, count]) => (
                <div key={classification} className="flex items-center justify-between p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)]">
                  <span className="text-text-secondary text-sm">{classification || 'غير محدد'}</span>
                  <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 font-semibold text-sm">
                    {(count || 0).toLocaleString('ar')}
                  </span>
                </div>
              ))}
        </div>
      </div>

          {/* آخر الوثائق */}
      <div className="card">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">آخر الوثائق</h3>
            <div className="space-y-2">
              {loading ? (
                <div className="text-center py-8 text-text-secondary text-sm">جارٍ التحميل...</div>
              ) : !stats.recent_documents || stats.recent_documents.length === 0 ? (
                <div className="text-center py-8 text-text-secondary text-sm">لا توجد وثائق بعد</div>
              ) : (
                stats.recent_documents.map((doc, index) => {
                  const displayTitle = doc.title && doc.title.trim() !== '' && doc.title !== 'بدون عنوان' 
                    ? doc.title 
                    : 'بدون عنوان'
                  const hasValidClassification = doc.classification && 
                    doc.classification.trim() !== '' && 
                    doc.classification !== 'other' && 
                    doc.classification !== 'أخرى'
                  
                  return (
                    <div
                      key={doc.id || index}
                      onClick={() => viewDocument(doc.id)}
                      className="flex items-start gap-3 p-3 rounded-lg bg-base-900/50 border border-[rgba(0,188,212,0.1)] hover:border-cyan-500/30 hover:bg-base-900 transition-all group cursor-pointer"
                    >
                      <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-text-secondary group-hover:text-cyan-400 transition-colors mt-0.5">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium mb-2 line-clamp-2 group-hover:text-cyan-300 ${
                          displayTitle === 'بدون عنوان' 
                            ? 'text-text-secondary italic' 
                            : 'text-white'
                        }`}>
                          {displayTitle}
                        </div>
                        {hasValidClassification && (
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-xs border border-cyan-500/20 whitespace-nowrap">
                              {doc.classification}
                            </span>
                          </div>
                        )}
                        {doc.document_number && (
                          <div className="text-xs font-mono text-text-secondary/80">
                            {doc.document_number}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* روابط سريعة */}
      <div className="grid md:grid-cols-4 gap-4">
        <Link 
          to="/upload" 
          className="card hover:shadow-cyan hover:border-cyan-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-full blur-2xl group-hover:from-cyan-500/30"></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 border-2 border-cyan-400 rounded-lg border-t-transparent border-r-transparent rotate-45 group-hover:border-cyan-300"></div>
              </div>
            </div>
            <div className="text-center font-bold text-lg group-hover:text-cyan-400 transition-colors">رفع وثيقة جديدة</div>
            <div className="text-center text-sm text-text-secondary mt-1">ارفع وثائقك بسهولة</div>
          </div>
        </Link>
        <Link 
          to="/documents" 
          className="card hover:shadow-blue-500/20 hover:border-blue-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-2xl group-hover:from-blue-500/30"></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 border-2 border-blue-400 rounded group-hover:border-blue-300"></div>
              </div>
            </div>
            <div className="text-center font-bold text-lg group-hover:text-blue-400 transition-colors">عرض الوثائق</div>
            <div className="text-center text-sm text-text-secondary mt-1">تصفح جميع وثائقك</div>
          </div>
        </Link>
        <Link 
          to="/search" 
          className="card hover:shadow-purple-500/20 hover:border-purple-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-2xl group-hover:from-purple-500/30"></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-400/10 border border-purple-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 border-2 border-purple-400 rounded-full group-hover:border-purple-300"></div>
              </div>
            </div>
            <div className="text-center font-bold text-lg group-hover:text-purple-400 transition-colors">بحث متقدم</div>
            <div className="text-center text-sm text-text-secondary mt-1">ابحث في الوثائق بذكاء</div>
          </div>
        </Link>
        <Link 
          to="/analyze" 
          className="card hover:shadow-green-500/20 hover:border-green-500/30 transition-all group relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-500/20 to-transparent rounded-full blur-2xl group-hover:from-green-500/30"></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-400/10 border border-green-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <div className="w-6 h-6 border-2 border-green-400 transform rotate-45 group-hover:border-green-300"></div>
              </div>
            </div>
            <div className="text-center font-bold text-lg group-hover:text-green-400 transition-colors">التحليل</div>
            <div className="text-center text-sm text-text-secondary mt-1">تحليل البيانات والإحصائيات</div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default Home

