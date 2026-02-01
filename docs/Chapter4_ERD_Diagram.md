# مخطط العلاقات بين الكيانات (ERD)
# Entity Relationship Diagram for Doc_Analysis System

## العلاقات بين الجداول:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│                           نظام إدارة وتحليل الوثائق الذكي                              │
│                          Entity Relationship Diagram (ERD)                              │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │     roles       │
                                    │─────────────────│
                                    │ PK: id          │
                                    │ name            │
                                    │ description     │
                                    │ permissions     │
                                    │ created_at      │
                                    └────────┬────────┘
                                             │
                                             │ 1
                                             │
                                             ▼ N
                          ┌─────────────────────────────────────┐
                          │              users                   │
                          │─────────────────────────────────────│
                          │ PK: id                               │
                          │ FK: role_id → roles.id               │
                          │ username                             │
                          │ full_name                            │
                          │ password_hash                        │
                          │ email                                │
                          │ phone                                │
                          │ is_active                            │
                          │ created_at                           │
                          │ last_login                           │
                          │ must_change_password                 │
                          │ analyze_scope                        │
                          │ permissions                          │
                          └───┬──────────────┬───────────────┬───┘
                              │              │               │
              ┌───────────────┘              │               └────────────────┐
              │                              │                                │
              │ 1                            │ 1                              │ 1
              │                              │                                │
              ▼ N                            ▼ N                              ▼ N
┌─────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│     activity_logs       │    │       documents         │    │  document_permissions   │
│─────────────────────────│    │─────────────────────────│    │─────────────────────────│
│ PK: id                  │    │ PK: id                  │    │ PK: id                  │
│ FK: user_id → users.id  │    │ FK: uploader_id →       │    │ FK: user_id → users.id  │
│ FK: document_id →       │    │     users.id            │    │ FK: document_id →       │
│     documents.id        │    │ document_number         │    │     documents.id        │
│ action                  │    │ type_id                 │    │ FK: granted_by →        │
│ action_details          │    │ title                   │    │     users.id            │
│ ip_address              │    │ suggested_title         │    │ can_view                │
│ timestamp               │    │ content_text            │    │ can_download            │
└─────────────────────────┘    │ ai_classification       │    │ can_edit_metadata       │
                               │ document_direction      │    │ can_delete              │
                               │ original_date           │    │ can_share               │
                               │ source_type             │    │ can_analyze             │
                               │ original_file_path      │    │ granted_at              │
                               │ pdf_path                │    └─────────────────────────┘
                               │ image_path              │
                               │ ocr_text_path           │
                               │ status                  │
                               │ version                 │
                               │ ocr_accuracy            │
                               │ created_at              │
                               │ updated_at              │
                               └───────────┬─────────────┘
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     │                     │                     │
                     │ 1                   │                     │ 1
                     │                     │                     │
                     ▼ N                   │                     ▼ N
         ┌─────────────────────┐           │         ┌─────────────────────┐
         │    attachments      │           │         │   document_types    │
         │─────────────────────│           │         │─────────────────────│
         │ PK: id              │           │         │ PK: id              │
         │ FK: document_id →   │           │         │ name                │
         │     documents.id    │           │         │ description         │
         │ FK: uploaded_by →   │           │         │ created_at          │
         │     users.id        │           │         └─────────────────────┘
         │ file_path           │           │
         │ file_type           │           │
         │ uploaded_at         │           │
         └─────────────────────┘           │
                                           │
                               ┌───────────┴───────────┐
                               │                       │
                               │ N                     │ N
                               │                       │
                               ▼                       ▼
                    ┌─────────────────────┐   ┌─────────────────┐   ┌─────────────────────┐
                    │  student_documents  │   │                 │   │   student_grades    │
                    │  (جدول الربط)       │───┤    students     │───│─────────────────────│
                    │─────────────────────│   │─────────────────│   │ PK: id              │
                    │ FK: student_id →    │   │ PK: id          │   │ FK: student_id →    │
                    │     students.id     │   │ student_number  │   │     students.id     │
                    │ FK: document_id →   │   │ full_name       │   │ FK: document_id →   │
                    │     documents.id    │   │ full_name_ar    │   │     documents.id    │
                    └─────────────────────┘   │ email           │   │ subject             │
                                              │ phone           │   │ exam_type           │
                                              │ date_of_birth   │   │ score               │
                                              │ grade_level     │   │ max_score           │
                                              │ department      │   │ percentage          │
                                              │ total_grades    │   │ grade               │
                                              │ average_score   │   │ exam_date           │
                                              │ created_at      │   │ semester            │
                                              │ updated_at      │   │ academic_year       │
                                              └─────────────────┘   │ notes               │
                                                                    │ created_at          │
                                                                    │ updated_at          │
                                                                    └─────────────────────┘
