
try:
    with open('backend/app/api/routes/documents.py', 'r', encoding='utf-8') as f:
        file1 = f.read()
except UnicodeDecodeError:
    with open('backend/app/api/routes/documents.py', 'r', encoding='utf-8', errors='ignore') as f:
        file1 = f.read()

with open('backend/delete_endpoint_fragment.py', 'r', encoding='utf-8') as f:
    file2 = f.read()

with open('backend/app/api/routes/documents.py', 'w', encoding='utf-8') as f:
    f.write(file1 + "\n" + file2)

import os
os.remove('backend/delete_endpoint_fragment.py')
print("Successfully appended delete function to documents.py")
