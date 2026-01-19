$ErrorActionPreference = "Stop"

# Basic auth for n8n UI (local dev)
$env:N8N_BASIC_AUTH_ACTIVE = "true"
$env:N8N_BASIC_AUTH_USER = "admin"
$env:N8N_BASIC_AUTH_PASSWORD = "admin123"

# n8n server config
$env:N8N_HOST = "localhost"
$env:N8N_PORT = "5678"
$env:N8N_PROTOCOL = "http"
$env:WEBHOOK_URL = "http://localhost:5678/"
$env:N8N_EDITOR_BASE_URL = "http://localhost:5678/"
$env:GENERIC_TIMEZONE = "Asia/Kolkata"

# DailyDigest backend (where n8n will POST articles)
$env:DAILYDIGEST_BACKEND_ARTICLES_URL = "http://localhost:3001/api/articles"
$env:DAILYDIGEST_WEBHOOK_SECRET = "dailydigest-n8n-webhook-secret"

Write-Host "Starting n8n..."
Write-Host "UI: http://localhost:5678 (user: admin / pass: admin123)"
Write-Host "Backend target: $env:DAILYDIGEST_BACKEND_ARTICLES_URL"

# Run n8n without global install
npx --yes n8n@latest



