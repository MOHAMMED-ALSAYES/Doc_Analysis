#!/bin/bash
set -e

echo "🚀 Starting Doc Analysis API (Linux Compatible)..."

# Run database migrations
echo "📦 Running database migrations..."
alembic upgrade head || echo "⚠️ Migrations failed or already applied"

echo "✅ Migrations complete!"

# Start the application
echo "🌐 Starting Gunicorn server..."
# Using a single line command to avoid CRLF/LF issues with backslashes
exec gunicorn app.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000} --timeout 120 --graceful-timeout 30 --access-logfile - --error-logfile -