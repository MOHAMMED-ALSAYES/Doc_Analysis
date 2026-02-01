# 🚀 دليل نشر المشروع على Render.com (مجاني)

## 📋 المتطلبات الأساسية

1. حساب على [GitHub](https://github.com)
2. حساب على [Render.com](https://render.com) (يمكن التسجيل بـ GitHub)

---

## 📦 الخطوة 1: رفع المشروع على GitHub

### 1.1 إنشاء مستودع جديد على GitHub

1. اذهب إلى [github.com/new](https://github.com/new)
2. اختر اسم المستودع: `doc-analysis`
3. اختر **Private** (خاص) أو **Public** (عام)
4. اضغط **Create repository**

### 1.2 رفع الملفات

افتح Terminal في مجلد المشروع ونفذ:

```powershell
# تهيئة Git (إذا لم يكن مُهيئاً)
git init

# إضافة جميع الملفات
git add .

# إنشاء commit
git commit -m "Initial commit - Doc Analysis System"

# ربط المستودع البعيد (استبدل USERNAME باسم المستخدم الخاص بك)
git remote add origin https://github.com/USERNAME/doc-analysis.git

# رفع الملفات
git branch -M main
git push -u origin main
```

---

## ☁️ الخطوة 2: النشر على Render.com

### 2.1 إنشاء قاعدة البيانات PostgreSQL

1. سجل الدخول إلى [Render Dashboard](https://dashboard.render.com)
2. اضغط **New +** → **PostgreSQL**
3. أدخل التفاصيل:
   - **Name**: `doc-analysis-db`
   - **Database**: `docdb`
   - **User**: `docuser`
   - **Region**: اختر الأقرب لك
   - **Plan**: `Free`
4. اضغط **Create Database**
5. **مهم**: انسخ **Internal Database URL** للاستخدام لاحقاً

### 2.2 إنشاء Redis

1. اضغط **New +** → **Redis**
2. أدخل التفاصيل:
   - **Name**: `doc-analysis-redis`
   - **Plan**: `Free`
3. اضغط **Create Redis**
4. انسخ **Internal URL**

### 2.3 نشر Backend (FastAPI)

1. اضغط **New +** → **Web Service**
2. اختر **Connect a repository** وحدد مستودع `doc-analysis`
3. أدخل التفاصيل:

| الإعداد | القيمة |
|---------|--------|
| **Name** | `doc-analysis-api` |
| **Region** | اختر الأقرب لك |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Docker` |
| **Dockerfile Path** | `./Dockerfile` |
| **Plan** | `Free` |

4. **Environment Variables** - اضغط **Add Environment Variable**:

| المتغير | القيمة |
|---------|--------|
| `DATABASE_URL` | الصق Internal Database URL من PostgreSQL |
| `REDIS_URL` | الصق Internal URL من Redis |
| `APP_NAME` | `Doc Analysis API` |
| `APP_ENV` | `production` |
| `CORS_ALLOW_ORIGINS` | `*` |
| `JWT_SECRET` | أنشئ كلمة سر قوية وطويلة |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_ACCESS_EXPIRES` | `3600` |
| `JWT_REFRESH_EXPIRES` | `1209600` |
| `TESSERACT_LANGS` | `ara+eng` |
| `FILE_STORAGE_ROOT` | `/app/storage` |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | كلمة مرور قوية للمشرف |

5. اضغط **Create Web Service**
6. انتظر حتى يكتمل البناء (قد يستغرق 5-10 دقائق)
7. **مهم**: انسخ عنوان الـ API (مثل: `https://doc-analysis-api.onrender.com`)

### 2.4 نشر Frontend (React)

1. اضغط **New +** → **Static Site**
2. اختر مستودع `doc-analysis`
3. أدخل التفاصيل:

| الإعداد | القيمة |
|---------|--------|
| **Name** | `doc-analysis-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. **Environment Variables**:

| المتغير | القيمة |
|---------|--------|
| `VITE_API_URL` | عنوان الـ API الذي نسخته (مثل: `https://doc-analysis-api.onrender.com`) |

5. **Redirects/Rewrites** - اضغط **Add Rule**:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`

6. اضغط **Create Static Site**

---

## ✅ الخطوة 3: تهيئة قاعدة البيانات

بعد نشر الـ Backend بنجاح، نحتاج تشغيل migrations:

### طريقة 1: عبر Render Shell

1. اذهب إلى خدمة `doc-analysis-api` في Render
2. اضغط **Shell**
3. نفذ:

```bash
cd /app
alembic upgrade head
```

### طريقة 2: إضافة أمر build

في إعدادات الـ Web Service، أضف **Build Command**:

```bash
pip install -r requirements.txt && alembic upgrade head
```

---

## 🔧 الخطوة 4: إضافة Disk للملفات (اختياري)

للاحتفاظ بالملفات المرفوعة:

1. اذهب إلى خدمة `doc-analysis-api`
2. اضغط **Disks** → **Add Disk**
3. أدخل:
   - **Name**: `doc-storage`
   - **Mount Path**: `/app/storage`
   - **Size**: `1 GB` (مجاناً)

---

## 🌐 الخطوة 5: اختبار النشر

### اختبار الـ Backend:
```
https://doc-analysis-api.onrender.com/health
```

يجب أن يُرجع:
```json
{"status": "healthy"}
```

### اختبار الـ Frontend:
افتح عنوان الـ Frontend في المتصفح وسجل الدخول بـ:
- **اسم المستخدم**: `admin`
- **كلمة المرور**: الكلمة التي حددتها في `ADMIN_PASSWORD`

---

## ⚠️ ملاحظات مهمة

### حدود الخطة المجانية:

| الخدمة | الحد |
|--------|------|
| **Web Services** | تنام بعد 15 دقيقة من عدم النشاط |
| **PostgreSQL** | 90 يوم مجاني، ثم تحتاج ترقية |
| **Redis** | 25 MB حد التخزين |
| **Static Sites** | غير محدود |

### لإبقاء الخدمة نشطة:

يمكنك استخدام [UptimeRobot](https://uptimerobot.com) (مجاني) لإرسال طلب كل 14 دقيقة:
1. سجل في UptimeRobot
2. أضف monitor جديد:
   - **Type**: HTTP(s)
   - **URL**: `https://doc-analysis-api.onrender.com/health`
   - **Interval**: 5 minutes

---

## 🔄 التحديث المستقبلي

عند إجراء تغييرات على الكود:

```powershell
git add .
git commit -m "وصف التحديث"
git push
```

Render سيكتشف التغييرات ويعيد النشر تلقائياً!

---

## 🆘 حل المشاكل الشائعة

### مشكلة: Build failed
- تحقق من logs في Render Dashboard
- تأكد من صحة `requirements.txt`

### مشكلة: Cannot connect to database
- تأكد من استخدام **Internal Database URL**
- تحقق من أن PostgreSQL في نفس Region

### مشكلة: 502 Bad Gateway
- انتظر دقيقة حتى تستيقظ الخدمة
- تحقق من logs للأخطاء

### مشكلة: Frontend لا يتصل بـ Backend
- تأكد من صحة `VITE_API_URL`
- تأكد من تضمين البروتوكول (`https://`)
- تحقق من CORS في Backend

---

## 📞 للمساعدة

إذا واجهت أي مشكلة، شارك:
1. رسالة الخطأ
2. لقطة شاشة من Logs
3. الخطوة التي توقفت عندها

وسأساعدك في حلها! 🎯
