@echo off
title Update Task Manager Dependencies
color 0E

echo ================================================
echo     UPDATING TASK MANAGER DEPENDENCIES
echo ================================================
echo.

echo Updating pip...
python -m pip install --upgrade pip

echo.
echo Installing/Updating required packages...
pip install --upgrade Flask==3.0.0
pip install --upgrade Flask-CORS==4.0.0
pip install --upgrade anthropic
pip install --upgrade plyer==2.1
pip install --upgrade requests==2.31.0

echo.
echo ================================================
echo     Dependencies Updated Successfully!
echo ================================================
echo.
echo You can now run the application with:
echo   run_task_manager.bat
echo.
pause