```

---

## ملخص العلاقات (Relationships Summary):

| العلاقة | النوع | الوصف |
|---------|-------|-------|
| `roles` → `users` | One-to-Many (1:N) | كل دور يمكن أن ينتمي له عدة مستخدمين |
| `users` → `documents` | One-to-Many (1:N) | كل مستخدم يمكنه رفع عدة وثائق |
| `users` → `activity_logs` | One-to-Many (1:N) | كل مستخدم له عدة سجلات نشاط |
| `documents` → `activity_logs` | One-to-Many (1:N) | كل وثيقة يمكن أن تظهر في عدة سجلات نشاط |
| `users` ↔ `documents` (permissions) | Many-to-Many via `document_permissions` | صلاحيات المستخدمين على الوثائق |
| `documents` → `attachments` | One-to-Many (1:N) | كل وثيقة يمكن أن تحتوي على عدة مرفقات |
| `students` ↔ `documents` | Many-to-Many via `student_documents` | ربط الطلاب بالوثائق المتعلقة بهم |
| `students` → `student_grades` | One-to-Many (1:N) | كل طالب له عدة درجات |
| `documents` → `student_grades` | One-to-Many (1:N) | كل وثيقة (كشف درجات) يمكن أن تحتوي على عدة درجات |

---

## تفاصيل المفاتيح (Keys Details):

### المفاتيح الأساسية (Primary Keys - PK):
- جميع الجداول تستخدم `id` كمفتاح أساسي من نوع `INTEGER` مع `AUTO_INCREMENT`

### المفاتيح الأجنبية (Foreign Keys - FK):

| الجدول | المفتاح الأجنبي | يشير إلى | عند الحذف |
|--------|----------------|----------|-----------|
| `users` | `role_id` | `roles.id` | SET NULL |
| `documents` | `uploader_id` | `users.id` | SET NULL |
| `activity_logs` | `user_id` | `users.id` | - |
| `activity_logs` | `document_id` | `documents.id` | - |
| `attachments` | `document_id` | `documents.id` | CASCADE |
| `attachments` | `uploaded_by` | `users.id` | - |
| `document_permissions` | `user_id` | `users.id` | CASCADE |
| `document_permissions` | `document_id` | `documents.id` | CASCADE |
| `document_permissions` | `granted_by` | `users.id` | - |
| `student_documents` | `student_id` | `students.id` | CASCADE |
| `student_documents` | `document_id` | `documents.id` | CASCADE |
| `student_grades` | `student_id` | `students.id` | CASCADE |
| `student_grades` | `document_id` | `documents.id` | SET NULL |

---

## القيود الفريدة (Unique Constraints):

| الجدول | الحقل | الوصف |
|--------|-------|-------|
| `users` | `username` | لا يمكن تكرار اسم المستخدم |
| `roles` | `name` | لا يمكن تكرار اسم الدور |
| `documents` | `document_number` | لا يمكن تكرار رقم الوثيقة |
| `students` | `student_number` | لا يمكن تكرار رقم الطالب |

---

## الفهارس (Indexes):

لتحسين أداء الاستعلامات، يُنصح بإنشاء الفهارس التالية:

```sql
-- فهرس البحث في الوثائق
CREATE INDEX idx_documents_classification ON documents(ai_classification);
CREATE INDEX idx_documents_direction ON documents(document_direction);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created_at ON documents(created_at);

-- فهرس البحث في النشاط
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_timestamp ON activity_logs(timestamp);

-- فهرس البحث في الطلاب
CREATE INDEX idx_students_number ON students(student_number);
CREATE INDEX idx_students_name ON students(full_name);

-- فهرس البحث في الدرجات
CREATE INDEX idx_grades_student ON student_grades(student_id);
CREATE INDEX idx_grades_subject ON student_grades(subject);
```
