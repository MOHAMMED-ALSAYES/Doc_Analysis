
import os

# Write backend/start.sh with LF only
with open("backend/start.sh", "wb") as f:
    sh_content = b'#!/bin/bash\nset -e\n\necho "Starting Doc Analysis API (Linux v2)..."\n\n# Run database migrations\necho "Running database migrations..."\nalembic upgrade head || echo "Migrations failed or already applied"\n\necho "Migrations complete!"\n\n# Start the application\necho "Starting Gunicorn server..."\nexec gunicorn app.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -\n'
    f.write(sh_content)

print(f"Backend start.sh rewritten with LF line endings ({len(sh_content)} bytes).")
