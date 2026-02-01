import { useState, DragEvent, useRef, useCallback, useEffect } from 'react'
import { api } from '../lib/api'

function Upload() {
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
    let checkInterval: NodeJS.Timeout | null = null
    
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
        if (!libraryLoaded) {
          // التحقق من حالة التحميل في Console
          console.error('Dynamsoft library check:', {
            hasDynamsoft: !!anyWindow?.Dynamsoft,
            hasWebTwainEnv: !!anyWindow?.Dynamsoft?.WebTwainEnv,
            hasDWT: !!anyWindow?.Dynamsoft?.DWT,
            windowKeys: Object.keys(anyWindow).filter(k => k.toLowerCase().includes('dynam') || k.toLowerCase().includes('twain'))
          })
          setScannerMsg('لم يتم تحميل مكتبة السكانر بعد 20 ثانية. تأكد من: 1) الاتصال بالإنترنت 2) تحديث الصفحة (F5) 3) فتح Console (F12) للتحقق من الأخطاء.')
          setScannerReady(false)
          return
        }
        
        // التحقق مرة أخرى من وجود المكتبة
        if (!anyWindow?.Dynamsoft) {
          console.error('Dynamsoft object not found in window')
          setScannerMsg('مكتبة السكانر غير موجودة. حاول تحديث الصفحة.')
          setScannerReady(false)
          return
        }

        setScannerMsg('جارٍ تهيئة السكانر...')
        
        // تهيئة مسار الموارد (ResourcesPath)
        if (anyWindow.Dynamsoft.WebTwainEnv) {
          anyWindow.Dynamsoft.WebTwainEnv.ResourcesPath = 'https://cdn.jsdelivr.net/npm/dwt@18.4.1/dist'
        }
        
        // انتظر قليلاً للتأكد من تهيئة WebTwainEnv
        await new Promise(resolve => setTimeout(resolve, 800))
        
        // محاولة إنشاء كائن DWT
        let obj
        if (anyWindow.Dynamsoft.DWT?.CreateDWTObject) {
          obj = await anyWindow.Dynamsoft.DWT.CreateDWTObject()
        } else if (anyWindow.Dynamsoft.DWT) {
          // طريقة بديلة لبعض الإصدارات
          obj = await anyWindow.Dynamsoft.DWT()
        } else {
          throw new Error('CreateDWTObject غير متاح. المكتبة قد تحتاج إلى مفتاح ترخيص.')
        }
        if (cancelled) return
        
        setDwObject(obj)
        setScannerReady(true)
        setScannerMsg('السكانر جاهز. اختر المصدر ثم ابدأ المسح.')
      } catch (e: any) {
        if (cancelled) return
        const errorMsg = e?.message || String(e)
        setScannerMsg('تعذر تهيئة السكانر: ' + errorMsg + '. تأكد من تثبيت تعريف السكانر.')
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
      <div className="card">
        <h1 className="text-3xl font-bold text-cyan-400 mb-2">رفع وثيقة جديدة</h1>
        <p className="text-text-secondary">
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
        <div className="card">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">
            1. اختر مصدر الوثيقة
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-6 rounded-xl border-2 transition-all relative overflow-hidden ${
                sourceType === 'file'
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/20'
                  : 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500/50 hover:bg-cyan-500/5'
              }`}
              onClick={() => {
                setSourceType('file')
                setTimeout(() => fileInputRef.current?.click(), 0)
              }}
            >
              {sourceType === 'file' && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/20 to-transparent rounded-full blur-xl"></div>
              )}
              <div className="relative z-10">
                <div className="mb-4 h-16 flex items-center justify-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    sourceType === 'file'
                      ? 'bg-gradient-to-br from-cyan-500/30 to-cyan-400/20 border-2 border-cyan-400/50 scale-110'
                      : 'bg-base-900 border border-[rgba(0,188,212,0.2)]'
                  }`}>
                    <div className={`w-6 h-6 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${
                      sourceType === 'file' ? 'border-cyan-300' : 'border-cyan-500/50'
                    }`}></div>
                  </div>
                </div>
                <div className={`font-bold mb-1 transition-colors ${
                  sourceType === 'file' ? 'text-cyan-400' : 'text-text-primary'
                }`}>ملف من الجهاز</div>
                <div className="text-sm text-text-secondary">
                  PDF, Word, Excel, صور
                </div>
              </div>
            </button>
            <button
              type="button"
              className={`p-6 rounded-xl border-2 transition-all relative overflow-hidden ${
                sourceType === 'scanner'
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-[rgba(59,130,246,0.12)] hover:border-blue-500/50 hover:bg-blue-500/5'
              }`}
              onClick={() => setSourceType('scanner')}
            >
              {sourceType === 'scanner' && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-xl"></div>
              )}
              <div className="relative z-10">
                <div className="mb-4 h-16 flex items-center justify-center">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                    sourceType === 'scanner'
                      ? 'bg-gradient-to-br from-blue-500/30 to-blue-400/20 border-2 border-blue-400/50 scale-110'
                      : 'bg-base-900 border border-[rgba(59,130,246,0.2)]'
                  }`}>
                    <div className={`w-6 h-6 border-2 rounded-full ${
                      sourceType === 'scanner' ? 'border-blue-300' : 'border-blue-500/50'
                    }`}></div>
                  </div>
                </div>
                <div className={`font-bold mb-1 transition-colors ${
                  sourceType === 'scanner' ? 'text-blue-400' : 'text-text-primary'
                }`}>سكانر</div>
                <div className="text-sm text-text-secondary">
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
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                file
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
                          معاينة الصورة من {sourceType === 'scanner' ? 'السكانر' : 'الملف'}
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
                <div className="space-y-3">
                  <div className="w-24 h-24 mx-auto rounded-xl bg-gradient-to-br from-cyan-500/10 to-cyan-400/5 border-2 border-dashed border-cyan-500/30 flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-cyan-400/50 rounded-lg border-t-transparent border-r-transparent rotate-45"></div>
                  </div>
                  <div className="text-text-secondary">
                    اسحب الملف هنا أو اضغط لاختيار ملف من جهازك
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-block px-6 py-2 rounded-xl border border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400 transition"
                  >
                    اختيار ملف
                  </button>
                  <div className="text-xs text-text-secondary mt-2">
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
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                  file
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
                      <div className={`text-sm mt-3 p-3 rounded-lg ${
                        scannerReady && !scannerBusy
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
        <div className="card">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">
            3. اختر اتجاه الوثيقة
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                direction === 'صادر'
                  ? 'border-green-500 bg-green-500/10 shadow-lg shadow-green-500/20'
                  : 'border-[rgba(34,197,94,0.12)] hover:border-green-500/50 hover:bg-green-500/5'
              }`}
              onClick={() => setDirection('صادر')}
              disabled={loading}
            >
              {direction === 'صادر' && (
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-green-500/20 to-transparent rounded-full blur-xl"></div>
              )}
              <div className="relative z-10">
                <div className="mb-3 h-12 flex items-center justify-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    direction === 'صادر'
                      ? 'bg-gradient-to-br from-green-500/30 to-green-400/20 border-2 border-green-400/50 scale-110'
                      : 'bg-base-900 border border-[rgba(34,197,94,0.2)]'
                  }`}>
                    <div className={`w-5 h-5 border-2 rounded-lg border-t-transparent border-r-transparent rotate-45 ${
                      direction === 'صادر' ? 'border-green-300' : 'border-green-500/50'
                    }`}></div>
                  </div>
                </div>
                <div className={`font-bold transition-colors ${
                  direction === 'صادر' ? 'text-green-400' : 'text-text-primary'
                }`}>صادر</div>
                <div className="text-xs text-text-secondary mt-1">وثيقة صادرة من المركز</div>
              </div>
            </button>
            <button
              type="button"
              className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                direction === 'وارد'
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-[rgba(59,130,246,0.12)] hover:border-blue-500/50 hover:bg-blue-500/5'
              }`}
              onClick={() => setDirection('وارد')}
              disabled={loading}
            >
              {direction === 'وارد' && (
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-xl"></div>
              )}
              <div className="relative z-10">
                <div className="mb-3 h-12 flex items-center justify-center">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                    direction === 'وارد'
                      ? 'bg-gradient-to-br from-blue-500/30 to-blue-400/20 border-2 border-blue-400/50 scale-110'
                      : 'bg-base-900 border border-[rgba(59,130,246,0.2)]'
                  }`}>
                    <div className={`w-5 h-5 border-2 rounded-lg border-b-transparent border-l-transparent rotate-45 ${
                      direction === 'وارد' ? 'border-blue-300' : 'border-blue-500/50'
                    }`}></div>
                  </div>
                </div>
                <div className={`font-bold transition-colors ${
                  direction === 'وارد' ? 'text-blue-400' : 'text-text-primary'
                }`}>وارد</div>
                <div className="text-xs text-text-secondary mt-1">وثيقة واردة للمركز</div>
              </div>
            </button>
          </div>
          {direction && (
            <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-sm">
              <span className="text-text-secondary">الاتجاه المحدد: </span>
              <span className="text-cyan-400 font-semibold">{direction}</span>
              <button
                type="button"
                onClick={() => setDirection('')}
                className="mr-3 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 text-sm transition-colors"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>

        {/* العنوان (اختياري) */}
        <div className="card">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">
            4. العنوان (اختياري)
          </h2>
          <div className="mb-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <p className="text-cyan-400 text-sm">
              إذا تركت الحقل فارغاً، سيقترح النظام عنواناً تلقائياً بناءً على محتوى الوثيقة
            </p>
          </div>
          <input
            className="w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
            placeholder="أدخل عنوان الوثيقة..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* شريط التقدم */}
        {loading && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-secondary text-sm">جارٍ الرفع والمعالجة...</span>
              <span className="text-cyan-400 font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-base-900 rounded-xl h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-3 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 text-xs text-text-secondary text-center">
              استخراج النص • تصنيف تلقائي • تحليل المحتوى
            </div>
          </div>
        )}

        {/* زر الرفع */}
        <button
          type="submit"
          className="btn-primary w-full text-lg py-3"
          disabled={loading || !file}
        >
          {loading ? 'جارٍ المعالجة...' : 'رفع وتحليل الوثيقة'}
        </button>
      </form>

      {/* رسالة النجاح/الخطأ */}
      {msg && (
        <div
          className={`card border-2 ${
            msgType === 'success'
              ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                msgType === 'success' 
                  ? 'bg-green-500/20 border-2 border-green-400' 
                  : 'bg-red-500/20 border-2 border-red-400'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  msgType === 'success' ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
              </div>
            </div>
            <div className="flex-1">
              <div
                className={`font-semibold mb-1 ${
                  msgType === 'success' ? 'text-cyan-400' : 'text-red-400'
                }`}
              >
                {msgType === 'success' ? 'نجح الرفع!' : 'فشل الرفع'}
              </div>
              <div className="text-text-secondary text-sm">{msg}</div>
              
              {uploadedDoc && msgType === 'success' && (
                <div className="mt-4 p-4 rounded-xl bg-base-900 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">رقم الوثيقة:</span>
                    <span className="text-cyan-400 font-mono">{uploadedDoc.document_number}</span>
                  </div>
                  {uploadedDoc.suggested_title && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">العنوان المقترح:</span>
                      <span className="text-cyan-400">{uploadedDoc.suggested_title}</span>
                    </div>
                  )}
                  {uploadedDoc.classification && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">التصنيف:</span>
                      <span className="text-cyan-400">{uploadedDoc.classification}</span>
                    </div>
                  )}
                  {uploadedDoc.ocr_accuracy && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">دقة OCR:</span>
                      <span className="text-green-400">{uploadedDoc.ocr_accuracy}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* معلومات إضافية */}
      <div className="card bg-cyan-500/5 border-cyan-500/20">
        <h3 className="font-semibold text-cyan-400 mb-2">ملاحظات مهمة:</h3>
        <ul className="text-sm text-text-secondary space-y-1">
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
