@echo off
title Task Manager - Launcher
color 0A

echo ========================================
echo     TASK MANAGER APPLICATION
echo ========================================
echo.

:: Check if Python is installed
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher from https://www.python.org/
    echo.
    pause
    exit /b 1
)

:: Display Python version
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo Found Python %PYTHON_VERSION%
echo.

:: Check if pip is installed
echo [2/4] Checking pip installation...
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: pip is not installed
    echo Installing pip...
    python -m ensurepip --default-pip
    if %errorlevel% neq 0 (
        echo Failed to install pip. Please install it manually.
        pause
        exit /b 1
    )
)
echo pip is installed
echo.

:: Check and install required packages
echo [3/4] Checking dependencies...
echo.

:: Create a temporary Python script to check dependencies
echo import sys > check_deps.py
echo import importlib.util >> check_deps.py
echo missing = [] >> check_deps.py
echo packages = {'flask': 'Flask', 'flask_cors': 'Flask-CORS', 'anthropic': 'anthropic', 'plyer': 'plyer', 'waitress': 'waitress'} >> check_deps.py
echo for module, package in packages.items(): >> check_deps.py
echo     if importlib.util.find_spec(module) is None: >> check_deps.py
echo         missing.append(package) >> check_deps.py
echo if missing: >> check_deps.py
echo     print('MISSING:' + ','.join(missing)) >> check_deps.py
echo else: >> check_deps.py
echo     print('OK') >> check_deps.py

:: Run the check
for /f "tokens=*" %%i in ('python check_deps.py') do set DEPS_STATUS=%%i

:: Clean up temp file
del check_deps.py >nul 2>&1

if "%DEPS_STATUS:~0,7%"=="MISSING" (
    echo Some dependencies are missing. Installing...
    echo.
    
    :: Install missing dependencies using requirements.txt
    pip install -r requirements.txt
    
    if %errorlevel% neq 0 (
        color 0C
        echo ERROR: Failed to install dependencies
        echo Please run manually: pip install -r requirements.txt
        pause
        exit /b 1
    )
    
    echo.
    echo Dependencies installed successfully!
) else (
    echo All dependencies are already installed
)
echo.

:: Create data directory if it doesn't exist
if not exist "data" (
    echo Creating data directory...
    mkdir data
)

:: Check if app.py exists
if not exist "app.py" (
    color 0C
    echo ERROR: app.py not found in current directory
    echo Please ensure you're running this from the TaskManager directory
    pause
    exit /b 1
)

:: Start the application
echo [4/4] Starting Task Manager...
echo ========================================
echo.

:: Find available port by trying to bind
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
echo Using port %PORT%
echo Dashboard will be available at: http://localhost:%PORT%
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

:: Start browser after a delay
start "" timeout /t 2 /nobreak >nul && start http://localhost:%PORT%

:: Check if we should use development mode for debugging
if "%1"=="--debug" (
    echo Starting in DEBUG mode with Flask development server...
    set FLASK_ENV=development
    set FLASK_DEBUG=1
    python app.py
) else (
    :: Run Waitress production server
    echo Starting Waitress production server...
    echo NOTE: Run with --debug flag to use Flask development server
    echo.
    python -m waitress --port=%PORT% --threads=4 app:app
    
    :: Check if Waitress failed to start (not user termination)
    if %errorlevel% neq 0 (
        if %errorlevel% neq -1073741510 (
            :: Error code -1073741510 is CTRL-C, don't show error for that
            echo.
            echo ERROR: Waitress failed to start.
            echo Possible causes:
            echo - Port %PORT% is already in use
            echo - Missing dependencies (run: pip install -r requirements.txt)
            echo.
            echo To run in development mode, use: run_task_manager.bat --debug
        )
    )
)

:: This will execute after the app is closed
echo.
echo Application stopped.
pause