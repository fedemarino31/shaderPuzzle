@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
	echo Instalando dependencias...
	call npm install || goto :error
)

echo Compilando game.html ^(rutas relativas^)...
call npx vite build --config vite.game.config.mjs || goto :error

copy /y "deploy\leame.txt" "dist\leame.txt" >nul

echo.
echo Listo. Copia el contenido de "dist" al hosting (ver dist\leame.txt).
pause
exit /b 0

:error
echo.
echo ERROR: fallo la compilacion.
pause
exit /b 1
