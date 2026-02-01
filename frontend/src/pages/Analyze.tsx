import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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
    <div className="space-y-6">      {/* رأس الصفحة */}      <div className="card">        <h1 className="text-3xl font-bold text-cyan-400 mb-2">تحليل الوثائق</h1>        <p className="text-text-secondary">          تحليل شامل للأداء والاتجاهات والإحصائيات التفصيلية        </p>      </div>      {/* بطاقات الإحصائيات السريعة */}      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">        <div className="card relative overflow-hidden group">          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-full blur-2xl"></div>          <div className="relative z-10">            <div className="text-xs text-text-secondary font-medium mb-2">اليوم</div>            <div className="text-3xl font-bold text-cyan-400 mb-1">              {formatNumber(analysis.time_analysis.today)}            </div>            <div className="text-xs text-text-secondary">وثيقة</div>          </div>        </div>        <div className="card relative overflow-hidden group">          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-2xl"></div>          <div className="relative z-10">            <div className="text-xs text-text-secondary font-medium mb-2">هذا الأسبوع</div>            <div className="text-3xl font-bold text-blue-400 mb-1">              {formatNumber(analysis.time_analysis.this_week)}            </div>            <div className="text-xs text-text-secondary">وثيقة</div>          </div>        </div>        <div className="card relative overflow-hidden group">          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/20 to-transparent rounded-full blur-2xl"></div>          <div className="relative z-10">            <div className="text-xs text-text-secondary font-medium mb-2">هذا الشهر</div>            <div className="text-3xl font-bold text-purple-400 mb-1">              {formatNumber(analysis.time_analysis.this_month)}            </div>            <div className="text-xs text-text-secondary">وثيقة</div>          </div>        </div>        <div className="card relative overflow-hidden group">          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/20 to-transparent rounded-full blur-2xl"></div>          <div className="relative z-10">            <div className="text-xs text-text-secondary font-medium mb-2">هذه السنة</div>            <div className="text-3xl font-bold text-emerald-400 mb-1">              {formatNumber(analysis.time_analysis.this_year)}            </div>            <div className="text-xs text-text-secondary">وثيقة</div>          </div>        </div>      </div>      {/* تحليل الأداء الزمني */}      <div className="card">        <div className="flex items-center justify-between mb-6">          <h2 className="text-xl font-semibold text-cyan-400">الاتجاهات الزمنية</h2>          <div className="flex gap-2">            <button              className={`px-4 py-2 rounded-xl text-sm transition ${                selectedPeriod === 'day'                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'                  : 'bg-base-900 border border-[rgba(0,188,212,0.12)] text-text-secondary hover:border-cyan-500/30'              }`}              onClick={() => setSelectedPeriod('day')}            >              آخر 30 يوم            </button>            <button              className={`px-4 py-2 rounded-xl text-sm transition ${                selectedPeriod === 'month'                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'                  : 'bg-base-900 border border-[rgba(0,188,212,0.12)] text-text-secondary hover:border-cyan-500/30'              }`}              onClick={() => setSelectedPeriod('month')}            >              آخر 12 شهر            </button>          </div>        </div>        <div className="space-y-4">          {selectedPeriod === 'day' ? (            <div className="space-y-3">              {analysis.time_analysis.by_day.map((item, idx) => {
                const maxCount = Math.max(...analysis.time_analysis.by_day.map(d => d.count), 1)
                const percentage = (item.count / maxCount) * 100
                return (                  <div key={idx} className="flex items-center gap-4">                    <div className="text-xs text-text-secondary w-16 text-left">                      {item.label}                    </div>                    <div className="flex-1 relative">                      <div className="h-8 rounded-lg bg-base-900 border border-[rgba(0,188,212,0.12)] overflow-hidden relative">                        <div                          className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"                          style={{ width: `${percentage}%` }}                        >                          {item.count > 0 && (                            <span className="text-xs font-semibold text-white">                              {item.count}                            </span>                          )}                        </div>                      </div>                    </div>                  </div>                )              })}            </div>          ) : (            <div className="space-y-3">              {analysis.time_analysis.by_month.map((item, idx) => {
                const maxCount = Math.max(...analysis.time_analysis.by_month.map(d => d.count), 1)
                const percentage = (item.count / maxCount) * 100
                return (                  <div key={idx} className="flex items-center gap-4">                    <div className="text-xs text-text-secondary w-24 text-left">                      {item.label}                    </div>                    <div className="flex-1 relative">                      <div className="h-8 rounded-lg bg-base-900 border border-[rgba(0,188,212,0.12)] overflow-hidden relative">                        <div                          className="h-full bg-gradient-to-r from-purple-500/60 to-purple-400/40 rounded-lg transition-all duration-500 flex items-center justify-end pr-3"                          style={{ width: `${percentage}%` }}                        >                          {item.count > 0 && (                            <span className="text-xs font-semibold text-white">                              {item.count}                            </span>                          )}                        </div>                      </div>                    </div>                  </div>                )              })}            </div>          )}        </div>      </div>      <div className="grid md:grid-cols-2 gap-6">        {/* تحليل أداء OCR */}        <div className="card">          <h2 className="text-xl font-semibold text-cyan-400 mb-6">تحليل أداء OCR</h2>                    <div className="space-y-6">            {/* متوسط الدقة */}            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">              <div className="text-sm text-text-secondary mb-2">متوسط دقة OCR</div>              <div className="text-4xl font-bold text-cyan-400 mb-2">                {analysis.ocr_analysis.average.toFixed(1)}%              </div>              <div className="w-full bg-base-900 h-2 rounded-full overflow-hidden">                <div                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"                  style={{ width: `${analysis.ocr_analysis.average}%` }}                ></div>              </div>            </div>            {/* توزيع الدقة */}            <div className="space-y-4">              <h3 className="text-sm font-semibold text-text-secondary">توزيع الدقة</h3>                            {ocrDistributionTotal > 0 && (                <>                  <div className="space-y-3">                    <div>                      <div className="flex items-center justify-between mb-2">                        <span className="text-sm text-text-secondary">ممتاز (≥90%)</span>                        <span className="text-sm font-semibold text-emerald-400">                          {formatNumber(analysis.ocr_analysis.distribution.excellent)} ({getPercentage(analysis.ocr_analysis.distribution.excellent, ocrDistributionTotal)}%)                        </span>                      </div>                      <div className="h-3 rounded-full bg-base-900 overflow-hidden">                        <div                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"                          style={{ width: `${getPercentage(analysis.ocr_analysis.distribution.excellent, ocrDistributionTotal)}%` }}                        ></div>                      </div>                    </div>                    <div>                      <div className="flex items-center justify-between mb-2">                        <span className="text-sm text-text-secondary">جيد (70-89%)</span>                        <span className="text-sm font-semibold text-blue-400">                          {formatNumber(analysis.ocr_analysis.distribution.good)} ({getPercentage(analysis.ocr_analysis.distribution.good, ocrDistributionTotal)}%)                        </span>                      </div>                      <div className="h-3 rounded-full bg-base-900 overflow-hidden">                        <div                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"                          style={{ width: `${getPercentage(analysis.ocr_analysis.distribution.good, ocrDistributionTotal)}%` }}                        ></div>                      </div>                    </div>                    <div>                      <div className="flex items-center justify-between mb-2">                        <span className="text-sm text-text-secondary">مقبول (50-69%)</span>                        <span className="text-sm font-semibold text-yellow-400">                          {formatNumber(analysis.ocr_analysis.distribution.fair)} ({getPercentage(analysis.ocr_analysis.distribution.fair, ocrDistributionTotal)}%)                        </span>                      </div>                      <div className="h-3 rounded-full bg-base-900 overflow-hidden">                        <div                          className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 rounded-full"                          style={{ width: `${getPercentage(analysis.ocr_analysis.distribution.fair, ocrDistributionTotal)}%` }}                        ></div>                      </div>                    </div>                    <div>                      <div className="flex items-center justify-between mb-2">                        <span className="text-sm text-text-secondary">ضعيف (&lt;50%)</span>                        <span className="text-sm font-semibold text-red-400">                          {formatNumber(analysis.ocr_analysis.distribution.poor)} ({getPercentage(analysis.ocr_analysis.distribution.poor, ocrDistributionTotal)}%)                        </span>                      </div>                      <div className="h-3 rounded-full bg-base-900 overflow-hidden">                        <div                          className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"                          style={{ width: `${getPercentage(analysis.ocr_analysis.distribution.poor, ocrDistributionTotal)}%` }}                        ></div>                      </div>                    </div>                  </div>                </>              )}              {/* دقة OCR حسب التصنيف */}              {Object.keys(analysis.ocr_analysis.by_classification).length > 0 && (                <div className="mt-6 pt-6 border-t border-[rgba(0,188,212,0.12)]">                  <h4 className="text-sm font-semibold text-text-secondary mb-4">دقة OCR حسب التصنيف</h4>                  <div className="space-y-3">                    {Object.entries(analysis.ocr_analysis.by_classification).map(([cls, avg]) => (                      <div key={cls}>                        <div className="flex items-center justify-between mb-2">                          <span className="text-sm text-text-secondary">{cls || 'أخرى'}</span>                          <span className="text-sm font-semibold text-cyan-400">{avg.toFixed(1)}%</span>                        </div>                        <div className="h-2 rounded-full bg-base-900 overflow-hidden">                          <div                            className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-full"                            style={{ width: `${avg}%` }}                          ></div>                        </div>                      </div>                    ))}                  </div>                </div>              )}            </div>          </div>        </div>        {/* تحليل التصنيفات والاتجاهات */}        <div className="card">          <h2 className="text-xl font-semibold text-cyan-400 mb-6">التصنيفات والاتجاهات</h2>                    <div className="space-y-6">            {/* التصنيفات */}            <div>              <h3 className="text-sm font-semibold text-text-secondary mb-4">توزيع حسب النوع</h3>              <div className="space-y-3">                {Object.entries(analysis.classification_analysis.total_by_type).map(([cls, count]) => (                  <div key={cls}>                    <div className="flex items-center justify-between mb-2">                      <span className="text-sm text-text-secondary">{cls || 'أخرى'}</span>                      <span className="text-sm font-semibold text-purple-400">                        {formatNumber(count)} ({getPercentage(count, classificationTotal)}%)                      </span>                    </div>                    <div className="h-3 rounded-full bg-base-900 overflow-hidden">                      <div                        className="h-full bg-gradient-to-r from-purple-500/60 to-purple-400/40 rounded-full"                        style={{ width: `${getPercentage(count, classificationTotal)}%` }}                      ></div>                    </div>                  </div>                ))}              </div>            </div>            {/* الاتجاهات */}            {Object.keys(analysis.classification_analysis.by_direction).length > 0 && (              <div className="pt-6 border-t border-[rgba(0,188,212,0.12)]">                <h3 className="text-sm font-semibold text-text-secondary mb-4">توزيع حسب الاتجاه</h3>                <div className="space-y-3">                  {Object.entries(analysis.classification_analysis.by_direction).map(([direction, count]) => {
                    const directionTotal = Object.values(analysis.classification_analysis.by_direction).reduce((a, b) => a + b, 0)
                    return (                      <div key={direction}>                        <div className="flex items-center justify-between mb-2">                          <span className="text-sm text-text-secondary">{direction}</span>                          <span className={`text-sm font-semibold ${                            direction === 'صادر' ? 'text-blue-400' : 'text-green-400'                          }`}>                            {formatNumber(count)} ({getPercentage(count, directionTotal)}%)                          </span>                        </div>                        <div className="h-3 rounded-full bg-base-900 overflow-hidden">                          <div                            className={`h-full rounded-full ${                              direction === 'صادر'                                ? 'bg-gradient-to-r from-blue-500/60 to-blue-400/40'                                : 'bg-gradient-to-r from-green-500/60 to-green-400/40'                            }`}                            style={{ width: `${getPercentage(count, directionTotal)}%` }}                          ></div>                        </div>                      </div>                    )                  })}                </div>              </div>            )}          </div>        </div>      </div>      {/* تحليل المصدر */}      {Object.keys(analysis.source_analysis.by_type).length > 0 && (        <div className="card">          <h2 className="text-xl font-semibold text-cyan-400 mb-6">تحليل المصدر</h2>                    <div className="grid md:grid-cols-2 gap-6">            {/* حسب النوع */}            <div>              <h3 className="text-sm font-semibold text-text-secondary mb-4">توزيع حسب نوع المصدر</h3>              <div className="space-y-3">                {Object.entries(analysis.source_analysis.by_type).map(([source, count]) => (                  <div key={source}>                    <div className="flex items-center justify-between mb-2">                      <span className="text-sm text-text-secondary">                        {source === 'file' ? 'ملف' : source === 'scanner' ? 'سكانر' : source}                      </span>                      <span className="text-sm font-semibold text-emerald-400">                        {formatNumber(count)} ({getPercentage(count, sourceTotal)}%)                      </span>                    </div>                    <div className="h-3 rounded-full bg-base-900 overflow-hidden">                      <div                        className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full"                        style={{ width: `${getPercentage(count, sourceTotal)}%` }}                      ></div>                    </div>                  </div>                ))}              </div>            </div>            {/* مقارنة دقة OCR حسب المصدر */}            {Object.keys(analysis.source_analysis.ocr_comparison).length > 0 && (              <div>                <h3 className="text-sm font-semibold text-text-secondary mb-4">مقارنة دقة OCR حسب المصدر</h3>                <div className="space-y-3">                  {Object.entries(analysis.source_analysis.ocr_comparison).map(([source, avg]) => (                    <div key={source}>                      <div className="flex items-center justify-between mb-2">                        <span className="text-sm text-text-secondary">                          {source === 'file' ? 'ملف' : source === 'scanner' ? 'سكانر' : source}                        </span>                        <span className="text-sm font-semibold text-cyan-400">{avg.toFixed(1)}%</span>                      </div>                      <div className="h-3 rounded-full bg-base-900 overflow-hidden">                        <div                          className="h-full bg-gradient-to-r from-cyan-500/60 to-cyan-400/40 rounded-full"                          style={{ width: `${avg}%` }}                        ></div>                      </div>                    </div>                  ))}                </div>              </div>            )}          </div>        </div>      )}      {/* التوصيات والتحليلات الذكية */}      {recommendations && !loadingRecommendations && (        <div className="space-y-4">          {/* التحذيرات */}          {recommendations.warnings && recommendations.warnings.length > 0 && (            <div className="card border-l-4 border-red-500/50">              <h2 className="text-xl font-semibold text-red-400 mb-4">تنبيهات مهمة</h2>              <div className="space-y-3">                {recommendations.warnings.map((warning, idx) => (                  <div key={idx} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">                    <div className="flex items-start gap-3">                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">                        <div className="w-2 h-2 rounded-full bg-red-400"></div>                      </div>                      <div className="flex-1">                        <div className="font-semibold text-red-400 mb-1">{warning.title}</div>                        <div className="text-sm text-text-secondary leading-relaxed">{warning.message}</div>                      </div>                    </div>                  </div>                ))}              </div>            </div>          )}          {/* التوصيات */}          {recommendations.recommendations && recommendations.recommendations.length > 0 && (            <div className="card border-l-4 border-yellow-500/50">              <h2 className="text-xl font-semibold text-yellow-400 mb-4">توصيات للتحسين</h2>              <div className="space-y-3">                {recommendations.recommendations.map((rec, idx) => (                  <div key={idx} className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">                    <div className="flex items-start gap-3">                      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>                      </div>                      <div className="flex-1">                        <div className="font-semibold text-yellow-400 mb-1">{rec.title}</div>                        <div className="text-sm text-text-secondary leading-relaxed">{rec.message}</div>                      </div>                    </div>                  </div>                ))}              </div>            </div>          )}          {/* الرؤى والإنجازات */}          {recommendations.insights && recommendations.insights.length > 0 && (            <div className="card border-l-4 border-emerald-500/50">              <h2 className="text-xl font-semibold text-emerald-400 mb-4">رؤى إيجابية</h2>              <div className="space-y-3">                {recommendations.insights.map((insight, idx) => (                  <div key={idx} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">                    <div className="flex items-start gap-3">                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>                      </div>                      <div className="flex-1">                        <div className="font-semibold text-emerald-400 mb-1">{insight.title}</div>                        <div className="text-sm text-text-secondary leading-relaxed">{insight.message}</div>                      </div>                    </div>                  </div>                ))}              </div>            </div>          )}        </div>      )}      {loadingRecommendations && (        <div className="card">          <div className="flex items-center justify-center py-8">            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-400"></div>            <span className="mr-3 text-text-secondary">جاري تحميل التوصيات...</span>          </div>        </div>      )}    </div>  )}

export default Analyze