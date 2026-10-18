@echo off
chcp 65001 >nul
title parseplaylist-catalog-server
cd /d "%~dp0"

echo ============================================
echo   parseplaylist-catalog-server
echo ============================================
echo.

REM --- Проверка Node.js ---
where node >nul 2>nul
if errorlevel 1 (
    echo [ОШИБКА] Node.js не найден в PATH.
    echo Установи Node.js ^>=18: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%
echo.

REM --- Установка зависимостей при первом запуске ---
if not exist "node_modules" (
    echo [INFO] node_modules не найден. Устанавливаю зависимости...
    call npm install
    if errorlevel 1 (
        echo [ОШИБКА] npm install завершился с ошибкой.
        pause
        exit /b 1
    )
    echo.
)

REM --- Запуск ---
echo [INFO] Запуск сервера...
echo.
call npm start

echo.
echo [INFO] Сервер остановлен.
pause