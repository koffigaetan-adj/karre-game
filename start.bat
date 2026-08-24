@echo off
setlocal

set ROOT=%~dp0

start "Kwadra - Backend (FastAPI)" cmd /k "cd /d "%ROOT%server" && python -m uvicorn app.main:app --reload --port 8000"
start "Kwadra - Frontend (Next.js)" cmd /k "cd /d "%ROOT%web" && npm run dev"

endlocal
