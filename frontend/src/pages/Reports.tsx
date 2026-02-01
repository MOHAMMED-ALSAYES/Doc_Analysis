import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import html2pdf from 'html2pdf.js'
import ExcelJS from 'exceljs'

interface DashboardStats {
  summary: {
    total_documents: number
    total_users: number
    active_users: number
    documents_today: number
    documents_last_7_days: number
    avg_ocr_accuracy: number
  }
  classification_distribution: Record<string, number>
  direction_distribution: Record<string, number>
  source_distribution: Record<string, number>
  status_distribution: Record<string, number>
  daily_activity: Array<{ date: string; count: number }>
  top_users: Array<{ username: string; full_name: string; document_count: number }>
}

const COLORS = ['#00BCD4', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3']

interface User {
  id: number
  username: string
  full_name?: string
}

function Reports() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState('30')
  
  // Filter states
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Export modal states
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportType, setExportType] = useState<'pdf' | 'excel' | null>(null)
  const [reportType, setReportType] = useState<string>('')
  const [exportDateFrom, setExportDateFrom] = useState('')
  const [exportDateTo, setExportDateTo] = useState('')
  const [exportUserId, setExportUserId] = useState<number | null>(null)
  const [exportPeriod, setExportPeriod] = useState<'week' | 'month' | 'custom' | 'day' | 'range'>('custom')
  const [userActivityType, setUserActivityType] = useState<'login' | 'documents' | 'both'>('both')

  useEffect(() => {
    checkUserRole()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  useEffect(() => {
    loadStats()
  }, [dateFrom, dateTo, selectedUserId])

  const checkUserRole = async () => {
    try {
      const res = await api.get('/auth/me')
      const roleFromApi = res?.data?.role
      const roleName = typeof roleFromApi === 'string' ? roleFromApi : (roleFromApi?.name || res?.data?.role_name)
      const adminFlag = roleName === 'system_admin' || res?.data?.is_admin === true
      setIsAdmin(Boolean(adminFlag))
    } catch (e) {
      setIsAdmin(false)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await api.get('/users/')
      setUsers(res.data)
    } catch (e) {
      console.error('Failed to load users:', e)
    }
  }

  const loadStats = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (selectedUserId && isAdmin) params.user_id = selectedUserId
      
      const res = await api.get('/reports/dashboard', { params })
      setStats(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'فشل جلب الإحصائيات')
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSelectedUserId(null)
  }

  const openExportModal = (type: 'pdf' | 'excel') => {
    setExportType(type)
    setReportType('')
    setExportDateFrom('')
    setExportDateTo('')
    setExportUserId(null)
    setExportPeriod('custom')
    setUserActivityType('both')
    setShowExportModal(true)
  }

  const calculateDatesFromPeriod = (period: 'week' | 'month') => {
    const today = new Date()
    let fromDate: Date

    if (period === 'week') {
      fromDate = new Date(today)
      fromDate.setDate(today.getDate() - 7)
    } else { // month
      fromDate = new Date(today)
      fromDate.setMonth(today.getMonth() - 1)
    }

    const fromStr = fromDate.toISOString().split('T')[0]
    const toStr = today.toISOString().split('T')[0]
    
    return { from: fromStr, to: toStr }
  }

  const handleExport = async () => {
    if (!reportType) {
      alert('الرجاء اختيار نوع التقرير')
      return
    }

    // معالجة تقرير تسجيل الدخول
    if (reportType === 'login_activity') {
      try {
        let params: any = {}
        if (exportPeriod === 'week') {
          const dates = calculateDatesFromPeriod('week')
          params.date_from = dates.from
          params.date_to = dates.to
        } else if (exportPeriod === 'month') {
          const dates = calculateDatesFromPeriod('month')
          params.date_from = dates.from
          params.date_to = dates.to
        } else if (exportDateFrom && exportDateTo) {
          params.date_from = exportDateFrom
          params.date_to = exportDateTo
        }
        
        const res = await api.get('/reports/login-activity', { params })
        
        setShowExportModal(false)
        
        if (exportType === 'pdf') {
          exportLoginActivityPDF(res.data, params.date_from || '', params.date_to || '')
        } else {
          exportLoginActivityExcel(res.data, params.date_from || '', params.date_to || '')
        }
        return
      } catch (e: any) {
        alert('فشل جلب بيانات تسجيل الدخول: ' + (e?.response?.data?.detail || ''))
        return
      }
    }

    // معالجة تقرير جميع المستخدمين
    if (reportType === 'users_report' && isAdmin) {
      try {
        if (!exportDateFrom) {
          alert('الرجاء تحديد التاريخ')
          return
        }

        let params: any = { activity_type: userActivityType }
        
        if (exportPeriod === 'day') {
          // يوم محدد
          params.date_from = exportDateFrom
          params.date_to = exportDateFrom
        } else if (exportPeriod === 'range') {
          // من تاريخ إلى تاريخ
          if (!exportDateTo) {
            alert('الرجاء تحديد تاريخ النهاية')
            return
          }
          params.date_from = exportDateFrom
          params.date_to = exportDateTo
        }
        
        const res = await api.get('/reports/users-activity', { params })
        
        setShowExportModal(false)
        
        if (exportType === 'pdf') {
          exportUsersActivityPDF(res.data, params.date_from || '', params.date_to || '')
        } else {
          exportUsersActivityExcel(res.data, params.date_from || '', params.date_to || '')
        }
        return
      } catch (e: any) {
        alert('فشل جلب بيانات نشاط المستخدمين: ' + (e?.response?.data?.detail || ''))
        return
      }
    }

    // معالجة تقرير نشاط مستخدم محدد
    if (reportType === 'user_activity' && isAdmin) {
      try {
        if (!exportUserId) {
          alert('الرجاء اختيار المستخدم')
          return
        }

        let params: any = { user_id: exportUserId }
        if (exportPeriod === 'week') {
          const dates = calculateDatesFromPeriod('week')
          params.date_from = dates.from
          params.date_to = dates.to
        } else if (exportPeriod === 'month') {
          const dates = calculateDatesFromPeriod('month')
          params.date_from = dates.from
          params.date_to = dates.to
        } else if (exportDateFrom && exportDateTo) {
          params.date_from = exportDateFrom
          params.date_to = exportDateTo
        }
        
        const res = await api.get('/reports/user-activity', { params })
        
        setShowExportModal(false)
        
        // تصفية البيانات حسب نوع النشاط المحدد
        let filteredData = { ...res.data }
        if (userActivityType === 'login') {
          filteredData.documents = { count: 0, items: [] }
        } else if (userActivityType === 'documents') {
          filteredData.activities = { count: 0, items: [] }
        }
        
        if (exportType === 'pdf') {
          exportUserActivityPDF(filteredData, params.date_from || '', params.date_to || '', userActivityType)
        } else {
          exportUserActivityExcel(filteredData, params.date_from || '', params.date_to || '', userActivityType)
        }
        return
      } catch (e: any) {
        alert('فشل جلب بيانات نشاط المستخدم: ' + (e?.response?.data?.detail || ''))
        return
      }
    }

    let finalDateFrom = exportDateFrom
    let finalDateTo = exportDateTo
    let finalUserId = exportUserId

    // معالجة "جميع الوثائق" - لا فلاتر
    if (reportType === 'all_documents' || reportType === 'my_documents_all') {
      finalDateFrom = ''
      finalDateTo = ''
      finalUserId = null
    } else {
      // حساب التواريخ من الفترة المحددة
      if (exportPeriod !== 'custom' && exportPeriod !== 'day' && exportPeriod !== 'range' && (reportType === 'documents_by_period')) {
        const dates = calculateDatesFromPeriod(exportPeriod as 'week' | 'month')
        finalDateFrom = dates.from
        finalDateTo = dates.to
      }

      // تأكد من وجود التواريخ المطلوبة
      if ((reportType === 'documents_by_date' || reportType === 'documents_by_day') && !finalDateFrom) {
        alert('الرجاء تحديد التاريخ')
        return
      }

      if (reportType === 'user_documents' && !finalUserId && isAdmin) {
        alert('الرجاء اختيار المستخدم')
        return
      }

      // معالجة "وثائقي في يوم محدد"
      if (reportType === 'documents_by_day' && finalDateFrom) {
        finalDateTo = finalDateFrom
      }
    }

    setShowExportModal(false)

    // جلب البيانات - الإحصائيات وقائمة الوثائق
    try {
      const params: any = {}
      if (finalDateFrom) params.date_from = finalDateFrom
      if (finalDateTo) params.date_to = finalDateTo
      if (finalUserId && isAdmin) params.user_id = finalUserId
      
      const [statsRes, documentsRes] = await Promise.all([
        api.get('/reports/dashboard', { params }),
        api.get('/reports/documents-list', { params })
      ])
      
      const includeDashboard = isAdmin && reportType === 'all_documents'
      if (exportType === 'pdf') {
        exportToPDFWithFilters(statsRes.data, documentsRes.data, finalDateFrom, finalDateTo, finalUserId, reportType, includeDashboard)
      } else {
        exportToExcelWithFilters(statsRes.data, documentsRes.data, finalDateFrom, finalDateTo, finalUserId, reportType, includeDashboard)
      }
    } catch (e: any) {
      alert('فشل جلب البيانات: ' + (e?.response?.data?.detail || ''))
    }
  }

  const exportToPDFWithFilters = (
    exportStats: DashboardStats,
    documentsData: any,
    dateFrom: string,
    dateTo: string,
    userId: number | null,
    reportType: string,
    includeDashboardSections: boolean
  ) => {
    if (!exportStats) {
      alert('لا توجد بيانات للتصدير')
      return
    }

    // التاريخ بالإنجليزية مع الشهر بالرقم
    const generatedDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    // بناء نص الفلاتر
    let filtersText = ''
    if (dateFrom || dateTo || userId) {
      filtersText = '<div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;"><strong>Applied Filters:</strong><br>'
      if (dateFrom) filtersText += `From: ${dateFrom} `
      if (dateTo) filtersText += `To: ${dateTo} `
      if (userId) {
        const selectedUser = users.find(u => u.id === userId)
        filtersText += `User: ${selectedUser?.username || userId}`
      }
      filtersText += '</div>'
    }

    // Create HTML content for PDF
    const pdfContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, 'Arial Unicode MS', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
            color: #333;
          }
          .header {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .header-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            background: white;
            padding: 8px;
            border-radius: 8px;
          }
          .header-content {
            flex: 1;
          }
          .header h1 {
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: bold;
          }
          .header p {
            font-size: 14px;
            opacity: 0.95;
            margin: 5px 0;
          }
          .cards-container {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 30px;
          }
          .card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #e0e0e0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .card.cyan {
            border-color: #00BCD4;
            background: linear-gradient(135deg, rgba(0,188,212,0.1) 0%, rgba(0,188,212,0.05) 100%);
          }
          .card.green {
            border-color: #10B981;
            background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.05) 100%);
          }
          .card.blue {
            border-color: #3B82F6;
            background: linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%);
          }
          .card.purple {
            border-color: #A855F7;
            background: linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(168,85,247,0.05) 100%);
          }
          .card-title {
            font-size: 12px;
            color: #666;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .card-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 15px 0;
            color: #00BCD4;
            padding-bottom: 10px;
            border-bottom: 2px solid #00BCD4;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          table thead {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
          }
          table th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
            font-size: 14px;
          }
          table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 13px;
          }
          table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          table tbody tr:hover {
            background-color: #e9ecef;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 11px;
          }
          @media print {
            body { padding: 10px; }
            .header { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/Image/icon.png" alt="شعار المركز" class="header-logo" onerror="this.style.display='none'" />
          <div class="header-content">
            <h1> System Report / تقرير النظام</h1>
            <p>نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية</p>
            <p>Generated: ${generatedDate}</p>
          </div>
        </div>
        ${filtersText}

        ${includeDashboardSections ? `
        <div class="cards-container">
          <div class="card cyan">
            <div class="card-title">Total Documents<br>إجمالي الوثائق</div>
            <div class="card-value">${exportStats.summary.total_documents}</div>
          </div>
          <div class="card green">
            <div class="card-title">Documents Today<br>الوثائق اليوم</div>
            <div class="card-value">${exportStats.summary.documents_today}</div>
          </div>
          <div class="card blue">
            <div class="card-title">Last 7 Days<br>آخر 7 أيام</div>
            <div class="card-value">${exportStats.summary.documents_last_7_days}</div>
          </div>
          <div class="card purple">
            <div class="card-title">Active Users<br>المستخدمون النشطون</div>
            <div class="card-value">${exportStats.summary.active_users}</div>
          </div>
        </div>

        <div class="section-title">Summary / ملخص الإحصائيات</div>
        <table>
          <thead>
            <tr>
              <th>Metric / المقياس</th>
              <th>Value / القيمة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Documents / إجمالي الوثائق</td>
              <td>${exportStats.summary.total_documents}</td>
            </tr>
            <tr>
              <td>Total Users / إجمالي المستخدمين</td>
              <td>${exportStats.summary.total_users}</td>
            </tr>
            <tr>
              <td>Active Users / المستخدمون النشطون</td>
              <td>${exportStats.summary.active_users}</td>
            </tr>
            <tr>
              <td>Documents Today / الوثائق اليوم</td>
              <td>${exportStats.summary.documents_today}</td>
            </tr>
            <tr>
              <td>Last 7 Days / آخر 7 أيام</td>
              <td>${exportStats.summary.documents_last_7_days}</td>
            </tr>
            <tr>
              <td>Avg OCR Accuracy / متوسط دقة OCR</td>
              <td>${exportStats.summary.avg_ocr_accuracy}%</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">Top Active Users / أكثر المستخدمين نشاطاً</div>
        <table>
          <thead>
            <tr>
              <th>Username / اسم المستخدم</th>
              <th>Full Name / الاسم الكامل</th>
              <th>Count / العدد</th>
            </tr>
          </thead>
          <tbody>
            ${exportStats.top_users.map(u => `
              <tr>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td>${u.document_count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        ${documentsData && documentsData.documents && documentsData.documents.length > 0 ? `
        <div class="section-title">Documents List / قائمة الوثائق</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Document Number / رقم الوثيقة</th>
              <th>Title / العنوان</th>
              <th>Uploaded By / رفع بواسطة</th>
              <th>Date & Time / التاريخ والوقت</th>
              <th>Direction / الاتجاه</th>
              <th>Classification / التصنيف</th>
            </tr>
          </thead>
          <tbody>
            ${documentsData.documents.map((doc: any, idx: number) => {
              const formatDate = (timestamp?: string) => {
                if (!timestamp) return '—'
                try {
                  const date = new Date(timestamp)
                  return date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                } catch {
                  return timestamp
                }
              }
              return `
              <tr>
                <td>${idx + 1}</td>
                <td>${doc.document_number || '-'}</td>
                <td>${doc.title || 'بدون عنوان'}</td>
                <td>${doc.uploader_full_name || doc.uploader_username || 'Unknown'}</td>
                <td>${formatDate(doc.created_at)}</td>
                <td>${doc.document_direction}</td>
                <td>${doc.ai_classification}</td>
              </tr>
            `
            }).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية
        </div>
      </body>
      </html>
    `

    // Open in new window and use print to PDF
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('فشل فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.')
      return
    }
    
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    // Wait for content to load, then trigger print/save as PDF
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus()
        // Trigger print dialog - user can save as PDF
        printWindow.print()
        // Note: User can choose "Save as PDF" in the print dialog
      }, 500)
    }
    
    // Fallback if onload doesn't fire
    setTimeout(() => {
      if (printWindow && !printWindow.closed) {
        printWindow.focus()
        printWindow.print()
      }
    }, 1000)
  }

  const exportToExcelWithFilters = async (
    exportStats: DashboardStats,
    documentsData: any,
    dateFrom: string,
    dateTo: string,
    userId: number | null,
    reportType: string,
    includeDashboardSections: boolean
  ) => {
    if (!exportStats) return

    // التاريخ بالإنجليزية مع الشهر بالرقم
    const generatedDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    
    // Colors
    const headerColor = '00BCD4'
    const headerTextColor = 'FFFFFF'
    const altRowColor = 'F5F5F5'
    const borderColor = 'E0E0E0'

    // Only include dashboard sheets for the full "all_documents" report
    const includeDashboardSheets = includeDashboardSections

    // Sheet 1: Summary / الملخص
    const summarySheet = includeDashboardSheets ? workbook.addWorksheet('Summary') : null as any
    
    // Header
    if (includeDashboardSheets) {
      summarySheet.mergeCells('A1:B1')
      summarySheet.getCell('A1').value = ' System Report / تقرير النظام'
      summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
      summarySheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
      
      summarySheet.mergeCells('A2:B2')
      let dateRowText = `Generated: ${generatedDate}`
      if (dateFrom || dateTo || userId) {
        const filterParts: string[] = []
        if (dateFrom) filterParts.push(`From: ${dateFrom}`)
        if (dateTo) filterParts.push(`To: ${dateTo}`)
        if (userId) {
          const selectedUser = users.find(u => u.id === userId)
          filterParts.push(`User: ${selectedUser?.username || userId}`)
        }
        dateRowText += ` | Filters: ${filterParts.join(', ')}`
      }
      summarySheet.getCell('A2').value = dateRowText
      summarySheet.getCell('A2').font = { size: 11 }
      summarySheet.getCell('A2').alignment = { horizontal: 'center' }
      
      summarySheet.getRow(3).height = 5
      
      // Table header
      summarySheet.getCell('A4').value = 'Metric / المقياس'
      summarySheet.getCell('B4').value = 'Value / القيمة'
      summarySheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + headerColor }
      }
      summarySheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
      summarySheet.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' }
      
      // Data rows
      const summaryRows = [
        ['Total Documents / إجمالي الوثائق', exportStats.summary.total_documents],
        ['Total Users / إجمالي المستخدمين', exportStats.summary.total_users],
        ['Active Users / المستخدمون النشطون', exportStats.summary.active_users],
        ['Documents Today / الوثائق اليوم', exportStats.summary.documents_today],
        ['Documents Last 7 Days / الوثائق آخر 7 أيام', exportStats.summary.documents_last_7_days],
        ['Avg OCR Accuracy / متوسط دقة OCR', `${exportStats.summary.avg_ocr_accuracy}%`],
      ]
      
      summaryRows.forEach((row, idx) => {
        const rowNum = 5 + idx
        summarySheet.getCell(`A${rowNum}`).value = row[0]
        summarySheet.getCell(`B${rowNum}`).value = row[1]
        if (idx % 2 === 0) {
          summarySheet.getRow(rowNum).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + altRowColor }
          }
        }
      })
      
      // Set column widths
      summarySheet.getColumn(1).width = 50
      summarySheet.getColumn(2).width = 20
      
      // Add borders
      summarySheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF' + borderColor } },
            left: { style: 'thin', color: { argb: 'FF' + borderColor } },
            bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
            right: { style: 'thin', color: { argb: 'FF' + borderColor } }
          }
        })
      })
    }

    if (includeDashboardSheets) {
    // Sheet 2: Classification with Chart / التصنيف مع الرسم البياني
    const classificationSheet = includeDashboardSheets ? workbook.addWorksheet('Classification') : null as any
    
    classificationSheet.mergeCells('A1:C1')
    classificationSheet.getCell('A1').value = ' Document Classification / توزيع الوثائق حسب التصنيف'
    classificationSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF' + headerColor } }
    classificationSheet.getCell('A1').alignment = { horizontal: 'center' }
    
    classificationSheet.mergeCells('A2:C2')
    classificationSheet.getCell('A2').value = `Generated: ${generatedDate}`
    classificationSheet.getCell('A2').font = { size: 11 }
    classificationSheet.getCell('A2').alignment = { horizontal: 'center' }
    
    classificationSheet.getRow(3).height = 5
    
    // Table
    classificationSheet.getCell('A4').value = 'Classification / التصنيف'
    classificationSheet.getCell('B4').value = 'Count / العدد'
    classificationSheet.getCell('C4').value = 'Percentage / النسبة'
    classificationSheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + headerColor }
    }
    classificationSheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
    classificationSheet.getRow(4).alignment = { horizontal: 'center' }
    
    const total = Object.values(exportStats.classification_distribution).reduce((sum, val) => sum + val, 0)
    let rowNum = 5
    Object.entries(exportStats.classification_distribution).forEach(([k, v], idx) => {
      const percent = total > 0 ? ((v / total) * 100).toFixed(1) : '0'
      classificationSheet.getCell(`A${rowNum}`).value = k
      classificationSheet.getCell(`B${rowNum}`).value = v
      classificationSheet.getCell(`C${rowNum}`).value = `${percent}%`
      
      if (idx % 2 === 0) {
        classificationSheet.getRow(rowNum).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + altRowColor }
        }
      }
      rowNum++
    })
    
    // Charts will be created manually by user if needed
    // ExcelJS Charts API is complex and may not work in all environments
    
    // Add visual colors to data cells
    let colorIndex = 0
    const chartColors = ['FF00BCD4', 'FF10B981', 'FF3B82F6', 'FFA855F7', 'FFFF6B6B', 'FFFFE66D', 'FF4ECDC4']
    Object.entries(exportStats.classification_distribution).forEach(([k, v], idx) => {
      const rowNum = 5 + idx
      if (classificationSheet.getCell(`B${rowNum}`)) {
        const color = chartColors[colorIndex % chartColors.length]
        classificationSheet.getCell(`B${rowNum}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: color }
        }
        classificationSheet.getCell(`B${rowNum}`).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        colorIndex++
      }
    })
    
    classificationSheet.getColumn(1).width = 30
    classificationSheet.getColumn(2).width = 15
    classificationSheet.getColumn(3).width = 15
    
    // Add borders
    for (let i = 4; i < rowNum; i++) {
      ['A', 'B', 'C'].forEach(col => {
        classificationSheet.getCell(`${col}${i}`).border = {
          top: { style: 'thin', color: { argb: 'FF' + borderColor } },
          left: { style: 'thin', color: { argb: 'FF' + borderColor } },
          bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
          right: { style: 'thin', color: { argb: 'FF' + borderColor } }
        }
      })
    }

    // Sheet 3: Top Users / المستخدمون
    const usersSheet = includeDashboardSheets ? workbook.addWorksheet('Top Users') : null as any
    
    usersSheet.mergeCells('A1:D1')
    usersSheet.getCell('A1').value = 'Top Active Users / أكثر المستخدمين نشاطاً'
    usersSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF' + headerColor } }
    usersSheet.getCell('A1').alignment = { horizontal: 'center' }
    
    usersSheet.mergeCells('A2:D2')
    usersSheet.getCell('A2').value = `Generated: ${generatedDate}`
    usersSheet.getCell('A2').font = { size: 11 }
    usersSheet.getCell('A2').alignment = { horizontal: 'center' }
    
    usersSheet.getRow(3).height = 5
    
    usersSheet.getCell('A4').value = 'Rank / الترتيب'
    usersSheet.getCell('B4').value = 'Username / اسم المستخدم'
    usersSheet.getCell('C4').value = 'Full Name / الاسم الكامل'
    usersSheet.getCell('D4').value = 'Count / العدد'
    usersSheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + headerColor }
    }
    usersSheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
    usersSheet.getRow(4).alignment = { horizontal: 'center' }
    
    // Color gradient for top users based on rank
    const rankColors = ['FFFFD700', 'FFC0C0C0', 'FFCD7F32', 'FFE0E0E0', 'FFF5F5F5']
    
    exportStats.top_users.forEach((u, idx) => {
      const rowNum = 5 + idx
      usersSheet.getCell(`A${rowNum}`).value = idx + 1
      usersSheet.getCell(`B${rowNum}`).value = u.username
      usersSheet.getCell(`C${rowNum}`).value = u.full_name || '-'
      usersSheet.getCell(`D${rowNum}`).value = u.document_count
      
      // Add rank color to count cell for top 3
      if (idx < 3) {
        usersSheet.getCell(`D${rowNum}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rankColors[idx] }
        }
        usersSheet.getCell(`D${rowNum}`).font = { bold: true }
      } else if (idx % 2 === 0) {
        usersSheet.getRow(rowNum).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + altRowColor }
        }
      }
    })
    
    const lastRow = 5 + exportStats.top_users.length - 1
    
    // Charts can be created manually in Excel
    
    usersSheet.getColumn(1).width = 12
    usersSheet.getColumn(2).width = 25
    usersSheet.getColumn(3).width = 30
    usersSheet.getColumn(4).width = 15
    
    // Add borders
    for (let i = 4; i <= lastRow; i++) {
      ['A', 'B', 'C', 'D'].forEach(col => {
        usersSheet.getCell(`${col}${i}`).border = {
          top: { style: 'thin', color: { argb: 'FF' + borderColor } },
          left: { style: 'thin', color: { argb: 'FF' + borderColor } },
          bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
          right: { style: 'thin', color: { argb: 'FF' + borderColor } }
        }
      })
    }

    // Sheet 4: Daily Activity with Chart / النشاط اليومي مع الرسم البياني
    const activitySheet = includeDashboardSheets ? workbook.addWorksheet('Daily Activity') : null as any
    
    activitySheet.mergeCells('A1:B1')
    activitySheet.getCell('A1').value = 'Daily Activity / النشاط اليومي (Last 30 Days / آخر 30 يوم)'
    activitySheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF' + headerColor } }
    activitySheet.getCell('A1').alignment = { horizontal: 'center' }
    
    activitySheet.mergeCells('A2:B2')
    activitySheet.getCell('A2').value = `Generated: ${generatedDate}`
    activitySheet.getCell('A2').font = { size: 11 }
    activitySheet.getCell('A2').alignment = { horizontal: 'center' }
    
    activitySheet.getRow(3).height = 5
    
    activitySheet.getCell('A4').value = 'Date / التاريخ'
    activitySheet.getCell('B4').value = 'Count / العدد'
    activitySheet.getRow(4).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF' + headerColor }
    }
    activitySheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
    activitySheet.getRow(4).alignment = { horizontal: 'center' }
    
    exportStats.daily_activity.forEach((a, idx) => {
      const rowNum = 5 + idx
      activitySheet.getCell(`A${rowNum}`).value = a.date
      activitySheet.getCell(`B${rowNum}`).value = a.count
      
      if (idx % 2 === 0) {
        activitySheet.getRow(rowNum).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF' + altRowColor }
        }
      }
    })
    
    const activityLastRow = 5 + exportStats.daily_activity.length - 1
    
    // Charts can be created manually in Excel
    
    activitySheet.getColumn(1).width = 20
    activitySheet.getColumn(2).width = 12
    
    // Add borders
    for (let i = 4; i < activityLastRow + 1; i++) {
      ['A', 'B'].forEach(col => {
        activitySheet.getCell(`${col}${i}`).border = {
          top: { style: 'thin', color: { argb: 'FF' + borderColor } },
          left: { style: 'thin', color: { argb: 'FF' + borderColor } },
          bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
          right: { style: 'thin', color: { argb: 'FF' + borderColor } }
        }
      })
    }
    } // includeDashboardSheets

    // Sheet 5: Documents List / قائمة الوثائق
    if (documentsData && documentsData.documents && documentsData.documents.length > 0) {
      const documentsSheet = workbook.addWorksheet('Documents List')
      
      documentsSheet.mergeCells('A1:G1')
      documentsSheet.getCell('A1').value = ' Documents List / قائمة الوثائق'
      documentsSheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF' + headerColor } }
      documentsSheet.getCell('A1').alignment = { horizontal: 'center' }
      
      documentsSheet.mergeCells('A2:G2')
      let dateRowText = `Generated: ${generatedDate}`
      if (dateFrom || dateTo) {
        const filterParts: string[] = []
        if (dateFrom) filterParts.push(`From: ${dateFrom}`)
        if (dateTo) filterParts.push(`To: ${dateTo}`)
        if (userId) {
          const selectedUser = users.find(u => u.id === userId)
          filterParts.push(`User: ${selectedUser?.username || userId}`)
        }
        dateRowText += ` | Filters: ${filterParts.join(', ')}`
      }
      documentsSheet.getCell('A2').value = dateRowText
      documentsSheet.getCell('A2').font = { size: 11 }
      documentsSheet.getCell('A2').alignment = { horizontal: 'center' }
      
      documentsSheet.getRow(3).height = 5
      
      documentsSheet.getCell('A4').value = '#'
      documentsSheet.getCell('B4').value = 'Document Number / رقم الوثيقة'
      documentsSheet.getCell('C4').value = 'Title / العنوان'
      documentsSheet.getCell('D4').value = 'Uploaded By / رفع بواسطة'
      documentsSheet.getCell('E4').value = 'Date & Time / التاريخ والوقت'
      documentsSheet.getCell('F4').value = 'Direction / الاتجاه'
      documentsSheet.getCell('G4').value = 'Classification / التصنيف'
      documentsSheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF' + headerColor }
      }
      documentsSheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
      documentsSheet.getRow(4).alignment = { horizontal: 'center' }
      
      const formatDate = (timestamp?: string) => {
        if (!timestamp) return '—'
        try {
          const date = new Date(timestamp)
          return date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        } catch {
          return timestamp
        }
      }
      
      documentsData.documents.forEach((doc: any, idx: number) => {
        const rowNum = 5 + idx
        documentsSheet.getCell(`A${rowNum}`).value = idx + 1
        documentsSheet.getCell(`B${rowNum}`).value = doc.document_number || '-'
        documentsSheet.getCell(`C${rowNum}`).value = doc.title || 'بدون عنوان'
        documentsSheet.getCell(`D${rowNum}`).value = doc.uploader_full_name || doc.uploader_username || 'Unknown'
        documentsSheet.getCell(`E${rowNum}`).value = formatDate(doc.created_at)
        documentsSheet.getCell(`F${rowNum}`).value = doc.document_direction || 'غير محدد'
        documentsSheet.getCell(`G${rowNum}`).value = doc.ai_classification || 'غير مصنف'
        
        if (idx % 2 === 0) {
          documentsSheet.getRow(rowNum).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF' + altRowColor }
          }
        }
      })
      
      documentsSheet.getColumn(1).width = 8
      documentsSheet.getColumn(2).width = 20
      documentsSheet.getColumn(3).width = 40
      documentsSheet.getColumn(4).width = 25
      documentsSheet.getColumn(5).width = 25
      documentsSheet.getColumn(6).width = 15
      documentsSheet.getColumn(7).width = 20
      
      const docsLastRow = 5 + documentsData.documents.length - 1
      for (let i = 4; i <= docsLastRow; i++) {
        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(col => {
          documentsSheet.getCell(`${col}${i}`).border = {
            top: { style: 'thin', color: { argb: 'FF' + borderColor } },
            left: { style: 'thin', color: { argb: 'FF' + borderColor } },
            bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
            right: { style: 'thin', color: { argb: 'FF' + borderColor } }
          }
        })
      }
    }

    // Save file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `System_Report_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportLoginActivityPDF = (data: any, dateFrom: string, dateTo: string) => {
    const generatedDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    let filtersText = ''
    if (dateFrom || dateTo) {
      filtersText = `<div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;"><strong>Period:</strong><br>From: ${dateFrom} To: ${dateTo}</div>`
    }

    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }

    const pdfContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, 'Arial Unicode MS', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
            color: #333;
          }
          .header {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .header-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            background: white;
            padding: 8px;
            border-radius: 8px;
          }
          .header-content {
            flex: 1;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          table thead {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
          }
          table th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
          }
          table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
          }
          table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/Image/icon.png" alt="شعار المركز" class="header-logo" onerror="this.style.display='none'" />
          <div class="header-content">
            <h1> Login Activity Report / تقرير نشاط تسجيل الدخول</h1>
            <p>نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية</p>
            <p>Generated: ${generatedDate}</p>
          </div>
        </div>
        ${filtersText}
        <div style="margin-bottom: 20px; font-size: 18px; font-weight: bold;">
          Total Logins: ${data.count} / إجمالي تسجيلات الدخول: ${data.count}
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Username / اسم المستخدم</th>
              <th>Full Name / الاسم الكامل</th>
              <th>Date & Time / التاريخ والوقت</th>
              <th>IP Address / عنوان IP</th>
            </tr>
          </thead>
          <tbody>
            ${data.logs.map((log: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${log.username}</td>
                <td>${log.full_name || '-'}</td>
                <td>${formatDate(log.timestamp)}</td>
                <td>${log.ip_address || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('فشل فتح نافذة الطباعة')
      return
    }
    
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  const exportLoginActivityExcel = async (data: any, dateFrom: string, dateTo: string) => {
    const workbook = new ExcelJS.Workbook()
    const headerColor = '00BCD4'
    const headerTextColor = 'FFFFFF'
    const altRowColor = 'F5F5F5'
    const borderColor = 'E0E0E0'

    const sheet = workbook.addWorksheet('Login Activity')
    
    sheet.mergeCells('A1:E1')
    sheet.getCell('A1').value = ' Login Activity Report / تقرير نشاط تسجيل الدخول'
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
    sheet.getCell('A1').alignment = { horizontal: 'center' }
    
    sheet.mergeCells('A2:E2')
    let dateRowText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}`
    if (dateFrom || dateTo) {
      dateRowText += ` | Period: ${dateFrom} to ${dateTo}`
    }
    sheet.getCell('A2').value = dateRowText
    sheet.getCell('A2').font = { size: 11 }
    sheet.getCell('A2').alignment = { horizontal: 'center' }
    
    sheet.getRow(3).height = 5
    
    sheet.getCell('A4').value = '#'
    sheet.getCell('B4').value = 'Username / اسم المستخدم'
    sheet.getCell('C4').value = 'Full Name / الاسم الكامل'
    sheet.getCell('D4').value = 'Date & Time / التاريخ والوقت'
    sheet.getCell('E4').value = 'IP Address / عنوان IP'
    sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
    sheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
    sheet.getRow(4).alignment = { horizontal: 'center' }
    
    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }
    
    data.logs.forEach((log: any, idx: number) => {
      const rowNum = 5 + idx
      sheet.getCell(`A${rowNum}`).value = idx + 1
      sheet.getCell(`B${rowNum}`).value = log.username
      sheet.getCell(`C${rowNum}`).value = log.full_name || '-'
      sheet.getCell(`D${rowNum}`).value = formatDate(log.timestamp)
      sheet.getCell(`E${rowNum}`).value = log.ip_address || '-'
      
      if (idx % 2 === 0) {
        sheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
      }
    })
    
    sheet.getColumn(1).width = 8
    sheet.getColumn(2).width = 20
    sheet.getColumn(3).width = 25
    sheet.getColumn(4).width = 25
    sheet.getColumn(5).width = 18
    
    for (let i = 4; i < 5 + data.logs.length; i++) {
      ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        sheet.getCell(`${col}${i}`).border = {
          top: { style: 'thin', color: { argb: 'FF' + borderColor } },
          left: { style: 'thin', color: { argb: 'FF' + borderColor } },
          bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
          right: { style: 'thin', color: { argb: 'FF' + borderColor } }
        }
      })
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Login_Activity_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportUserActivityPDF = (data: any, dateFrom: string, dateTo: string, activityType: 'login' | 'documents' | 'both' = 'both') => {
    const generatedDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    let filtersText = ''
    if (dateFrom || dateTo) {
      filtersText = `<div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;"><strong>Period:</strong><br>From: ${dateFrom} To: ${dateTo}</div>`
    }
    
    let activityTypeText = ''
    if (activityType === 'login') {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;"><strong>نوع النشاط:</strong> تسجيل الدخول فقط</div>'
    } else if (activityType === 'documents') {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px;"><strong>نوع النشاط:</strong> الوثائق التي رفعها فقط</div>'
    } else {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #fff3e0; border-radius: 8px;"><strong>نوع النشاط:</strong> كلاهما (تسجيل الدخول والوثائق)</div>'
    }

    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }

    const pdfContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, 'Arial Unicode MS', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
            color: #333;
          }
          .header {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .header-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            background: white;
            padding: 8px;
            border-radius: 8px;
          }
          .header-content {
            flex: 1;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          table thead {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
          }
          table th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
          }
          table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
          }
          table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 15px 0;
            color: #00BCD4;
            padding-bottom: 10px;
            border-bottom: 2px solid #00BCD4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/Image/icon.png" alt="شعار المركز" class="header-logo" onerror="this.style.display='none'" />
          <div class="header-content">
            <h1> User Activity Report / تقرير نشاط المستخدم</h1>
            <p>نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية</p>
            <p>User: ${data.user.username} ${data.user.full_name ? `(${data.user.full_name})` : ''}</p>
            <p>Generated: ${generatedDate}</p>
          </div>
        </div>
        ${filtersText}
        ${activityTypeText}
        
        ${(activityType === 'both' || activityType === 'login') && data.activities.count > 0 ? `
        <div class="section-title">Activities / النشاطات (${data.activities.count})</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Action / الإجراء</th>
              <th>Date & Time / التاريخ والوقت (بدقة الساعة)</th>
              <th>IP Address / عنوان IP</th>
            </tr>
          </thead>
          <tbody>
            ${data.activities.items.map((activity: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${activity.action}</td>
                <td>${formatDate(activity.timestamp)}</td>
                <td>${activity.ip_address || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        ${(activityType === 'both' || activityType === 'documents') && data.documents.count > 0 ? `
        <div class="section-title">Documents / الوثائق (${data.documents.count})</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Document Number / رقم الوثيقة</th>
              <th>Title / العنوان</th>
              <th>Date & Time / التاريخ والوقت (بدقة الساعة)</th>
              <th>Direction / الاتجاه</th>
              <th>Classification / التصنيف</th>
            </tr>
          </thead>
          <tbody>
            ${data.documents.items.map((doc: any, idx: number) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${doc.document_number || '-'}</td>
                <td>${doc.title || 'بدون عنوان'}</td>
                <td>${formatDate(doc.created_at)}</td>
                <td>${doc.document_direction}</td>
                <td>${doc.ai_classification}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('فشل فتح نافذة الطباعة')
      return
    }
    
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  const exportUserActivityExcel = async (data: any, dateFrom: string, dateTo: string, activityType: 'login' | 'documents' | 'both' = 'both') => {
    const workbook = new ExcelJS.Workbook()
    const headerColor = '00BCD4'
    const headerTextColor = 'FFFFFF'
    const altRowColor = 'F5F5F5'
    const borderColor = 'E0E0E0'

    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }

    // Sheet 1: Activities (only if needed)
    if (activityType === 'both' || activityType === 'login') {
      const activitiesSheet = workbook.addWorksheet('Activities')
      
      activitiesSheet.mergeCells('A1:D1')
      activitiesSheet.getCell('A1').value = ` User Activity Report / تقرير نشاط المستخدم - ${data.user.username}`
      activitiesSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
      activitiesSheet.getCell('A1').alignment = { horizontal: 'center' }
      
      activitiesSheet.mergeCells('A2:D2')
      let dateRowText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}`
      if (dateFrom || dateTo) {
        dateRowText += ` | Period: ${dateFrom} to ${dateTo}`
      }
      let activityTypeText = ''
      if (activityType === 'login') {
        activityTypeText = ' | Type: تسجيل الدخول فقط'
      } else if (activityType === 'documents') {
        activityTypeText = ' | Type: الوثائق فقط'
      } else {
        activityTypeText = ' | Type: كلاهما'
      }
      activitiesSheet.getCell('A2').value = dateRowText + activityTypeText
      activitiesSheet.getCell('A2').font = { size: 11 }
      activitiesSheet.getCell('A2').alignment = { horizontal: 'center' }
      
      activitiesSheet.getRow(3).height = 5
      
      activitiesSheet.getCell('A4').value = '#'
      activitiesSheet.getCell('B4').value = 'Action / الإجراء'
      activitiesSheet.getCell('C4').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
      activitiesSheet.getCell('D4').value = 'IP Address / عنوان IP'
      activitiesSheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
      activitiesSheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
      activitiesSheet.getRow(4).alignment = { horizontal: 'center' }
      
      data.activities.items.forEach((activity: any, idx: number) => {
        const rowNum = 5 + idx
        activitiesSheet.getCell(`A${rowNum}`).value = idx + 1
        activitiesSheet.getCell(`B${rowNum}`).value = activity.action
        activitiesSheet.getCell(`C${rowNum}`).value = formatDate(activity.timestamp)
        activitiesSheet.getCell(`D${rowNum}`).value = activity.ip_address || '-'
        
        if (idx % 2 === 0) {
          activitiesSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
        }
      })
      
      activitiesSheet.getColumn(1).width = 8
      activitiesSheet.getColumn(2).width = 25
      activitiesSheet.getColumn(3).width = 30
      activitiesSheet.getColumn(4).width = 18

      // Add borders
      const activitiesLastRow = 5 + data.activities.items.length - 1
      for (let i = 4; i <= activitiesLastRow; i++) {
        ['A', 'B', 'C', 'D'].forEach(col => {
          activitiesSheet.getCell(`${col}${i}`).border = {
            top: { style: 'thin', color: { argb: 'FF' + borderColor } },
            left: { style: 'thin', color: { argb: 'FF' + borderColor } },
            bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
            right: { style: 'thin', color: { argb: 'FF' + borderColor } }
          }
        })
      }
    }

    // Sheet 2: Documents (only if needed)
    if (activityType === 'both' || activityType === 'documents') {
      const documentsSheet = workbook.addWorksheet('Documents')
      
      documentsSheet.mergeCells('A1:F1')
      documentsSheet.getCell('A1').value = ` Documents by ${data.user.username} / وثائق ${data.user.username}`
      documentsSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
      documentsSheet.getCell('A1').alignment = { horizontal: 'center' }
      
      documentsSheet.mergeCells('A2:F2')
      let dateRowText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}`
      if (dateFrom || dateTo) {
        dateRowText += ` | Period: ${dateFrom} to ${dateTo}`
      }
      let activityTypeText = ''
      if (activityType === 'login') {
        activityTypeText = ' | Type: تسجيل الدخول فقط'
      } else if (activityType === 'documents') {
        activityTypeText = ' | Type: الوثائق فقط'
      } else {
        activityTypeText = ' | Type: كلاهما'
      }
      documentsSheet.getCell('A2').value = dateRowText + activityTypeText
      documentsSheet.getCell('A2').font = { size: 11 }
      documentsSheet.getCell('A2').alignment = { horizontal: 'center' }
      
      documentsSheet.getRow(3).height = 5
      
      documentsSheet.getCell('A4').value = '#'
      documentsSheet.getCell('B4').value = 'Document Number / رقم الوثيقة'
      documentsSheet.getCell('C4').value = 'Title / العنوان'
      documentsSheet.getCell('D4').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
      documentsSheet.getCell('E4').value = 'Direction / الاتجاه'
      documentsSheet.getCell('F4').value = 'Classification / التصنيف'
      documentsSheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
      documentsSheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
      documentsSheet.getRow(4).alignment = { horizontal: 'center' }
      
      data.documents.items.forEach((doc: any, idx: number) => {
        const rowNum = 5 + idx
        documentsSheet.getCell(`A${rowNum}`).value = idx + 1
        documentsSheet.getCell(`B${rowNum}`).value = doc.document_number || '-'
        documentsSheet.getCell(`C${rowNum}`).value = doc.title || 'بدون عنوان'
        documentsSheet.getCell(`D${rowNum}`).value = formatDate(doc.created_at)
        documentsSheet.getCell(`E${rowNum}`).value = doc.document_direction || 'غير محدد'
        documentsSheet.getCell(`F${rowNum}`).value = doc.ai_classification || 'غير مصنف'
        
        if (idx % 2 === 0) {
          documentsSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
        }
      })
      
      documentsSheet.getColumn(1).width = 8
      documentsSheet.getColumn(2).width = 20
      documentsSheet.getColumn(3).width = 40
      documentsSheet.getColumn(4).width = 30
      documentsSheet.getColumn(5).width = 15
      documentsSheet.getColumn(6).width = 20

      // Add borders
      const documentsLastRow = 5 + data.documents.items.length - 1
      for (let i = 4; i <= documentsLastRow; i++) {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
          documentsSheet.getCell(`${col}${i}`).border = {
            top: { style: 'thin', color: { argb: 'FF' + borderColor } },
            left: { style: 'thin', color: { argb: 'FF' + borderColor } },
            bottom: { style: 'thin', color: { argb: 'FF' + borderColor } },
            right: { style: 'thin', color: { argb: 'FF' + borderColor } }
          }
        })
      }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `User_Activity_${data.user.username}_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const exportUsersActivityPDF = (data: any, dateFrom: string, dateTo: string) => {
    const generatedDate = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })

    let filtersText = ''
    if (dateFrom || dateTo) {
      if (dateFrom === dateTo) {
        filtersText = `<div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;"><strong>التاريخ:</strong> ${dateFrom}</div>`
      } else {
        filtersText = `<div style="margin-bottom: 20px; padding: 15px; background: #f0f0f0; border-radius: 8px;"><strong>الفترة:</strong> من ${dateFrom} إلى ${dateTo}</div>`
      }
    }
    
    let activityTypeText = ''
    if (data.activity_type === 'login') {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;"><strong>نوع النشاط:</strong> تسجيل الدخول فقط</div>'
    } else if (data.activity_type === 'documents') {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px;"><strong>نوع النشاط:</strong> نشاط رفع الوثائق فقط</div>'
    } else {
      activityTypeText = '<div style="margin-bottom: 20px; padding: 15px; background: #fff3e0; border-radius: 8px;"><strong>نوع النشاط:</strong> كلاهما (تسجيل الدخول ونشاط رفع الوثائق)</div>'
    }

    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }

    let usersContent = ''
    data.users.forEach((userData: any, userIdx: number) => {
      usersContent += `
        <div style="page-break-inside: avoid; margin-bottom: 40px;">
          <div class="section-title" style="margin-top: 30px;">
 ${userData.user.username} ${userData.user.full_name ? `(${userData.user.full_name})` : ''}
          </div>
          
          ${(data.activity_type === 'both' || data.activity_type === 'login') && userData.activities.count > 0 ? `
          <div style="margin-top: 20px; margin-bottom: 15px;">
            <strong>نشاط تسجيل الدخول (${userData.activities.count})</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Action / الإجراء</th>
                <th>Date & Time / التاريخ والوقت (بدقة الساعة)</th>
                <th>IP Address / عنوان IP</th>
              </tr>
            </thead>
            <tbody>
              ${userData.activities.items.map((activity: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${activity.action}</td>
                  <td>${formatDate(activity.timestamp)}</td>
                  <td>${activity.ip_address || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}

          ${(data.activity_type === 'both' || data.activity_type === 'documents') && userData.documents.count > 0 ? `
          <div style="margin-top: 20px; margin-bottom: 15px;">
            <strong>الوثائق التي رفعها (${userData.documents.count})</strong>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Document Number / رقم الوثيقة</th>
                <th>Title / العنوان</th>
                <th>Date & Time / التاريخ والوقت (بدقة الساعة)</th>
                <th>Direction / الاتجاه</th>
                <th>Classification / التصنيف</th>
              </tr>
            </thead>
            <tbody>
              ${userData.documents.items.map((doc: any, idx: number) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${doc.document_number || '-'}</td>
                  <td>${doc.title || 'بدون عنوان'}</td>
                  <td>${formatDate(doc.created_at)}</td>
                  <td>${doc.document_direction}</td>
                  <td>${doc.ai_classification}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ` : ''}
        </div>
      `
    })

    const pdfContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, 'Arial Unicode MS', sans-serif;
            direction: rtl;
            background: white;
            padding: 20px;
            color: #333;
          }
          .header {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
          }
          .header-logo {
            width: 80px;
            height: 80px;
            object-fit: contain;
            background: white;
            padding: 8px;
            border-radius: 8px;
          }
          .header-content {
            flex: 1;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          table thead {
            background: linear-gradient(135deg, #00BCD4 0%, #0097A7 100%);
            color: white;
          }
          table th {
            padding: 15px;
            text-align: right;
            font-weight: bold;
          }
          table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
          }
          table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .section-title {
            font-size: 20px;
            font-weight: bold;
            margin: 30px 0 15px 0;
            color: #00BCD4;
            padding-bottom: 10px;
            border-bottom: 2px solid #00BCD4;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/Image/icon.png" alt="شعار المركز" class="header-logo" onerror="this.style.display='none'" />
          <div class="header-content">
            <h1>Users Activity Report / تقرير نشاط المستخدمين</h1>
            <p>نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية</p>
            <p>Total Users: ${data.total_users} / إجمالي المستخدمين: ${data.total_users}</p>
            <p>Generated: ${generatedDate}</p>
          </div>
        </div>
        ${filtersText}
        ${activityTypeText}
        
        ${usersContent}
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('فشل فتح نافذة الطباعة')
      return
    }
    
    printWindow.document.write(pdfContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 500)
  }

  const exportUsersActivityExcel = async (data: any, dateFrom: string, dateTo: string) => {
    const workbook = new ExcelJS.Workbook()
    const headerColor = '00BCD4'
    const headerTextColor = 'FFFFFF'
    const altRowColor = 'F5F5F5'
    const borderColor = 'E0E0E0'

    const formatDate = (timestamp?: string) => {
      if (!timestamp) return '—'
      try {
        const date = new Date(timestamp)
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      } catch {
        return timestamp
      }
    }

    // Create a sheet for each user or combine based on activity type
    if (data.activity_type === 'both') {
      // Sheet for each user with both activities and documents
      data.users.forEach((userData: any, userIdx: number) => {
        const userSheet = workbook.addWorksheet(`${userData.user.username}`)
        
        userSheet.mergeCells('A1:F1')
        userSheet.getCell('A1').value = ` ${userData.user.username} ${userData.user.full_name ? `(${userData.user.full_name})` : ''}`
        userSheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
        userSheet.getCell('A1').alignment = { horizontal: 'center' }
        
        let dateRowText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}`
        if (dateFrom === dateTo) {
          dateRowText += ` | Date: ${dateFrom}`
        } else {
          dateRowText += ` | Period: ${dateFrom} to ${dateTo}`
        }
        userSheet.mergeCells('A2:F2')
        userSheet.getCell('A2').value = dateRowText
        userSheet.getCell('A2').font = { size: 11 }
        userSheet.getCell('A2').alignment = { horizontal: 'center' }
        
        userSheet.getRow(3).height = 5
        
        // Activities section
        if (userData.activities.count > 0) {
          userSheet.mergeCells('A4:D4')
          userSheet.getCell('A4').value = `نشاط تسجيل الدخول (${userData.activities.count})`
          userSheet.getCell('A4').font = { bold: true, size: 12 }
          
          userSheet.getCell('A5').value = '#'
          userSheet.getCell('B5').value = 'Action / الإجراء'
          userSheet.getCell('C5').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
          userSheet.getCell('D5').value = 'IP Address / عنوان IP'
          userSheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
          userSheet.getRow(5).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
          
          userData.activities.items.forEach((activity: any, idx: number) => {
            const rowNum = 6 + idx
            userSheet.getCell(`A${rowNum}`).value = idx + 1
            userSheet.getCell(`B${rowNum}`).value = activity.action
            userSheet.getCell(`C${rowNum}`).value = formatDate(activity.timestamp)
            userSheet.getCell(`D${rowNum}`).value = activity.ip_address || '-'
            
            if (idx % 2 === 0) {
              userSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
            }
          })
          
          const activitiesEndRow = 6 + userData.activities.items.length
          userSheet.getRow(activitiesEndRow).height = 10
          
          // Documents section
          if (userData.documents.count > 0) {
            userSheet.mergeCells(`A${activitiesEndRow + 1}:F${activitiesEndRow + 1}`)
            userSheet.getCell(`A${activitiesEndRow + 1}`).value = `الوثائق التي رفعها (${userData.documents.count})`
            userSheet.getCell(`A${activitiesEndRow + 1}`).font = { bold: true, size: 12 }
            
            userSheet.getCell(`A${activitiesEndRow + 2}`).value = '#'
            userSheet.getCell(`B${activitiesEndRow + 2}`).value = 'Document Number / رقم الوثيقة'
            userSheet.getCell(`C${activitiesEndRow + 2}`).value = 'Title / العنوان'
            userSheet.getCell(`D${activitiesEndRow + 2}`).value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
            userSheet.getCell(`E${activitiesEndRow + 2}`).value = 'Direction / الاتجاه'
            userSheet.getCell(`F${activitiesEndRow + 2}`).value = 'Classification / التصنيف'
            userSheet.getRow(activitiesEndRow + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
            userSheet.getRow(activitiesEndRow + 2).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
            
            userData.documents.items.forEach((doc: any, idx: number) => {
              const rowNum = activitiesEndRow + 3 + idx
              userSheet.getCell(`A${rowNum}`).value = idx + 1
              userSheet.getCell(`B${rowNum}`).value = doc.document_number || '-'
              userSheet.getCell(`C${rowNum}`).value = doc.title || 'بدون عنوان'
              userSheet.getCell(`D${rowNum}`).value = formatDate(doc.created_at)
              userSheet.getCell(`E${rowNum}`).value = doc.document_direction || 'غير محدد'
              userSheet.getCell(`F${rowNum}`).value = doc.ai_classification || 'غير مصنف'
              
              if (idx % 2 === 0) {
                userSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
              }
            })
          }
        } else if (userData.documents.count > 0) {
          // Only documents
          userSheet.mergeCells('A4:F4')
          userSheet.getCell('A4').value = `الوثائق التي رفعها (${userData.documents.count})`
          userSheet.getCell('A4').font = { bold: true, size: 12 }
          
          userSheet.getCell('A5').value = '#'
          userSheet.getCell('B5').value = 'Document Number / رقم الوثيقة'
          userSheet.getCell('C5').value = 'Title / العنوان'
          userSheet.getCell('D5').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
          userSheet.getCell('E5').value = 'Direction / الاتجاه'
          userSheet.getCell('F5').value = 'Classification / التصنيف'
          userSheet.getRow(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
          userSheet.getRow(5).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
          
          userData.documents.items.forEach((doc: any, idx: number) => {
            const rowNum = 6 + idx
            userSheet.getCell(`A${rowNum}`).value = idx + 1
            userSheet.getCell(`B${rowNum}`).value = doc.document_number || '-'
            userSheet.getCell(`C${rowNum}`).value = doc.title || 'بدون عنوان'
            userSheet.getCell(`D${rowNum}`).value = formatDate(doc.created_at)
            userSheet.getCell(`E${rowNum}`).value = doc.document_direction || 'غير محدد'
            userSheet.getCell(`F${rowNum}`).value = doc.ai_classification || 'غير مصنف'
            
            if (idx % 2 === 0) {
              userSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
            }
          })
        }
        
        userSheet.getColumn(1).width = 8
        userSheet.getColumn(2).width = 25
        userSheet.getColumn(3).width = 40
        userSheet.getColumn(4).width = 30
        userSheet.getColumn(5).width = 15
        userSheet.getColumn(6).width = 20
      })
    } else {
      // Single sheet for all users (login or documents only)
      const sheet = workbook.addWorksheet('Users Activity')
      
      sheet.mergeCells('A1:E1')
      sheet.getCell('A1').value = `Users Activity Report / تقرير نشاط المستخدمين`
      sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF' + headerColor } }
      sheet.getCell('A1').alignment = { horizontal: 'center' }
      
      sheet.mergeCells('A2:E2')
      let dateRowText = `Generated: ${new Date().toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}`
      if (dateFrom === dateTo) {
        dateRowText += ` | Date: ${dateFrom}`
      } else {
        dateRowText += ` | Period: ${dateFrom} to ${dateTo}`
      }
      let activityTypeText = data.activity_type === 'login' ? ' | Type: تسجيل الدخول فقط' : ' | Type: الوثائق فقط'
      sheet.getCell('A2').value = dateRowText + activityTypeText
      sheet.getCell('A2').font = { size: 11 }
      sheet.getCell('A2').alignment = { horizontal: 'center' }
      
      sheet.getRow(3).height = 5
      
      if (data.activity_type === 'login') {
        sheet.getCell('A4').value = 'Username / اسم المستخدم'
        sheet.getCell('B4').value = 'Full Name / الاسم الكامل'
        sheet.getCell('C4').value = 'Action / الإجراء'
        sheet.getCell('D4').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
        sheet.getCell('E4').value = 'IP Address / عنوان IP'
        
        let rowNum = 5
        data.users.forEach((userData: any) => {
          userData.activities.items.forEach((activity: any) => {
            sheet.getCell(`A${rowNum}`).value = userData.user.username
            sheet.getCell(`B${rowNum}`).value = userData.user.full_name || '-'
            sheet.getCell(`C${rowNum}`).value = activity.action
            sheet.getCell(`D${rowNum}`).value = formatDate(activity.timestamp)
            sheet.getCell(`E${rowNum}`).value = activity.ip_address || '-'
            
            if ((rowNum - 5) % 2 === 0) {
              sheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
            }
            rowNum++
          })
        })
        
        sheet.getColumn(1).width = 20
        sheet.getColumn(2).width = 25
        sheet.getColumn(3).width = 25
        sheet.getColumn(4).width = 30
        sheet.getColumn(5).width = 18
      } else {
        sheet.getCell('A4').value = 'Username / اسم المستخدم'
        sheet.getCell('B4').value = 'Full Name / الاسم الكامل'
        sheet.getCell('C4').value = 'Document Number / رقم الوثيقة'
        sheet.getCell('D4').value = 'Title / العنوان'
        sheet.getCell('E4').value = 'Date & Time / التاريخ والوقت (بدقة الساعة)'
        
        let rowNum = 5
        data.users.forEach((userData: any) => {
          userData.documents.items.forEach((doc: any) => {
            sheet.getCell(`A${rowNum}`).value = userData.user.username
            sheet.getCell(`B${rowNum}`).value = userData.user.full_name || '-'
            sheet.getCell(`C${rowNum}`).value = doc.document_number || '-'
            sheet.getCell(`D${rowNum}`).value = doc.title || 'بدون عنوان'
            sheet.getCell(`E${rowNum}`).value = formatDate(doc.created_at)
            
            if ((rowNum - 5) % 2 === 0) {
              sheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + altRowColor } }
            }
            rowNum++
          })
        })
        
        sheet.getColumn(1).width = 20
        sheet.getColumn(2).width = 25
        sheet.getColumn(3).width = 20
        sheet.getColumn(4).width = 40
        sheet.getColumn(5).width = 30
      }
      
      sheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + headerColor } }
      sheet.getRow(4).font = { bold: true, color: { argb: 'FF' + headerTextColor } }
      sheet.getRow(4).alignment = { horizontal: 'center' }
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Users_Activity_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">جارٍ تحميل الإحصائيات...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card max-w-2xl mx-auto text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/10 to-red-400/5 border-2 border-dashed border-red-500/30 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-red-400/50 rounded-lg"></div>
        </div>
        <h2 className="text-xl font-bold text-red-400 mb-2">خطأ</h2>
        <p className="text-text-secondary">{error}</p>
        <button onClick={loadStats} className="btn-primary mt-4">
          إعادة المحاولة
        </button>
      </div>
    )
  }

  if (!stats) return null

  // تحويل البيانات للرسوم البيانية
  const classificationChartData = Object.entries(stats.classification_distribution).map(([name, value]) => ({
    name,
    value,
  }))

  const directionChartData = Object.entries(stats.direction_distribution).map(([name, value]) => ({
    name,
    value,
  }))

  const sourceChartData = Object.entries(stats.source_distribution).map(([name, value]) => ({
    name: name === 'file' ? 'ملف' : name === 'scanner' ? 'سكانر' : name,
    value,
  }))

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2"> التقارير والإحصائيات</h1>
            <p className="text-text-secondary">نظرة شاملة على أداء النظام</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openExportModal('excel')}
              className="px-4 py-2 rounded-xl border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-400 transition"
            >
 تصدير Excel
            </button>
            <button
              onClick={() => openExportModal('pdf')}
              className="px-4 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
            >
 تصدير PDF
            </button>
            <button onClick={loadStats} className="btn-primary flex items-center gap-2">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/50"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-white/80"></span>
              </span>
              تحديث
            </button>
          </div>
        </div>
      </div>

      {/* فلترة التقارير */}
      <div className="card">
        <h2 className="text-xl font-bold text-cyan-400 mb-4"> فلترة التقارير</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              من تاريخ
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                المستخدم
              </label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
              >
                <option value="">جميع المستخدمين</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} {user.full_name ? `(${user.full_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 rounded-lg border border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 transition"
            >
 مسح الفلاتر
            </button>
          </div>
        </div>
        {(dateFrom || dateTo || selectedUserId) && (
          <div className="mt-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-sm">
            <span className="text-text-secondary">الفلاتر النشطة: </span>
            {dateFrom && <span className="text-cyan-400">من {dateFrom}</span>}
            {dateTo && <span className="text-cyan-400 mr-2">إلى {dateTo}</span>}
            {selectedUserId && (
              <span className="text-cyan-400">
                مستخدم: {users.find(u => u.id === selectedUserId)?.username}
              </span>
            )}
          </div>
        )}
      </div>

      {/* بطاقات الملخص - منظمة بشكل أفضل */}
      <div className="space-y-6">
        {/* مجموعة 1: إحصائيات الوثائق */}
        <div>
          <h2 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            إحصائيات الوثائق
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 border-cyan-500/40 hover:border-cyan-500/60 transition-all duration-300 shadow-lg shadow-cyan-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">إجمالي الوثائق</p>
                  <p className="text-4xl font-bold text-cyan-400 mb-1">{stats.summary.total_documents}</p>
                  <p className="text-xs text-text-secondary">وثيقة في النظام</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600/30 to-cyan-400/20 border border-cyan-400/40 flex flex-col justify-center items-center gap-1">
                    <span className="w-8 h-1 rounded-full bg-cyan-300/60"></span>
                    <span className="w-10 h-1 rounded-full bg-cyan-300/40"></span>
                    <span className="w-6 h-1 rounded-full bg-cyan-300/30"></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60 transition-all duration-300 shadow-lg shadow-emerald-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">الوثائق اليوم</p>
                  <p className="text-4xl font-bold text-emerald-400 mb-1">{stats.summary.documents_today}</p>
                  <p className="text-xs text-text-secondary">وثيقة جديدة اليوم</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-400/10 border border-emerald-400/40 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-xl border border-emerald-300/50 bg-emerald-500/10 flex flex-col">
                      <div className="h-2 border-b border-emerald-300/40 flex justify-between px-1">
                        <span className="w-2 h-1 bg-emerald-300/60 rounded"></span>
                        <span className="w-2 h-1 bg-emerald-300/60 rounded"></span>
                      </div>
                      <div className="flex-1 grid grid-cols-3 gap-0.5 p-1">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <span key={idx} className="rounded-sm bg-emerald-400/20"></span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-blue-500/15 to-blue-500/5 border-blue-500/40 hover:border-blue-500/60 transition-all duration-300 shadow-lg shadow-blue-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">آخر 7 أيام</p>
                  <p className="text-4xl font-bold text-blue-400 mb-1">{stats.summary.documents_last_7_days}</p>
                  <p className="text-xs text-text-secondary">وثيقة هذا الأسبوع</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/25 to-blue-400/10 border border-blue-400/40 flex items-center justify-center relative">
                    <div className="w-10 h-10 border-2 border-blue-300/40 rounded-lg absolute bottom-2"></div>
                    <div className="w-8 h-8 border-2 border-blue-300/70 border-t-transparent border-r-transparent rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* مجموعة 2: إحصائيات المستخدمين والأداء (للمدير فقط) */}
        {isAdmin && <div>
          <h2 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400"></span>
            إحصائيات المستخدمين والأداء
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-purple-500/15 to-purple-500/5 border-purple-500/40 hover:border-purple-500/60 transition-all duration-300 shadow-lg shadow-purple-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">إجمالي المستخدمين</p>
                  <p className="text-4xl font-bold text-purple-400 mb-1">{stats.summary.total_users}</p>
                  <p className="text-xs text-text-secondary">مستخدم مسجل</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/25 to-purple-400/10 border border-purple-400/40 flex items-center justify-center">
                    <div className="flex -space-x-2">
                      <span className="w-6 h-6 rounded-full border border-purple-300/60 bg-purple-500/20"></span>
                      <span className="w-6 h-6 rounded-full border border-purple-300/40 bg-purple-500/10"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-orange-500/15 to-orange-500/5 border-orange-500/40 hover:border-orange-500/60 transition-all duration-300 shadow-lg shadow-orange-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">المستخدمون النشطون</p>
                  <p className="text-4xl font-bold text-orange-400 mb-1">{stats.summary.active_users}</p>
                  <p className="text-xs text-text-secondary">مستخدم نشط</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/25 to-orange-400/10 border border-orange-400/40 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-orange-300/70 border-t-transparent border-l-transparent rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-gradient-to-br from-pink-500/15 to-pink-500/5 border-pink-500/40 hover:border-pink-500/60 transition-all duration-300 shadow-lg shadow-pink-500/10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-text-secondary text-xs mb-2 font-medium">متوسط دقة OCR</p>
                  <p className="text-4xl font-bold text-pink-400 mb-1">{stats.summary.avg_ocr_accuracy}%</p>
                  <p className="text-xs text-text-secondary">دقة الاستخراج</p>
                </div>
                <div className="ml-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/25 to-pink-400/10 border border-pink-400/40 flex items-center justify-center">
                    <div className="w-10 h-10 border border-pink-200/60 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border border-pink-200/60 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-pink-300"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}
      </div>

      {/* الرسوم البيانية - محسّنة بشكل أفضل */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-cyan-400 flex items-center gap-2">
          <span className="text-2xl"></span>
          التحليل البصري للبيانات
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* النشاط اليومي - محسّن */}
          <div className="card bg-gradient-to-br from-base-900 to-base-800 border-cyan-500/20 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-400/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-cyan-300/60 border-t-transparent border-r-transparent rotate-45"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-cyan-400">النشاط اليومي</h3>
                <p className="text-xs text-text-secondary">آخر 30 يوم من النشاط</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={stats.daily_activity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00BCD4" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#00BCD4" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis 
                  dataKey="date" 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickMargin={8}
                />
                <YAxis 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickMargin={8}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #00BCD4',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                  labelStyle={{ color: '#00BCD4', fontWeight: 'bold' }}
                  itemStyle={{ color: '#00BCD4' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#00BCD4" 
                  strokeWidth={3} 
                  dot={{ fill: '#00BCD4', r: 5, strokeWidth: 2, stroke: '#1a1a1a' }}
                  activeDot={{ r: 7, fill: '#00BCD4' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* التصنيف - دائرة محسّنة بدون نصوص داخلية */}
          <div className="card bg-gradient-to-br from-base-900 to-base-800 border-purple-500/20 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-purple-400 mb-1"> توزيع حسب التصنيف</h3>
              <p className="text-xs text-text-secondary">نسبة كل نوع من الوثائق</p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={classificationChartData}
                  cx="50%"
                  cy="45%"
                  labelLine={false}
                  outerRadius={90}
                  innerRadius={50}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={450}
                >
                  {classificationChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]}
                      stroke="#1a1a1a"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any, props: any) => {
                    const percent = ((value / classificationChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)
                    return [`${value} وثيقة (${percent}%)`, props.payload.name]
                  }}
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #00BCD4',
                    borderRadius: '8px',
                    padding: '10px',
                    direction: 'rtl'
                  }}
                  labelStyle={{ color: '#00BCD4', fontWeight: 'bold', fontSize: '13px' }}
                  itemStyle={{ color: '#888', fontSize: '12px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={80}
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value, entry: any) => {
                    const data = classificationChartData.find(d => d.name === value)
                    const total = classificationChartData.reduce((sum, item) => sum + item.value, 0)
                    const percent = data ? ((data.value / total) * 100).toFixed(1) : '0'
                    return (
                      <span style={{ color: '#888', fontSize: '12px', marginRight: '5px' }}>
                        {value} - {data?.value} ({percent}%)
                      </span>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* الاتجاه - أعمدة محسّنة */}
          <div className="card bg-gradient-to-br from-base-900 to-base-800 border-blue-500/20 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-400/10 border border-blue-400/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-300/70 border-b-transparent border-l-transparent rotate-45"></div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-400">توزيع حسب الاتجاه</h3>
                <p className="text-xs text-text-secondary">صادر مقابل وارد</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={directionChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00BCD4" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0097A7" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickMargin={8}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #00BCD4',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                  labelStyle={{ color: '#00BCD4', fontWeight: 'bold' }}
                  itemStyle={{ color: '#00BCD4' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGradient1)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* المصدر - أعمدة محسّنة */}
          <div className="card bg-gradient-to-br from-base-900 to-base-800 border-green-500/20 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-green-400 mb-1">توزيع حسب المصدر</h3>
              <p className="text-xs text-text-secondary">ملف مقابل سكانر</p>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sourceChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4ECDC4" stopOpacity={1} />
                    <stop offset="100%" stopColor="#26A69A" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 12 }}
                  tickMargin={8}
                />
                <YAxis 
                  stroke="#888" 
                  tick={{ fill: '#888', fontSize: 11 }}
                  tickMargin={8}
                />
                <Tooltip
                  contentStyle={{ 
                    backgroundColor: '#1a1a1a', 
                    border: '1px solid #4ECDC4',
                    borderRadius: '8px',
                    padding: '10px'
                  }}
                  labelStyle={{ color: '#4ECDC4', fontWeight: 'bold' }}
                  itemStyle={{ color: '#4ECDC4' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="url(#barGradient2)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* أكثر المستخدمين نشاطاً (للمدير فقط) */}
      {isAdmin && <div className="card">
        <h2 className="text-xl font-semibold text-cyan-400 mb-4">أكثر المستخدمين نشاطاً</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,188,212,0.12)]">
                <th className="text-right py-3 px-4 text-text-secondary font-semibold">#</th>
                <th className="text-right py-3 px-4 text-text-secondary font-semibold">اسم المستخدم</th>
                <th className="text-right py-3 px-4 text-text-secondary font-semibold">الاسم الكامل</th>
                <th className="text-right py-3 px-4 text-text-secondary font-semibold">عدد الوثائق</th>
              </tr>
            </thead>
            <tbody>
              {stats.top_users.map((user, idx) => (
                <tr key={idx} className="border-b border-[rgba(0,188,212,0.06)] hover:bg-base-800/30">
                  <td className="py-3 px-4 text-text-secondary">{idx + 1}</td>
                  <td className="py-3 px-4 text-cyan-400 font-mono">{user.username}</td>
                  <td className="py-3 px-4">{user.full_name || '-'}</td>
                  <td className="py-3 px-4 font-semibold">{user.document_count}</td>
                </tr>
              ))}
              {stats.top_users.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-text-secondary">
                    لا توجد بيانات
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <style>{`
            select option {
              background-color: #1a1a1a !important;
              color: #e0e0e0 !important;
            }
            select option:hover {
              background-color: #00BCD4 !important;
              color: white !important;
            }
          `}</style>
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-cyan-400">
                {exportType === 'pdf' ? ' تصدير PDF' : ' تصدير Excel'}
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-text-secondary hover:text-red-400 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  نوع التقرير
                </label>
                <select
                  value={reportType}
                  onChange={(e) => {
                    setReportType(e.target.value)
                    // Reset filters when changing report type
                    setExportDateFrom('')
                    setExportDateTo('')
                    setExportUserId(null)
                    setExportPeriod('custom')
                    setUserActivityType('both')
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                  style={{
                    backgroundColor: 'rgba(26, 26, 26, 0.8)',
                    color: '#e0e0e0'
                  }}
                >
                  <option value="">اختر نوع التقرير...</option>
                  {isAdmin ? (
                    <>
                      <option value="all_documents">جميع الوثائق</option>
                      <option value="documents_by_date">الوثائق حسب التاريخ (من - إلى)</option>
                      <option value="documents_by_period">الوثائق حسب الفترة (أسبوع / شهر)</option>
                      <option value="user_documents">وثائق مستخدم محدد</option>
                      <option value="user_activity">نشاط مستخدم محدد (جميع العمليات والوثائق)</option>
                      <option value="users_report">تقرير المستخدمين</option>
                      <option value="login_activity">نشاط تسجيل الدخول</option>
                    </>
                  ) : (
                    <>
                      <option value="my_documents_all">جميع وثائقي</option>
                      <option value="documents_by_date">وثائقي حسب التاريخ (من - إلى)</option>
                      <option value="documents_by_period">وثائقي حسب الفترة (أسبوع / شهر)</option>
                      <option value="documents_by_day">وثائقي في يوم محدد</option>
                    </>
                  )}
                </select>
              </div>

              {reportType === 'users_report' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    نوع النشاط
                  </label>
                  <select
                    value={userActivityType}
                    onChange={(e) => setUserActivityType(e.target.value as 'login' | 'documents' | 'both')}
                    className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                    style={{
                      backgroundColor: 'rgba(26, 26, 26, 0.8)',
                      color: '#e0e0e0'
                    }}
                  >
                    <option value="both">كلاهما (تسجيل الدخول والوثائق)</option>
                    <option value="login">نشاط تسجيل الدخول</option>
                    <option value="documents">نشاط رفع الوثائق</option>
                  </select>
                </div>
              )}

              {reportType === 'users_report' && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    نوع التاريخ
                  </label>
                  <select
                    value={exportPeriod}
                    onChange={(e) => {
                      setExportPeriod(e.target.value as 'day' | 'range')
                      if (e.target.value === 'day') {
                        setExportDateTo('')
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                    style={{
                      backgroundColor: 'rgba(26, 26, 26, 0.8)',
                      color: '#e0e0e0'
                    }}
                  >
                    <option value="day">يوم محدد</option>
                    <option value="range">من تاريخ إلى تاريخ</option>
                  </select>
                </div>
              )}

              {(reportType === 'documents_by_period' || reportType === 'documents_by_date' || reportType === 'documents_by_day' || reportType === 'user_activity' || reportType === 'login_activity') && (
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    الفترة الزمنية
                  </label>
                  <select
                    value={exportPeriod}
                    onChange={(e) => {
                      setExportPeriod(e.target.value as 'week' | 'month' | 'custom')
                      if (e.target.value !== 'custom') {
                        const dates = calculateDatesFromPeriod(e.target.value as 'week' | 'month')
                        setExportDateFrom(dates.from)
                        setExportDateTo(dates.to)
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                    style={{
                      backgroundColor: 'rgba(26, 26, 26, 0.8)',
                      color: '#e0e0e0'
                    }}
                  >
                    <option value="custom">تاريخ مخصص</option>
                    <option value="week">آخر أسبوع</option>
                    <option value="month">آخر شهر</option>
                  </select>
                </div>
              )}

              {reportType === 'users_report' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        {exportPeriod === 'day' ? 'التاريخ' : 'من تاريخ'}
                      </label>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => {
                          setExportDateFrom(e.target.value)
                          if (exportPeriod === 'day') {
                            setExportDateTo(e.target.value)
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
                        style={{
                          backgroundColor: 'rgba(26, 26, 26, 0.8)',
                          color: '#e0e0e0'
                        }}
                      />
                    </div>
                    {exportPeriod === 'range' && (
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          إلى تاريخ
                        </label>
                        <input
                          type="date"
                          value={exportDateTo}
                          onChange={(e) => setExportDateTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
                          style={{
                            backgroundColor: 'rgba(26, 26, 26, 0.8)',
                            color: '#e0e0e0'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary bg-base-800/50 p-2 rounded-lg border border-[rgba(255,255,255,0.05)]">
                    ملاحظة: سيتم عرض الوقت بدقة (الساعة والدقيقة) في التقرير لجميع المستخدمين
                  </div>
                </div>
              )}

              {(exportPeriod === 'custom' || reportType === 'documents_by_date' || reportType === 'documents_by_day' || (reportType === 'user_activity' && exportPeriod === 'custom') || (reportType === 'login_activity' && exportPeriod === 'custom')) && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        {reportType === 'documents_by_day' ? 'التاريخ' : 'من تاريخ'}
                      </label>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => {
                          setExportDateFrom(e.target.value)
                          if (reportType === 'documents_by_day') {
                            setExportDateTo(e.target.value)
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
                        style={{
                          backgroundColor: 'rgba(26, 26, 26, 0.8)',
                          color: '#e0e0e0'
                        }}
                      />
                    </div>
                    {reportType !== 'documents_by_day' && (
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                          إلى تاريخ
                        </label>
                        <input
                          type="date"
                          value={exportDateTo}
                          onChange={(e) => setExportDateTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500"
                          style={{
                            backgroundColor: 'rgba(26, 26, 26, 0.8)',
                            color: '#e0e0e0'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  
                  {(reportType === 'user_activity' || reportType === 'login_activity') && (
                    <div className="text-xs text-text-secondary bg-base-800/50 p-2 rounded-lg border border-[rgba(255,255,255,0.05)]">
                      ملاحظة: سيتم عرض الوقت بدقة (الساعة والدقيقة) في التقرير
                    </div>
                  )}
                </div>
              )}

              {(reportType === 'user_documents' || reportType === 'user_activity') && isAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      المستخدم
                    </label>
                    <select
                      value={exportUserId || ''}
                      onChange={(e) => setExportUserId(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                      style={{
                        backgroundColor: 'rgba(26, 26, 26, 0.8)',
                        color: '#e0e0e0'
                      }}
                    >
                      <option value="">اختر المستخدم...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} {user.full_name ? `(${user.full_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {reportType === 'user_activity' && exportUserId && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">
                        نوع النشاط
                      </label>
                      <select
                        value={userActivityType}
                        onChange={(e) => setUserActivityType(e.target.value as 'login' | 'documents' | 'both')}
                        className="w-full px-3 py-2 rounded-lg bg-base-800 border border-[rgba(255,255,255,0.1)] text-text-primary focus:outline-none focus:border-cyan-500 text-sm"
                        style={{
                          backgroundColor: 'rgba(26, 26, 26, 0.8)',
                          color: '#e0e0e0'
                        }}
                      >
                        <option value="both">كلاهما (تسجيل الدخول والوثائق)</option>
                        <option value="login">تسجيل الدخول فقط</option>
                        <option value="documents">الوثائق التي رفعها فقط</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleExport}
                  className="flex-1 btn-primary"
                >
                  {exportType === 'pdf' ? ' تصدير PDF' : ' تصدير Excel'}
                </button>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-500/30 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports

