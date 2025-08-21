@echo off
title Task Manager - Setup and Launch
color 0B

echo ================================================
echo     TASK MANAGER - FIRST TIME SETUP
echo ================================================
echo.
echo This script will:
echo  1. Check Python installation
echo  2. Install all required dependencies
echo  3. Set up the application
echo  4. Launch the Task Manager
echo.
echo ================================================
echo.
pause

cls
echo ================================================
echo     CHECKING SYSTEM REQUIREMENTS
echo ================================================
echo.

:: Check Python installation
echo Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Python is not installed or not in PATH
    echo.
    echo Please install Python 3.7 or higher:
    echo 1. Download from: https://www.python.org/downloads/
    echo 2. During installation, check "Add Python to PATH"
    echo 3. Run this script again after installation
    echo.
    pause
    exit /b 1
)

:: Get Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% found
echo.

:: Check pip
echo Checking pip installation...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo pip not found. Installing pip...
    python -m ensurepip --default-pip
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install pip
        echo Please install pip manually and run this script again
        pause
        exit /b 1
    )
)
echo [OK] pip is installed
echo.

:: Install dependencies
echo ================================================
echo     INSTALLING DEPENDENCIES
echo ================================================
echo.
echo Installing required Python packages...
echo This may take a few minutes...
echo.

pip install --upgrade pip >nul 2>&1

:: Try to install from requirements.txt first
if exist "requirements.txt" (
    echo Installing from requirements.txt...
    pip install -r requirements.txt
) else (
    echo Installing individual packages...
    pip install Flask==3.0.0 Flask-CORS==4.0.0 anthropic>=0.25.0 plyer==2.1 requests==2.31.0 waitress==3.0.0
)

if %errorlevel% neq 0 (
    color 0E
    echo.
    echo [WARNING] Some packages may not have installed correctly
    echo Attempting alternative installation...
    pip install Flask Flask-CORS anthropic plyer requests waitress
)

echo.
echo [OK] Dependencies installed
echo.

:: Create necessary directories
echo ================================================
echo     SETTING UP APPLICATION
echo ================================================
echo.

if not exist "data" (
    echo Creating data directory...
    mkdir data
    echo [OK] Data directory created
) else (
    echo [OK] Data directory exists
)

if not exist "static" (
    echo [WARNING] Static directory not found
    mkdir static\css static\js 2>nul
)

if not exist "templates" (
    echo [WARNING] Templates directory not found
    mkdir templates 2>nul
)

:: Check for main application file
if not exist "app.py" (
    color 0C
    echo.
    echo [ERROR] app.py not found!
    echo Please ensure all application files are in the current directory
    echo.
    pause
    exit /b 1
)

echo [OK] Application files verified
echo.

:: Create initial config files if they don't exist
if not exist "data\config.json" (
    echo Creating default configuration...
    (
        echo {
        echo   "categories": ["Development", "Support", "Bug", "Feature", "Documentation"],
        echo   "statuses": ["Open", "In Progress", "Pending", "Completed", "Cancelled"],
        echo   "priorities": ["Low", "Medium", "High", "Urgent"],
        echo   "tags": ["Frontend", "Backend", "Database", "API", "UI", "Security"]
        echo }
    ) > data\config.json
    echo [OK] Default configuration created
)

if not exist "data\settings.json" (
    echo Creating default settings...
    (
        echo {
        echo   "api_key": "",
        echo   "notifications_enabled": true,
        echo   "check_interval": 60
        echo }
    ) > data\settings.json
    echo [OK] Default settings created
)

if not exist "data\tasks.json" (
    echo Creating tasks database...
    echo [] > data\tasks.json
    echo [OK] Tasks database created
)

echo.
echo ================================================
echo     LAUNCHING APPLICATION
echo ================================================
echo.
color 0A
echo Setup complete! Starting Task Manager with Waitress...
echo.

:: Find available port by checking what's listening
echo Finding available port...
set PORT=8080
set PORTS_TO_TRY=8080 8081 5000 5001 8000 3000

for %%p in (%PORTS_TO_TRY%) do (
    netstat -an | findstr /r ":%%p.*LISTENING" >nul 2>&1
    if errorlevel 1 (
        set PORT=%%p
        goto :port_found
    )
)

:port_found
echo The application will open at: http://localhost:%PORT%
echo.
echo IMPORTANT NOTES:
echo - Using production server for better performance
echo - To use AI features, add your Anthropic API key in Settings
echo - Press Ctrl+C in this window to stop the server
echo - Your data is saved in the 'data' folder
echo.
echo ================================================
echo.

:: Wait a moment before starting
timeout /t 2 >nul

:: Open browser automatically
start "" http://localhost:%PORT%

:: Try Waitress first, then fall back to Flask if it fails
echo Starting server...
python -m waitress --port=%PORT% --threads=4 app:app
if %errorlevel% neq 0 (
    echo.
    echo Waitress failed to start. Using Flask development server...
    echo.
    python app.py
)

:: After application closes
echo.
echo ================================================
echo Application stopped.
echo.
echo To restart, run: run_task_manager.bat
echo ================================================
pause