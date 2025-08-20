@echo off
echo 🚀 Tag Structure Migration Runner
echo.

REM Check if SUPABASE_SERVICE_KEY is set
if "%SUPABASE_SERVICE_KEY%"=="" (
    echo ❌ SUPABASE_SERVICE_KEY environment variable is required
    echo Set it with: set SUPABASE_SERVICE_KEY=your_service_key
    echo.
    echo Your Supabase service key can be found at:
    echo https://supabase.com/dashboard/project/bykbnagijmxtfpkaflae/settings/api
    pause
    exit /b 1
)

echo ✅ Service key found, starting analysis...
echo.

node run_migration_simple.js

echo.
pause