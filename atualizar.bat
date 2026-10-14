@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo Atualizando dependencias e recompilando a interface...
echo (Os dados ficam na pasta "data" e NAO sao alterados.)
call npm install
if errorlevel 1 goto erro
call npm run build
if errorlevel 1 goto erro
echo.
echo Atualizacao concluida. Execute iniciar.bat.
pause
exit /b 0
:erro
echo.
echo  Ocorreu um erro. Verifique a mensagem acima.
pause
exit /b 1
