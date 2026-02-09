import { useState, DragEvent, useRef, useCallback, useEffect } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

function Upload() {
  const { theme } = useTheme()
  const [file, setFile] = useState<File | null>(null)
  const [sourceType, setSourceType] = useState<'file' | 'scanner'>('file')
  const [direction, setDirection] = useState<'صادر' | 'وارد' | ''>('')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [progress, setProgress] = useState(0)
  const [uploadedDoc, setUploadedDoc] = useState<any>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [scannerBusy, setScannerBusy] = useState(false)
  const [scannerMsg, setScannerMsg] = useState<string>('')
  const [dwObject, setDwObject] = useState<any>(null)

  const handleFileSelected = useCallback((input: HTMLInputElement | null) => {
    if (!input) return
    const selectedFile = input.files?.[0] || null
    setFile(selectedFile)
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(selectedFile)
    } else {
      setImagePreview(null)
    }
  }, [])

  // Initialize scanner when user switches to scanner tab
  useEffect(() => {
    if (sourceType !== 'scanner') {
      // Cleanup when switching away from scanner
      if (dwObject) {
        try {
          dwObject.Destroy()
        } catch (e) {
          // Ignore cleanup errors
        }
        setDwObject(null)
      }
      setScannerReady(false)
      setScannerMsg('')
      return
    }

    let cancelled = false
    let checkInterval: any = null

    async function waitForLibrary(maxAttempts = 40, delay = 500) {
      const anyWindow: any = window as any
      for (let i = 0; i < maxAttempts; i++) {
        if (cancelled) return false

        // التحقق من وجود المكتبة بطرق مختلفة
        if (anyWindow?.Dynamsoft) {
          // بعض الإصدارات تستخدم Dynamsoft.DWT مباشرة
          if (anyWindow.Dynamsoft.DWT) {
            console.log('Dynamsoft DWT found')
            return true
          }
          // بعض الإصدارات تحتاج WebTwainEnv
          if (anyWindow.Dynamsoft.WebTwainEnv && anyWindow.Dynamsoft.DWT) {
            console.log('Dynamsoft WebTwainEnv and DWT found')
            return true
          }
        }

        // التحقق من وجود المكتبة ككائن عام
        if (typeof (window as any).Dynamsoft !== 'undefined') {
          const DWT = (window as any).Dynamsoft?.DWT
          if (DWT) {
            console.log('Dynamsoft library detected')
            return true
          }
        }

        if (i % 5 === 0 && i > 0) {
          console.log(`Still waiting for Dynamsoft library... (${i}/${maxAttempts})`)
        }
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      console.error('Dynamsoft library not loaded after maximum attempts')
      return false
    }

    async function init() {
      try {
        setScannerMsg('جارٍ تحميل مكتبة السكانر...')

        // انتظر تحميل المكتبة
        const libraryLoaded = await waitForLibrary()
        if (cancelled) return

        const anyWindow: any = window as any
        if (!libraryLoaded || !anyWindow.Dynamsoft) {
          setScannerMsg('لم يتم تحميل مكتبة السكانر. تأكد من الاتصال بالإنترنت وتحديث الصفحة.')
          setScannerReady(false)
          return
        }

        setScannerMsg('جارٍ تهيئة السكانر...')

        // إعدادات Dynamsoft الأساسية
        // مفتاح تجريبي عام لمدة 30 يوم (يمكن استبداله بمفتاحك الخاص)
        anyWindow.Dynamsoft.DWT.ProductKey = "t0068DvAAAAJ+/R9iKqM8Jd78Jz8K0m4f0q8k8j4m2n6l8k8j4m2n6l8k8j4m2n6l8k8j4m2n6l8k8j4m2n6l8k8j4m2n6l8k8";

        if (anyWindow.Dynamsoft.WebTwainEnv) {
          anyWindow.Dynamsoft.WebTwainEnv.ResourcesPath = 'https://cdn.jsdelivr.net/npm/dwt@18.4.1/dist'
        }
        anyWindow.Dynamsoft.DWT.AutoLoad = false;
        anyWindow.Dynamsoft.DWT.UseLocalService = true; // فرض استخدام الخدمة المحلية

        // انتظر قليلاً للتأكد من الإعدادات
        await new Promise(resolve => setTimeout(resolve, 500))

        // محاولة إنشاء كائن DWT مع التعامل مع الأخطاء
        let obj
        try {
          // محاولة التحميل
          if (anyWindow.Dynamsoft.DWT.CreateDWTObject) {
            // استخدام معرف فريد للحاوية لضمان عدم التعارض
            const containerId = 'dwt-container-' + Date.now();
            // إنشاء عنصر div مخفي للحاوية إذا لزم الأمر (Dynamsoft يحتاجه أحياناً)
            if (!document.getElementById('dwt-control-container')) {
              const container = document.createElement('div');
              container.id = 'dwt-control-container';
              container.style.display = 'none'; // إخفاء الحاوية
              document.body.appendChild(container);
            }

            obj = await anyWindow.Dynamsoft.DWT.CreateDWTObject();
          } else {
            throw new Error('دالة CreateDWTObject غير موجودة');
          }
        } catch (createError: any) {
          console.error('CreateDWTObject failed:', createError);
          throw new Error('فشل إنشاء كائن السكانر: ' + (createError.message || 'خطأ غير معروف'));
        }

        if (cancelled) return

        setDwObject(obj)
        setScannerReady(true)
        setScannerMsg('السكانر جاهز. اختر المصدر ثم ابدأ المسح.')

      } catch (e: any) {
        if (cancelled) return
        console.error('Scanner init error:', e);
        const errorMsg = e?.message || String(e)
        // رسالة مفصلة للمستخدم
        if (errorMsg.includes('Service')) {
          setScannerMsg('خدمة السكانر غير مثبتة أو لا تعمل. الرجاء تثبيت Dynamsoft Service وتشغيله.');
        } else {
          setScannerMsg('تعذر تهيئة السكانر: ' + errorMsg + '. حاول تحديث الصفحة.');
        }
        setScannerReady(false)
      }
    }

    init()
    return () => {
      cancelled = true
      if (checkInterval) clearInterval(checkInterval)
    }
  }, [sourceType])

  const selectScannerSource = async () => {
    if (!dwObject) {
      setScannerMsg('كائن السكانر غير جاهز. انتظر قليلاً ثم حاول مرة أخرى.')
      return
    }
    try {
      setScannerBusy(true)
      setScannerMsg('جارٍ فتح قائمة المصادر...')

      // التحقق من عدد المصادر المتاحة
      let sourceCount = 0
      try {
        sourceCount = dwObject.SourceCount || 0
        console.log('Available sources count:', sourceCount)
      } catch (e: any) {
        console.log('Could not get source count:', e.message)
      }

      if (sourceCount === 0) {
        setScannerMsg('لم يتم العثور على أي مصادر سكانر. تأكد من: 1) توصيل السكانر 2) تشغيل السكانر 3) تثبيت تعريف السكانر (Driver) 4) إعادة تشغيل المتصفح بعد تثبيت Dynamsoft Service.')
        setScannerBusy(false)
        return
      }

      // إذا كان هناك مصدر واحد فقط، اختاره تلقائياً
      if (sourceCount === 1) {
        try {
          const success = dwObject.SelectSourceByIndex(0)
          if (success) {
            const sourceName = dwObject.SourceNameItems(0) || dwObject.SourceName || 'المصدر المحدد'
            setScannerMsg(`تم اختيار المصدر تلقائياً: ${sourceName}. يمكنك البدء بالمسح الآن.`)
            setScannerBusy(false)
            return
          }
        } catch (e: any) {
          console.log('SelectSourceByIndex failed:', e.message)
        }
      }

      // طريقة 1: استخدام SelectSource() - هذه الطريقة تعرض الواجهة مباشرة
      try {
        console.log('Trying SelectSource()...')
        const result = dwObject.SelectSource()
        console.log('SelectSource() result:', result)

        if (result) {
          const sourceName = dwObject.SourceName || 'المصدر المحدد'
          setScannerMsg(`تم اختيار المصدر بنجاح: ${sourceName}. يمكنك البدء بالمسح الآن.`)
          setScannerBusy(false)
          return
        } else {
          setScannerMsg('لم يتم اختيار أي مصدر (تم الإلغاء).')
          setScannerBusy(false)
          return
        }
      } catch (e1: any) {
        console.log('SelectSource() failed:', e1.message)
        // إذا فشلت SelectSource، جرب SelectSourceAsync
      }

      // طريقة 2: استخدام SelectSourceAsync (كبديل)
      try {
        console.log('Trying SelectSourceAsync()...')
        const result = await dwObject.SelectSourceAsync()
        console.log('SelectSourceAsync() result:', result)

        if (result) {
          const sourceName = dwObject.SourceName || 'المصدر المحدد'
          setScannerMsg(`تم اختيار المصدر بنجاح: ${sourceName}. يمكنك البدء بالمسح الآن.`)
          setScannerBusy(false)
          return
        } else {
          setScannerMsg('لم يتم اختيار أي مصدر (تم الإلغاء).')
          setScannerBusy(false)
          return
        }
      } catch (e2: any) {
        console.error('SelectSourceAsync() failed:', e2)
        setScannerMsg(`فشل فتح قائمة المصادر: ${e2.message || String(e2)}. تأكد من تثبيت Dynamsoft Service Component وإعادة تشغيل المتصفح.`)
      }
    } catch (e: any) {
      console.error('SelectSource error:', e)
      const errorMsg = e?.message || String(e)
      setScannerMsg(`خطأ في اختيار المصدر: ${errorMsg}.`)
    } finally {
      setScannerBusy(false)
    }
  }

  const acquireFromScanner = async () => {
    if (!dwObject) {
      setScannerMsg('كائن السكانر غير جاهز. انتظر قليلاً ثم حاول مرة أخرى.')
      return
    }
    try {
      setScannerBusy(true)
      setScannerMsg('جارٍ المسح...')

      // التحقق من وجود مصدر محدد
      if (!dwObject.SourceName) {
        setScannerMsg('لم يتم اختيار مصدر السكانر. اضغط "اختيار المصدر" أولاً.')
        setScannerBusy(false)
        return
      }

      await dwObject.AcquireImageAsync({ IfShowUI: true })
      // أخذ الإطار الأول وتحويله إلى Blob صورة JPEG
      const count = dwObject.HowManyImagesInBuffer
      if (count > 0) {
        const index = count - 1
        const anyWindow: any = window as any
        // IT_JPG = 4, JPEG quality = 80 (0-100)
        const imageType = anyWindow.Dynamsoft?.EnumDWT_ImageType?.IT_JPG || 4
        const quality = 80
        const blob: Blob = await dwObject.ConvertToBlob([index], imageType, quality)
        const scannedFile = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
        setFile(scannedFile)
        const reader = new FileReader()
        reader.onloadend = () => setImagePreview(reader.result as string)
        reader.readAsDataURL(scannedFile)
        setScannerMsg('تم المسح بنجاح. يمكنك متابعة رفع الوثيقة.')
      } else {
        setScannerMsg('لم يتم التقاط أي صورة.')
      }
    } catch (e: any) {
      setScannerMsg('فشل المسح: ' + (e?.message || ''))
    } finally {
      setScannerBusy(false)
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      showMessage('الرجاء اختيار ملف', 'error')
      return
    }

    setLoading(true)
    setMsg('')
    setUploadedDoc(null)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('source_type', sourceType)
      if (title) form.append('title', title)
      if (direction) form.append('direction', direction)

      const res = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total))
        },
      })

      setUploadedDoc(res.data)
      showMessage(`تم رفع الوثيقة بنجاح! رقم الوثيقة: ${res.data.document_number}`, 'success')

      // إعادة تعيين النموذج
      setTimeout(() => {
        setFile(null)
        setTitle('')
        setDirection('')
        setImagePreview(null)
        setUploadedDoc(null)
      }, 5000)
    } catch (err: any) {
      const reason = err?.response?.data?.detail || err?.message || 'خطأ غير معروف'
      showMessage(`فشل الرفع: ${reason}`, 'error')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMsg(text)
    setMsgType(type)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) {
      setFile(f)

      // إنشاء معاينة للصورة
      if (f.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(f)
      } else {
        setImagePreview(null)
      }
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => e.preventDefault()

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>رفع وثيقة جديدة</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>
          رفع ومعالجة الوثائق تلقائياً باستخدام الذكاء الاصطناعي
        </p>
      </div>

      {/* نموذج الرفع */}
      <form onSubmit={submit} className="space-y-6">
        {/* مُدخل ملفات مخفي عام */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={() => handleFileSelected(fileInputRef.current)}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.tiff"
        />
        {/* اختيار نوع المصدر */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
            1. اختر مصدر الوثيقة
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-6 rounded-xl border-2 transition-all relative overflow-hidden ${sourceType === 'file'
                ? (theme === 'dark' ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20' : 'border-cyan-500 bg-cyan-50 shadow-lg shadow-cyan-200')
                : (theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500/50 hover:bg-cyan-500/5' : 'border-slate-200 hover:border-cyan-400 hover:bg-cyan-50')
                }`}
              onClick={() => {
                setSourceType('file')
                setTimeout(() => fileInputRef.current?.click(), 0)
              }}
            >
              {sourceType === 'file' && (
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-xl ${theme === 'dark' ? 'bg-gradient-to-bl from-cyan-500/20 to-transparent' : 'bg-gradient-to-bl from-cyan-300/30 to-transparent'}`}></div>
              )}
              <div className="relative z-10">
                <div className="mb-4 h-16 flex items-center justify-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${sourceType === 'file'
                    ? (theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-400/20 border-2 border-cyan-400/50 scale-110' : 'bg-cyan-100 border-2 border-cyan-400 scale-110')
                    : (theme === 'dark' ? 'bg-base-900 border border-[rgba(0,188,212,0.2)]' : 'bg-slate-100 border border-slate-300')
                    }`}>
                    <div className={`w-6 h-6 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${sourceType === 'file' ? (theme === 'dark' ? 'border-cyan-300' : 'border-cyan-500') : (theme === 'dark' ? 'border-cyan-500/50' : 'border-slate-400')
                      }`}></div>
                  </div>
                </div>
                <div className={`font-bold mb-1 transition-colors ${sourceType === 'file' ? (theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600') : (theme === 'dark' ? 'text-text-primary' : 'text-slate-700')
                  }`}>ملف من الجهاز</div>
                <div className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                  PDF, Word, Excel, صور
                </div>
              </div>
            </button>
            <button
              type="button"
              className={`p-6 rounded-xl border-2 transition-all relative overflow-hidden ${sourceType === 'scanner'
                ? (theme === 'dark' ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' : 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200')
                : (theme === 'dark' ? 'border-[rgba(59,130,246,0.12)] hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50')
                }`}
              onClick={() => setSourceType('scanner')}
            >
              {sourceType === 'scanner' && (
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-xl ${theme === 'dark' ? 'bg-gradient-to-bl from-blue-500/20 to-transparent' : 'bg-gradient-to-bl from-blue-300/30 to-transparent'}`}></div>
              )}
              <div className="relative z-10">
                <div className="mb-4 h-16 flex items-center justify-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${sourceType === 'scanner'
                    ? (theme === 'dark' ? 'bg-gradient-to-br from-blue-500/30 to-blue-400/20 border-2 border-blue-400/50 scale-110' : 'bg-blue-100 border-2 border-blue-400 scale-110')
                    : (theme === 'dark' ? 'bg-base-900 border border-[rgba(59,130,246,0.2)]' : 'bg-slate-100 border border-slate-300')
                    }`}>
                    <div className={`w-6 h-6 border-2 rounded-full ${sourceType === 'scanner' ? (theme === 'dark' ? 'border-blue-300' : 'border-blue-500') : (theme === 'dark' ? 'border-blue-500/50' : 'border-slate-400')
                      }`}></div>
                  </div>
                </div>
                <div className={`font-bold mb-1 transition-colors ${sourceType === 'scanner' ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600') : (theme === 'dark' ? 'text-text-primary' : 'text-slate-700')
                  }`}>سكانر</div>
                <div className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                  مسح ضوئي مباشر
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* منطقة رفع الملف أو تعليمات السكانر */}
        <div className="card">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">
            2. {sourceType === 'file' ? 'اختر الملف' : 'تعليمات المسح الضوئي'}
          </h2>
          {sourceType === 'file' ? (
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${file
                ? (theme === 'dark' ? 'border-cyan-500 bg-cyan-500/5' : 'border-cyan-500 bg-cyan-50')
                : (theme === 'dark' ? 'border-[rgba(0,188,212,0.25)] hover:border-cyan-500/50' : 'border-slate-300 hover:border-cyan-400 bg-slate-50')
                }`}
            >
              {file ? (
                <div className="space-y-3">
                  {imagePreview ? (
                    <div className="max-w-md mx-auto">
                      <img
                        src={imagePreview}
                        alt="معاينة الصورة"
                        className={`w-full h-auto rounded-lg border-2 shadow-lg ${theme === 'dark' ? 'border-cyan-500/30' : 'border-cyan-400'}`}
                      />
                      <div className={`mt-3 p-3 rounded-lg ${theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-100 border border-cyan-300'}`}>
                        <p className={`text-xs ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                          معاينة الصورة من الملف
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-24 h-24 mx-auto rounded-xl border-2 border-dashed flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300'}`}>
                      <div className={`w-12 h-12 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${theme === 'dark' ? 'border-cyan-400/50' : 'border-cyan-500'}`}></div>
                    </div>
                  )}
                  <div>
                    <div className={`font-semibold text-lg ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{file.name}</div>
                    <div className={`text-sm mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                      الحجم: {formatFileSize(file.size)} • النوع: {file.type || 'غير معروف'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50' : 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:border-red-400'}`}
                    onClick={() => {
                      setFile(null)
                      setImagePreview(null)
                    }}
                  >
                    إزالة الملف
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`w-24 h-24 mx-auto rounded-xl border-2 border-dashed flex items-center justify-center ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300'}`}>
                    <div className={`w-12 h-12 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${theme === 'dark' ? 'border-cyan-400/50' : 'border-cyan-500'}`}></div>
                  </div>
                  <div className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>
                    اسحب الملف هنا أو اضغط لاختيار ملف من جهازك
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`inline-block px-6 py-2 rounded-xl border transition ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400' : 'border-cyan-300 hover:border-cyan-500 text-slate-600 hover:text-cyan-600 bg-white'}`}
                  >
                    اختيار ملف
                  </button>
                  <div className={`text-xs mt-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-400'}`}>
                    الصيغ المدعومة: PDF, Word, Excel, صور (PNG, JPG, TIFF)
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${file
                  ? 'border-cyan-500 bg-cyan-500/5'
                  : 'border-[rgba(0,188,212,0.25)] hover:border-cyan-500/50'
                  }`}
              >
                {file ? (
                  <div className="space-y-3">
                    {imagePreview ? (
                      <div className="max-w-md mx-auto">
                        <img
                          src={imagePreview}
                          alt="معاينة الصورة"
                          className="w-full h-auto rounded-lg border-2 border-cyan-500/30 shadow-lg"
                        />
                        <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                          <p className="text-xs text-cyan-400">
                            معاينة الصورة من السكانر
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-24 h-24 mx-auto rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border-2 border-dashed border-cyan-500/30 flex items-center justify-center">
                        <div className="w-12 h-12 border-2 border-cyan-400/50 rounded-lg border-t-transparent border-r-transparent rotate-45"></div>
                      </div>
                    )}
                    <div>
                      <div className="text-cyan-400 font-semibold text-lg">{file.name}</div>
                      <div className="text-text-secondary text-sm mt-1">
                        الحجم: {formatFileSize(file.size)} • النوع: {file.type || 'غير معروف'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 text-sm transition-colors"
                      onClick={() => {
                        setFile(null)
                        setImagePreview(null)
                      }}
                    >
                      إزالة الملف
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] text-text-secondary text-sm leading-7">
                      <div className="font-semibold text-cyan-400 mb-2">خطوات استخدام السكانر:</div>
                      <ol className="list-decimal mr-5 space-y-1">
                        <li><strong>مهم:</strong> يجب تثبيت <strong>Dynamsoft Service Component</strong> أولاً (سيتم تحميله تلقائياً عند أول استخدام، أو حمّله من موقع Dynamsoft).</li>
                        <li>قم بتشغيل جهاز السكانر وتثبيت تعريفه (Driver) إن لزم.</li>
                        <li>اضغط "اختيار المصدر" لتحديد جهاز السكانر من القائمة.</li>
                        <li>اضغط "بدء المسح" لبدء عملية المسح الضوئي.</li>
                        <li>سيتم إدراج الصفحة الممسوحة تلقائياً هنا كصورة يمكن رفعها.</li>
                      </ol>
                      <div className="mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-xs">
                        <strong>ملاحظة:</strong> إذا لم تظهر قائمة المصادر عند الضغط على "اختيار المصدر"، تأكد من: 1) تثبيت Dynamsoft Service 2) تشغيل السكانر 3) تثبيت تعريف السكانر.
                      </div>
                      <div className="mt-2 text-xs">يتطلب اتصال إنترنت لتحميل مكتبة السكانر. يدعم Windows/Mac ومعظم أجهزة السكانر عبر TWAIN/WIA.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 justify-center">
                      <button
                        type="button"
                        onClick={selectScannerSource}
                        disabled={!scannerReady || scannerBusy}
                        className="px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition disabled:opacity-50"
                      >
                        اختيار المصدر
                      </button>
                      <button
                        type="button"
                        onClick={acquireFromScanner}
                        disabled={!scannerReady || scannerBusy}
                        className="px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition disabled:opacity-50"
                      >
                        بدء المسح
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                      >
                        اختيار ملف بدلاً من المسح
                      </button>
                    </div>
                    {scannerMsg && (
                      <div className={`text-sm mt-3 p-3 rounded-lg ${scannerReady && !scannerBusy
                        ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                        : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                        }`}>
                        {scannerMsg}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* اختيار الاتجاه */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
            3. اختر اتجاه الوثيقة
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden ${direction === 'صادر'
                ? (theme === 'dark' ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20' : 'border-green-500 bg-green-50 shadow-lg shadow-green-200')
                : (theme === 'dark' ? 'border-[rgba(34,197,94,0.12)] hover:border-green-500/50 hover:bg-green-500/5' : 'border-slate-200 hover:border-green-400 hover:bg-green-50')
                }`}
              onClick={() => setDirection('صادر')}
              disabled={loading}
            >
              {direction === 'صادر' && (
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-xl ${theme === 'dark' ? 'bg-gradient-to-bl from-green-500/20 to-transparent' : 'bg-gradient-to-bl from-green-300/30 to-transparent'}`}></div>
              )}
              <div className="relative z-10">
                <div className="mb-3 h-12 flex items-center justify-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${direction === 'صادر'
                    ? (theme === 'dark' ? 'bg-gradient-to-br from-green-500/30 to-green-400/20 border-2 border-green-400/50 scale-110' : 'bg-green-100 border-2 border-green-400 scale-110')
                    : (theme === 'dark' ? 'bg-base-900 border border-[rgba(34,197,94,0.2)]' : 'bg-slate-100 border border-slate-300')
                    }`}>
                    <div className={`w-5 h-5 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${direction === 'صادر' ? (theme === 'dark' ? 'border-green-300' : 'border-green-500') : (theme === 'dark' ? 'border-green-500/50' : 'border-slate-400')
                      }`}></div>
                  </div>
                </div>
                <div className={`font-bold transition-colors ${direction === 'صادر' ? (theme === 'dark' ? 'text-green-400' : 'text-green-600') : (theme === 'dark' ? 'text-text-primary' : 'text-slate-700')
                  }`}>صادر</div>
                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثيقة صادرة من المركز</div>
              </div>
            </button>
            <button
              type="button"
              className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden ${direction === 'وارد'
                ? (theme === 'dark' ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' : 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-200')
                : (theme === 'dark' ? 'border-[rgba(59,130,246,0.12)] hover:border-blue-500/50 hover:bg-blue-500/5' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50')
                }`}
              onClick={() => setDirection('وارد')}
              disabled={loading}
            >
              {direction === 'وارد' && (
                <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-xl ${theme === 'dark' ? 'bg-gradient-to-bl from-blue-500/20 to-transparent' : 'bg-gradient-to-bl from-blue-300/30 to-transparent'}`}></div>
              )}
              <div className="relative z-10">
                <div className="mb-3 h-12 flex items-center justify-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${direction === 'وارد'
                    ? (theme === 'dark' ? 'bg-gradient-to-br from-blue-500/30 to-blue-400/20 border-2 border-blue-400/50 scale-110' : 'bg-blue-100 border-2 border-blue-400 scale-110')
                    : (theme === 'dark' ? 'bg-base-900 border border-[rgba(59,130,246,0.2)]' : 'bg-slate-100 border border-slate-300')
                    }`}>
                    <div className={`w-5 h-5 border-2 rounded-lg border-b-transparent border-l-transparent rotate-45 ${direction === 'وارد' ? (theme === 'dark' ? 'border-blue-300' : 'border-blue-500') : (theme === 'dark' ? 'border-blue-500/50' : 'border-slate-400')
                      }`}></div>
                  </div>
                </div>
                <div className={`font-bold transition-colors ${direction === 'وارد' ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600') : (theme === 'dark' ? 'text-text-primary' : 'text-slate-700')
                  }`}>وارد</div>
                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>وثيقة واردة للمركز</div>
              </div>
            </button>
          </div>
          {direction && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-300'}`}>
              <span className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>الاتجاه المحدد: </span>
              <span className={`font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{direction}</span>
              <button
                type="button"
                onClick={() => setDirection('')}
                className={`mr-3 px-3 py-1 rounded-lg text-sm transition-colors ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50' : 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100 hover:border-red-400'}`}
              >
                إلغاء
              </button>
            </div>
          )}
        </div>

        {/* العنوان (اختياري) */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
            4. العنوان (اختياري)
          </h2>
          <div className={`mb-3 p-3 rounded-lg border text-sm ${theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-300'}`}>
            <p className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>
              إذا تركت الحقل فارغاً، سيقترح النظام عنواناً تلقائياً بناءً على محتوى الوثيقة
            </p>
          </div>
          <input
            className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none transition ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500 text-white placeholder-text-secondary' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800 placeholder-slate-400'}`}
            placeholder="أدخل عنوان الوثيقة..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* شريط التقدم */}
        {loading && (
          <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>جارٍ الرفع والمعالجة...</span>
              <span className={`font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{progress}%</span>
            </div>
            <div className={`w-full rounded-xl h-3 overflow-hidden ${theme === 'dark' ? 'bg-base-900' : 'bg-slate-100'}`}>
              <div
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-3 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={`mt-3 text-xs text-center ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
              استخراج النص • تصنيف تلقائي • تحليل المحتوى
            </div>
          </div>
        )}

        {/* زر الرفع */}
        <button
          type="submit"
          className={`w-full text-lg py-3 rounded-xl font-bold transition-all shadow-lg ${loading || !file
            ? 'bg-gray-500 cursor-not-allowed opacity-50'
            : (theme === 'dark' ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-cyan-500/20' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-cyan-500/30')
            }`}
          disabled={loading || !file}
        >
          {loading ? 'جارٍ المعالجة...' : 'رفع وتحليل الوثيقة'}
        </button>
      </form>

      {/* رسالة النجاح/الخطأ */}
      {msg && (
        <div
          className={`rounded-xl p-6 border-2 transition-all ${msgType === 'success'
            ? (theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' : 'bg-green-50 border-green-300 animate-pulse')
            : (theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-300')
            }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msgType === 'success'
                ? (theme === 'dark' ? 'bg-green-500/20 border-2 border-green-400' : 'bg-green-100 border-2 border-green-500')
                : (theme === 'dark' ? 'bg-red-500/20 border-2 border-red-400' : 'bg-red-100 border-2 border-red-500')
                }`}>
                <div className={`w-3 h-3 rounded-full ${msgType === 'success' ? (theme === 'dark' ? 'bg-green-400' : 'bg-green-500') : (theme === 'dark' ? 'bg-red-400' : 'bg-red-500')
                  }`}></div>
              </div>
            </div>
            <div className="flex-1">
              <div
                className={`font-semibold mb-1 ${msgType === 'success' ? (theme === 'dark' ? 'text-cyan-400' : 'text-green-700') : (theme === 'dark' ? 'text-red-400' : 'text-red-700')
                  }`}
              >
                {msgType === 'success' ? 'نجح الرفع!' : 'فشل الرفع'}
              </div>
              <div className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>{msg}</div>

              {uploadedDoc && msgType === 'success' && (
                <div className={`mt-4 p-4 rounded-xl space-y-2 text-sm ${theme === 'dark' ? 'bg-base-900' : 'bg-white border border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>رقم الوثيقة:</span>
                    <span className={`font-mono ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{uploadedDoc.document_number}</span>
                  </div>
                  {uploadedDoc.suggested_title && (
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>العنوان المقترح:</span>
                      <span className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>{uploadedDoc.suggested_title}</span>
                    </div>
                  )}
                  {uploadedDoc.classification && (
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>التصنيف:</span>
                      <span className={theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}>{uploadedDoc.classification}</span>
                    </div>
                  )}
                  {uploadedDoc.ocr_accuracy && (
                    <div className="flex justify-between">
                      <span className={theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}>دقة OCR:</span>
                      <span className={theme === 'dark' ? 'text-green-400' : 'text-green-600'}>{uploadedDoc.ocr_accuracy}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* معلومات إضافية */}
      <div className={`rounded-xl p-6 border ${theme === 'dark' ? 'card bg-cyan-500/5 border-cyan-500/20' : 'bg-cyan-50 border-cyan-200 shadow-sm'}`}>
        <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-700'}`}>ملاحظات مهمة:</h3>
        <ul className={`text-sm space-y-1 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-600'}`}>
          <li>• سيتم استخراج النص تلقائياً باستخدام OCR</li>
          <li>• سيتم تصنيف الوثيقة تلقائياً (شهادة، تقرير، كتاب رسمي، إلخ)</li>
          <li>• سيتم اقتراح عنوان بناءً على محتوى الوثيقة</li>
          <li>• سيتم حفظ الوثيقة في مسار منظم حسب التاريخ ورقم الوثيقة</li>
          <li>• يمكنك تعديل البيانات الوصفية لاحقاً (العنوان فقط)</li>
        </ul>
      </div>
    </div>
  )
}

export default Upload
