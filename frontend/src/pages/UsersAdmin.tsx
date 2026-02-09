import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useTheme } from '../contexts/ThemeContext'

type UserRow = {
  id: number
  username: string
  full_name?: string
  email?: string
  phone?: string
  role_name: string
  is_active: boolean
  must_change_password: boolean
  analyze_scope?: string
  permissions?: any
  online: boolean  // إزالة ? لجعله مطلوباً
}

function UsersAdmin() {
  const { theme } = useTheme()
  const [users, setUsers] = useState<UserRow[]>([])
  const [showAdd, setShowAdd] = useState(false)

  // حقول المستخدم الجديد
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleName, setRoleName] = useState<'employee' | 'system_admin'>('employee')
  const [analyzeScope, setAnalyzeScope] = useState<'own' | 'all' | 'selected'>('own')
  const [mustChangePassword, setMustChangePassword] = useState(true)

  // الصلاحيات
  const [permViewAll, setPermViewAll] = useState(false)
  const [permManageOwn, setPermManageOwn] = useState(true)
  const [permDeleteOwn, setPermDeleteOwn] = useState(false)
  const [permShareOwn, setPermShareOwn] = useState(false)
  const [permSearchOwn, setPermSearchOwn] = useState(true)
  const [permViewReports, setPermViewReports] = useState(true)

  // التعديل
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState<'employee' | 'system_admin'>('employee')
  const [editActive, setEditActive] = useState(true)
  const [editAnalyzeScope, setEditAnalyzeScope] = useState<'own' | 'all' | 'selected'>('own')
  const [editMustChangePassword, setEditMustChangePassword] = useState(false)
  // صلاحيات التعديل
  const [editPermViewAll, setEditPermViewAll] = useState(false)
  const [editPermManageOwn, setEditPermManageOwn] = useState(true)
  const [editPermDeleteOwn, setEditPermDeleteOwn] = useState(false)
  const [editPermShareOwn, setEditPermShareOwn] = useState(false)
  const [editPermSearchOwn, setEditPermSearchOwn] = useState(true)
  const [editPermViewReports, setEditPermViewReports] = useState(true)

  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')

  const load = async () => {
    try {
      const res = await api.get('/users/')
      setUsers(res.data)
    } catch (e: any) {
      showMessage('فشل جلب المستخدمين: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  useEffect(() => {
    load()
    // تحديث القائمة كل 5 ثوان لتحديث حالة الاتصال
    const refreshInterval = setInterval(() => {
      load()
    }, 5000) // كل 5 ثوان

    return () => clearInterval(refreshInterval)
  }, [])

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 5000)
  }

  const resetForm = () => {
    setUsername('')
    setPassword('')
    setFullName('')
    setEmail('')
    setPhone('')
    setRoleName('employee')
    setAnalyzeScope('own')
    setMustChangePassword(true)
    setPermViewAll(false)
    setPermManageOwn(true)
    setPermDeleteOwn(false)
    setPermShareOwn(false)
    setPermSearchOwn(true)
    setPermViewReports(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')

    if (!username || !password) {
      showMessage('اسم المستخدم وكلمة المرور مطلوبان', 'error')
      return
    }

    try {
      await api.post('/users/', {
        username,
        password,
        full_name: fullName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        role_name: roleName,
        analyze_scope: analyzeScope,
        must_change_password: mustChangePassword,
        permissions: {
          view_all_documents: permViewAll,
          manage_own_documents: permManageOwn,
          delete_own_documents: permDeleteOwn,
          share_own_documents: permShareOwn,
          search_own_documents: permSearchOwn,
          view_reports: permViewReports,
        },
      })
      showMessage('تم إنشاء المستخدم بنجاح', 'success')
      resetForm()
      setShowAdd(false)
      load()
    } catch (e: any) {
      showMessage('فشل إنشاء المستخدم: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  const startEdit = (u: UserRow) => {
    setEditId(u.id)
    setEditName(u.full_name || '')
    setEditEmail(u.email || '')
    setEditPhone(u.phone || '')
    setEditRole((u.role_name as any) || 'employee')
    setEditActive(u.is_active)
    setEditAnalyzeScope((u.analyze_scope as any) || 'own')
    setEditMustChangePassword(u.must_change_password)
    // تحميل الصلاحيات
    const perms = u.permissions || {}
    setEditPermViewAll(perms.view_all_documents || false)
    setEditPermManageOwn(perms.manage_own_documents || false)
    setEditPermDeleteOwn(perms.delete_own_documents || false)
    setEditPermShareOwn(perms.share_own_documents || false)
    setEditPermSearchOwn(perms.search_own_documents || false)
    setEditPermViewReports(perms.view_reports !== undefined ? perms.view_reports : true)
  }

  const saveEdit = async () => {
    if (editId == null) return
    try {
      await api.put(`/users/${editId}`, {
        full_name: editName || undefined,
        email: editEmail || undefined,
        phone: editPhone || undefined,
        role_name: editRole,
        is_active: editActive,
        analyze_scope: editAnalyzeScope,
        must_change_password: editMustChangePassword,
        permissions: {
          view_all_documents: editPermViewAll,
          manage_own_documents: editPermManageOwn,
          delete_own_documents: editPermDeleteOwn,
          share_own_documents: editPermShareOwn,
          search_own_documents: editPermSearchOwn,
          view_reports: editPermViewReports,
        },
      })
      showMessage('تم تحديث المستخدم بنجاح', 'success')
      setEditId(null)
      load()
    } catch (e: any) {
      showMessage('فشل التحديث: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  const toggleUserStatus = async (user: UserRow) => {
    const action = user.is_active ? 'تعطيل' : 'تنشيط'
    if (!confirm(`هل أنت متأكد من ${action} المستخدم "${user.username}"؟`)) return
    try {
      await api.put(`/users/${user.id}`, {
        is_active: !user.is_active
      })
      showMessage(`تم ${action} المستخدم بنجاح`, 'success')
      load()
    } catch (e: any) {
      showMessage(`فشل ${action}: ` + (e?.response?.data?.detail || ''), 'error')
    }
  }

  const deleteUser = async (user: UserRow) => {
    if (!confirm(`تحذير: هل أنت متأكد من حذف المستخدم "${user.username}" نهائياً؟\n\nهذا الإجراء لا يمكن التراجع عنه!`)) return
    if (!confirm(`تأكيد نهائي: سيتم حذف المستخدم "${user.username}" وجميع بياناته. هل تريد المتابعة؟`)) return
    try {
      await api.delete(`/users/${user.id}`)
      showMessage('تم حذف المستخدم نهائياً', 'success')
      load()
    } catch (e: any) {
      showMessage('فشل الحذف: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  const resetPassword = async (user: UserRow) => {
    if (!confirm(`هل أنت متأكد من إعادة تعيين كلمة مرور المستخدم "${user.username}"؟\n\nسيتم توليد كلمة مرور مؤقتة جديدة.`)) return
    try {
      const res = await api.post(`/users/${user.id}/reset-password`)
      const tempPassword = res.data.temporary_password
      // عرض كلمة المرور المؤقتة للمدير
      const message = `تم إعادة تعيين كلمة المرور بنجاح!\n\nكلمة المرور المؤقتة: ${tempPassword}\n\nيرجى إعطاء هذه الكلمة للمستخدم. يجب عليه تغييرها عند تسجيل الدخول.`
      alert(message)
      // نسخ كلمة المرور إلى الحافظة
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(tempPassword)
          showMessage('تم نسخ كلمة المرور المؤقتة إلى الحافظة', 'success')
        } catch (e) {
          // فشل النسخ، لكن هذا ليس مشكلة كبيرة
        }
      }
      load()
    } catch (e: any) {
      showMessage('فشل إعادة تعيين كلمة المرور: ' + (e?.response?.data?.detail || ''), 'error')
    }
  }

  // فئات CSS مشتركة
  const inputClass = theme === 'dark'
    ? "w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
    : "w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cyan-200 focus:border-cyan-500 focus:outline-none transition text-slate-700"

  const selectClass = theme === 'dark'
    ? "w-full px-4 py-2.5 rounded-xl bg-base-900 border border-[rgba(0,188,212,0.12)] focus:border-cyan-500 focus:outline-none transition"
    : "w-full px-4 py-2.5 rounded-xl bg-white border-2 border-cyan-200 focus:border-cyan-500 focus:outline-none transition text-slate-700"

  const labelClass = theme === 'dark' ? "block text-sm text-text-secondary mb-2" : "block text-sm text-slate-600 mb-2"

  const sectionTitleClass = theme === 'dark'
    ? "text-sm font-medium text-text-secondary mb-3 flex items-center gap-2"
    : "text-sm font-medium text-slate-600 mb-3 flex items-center gap-2"

  const checkboxLabelClass = theme === 'dark'
    ? "flex items-center gap-2 text-text-secondary hover:text-cyan-400 cursor-pointer transition"
    : "flex items-center gap-2 text-slate-600 hover:text-cyan-600 cursor-pointer transition"

  return (
    <div className="space-y-6">
      {/* رأس الصفحة */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
        <div className={`${theme === 'light' ? 'border-t-4 border-t-cyan-500 -mt-6 -mx-6 px-6 pt-6 mb-4' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`text-2xl font-bold mb-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>إدارة المستخدمين</h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>إضافة وتعديل وحذف المستخدمين في النظام • التحديث التلقائي كل 5 ثوان</p>
            </div>
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${theme === 'dark' ? 'btn-primary' : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-md'}`}
              onClick={() => {
                resetForm()
                setShowAdd(true)
              }}
            >
              <span className="text-xl">+</span>
              <span>إضافة مستخدم جديد</span>
            </button>
          </div>
        </div>

        {/* رسالة النجاح/الخطأ */}
        {msg && (
          <div
            className={`px-4 py-3 rounded-xl border ${msgType === 'success'
              ? (theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'bg-cyan-50 border-cyan-300 text-cyan-600')
              : (theme === 'dark' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-300 text-red-600')
              }`}
          >
            {msg}
          </div>
        )}
      </div>

      {/* نموذج إضافة مستخدم جديد */}
      {showAdd && (
        <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-xl font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>مستخدم جديد</h2>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100'}`}
              onClick={() => setShowAdd(false)}
            >
              إلغاء
            </button>
          </div>

          <form onSubmit={submit} className="space-y-6">
            {/* معلومات الحساب */}
            <div>
              <h3 className={sectionTitleClass}>
                <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-cyan-500'}`}></div>
                معلومات الحساب
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    اسم المستخدم <span className="text-red-400">*</span>
                  </label>
                  <input
                    className={inputClass}
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    كلمة المرور المؤقتة <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* المعلومات الشخصية */}
            <div>
              <h3 className={sectionTitleClass}>
                <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-cyan-500'}`}></div>
                المعلومات الشخصية
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>الاسم الكامل</label>
                  <input
                    className={inputClass}
                    placeholder="الاسم الكامل"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>البريد الإلكتروني</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>رقم الهاتف</label>
                  <input
                    type="tel"
                    className={inputClass}
                    placeholder="+964 XXX XXX XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* الدور والصلاحيات */}
            <div>
              <h3 className={sectionTitleClass}>
                <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-cyan-500'}`}></div>
                الدور والصلاحيات
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>الدور</label>
                  <select
                    className={selectClass}
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value as any)}
                  >
                    <option value="employee">موظف</option>
                    <option value="system_admin">مدير النظام</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>نطاق التحليل</label>
                  <select
                    className={selectClass}
                    value={analyzeScope}
                    onChange={(e) => setAnalyzeScope(e.target.value as any)}
                  >
                    <option value="own">وثائقه فقط</option>
                    <option value="all">كل الوثائق</option>
                    <option value="selected">وثائق محددة</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className={checkboxLabelClass}>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[rgba(0,188,212,0.12)] bg-base-900 text-cyan-500 focus:ring-cyan-500"
                      checked={mustChangePassword}
                      onChange={(e) => setMustChangePassword(e.target.checked)}
                    />
                    <span>إجبار تغيير كلمة المرور</span>
                  </label>
                </div>
              </div>
            </div>

            {/* صلاحيات الوثائق */}
            <div>
              <h3 className={sectionTitleClass}>
                <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-cyan-500'}`}></div>
                صلاحيات الوثائق
              </h3>
              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permViewAll}
                    onChange={(e) => setPermViewAll(e.target.checked)}
                  />
                  <span>الاطلاع على كل الوثائق</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permManageOwn}
                    onChange={(e) => setPermManageOwn(e.target.checked)}
                  />
                  <span>إدارة وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permDeleteOwn}
                    onChange={(e) => setPermDeleteOwn(e.target.checked)}
                  />
                  <span>حذف وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permShareOwn}
                    onChange={(e) => setPermShareOwn(e.target.checked)}
                  />
                  <span>مشاركة وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permSearchOwn}
                    onChange={(e) => setPermSearchOwn(e.target.checked)}
                  />
                  <span>البحث داخل وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={permViewReports}
                    onChange={(e) => setPermViewReports(e.target.checked)}
                  />
                  <span>إنشاء التقارير</span>
                </label>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className={`flex gap-3 pt-4 border-t ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)]' : 'border-cyan-200'}`}>
              <button type="submit" className={`px-8 py-2 rounded-xl transition-all ${theme === 'dark' ? 'btn-primary' : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-md'}`}>
                حفظ المستخدم
              </button>
              <button
                type="button"
                className={`px-6 py-2 rounded-xl border transition ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400' : 'border-cyan-200 hover:border-cyan-500 text-slate-600 hover:text-cyan-600'}`}
                onClick={() => setShowAdd(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* جدول المستخدمين */}
      <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
        <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>قائمة المستخدمين ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`${theme === 'dark' ? 'text-text-secondary border-b border-[rgba(0,188,212,0.12)]' : 'text-slate-600 border-b-2 border-cyan-200 bg-cyan-50/50'}`}>
                <th className="text-right py-3 px-2">#</th>
                <th className="text-right py-3 px-2">اسم المستخدم</th>
                <th className="text-right py-3 px-2">الاسم الكامل</th>
                <th className="text-right py-3 px-2">البريد</th>
                <th className="text-right py-3 px-2">الهاتف</th>
                <th className="text-right py-3 px-2">الدور</th>
                <th className="text-right py-3 px-2">الحالة</th>
                <th className="text-right py-3 px-2">الاتصال</th>
                <th className="text-left py-3 px-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`${theme === 'dark' ? 'border-b border-[rgba(0,188,212,0.12)] hover:bg-base-900/50' : 'border-b border-cyan-100 hover:bg-cyan-50/50'} transition`}
                >
                  <td className={`py-3 px-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{u.id}</td>
                  <td className={`py-3 px-2 font-medium ${theme === 'dark' ? '' : 'text-slate-700'}`}>{u.username}</td>
                  <td className={`py-3 px-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{u.full_name || '—'}</td>
                  <td className={`py-3 px-2 text-xs ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{u.email || '—'}</td>
                  <td className={`py-3 px-2 ${theme === 'dark' ? 'text-text-secondary' : 'text-slate-500'}`}>{u.phone || '—'}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-lg text-xs ${u.role_name === 'system_admin'
                        ? (theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-600')
                        : (theme === 'dark' ? 'bg-base-900 text-text-secondary' : 'bg-slate-100 text-slate-600')
                        }`}
                    >
                      {u.role_name === 'system_admin' ? 'مدير النظام' : 'موظف'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-block px-2 py-1 rounded-lg text-xs ${u.is_active
                        ? (theme === 'dark' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                        : (theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
                        }`}
                    >
                      {u.is_active ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${u.online
                          ? (theme === 'dark' ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-500 animate-pulse')
                          : (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-400')
                          }`}
                      ></span>
                      <span className={u.online ? (theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600') : (theme === 'dark' ? 'text-text-secondary' : 'text-slate-500')}>
                        {u.online ? 'متصل' : 'غير متصل'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-left">
                    <div className="flex gap-2 justify-end flex-wrap">
                      <button
                        className={`px-3 py-1.5 rounded-lg border transition text-xs ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400' : 'border-cyan-200 hover:border-cyan-500 text-slate-600 hover:text-cyan-600 hover:bg-cyan-50'}`}
                        onClick={() => startEdit(u)}
                      >
                        تعديل
                      </button>
                      <button
                        className={`px-3 py-1.5 rounded-lg border transition text-xs ${theme === 'dark' ? 'border-[rgba(168,85,247,0.3)] hover:border-purple-500 text-text-secondary hover:text-purple-400' : 'border-purple-200 hover:border-purple-500 text-slate-600 hover:text-purple-600 hover:bg-purple-50'}`}
                        onClick={() => resetPassword(u)}
                        title="إعادة تعيين كلمة المرور"
                      >
                        إعادة تعيين كلمة المرور
                      </button>
                      <button
                        className={`px-3 py-1.5 rounded-lg border transition text-xs ${u.is_active
                          ? (theme === 'dark' ? 'border-[rgba(255,165,0,0.3)] hover:border-orange-500 text-text-secondary hover:text-orange-400' : 'border-orange-200 hover:border-orange-500 text-slate-600 hover:text-orange-600 hover:bg-orange-50')
                          : (theme === 'dark' ? 'border-[rgba(0,255,0,0.2)] hover:border-green-500 text-text-secondary hover:text-green-400' : 'border-green-200 hover:border-green-500 text-slate-600 hover:text-green-600 hover:bg-green-50')
                          }`}
                        onClick={() => toggleUserStatus(u)}
                      >
                        {u.is_active ? 'تعطيل' : 'تنشيط'}
                      </button>
                      <button
                        className={`px-3 py-1.5 rounded-lg border transition text-xs ${theme === 'dark' ? 'border-[rgba(255,0,0,0.3)] hover:border-red-500 text-text-secondary hover:text-red-400' : 'border-red-200 hover:border-red-500 text-slate-600 hover:text-red-600 hover:bg-red-50'}`}
                        onClick={() => deleteUser(u)}
                      >
                        حذف نهائي
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* نموذج التعديل */}
      {editId !== null && (
        <div className={`rounded-xl p-6 ${theme === 'dark' ? 'card' : 'bg-white border-2 border-cyan-200 shadow-lg'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>تعديل المستخدم #{editId}</h3>
            <button
              type="button"
              className={`px-4 py-2 rounded-lg transition-colors ${theme === 'dark' ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border border-red-300 text-red-600 hover:bg-red-100'}`}
              onClick={() => setEditId(null)}
            >
              إلغاء
            </button>
          </div>
          <div className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>الاسم الكامل</label>
                <input
                  className={inputClass}
                  placeholder="الاسم الكامل"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>البريد الإلكتروني</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="email@example.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>رقم الهاتف</label>
                <input
                  type="tel"
                  className={inputClass}
                  placeholder="+964 XXX XXX XXXX"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className={labelClass}>الدور</label>
                <select
                  className={selectClass}
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                >
                  <option value="employee">موظف</option>
                  <option value="system_admin">مدير النظام</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>نطاق التحليل</label>
                <select
                  className={selectClass}
                  value={editAnalyzeScope}
                  onChange={(e) => setEditAnalyzeScope(e.target.value as any)}
                >
                  <option value="own">وثائقه فقط</option>
                  <option value="all">كل الوثائق</option>
                  <option value="selected">وثائق محددة</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                  />
                  <span>نشط</span>
                </label>
              </div>
              <div className="flex items-end">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editMustChangePassword}
                    onChange={(e) => setEditMustChangePassword(e.target.checked)}
                  />
                  <span>إجبار تغيير كلمة المرور</span>
                </label>
              </div>
            </div>

            {/* صلاحيات الوثائق */}
            <div>
              <h4 className={sectionTitleClass}>
                <div className={`w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-cyan-400' : 'bg-cyan-500'}`}></div>
                صلاحيات الوثائق
              </h4>
              <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermViewAll}
                    onChange={(e) => setEditPermViewAll(e.target.checked)}
                  />
                  <span>الاطلاع على كل الوثائق</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermManageOwn}
                    onChange={(e) => setEditPermManageOwn(e.target.checked)}
                  />
                  <span>إدارة وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermDeleteOwn}
                    onChange={(e) => setEditPermDeleteOwn(e.target.checked)}
                  />
                  <span>حذف وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermShareOwn}
                    onChange={(e) => setEditPermShareOwn(e.target.checked)}
                  />
                  <span>مشاركة وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermSearchOwn}
                    onChange={(e) => setEditPermSearchOwn(e.target.checked)}
                  />
                  <span>البحث داخل وثائقه</span>
                </label>
                <label className={checkboxLabelClass}>
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={editPermViewReports}
                    onChange={(e) => setEditPermViewReports(e.target.checked)}
                  />
                  <span>إنشاء التقارير</span>
                </label>
              </div>
            </div>

            <div className={`flex gap-3 pt-4 border-t ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)]' : 'border-cyan-200'}`}>
              <button className={`px-8 py-2 rounded-xl transition-all ${theme === 'dark' ? 'btn-primary' : 'bg-cyan-500 text-white hover:bg-cyan-600 shadow-md'}`} onClick={saveEdit}>
                حفظ التعديلات
              </button>
              <button
                className={`px-6 py-2 rounded-xl border transition ${theme === 'dark' ? 'border-[rgba(0,188,212,0.12)] hover:border-cyan-500 text-text-secondary hover:text-cyan-400' : 'border-cyan-200 hover:border-cyan-500 text-slate-600 hover:text-cyan-600'}`}
                onClick={() => setEditId(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UsersAdmin
