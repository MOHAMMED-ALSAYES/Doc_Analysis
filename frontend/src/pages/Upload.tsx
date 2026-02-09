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

  // Camera State
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [scannerReady, setScannerReady] = useState(false)
  const [scannerBusy, setScannerBusy] = useState(false)
  const [scannerMsg, setScannerMsg] = useState<string>('')

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

  // Camera cleanup
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  // Handle source type change
  useEffect(() => {
    if (sourceType === 'scanner') {
      startCamera()
    } else {
      stopCamera()
    }
  }, [sourceType])

  const startCamera = async () => {
    setScannerBusy(true)
    setScannerMsg('جارٍ تشغيل الكاميرا...')
    setScannerReady(false)

    try {
      // Request camera access with preference for rear camera (environment) and high resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setCameraActive(true)
        setScannerMsg('الكاميرا جاهزة. قم بتوجيهها نحو المستند واضغط "التقاط صورة".')
        setScannerReady(true)
      }
    } catch (err: any) {
      console.error("Camera Error:", err)
      const msg = err.name === 'NotAllowedError'
        ? 'تم رفض إذن الكاميرا. يرجى السماح للموقع باستخدام الكاميرا.'
        : 'تعذر تشغيل الكاميرا: ' + (err.message || 'تأكد من توصيل الكاميرا.')

      setScannerMsg(msg)
      setScannerReady(false)
    } finally {
      setScannerBusy(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      const tracks = stream.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
      setCameraActive(false)
      setScannerMsg('')
    }
  }

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas dimensions to match video stream
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const context = canvas.getContext('2d')
      if (context) {
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Convert canvas to blob/file
        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
            setFile(capturedFile)

            // Create preview
            const reader = new FileReader()
            reader.onloadend = () => setImagePreview(reader.result as string)
            reader.readAsDataURL(capturedFile)

            setScannerMsg('تم التقاط الصورة بنجاح! يمكنك الآن الرفع.')
            stopCamera() // Stop camera after capture
            setSourceType('file') // Switch back to file mode to show preview
          }
        }, 'image/jpeg', 0.90) // 90% quality JPEG
      }
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
      form.append('source_type', sourceType === 'scanner' ? 'scanner' : 'file') // Preserve source type info
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

      // Reset form
      setTimeout(() => {
        setFile(null)
        setTitle('')
        setDirection('')
        setImagePreview(null)
        setUploadedDoc(null)
        if (sourceType === 'scanner') {
          setSourceType('file')
        }
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

      // Create preview
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
      {/* Header */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-lg'}`}>
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>رفع وثيقة جديدة</h1>
        <p className={theme === 'dark' ? 'text-text-secondary' : 'text-cyan-100'}>
          رفع ومعالجة الوثائق تلقائياً باستخدام الذكاء الاصطناعي
        </p>
      </div>

      {/* Upload Form */}
      <form onSubmit={submit} className="space-y-6">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={() => handleFileSelected(fileInputRef.current)}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.bmp,.tiff"
        />

        {/* Source Selection */}
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
                // Wait briefly then click input if no file selected yet
                if (!file) {
                  setTimeout(() => fileInputRef.current?.click(), 100)
                }
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
                    <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center ${sourceType === 'scanner' ? (theme === 'dark' ? 'border-blue-300' : 'border-blue-500') : (theme === 'dark' ? 'border-blue-500/50' : 'border-slate-400')
                      }`}>
                      <div className={`w-2 h-2 rounded-full ${sourceType === 'scanner' ? (theme === 'dark' ? 'bg-blue-300' : 'bg-blue-500') : 'bg-transparent'}`}></div>
                    </div>
                  </div>
                </div>
                <div className={`font-bold mb-1 transition-colors ${sourceType === 'scanner' ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600') : (theme === 'dark' ? 'text-text-primary' : 'text-slate-700')
                  }`}>الماسح الضوئي (الكاميرا)</div>
                <div className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>
                  مسح ضوئي باستخدام الكاميرا
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Capture/Upload Area */}
        <div className="card">
          <h2 className="text-lg font-semibold text-cyan-400 mb-3">
            2. {sourceType === 'file' ? 'اختر الملف' : 'مسح المستند'}
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
            // Camera Interface
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-blue-500/30">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-contain ${!cameraActive && 'hidden'}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {!cameraActive && !scannerBusy && (
                  <div className="text-center p-4">
                    <div className="text-gray-400 mb-2">الكاميرا متوقفة</div>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      تشغيل الكاميرا
                    </button>
                  </div>
                )}

                {scannerBusy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                    <div className="text-white">جارٍ التحميل...</div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-center">
                <button
                  type="button"
                  onClick={captureImage}
                  disabled={!scannerReady || !cameraActive || scannerBusy}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
                  التقاط صورة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera()
                    setSourceType('file')
                  }}
                  className="px-4 py-3 rounded-xl border border-gray-500 text-gray-400 hover:text-white hover:border-white transition"
                >
                  إلغاء
                </button>
              </div>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm">
                <p className="text-blue-300 mb-1 font-bold">نصائح لتصوير المستندات:</p>
                <ul className="list-disc list-inside text-blue-200/80 space-y-1">
                  <li>تأكد من وجود إضاءة جيدة.</li>
                  <li>ضع المستند على خلفية داكنة ومتباينة.</li>
                  <li>حاول تثبيت يدك لتجنب الاهتزاز.</li>
                </ul>
              </div>

              {scannerMsg && (
                <div className={`text-sm mt-3 p-3 rounded-lg text-center ${scannerReady
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                  : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                  }`}>
                  {scannerMsg}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direction Selection */}
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
              </div>
            </button>
          </div>
        </div>

        {/* Title (Optional) */}
        <div className={`rounded-xl p-6 border-2 ${theme === 'dark' ? 'card' : 'bg-white border-cyan-200 shadow-lg'}`}>
          <h2 className={`text-lg font-semibold mb-3 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
            4. العنوان (اختياري)
          </h2>
          <input
            className={`w-full px-4 py-2.5 rounded-xl border focus:outline-none transition ${theme === 'dark' ? 'bg-base-900 border-[rgba(0,188,212,0.12)] focus:border-cyan-500 text-white placeholder-text-secondary' : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-800 placeholder-slate-400'}`}
            placeholder="أدخل عنوان الوثيقة..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Progress Bar */}
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

        {/* Submit Button */}
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

      {/* Messages */}
      {msg && (
        <div
          className={`rounded-xl p-6 border-2 transition-all ${msgType === 'success'
            ? (theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30 animate-pulse' : 'bg-green-50 border-green-300 animate-pulse')
            : (theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-300')
            }`}
        >
          <div className="flex items-start gap-3">
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload
