@echo off
title Santa Cebada - Iniciando...
color 0A

echo.
echo  ============================================================
echo   SANTA CEBADA - Sistema de Gestion
echo  ============================================================
echo.
echo  Iniciando backend y frontend en ventanas separadas...
echo.

REM Iniciar backend en nueva ventana
start "BACKEND - Santa Cebada" cmd /k "cd /d ""%~dp0backend-nucleo"" && if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) && echo. && echo  [BACKEND] Servidor iniciado en http://localhost:8000 && echo. && python main.py"

REM Esperar 3 segundos para que el backend arranque primero
timeout /t 3 /nobreak >nul

REM Iniciar frontend en nueva ventana
start "FRONTEND - Santa Cebada" cmd /k "cd /d ""%~dp0frontend"" && echo. && echo  [FRONTEND] Iniciando en http://localhost:5173 && echo. && npm run dev"

REM Esperar a que el frontend levante
timeout /t 5 /nobreak >nul

REM Abrir el navegador
echo  Abriendo navegador...
start http://localhost:5173

echo.
echo  ============================================================
echo   Listo. Podes cerrar esta ventana.
echo   Para detener: cerra las ventanas de BACKEND y FRONTEND.
echo  ============================================================
echo.
pause
