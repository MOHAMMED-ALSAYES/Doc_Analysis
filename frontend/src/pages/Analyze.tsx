import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

type AnalysisData = {
  time_analysis: {
    today: number
    this_week: number
    this_month: number
    this_year: number
    by_day: Array<{ date: string; label: string; count: number }>
    by_month: Array<{ date: string; label: string; count: number }>
  }
  ocr_analysis: {
    average: number
    distribution: {
      excellent: number
      good: number
      fair: number
      poor: number
    }
    by_classification: Record<string, number>
    trend: Array<any>
  }
  classification_analysis: {
    total_by_type: Record<string, number>
    by_direction: Record<string, number>
  }
  source_analysis: {
    by_type: Record<string, number>
    ocr_comparison: Record<string, number>
  }
}

type Recommendation = {
  type: 'improvement' | 'action' | 'info' | 'warning' | 'success'
  priority: 'high' | 'medium' | 'low'
  title: string
  message: string
  action?: string
  icon: string
}

type RecommendationsData = {
  recommendations: Recommendation[]
  warnings: Recommendation[]
  insights: Recommendation[]
}

function Analyze() {
  const { theme } = useTheme()
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'month'>('day')
  const [loadingRecommendations, setLoadingRecommendations] = useState(true)
  useEffect(() => {
    loadAnalysis()
    loadRecommendations()
  }, [])

  const loadAnalysis = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/documents/analysis', {
        timeout: 60000
      })
      setAnalysis(res.data)
    } catch (e: any) {
      console.error('Failed to load analysis:', e)
      setError('فشل تحميل بيانات التحليل')
    } finally {
      setLoading(false)
    }
  }

  const loadRecommendations = async () => {
    setLoadingRecommendations(true)
    try {
      const res = await api.get('/documents/analysis/recommendations', {
        timeout: 60000
      })
      setRecommendations(res.data)
    } catch (e: any) {
      console.error('Failed to load recommendations:', e)
    } finally {
      setLoadingRecommendations(false)
    }
  }

  const formatNumber = (num: number) => {
    return num?.toLocaleString('ar') || 0
  }

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="space-y-6">
        <div className="card">
          <p className="text-text-secondary">لا توجد بيانات للتحليل</p>
        </div>
      </div>
    )
  }
  const totalDocs = analysis.time_analysis.this_year
  const ocrDistributionTotal = Object.values(analysis.ocr_analysis.distribution).reduce((a, b) => a + b, 0)
  const classificationTotal = Object.values(analysis.classification_analysis.total_by_type).reduce((a, b) => a + b, 0)
  const sourceTotal = Object.values(analysis.source_analysis.by_type).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>تحليل الوثائق</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>
          تحليل شامل للأداء والاتجاهات والإحصائيات التفصيلية
        </p>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'اليوم', count: analysis.time_analysis.today, color: 'text-cyan-400', gradient: 'from-cyan-500/20', lightColor: 'text-cyan-600', lightGradient: 'bg-cyan-100/50' },
          { label: 'هذا الأسبوع', count: analysis.time_analysis.this_week, color: 'text-blue-400', gradient: 'from-blue-500/20', lightColor: 'text-blue-600', lightGradient: 'bg-blue-100/50' },
          { label: 'هذا الشهر', count: analysis.time_analysis.this_month, color: 'text-purple-400', gradient: 'from-purple-500/20', lightColor: 'text-purple-600', lightGradient: 'bg-purple-100/50' },
          { label: 'هذه السنة', count: analysis.time_analysis.this_year, color: 'text-emerald-400', gradient: 'from-emerald-500/20', lightColor: 'text-emerald-600', lightGradient: 'bg-emerald-100/50' }
        ].map((item, idx) => (
          <div key={idx} className={`relative overflow-hidden group ${theme === 'dark' ? 'card' : 'bg-white rounded-xl p-4 shadow-md border border-slate-100'}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl ${theme === 'dark' ? `bg-gradient-to-bl ${item.gradient} to-transparent` : item.lightGradient}`}></div>
            <div className="relative z-10">
              <div className={`text-xs font-medium mb-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{item.label}</div>
              <div className={`text-3xl font-bold mb-1 ${theme === 'dark' ? item.color : item.lightColor}`}>
                {formatNumber(item.count)}
              </div>
              <div className={`text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>وثيقة</div>
            </div>
          </div>
        ))}
      </div>

      {/* تحليل الأداء الزمني */}
      <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>الاتجاهات الزمنية</h2>
          <div className="flex gap-2">
            {[
              { id: 'day', label: 'آخر 30 يوم' },
              { id: 'month', label: 'آخر 12 شهر' }
            ].map((period) => (
              <button
                key={period.id}
                className={`px-4 py-2 rounded-xl text-sm transition ${selectedPeriod === period.id
                  ? (theme === 'dark' ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400' : 'bg-cyan-100 border border-cyan-300 text-cyan-700')
                  : (theme === 'dark' ? 'bg-base-900 border border-[rgba(0,188,212,0.12)] text-text-secondary hover:border-cyan-500/30' : 'bg-slate-50 border border-slate-200 text-slate-500 hover:border-cyan-300')
                  }`}
                onClick={() => setSelectedPeriod(period.id as any)}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {(selectedPeriod === 'day' ? analysis.time_analysis.by_day : analysis.time_analysis.by_month).map((item, idx, arr) => {
            const maxCount = Math.max(...arr.map(d => d.count), 1)
            const percentage = (item.count / maxCount) * 100
            const isDay = selectedPeriod === 'day'
            return (
              <div key={idx} className="flex items-center gap-4">
                <div className={`text-xs text-left ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'} ${isDay ? 'w-16' : 'w-24'}`}>
                  {item.label}
                </div>
                <div className="flex-1 relative">
                  <div className={`h-8 rounded-lg overflow-hidden relative ${theme === 'dark' ? 'bg-base-900 border border-[rgba(0,188,212,0.12)]' : 'bg-slate-100 border border-slate-200'}`}>
                    <div
                      className={`h-full rounded-lg transition-all duration-500 flex items-center justify-end pr-3 ${isDay
                        ? (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/60 to-cyan-400/40' : 'bg-cyan-500')
                        : (theme === 'dark' ? 'bg-gradient-to-r from-purple-500/60 to-purple-400/40' : 'bg-purple-500')
                        }`}
                      style={{ width: `${percentage}%` }}
                    >
                      {item.count > 0 && (
                        <span className="text-xs font-semibold text-white">
                          {item.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* تحليل أداء OCR */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>تحليل أداء OCR</h2>
          <div className="space-y-6">
            {/* متوسط الدقة */}
            <div className={`text-center p-6 rounded-xl border ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20' : 'bg-slate-50 border-cyan-100'}`}>
              <div className={`text-sm mb-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>متوسط دقة OCR</div>
              <div className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                {analysis.ocr_analysis.average.toFixed(1)}%
              </div>
              <div className={`w-full h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-base-900' : 'bg-slate-200'}`}>
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
                  style={{ width: `${analysis.ocr_analysis.average}%` }}
                ></div>
              </div>
            </div>
            {/* توزيع الدقة */}
            <div className="space-y-4">
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>توزيع الدقة</h3>
              <div className="space-y-3">
                {[
                  { label: 'ممتاز (≥90%)', value: analysis.ocr_analysis.distribution.excellent, color: 'text-emerald-400', bg: 'from-emerald-500 to-emerald-400' },
                  { label: 'جيد (70-89%)', value: analysis.ocr_analysis.distribution.good, color: 'text-blue-400', bg: 'from-blue-500 to-blue-400' },
                  { label: 'مقبول (50-69%)', value: analysis.ocr_analysis.distribution.fair, color: 'text-yellow-400', bg: 'from-yellow-500 to-yellow-400' },
                  { label: 'ضعيف (<50%)', value: analysis.ocr_analysis.distribution.poor, color: 'text-red-400', bg: 'from-red-500 to-red-400' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{item.label}</span>
                      <span className={`text-sm font-semibold ${item.color}`}>
                        {formatNumber(item.value)} ({getPercentage(item.value, ocrDistributionTotal)}%)
                      </span>
                    </div>
                    <div className={`h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-base-900' : 'bg-slate-100'}`}>
                      <div
                        className={`h-full bg-gradient-to-r ${item.bg} rounded-full`}
                        style={{ width: `${getPercentage(item.value, ocrDistributionTotal)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* تحليل التصنيفات والاتجاهات */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-xl font-semibold mb-6 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>التصنيفات والاتجاهات</h2>
          <div className="space-y-6">
            <div>
              <h3 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>توزيع حسب النوع</h3>
              <div className="space-y-3">
                {Object.entries(analysis.classification_analysis.total_by_type).map(([cls, count]) => (
                  <div key={cls}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{cls || 'أخرى'}</span>
                      <span className="text-sm font-semibold text-purple-400">
                        {formatNumber(count)} ({getPercentage(count, classificationTotal)}%)
                      </span>
                    </div>
                    <div className={`h-3 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-base-900' : 'bg-slate-100'}`}>
                      <div
                        className="h-full bg-gradient-to-r from-purple-500/60 to-purple-400/40 rounded-full"
                        style={{ width: `${getPercentage(count, classificationTotal)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {recommendations && !loadingRecommendations && (
        <div className="space-y-4">
          {recommendations.warnings && recommendations.warnings.length > 0 && (
            <div className={`rounded-xl p-6 border-l-4 ${theme === 'dark' ? 'card border-red-500/50' : 'bg-white shadow-md border-slate-200 border-l-red-500'}`}>
              <h2 className="text-xl font-semibold text-red-400 mb-4">تنبيهات مهمة</h2>
              <div className="space-y-3">
                {recommendations.warnings.map((warning, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-red-400 mb-1">{warning.title}</div>
                        <div className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{warning.message}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recommendations.recommendations && recommendations.recommendations.length > 0 && (
            <div className={`rounded-xl p-6 border-l-4 ${theme === 'dark' ? 'card border-yellow-500/50' : 'bg-white shadow-md border-slate-200 border-l-yellow-500'}`}>
              <h2 className="text-xl font-semibold text-yellow-400 mb-4">توصيات للتحسين</h2>
              <div className="space-y-3">
                {recommendations.recommendations.map((rec, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-yellow-400 mb-1">{rec.title}</div>
                        <div className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{rec.message}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Analyze