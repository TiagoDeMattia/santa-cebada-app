@echo off
REM Script para iniciar el backend con logs visibles

cd /d "c:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\backend-nucleo"

echo.
echo ================================================================================
echo INICIANDO BACKEND NUCLEO
echo ================================================================================
echo.

echo Activando environment virtual (si existe)...
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
    echo Activado venv
) else (
    echo Usando Python global
)

echo.
echo Iniciando servidor...
echo.

python main.py

pause
