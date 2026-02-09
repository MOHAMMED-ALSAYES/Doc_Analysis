import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

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
  const { theme } = useTheme()
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
          direction_counts: { 'صادر': 0, 'وارد': 0 },
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
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>مرحباً بك في نظام أرشفة وتحليل البيانات</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>مركز الاستشارات والتنمية - رفع، تحليل، وإدارة الوثائق بكل سهولة</p>
      </div>

      {/* إحصائيات سريعة - رؤوس الأقلام */}
      {stats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* إجمالي الوثائق */}
          <div className={`rounded-xl p-5 relative overflow-hidden group border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg hover:shadow-xl hover:border-cyan-400'}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-cyan-500/20 to-transparent' : 'bg-gradient-to-bl from-cyan-300/30 to-transparent'}`}></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>إجمالي الوثائق</div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-cyan-500/20 border border-cyan-500/30' : 'bg-cyan-100 border border-cyan-300'}`}>
                  <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{(stats.total_documents || 0).toLocaleString('ar')}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثيقة في النظام</div>
            </div>
          </div>

          {/* وثائق هذا الشهر */}
          <div className={`rounded-xl p-5 relative overflow-hidden group border-2 ${theme === 'dark' ? 'card' : 'bg-white border-blue-200 shadow-lg hover:shadow-xl hover:border-blue-400'}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-blue-500/20 to-transparent' : 'bg-gradient-to-bl from-blue-300/30 to-transparent'}`}></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>هذا الشهر</div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-100 border border-blue-300'}`}>
                  <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>{(stats.this_month_documents || 0).toLocaleString('ar')}</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثيقة جديدة</div>
            </div>
          </div>

          {/* متوسط دقة OCR */}
          <div className={`rounded-xl p-5 relative overflow-hidden group border-2 ${theme === 'dark' ? 'card' : 'bg-white border-green-200 shadow-lg hover:shadow-xl hover:border-green-400'}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-green-500/20 to-transparent' : 'bg-gradient-to-bl from-green-300/30 to-transparent'}`}></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <div className={`text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>متوسط دقة OCR</div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-100 border border-green-300'}`}>
                  <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>{(stats.average_ocr_accuracy || 0)}%</div>
              <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>مستوى الدقة</div>
            </div>
          </div>

          {/* إجمالي المستخدمين (للمدير فقط) */}
          {stats.total_users !== undefined && stats.total_users !== null ? (
            <div className={`rounded-xl p-5 relative overflow-hidden group border-2 ${theme === 'dark' ? 'card' : 'bg-white border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-400'}`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-purple-500/20 to-transparent' : 'bg-gradient-to-bl from-purple-300/30 to-transparent'}`}></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>إجمالي المستخدمين</div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-purple-100 border border-purple-300'}`}>
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>{(stats.total_users || 0).toLocaleString('ar')}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>مستخدم نشط</div>
              </div>
            </div>
          ) : (
            <div className={`rounded-xl p-5 relative overflow-hidden group border-2 ${theme === 'dark' ? 'card' : 'bg-white border-teal-200 shadow-lg hover:shadow-xl hover:border-teal-400'}`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-teal-500/20 to-transparent' : 'bg-gradient-to-bl from-teal-300/30 to-transparent'}`}></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-xs font-medium ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثائق صادرة</div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'bg-teal-500/20 border border-teal-500/30' : 'bg-teal-100 border border-teal-300'}`}>
                    <svg className={`w-5 h-5 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`}>{((stats.direction_counts && stats.direction_counts['صادر']) || 0).toLocaleString('ar')}</div>
                <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثيقة صادرة</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* معلومات إضافية */}
      {stats && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* التصنيفات */}
          <div className={`rounded-xl p-5 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>التصنيفات</h3>
            <div className="space-y-3">
              {stats.classification_counts && Object.entries(stats.classification_counts).map(([classification, count]) => (
                <div key={classification} className={`flex items-center justify-between p-3 rounded-lg border ${theme === 'dark' ? 'bg-base-900/50 border-[rgba(0,188,212,0.1)]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{classification || 'غير محدد'}</span>
                  <span className={`px-3 py-1 rounded-lg font-semibold text-sm ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>
                    {(count || 0).toLocaleString('ar')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* آخر الوثائق */}
          <div className={`rounded-xl p-5 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>آخر الوثائق</h3>
            <div className="space-y-2">
              {loading ? (
                <div className={`text-center py-8 text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>جارٍ التحميل...</div>
              ) : !stats.recent_documents || stats.recent_documents.length === 0 ? (
                <div className={`text-center py-8 text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>لا توجد وثائق بعد</div>
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
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all group cursor-pointer ${theme === 'dark' ? 'bg-base-900/50 border-[rgba(0,188,212,0.1)] hover:border-cyan-500/30 hover:bg-base-900' : 'bg-slate-50 border-slate-200 hover:border-cyan-400 hover:bg-cyan-50'}`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 flex items-center justify-center transition-colors mt-0.5 ${theme === 'dark' ? 'text-text-secondary group-hover:text-cyan-400' : 'text-slate-400 group-hover:text-cyan-500'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium mb-2 line-clamp-2 ${displayTitle === 'بدون عنوان'
                          ? (theme === 'dark' ? 'text-text-secondary italic' : 'text-slate-400 italic')
                          : (theme === 'dark' ? 'text-white group-hover:text-cyan-300' : 'text-slate-700 group-hover:text-cyan-600')
                          }`}>
                          {displayTitle}
                        </div>
                        {hasValidClassification && (
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`px-2 py-0.5 rounded text-xs border whitespace-nowrap ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-cyan-100 text-cyan-600 border-cyan-300'}`}>
                              {doc.classification}
                            </span>
                          </div>
                        )}
                        {doc.document_number && (
                          <div className={`text-xs font-mono ${theme === 'dark' ? 'text-text-secondary/80' : 'text-slate-500'}`}>
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
          className={`rounded-xl p-5 border-2 transition-all group relative overflow-hidden ${theme === 'dark' ? 'card hover:shadow-cyan hover:border-cyan-500/30' : 'bg-white border-cyan-200 shadow-lg hover:shadow-xl hover:border-cyan-400'}`}
        >
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-cyan-500/20 to-transparent group-hover:from-cyan-500/30' : 'bg-gradient-to-bl from-cyan-300/30 to-transparent group-hover:from-cyan-400/40'}`}></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/30' : 'bg-cyan-100 border border-cyan-300'}`}>
                <div className={`w-6 h-6 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${theme === 'dark' ? 'border-cyan-400 group-hover:border-cyan-300' : 'border-cyan-500 group-hover:border-cyan-600'}`}></div>
              </div>
            </div>
            <div className={`text-center font-bold text-lg transition-colors ${theme === 'dark' ? 'group-hover:text-cyan-400' : 'text-slate-700 group-hover:text-cyan-600'}`}>رفع وثيقة جديدة</div>
            <div className={`text-center text-sm mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>ارفع وثائقك بسهولة</div>
          </div>
        </Link>
        <Link
          to="/documents"
          className={`rounded-xl p-5 border-2 transition-all group relative overflow-hidden ${theme === 'dark' ? 'card hover:shadow-blue-500/20 hover:border-blue-500/30' : 'bg-white border-blue-200 shadow-lg hover:shadow-xl hover:border-blue-400'}`}
        >
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-blue-500/20 to-transparent group-hover:from-blue-500/30' : 'bg-gradient-to-bl from-blue-300/30 to-transparent group-hover:from-blue-400/40'}`}></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-500/30' : 'bg-blue-100 border border-blue-300'}`}>
                <div className={`w-6 h-6 border-2 rounded ${theme === 'dark' ? 'border-blue-400 group-hover:border-blue-300' : 'border-blue-500 group-hover:border-blue-600'}`}></div>
              </div>
            </div>
            <div className={`text-center font-bold text-lg transition-colors ${theme === 'dark' ? 'group-hover:text-blue-400' : 'text-slate-700 group-hover:text-blue-600'}`}>عرض الوثائق</div>
            <div className={`text-center text-sm mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>تصفح جميع وثائقك</div>
          </div>
        </Link>
        <Link
          to="/search"
          className={`rounded-xl p-5 border-2 transition-all group relative overflow-hidden ${theme === 'dark' ? 'card hover:shadow-purple-500/20 hover:border-purple-500/30' : 'bg-white border-purple-200 shadow-lg hover:shadow-xl hover:border-purple-400'}`}
        >
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-purple-500/20 to-transparent group-hover:from-purple-500/30' : 'bg-gradient-to-bl from-purple-300/30 to-transparent group-hover:from-purple-400/40'}`}></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-gradient-to-br from-purple-500/20 to-purple-400/10 border border-purple-500/30' : 'bg-purple-100 border border-purple-300'}`}>
                <div className={`w-6 h-6 border-2 rounded-full ${theme === 'dark' ? 'border-purple-400 group-hover:border-purple-300' : 'border-purple-500 group-hover:border-purple-600'}`}></div>
              </div>
            </div>
            <div className={`text-center font-bold text-lg transition-colors ${theme === 'dark' ? 'group-hover:text-purple-400' : 'text-slate-700 group-hover:text-purple-600'}`}>بحث متقدم</div>
            <div className={`text-center text-sm mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>ابحث في الوثائق بذكاء</div>
          </div>
        </Link>
        <Link
          to="/analyze"
          className={`rounded-xl p-5 border-2 transition-all group relative overflow-hidden ${theme === 'dark' ? 'card hover:shadow-green-500/20 hover:border-green-500/30' : 'bg-white border-green-200 shadow-lg hover:shadow-xl hover:border-green-400'}`}
        >
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl ${theme === 'dark' ? 'bg-gradient-to-bl from-green-500/20 to-transparent group-hover:from-green-500/30' : 'bg-gradient-to-bl from-green-300/30 to-transparent group-hover:from-green-400/40'}`}></div>
          <div className="relative z-10">
            <div className="mb-4 h-16 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${theme === 'dark' ? 'bg-gradient-to-br from-green-500/20 to-green-400/10 border border-green-500/30' : 'bg-green-100 border border-green-300'}`}>
                <div className={`w-6 h-6 border-2 transform rotate-45 ${theme === 'dark' ? 'border-green-400 group-hover:border-green-300' : 'border-green-500 group-hover:border-green-600'}`}></div>
              </div>
            </div>
            <div className={`text-center font-bold text-lg transition-colors ${theme === 'dark' ? 'group-hover:text-green-400' : 'text-slate-700 group-hover:text-green-600'}`}>التحليل</div>
            <div className={`text-center text-sm mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>تحليل البيانات والإحصائيات</div>
          </div>
        </Link>
      </div>
    </div>
  )
}

export default Home

