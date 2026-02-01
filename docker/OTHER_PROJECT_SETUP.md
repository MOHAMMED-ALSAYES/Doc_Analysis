# إعداد المشروع الآخر بشكل منفصل

هذا الملف يوضح كيفية إعداد المشروع الآخر (مثل food_waste) بشكل منفصل تماماً عن مشروع Doc_Analysis.

## الخطوات المطلوبة:

### 1. تحديث docker-compose.yml في المشروع الآخر

أضف هذه الإعدادات في ملف `docker-compose.yml` للمشروع الآخر:

```yaml
# Project name مميز - يجب أن يكون مختلف عن doc-analysis
name: food-waste  # أو أي اسم آخر للمشروع

services:
  postgres:
    container_name: food-waste-postgres  # اسم مميز
    image: postgres:15
    ports:
      - "5433:5432"  # منفذ مختلف (5433 بدلاً من 5432)
    volumes:
      - food-waste-pgdata:/var/lib/postgresql/data  # volume مميز
    networks:
      - food-waste-network  # network مميز
    # ... باقي الإعدادات

  redis:
    container_name: food-waste-redis
    ports:
      - "6380:6379"  # منفذ مختلف (6380 بدلاً من 6379)
    networks:
      - food-waste-network

  api:
    container_name: food-waste-api
    ports:
      - "8001:8000"  # منفذ مختلف (8001 بدلاً من 8000)
    networks:
      - food-waste-network
    # ... باقي الإعدادات

volumes:
  food-waste-pgdata:  # volume مميز
  # ... باقي الـ volumes

networks:
  food-waste-network:  # network مميز
    driver: bridge
```

### 2. المنافذ المقترحة للمشروع الآخر:

| الخدمة | المنفذ الخارجي | المنفذ الداخلي | الملاحظات |
|--------|----------------|----------------|-----------|
| Postgres | 5433 | 5432 | مختلف عن Doc_Analysis (5432) |
| Redis | 6380 | 6379 | مختلف عن Doc_Analysis (6379) |
| API | 8001 | 8000 | مختلف عن Doc_Analysis (8000) |
| Minio (إن وُجد) | 9002, 9003 | 9000, 9001 | مختلف عن Doc_Analysis |

### 3. الأوامر لتشغيل المشروع الآخر:

```bash
# انتقل إلى مجلد المشروع الآخر
cd C:\path\to\food_waste

# شغّل الخدمات
docker-compose up -d

# أو مع تحديد المشروع بشكل صريح
docker-compose -p food-waste up -d

# التحقق من الحالة
docker-compose ps

# عرض الـ containers الخاصة بهذا المشروع فقط
docker ps --filter "name=food-waste"

# إيقاف الخدمات
docker-compose down
```

### 4. التحقق من عدم التعارض:

```bash
# عرض جميع الـ containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# يجب أن ترى:
# doc-analysis-* للمشروع الحالي
# food-waste-* للمشروع الآخر

# عرض جميع الـ volumes
docker volume ls

# يجب أن ترى:
# doc-analysis_* للمشروع الحالي
# food-waste_* للمشروع الآخر

# عرض جميع الـ networks
docker network ls

# يجب أن ترى:
# doc-analysis_* للمشروع الحالي
# food-waste_* للمشروع الآخر
```

### 5. قاعدة البيانات للمشروع الآخر:

إذا كنت تريد استخدام قاعدة بيانات مختلفة:

```yaml
services:
  postgres:
    environment:
      POSTGRES_DB: food_waste_db  # اسم مختلف
      POSTGRES_USER: fooduser     # مستخدم مختلف
      POSTGRES_PASSWORD: foodpass # كلمة مرور مختلفة
```

### 6. تشغيل Migrations في المشروع الآخر:

```bash
# من داخل container المشروع الآخر
docker-compose exec api alembic upgrade head

# أو إذا كان اسم الخدمة مختلف
docker-compose exec web alembic upgrade head
```

## ملاحظات مهمة:

1. **أسماء الـ Containers**: يجب أن تكون مميزة تماماً
   - ✅ `doc-analysis-postgres` و `food-waste-postgres`
   - ❌ `postgres` (سيسبب تعارض)

2. **أسماء الـ Volumes**: يجب أن تكون مميزة
   - ✅ `doc-analysis-pgdata` و `food-waste-pgdata`
   - ❌ `pgdata` (سيسبب تعارض)

3. **أسماء الـ Networks**: يجب أن تكون مميزة
   - ✅ `doc-analysis-network` و `food-waste-network`
   - ❌ `default` (سيسبب تعارض)

4. **المنافذ**: يجب أن تكون مختلفة لكل مشروع
   - Doc_Analysis: 5432, 6379, 8000
   - المشروع الآخر: 5433, 6380, 8001

5. **Project Name**: استخدم `-p` أو `name:` في docker-compose.yml
   - يمنع التعارض في أسماء الـ resources

## مثال كامل:

```yaml
name: food-waste

services:
  postgres:
    container_name: food-waste-postgres
    image: postgres:15
    environment:
      POSTGRES_DB: food_waste_db
      POSTGRES_USER: fooduser
      POSTGRES_PASSWORD: foodpass
    ports:
      - "5433:5432"
    volumes:
      - food-waste-pgdata:/var/lib/postgresql/data
    networks:
      - food-waste-network

  api:
    container_name: food-waste-api
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8001:8000"
    depends_on:
      - postgres
    networks:
      - food-waste-network

volumes:
  food-waste-pgdata:

networks:
  food-waste-network:
    driver: bridge
```

## التحقق من عدم التعارض:

بعد تشغيل المشروعين، تحقق:

```bash
# يجب أن تعمل جميع الخدمات بدون تعارض
docker ps

# يجب أن ترى:
# doc-analysis-postgres على المنفذ 5432
# food-waste-postgres على المنفذ 5433
# doc-analysis-api على المنفذ 8000
# food-waste-api على المنفذ 8001
```


