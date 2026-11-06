@echo off
rem Comandos de administracao no servidor (pacote com o Node.js embutido).
rem   sisferias.cmd admin --senha NovaSenha@2026
rem   sisferias.cmd backup ^| restaurar ARQUIVO ^| banco status ^| https status ^| servico status
setlocal
cd /d "%~dp0"
if exist "%~dp0runtime\node.exe" set "PATH=%~dp0runtime;%PATH%"
set "CMD=%~1"
if "%CMD%"=="" goto uso
shift
if /i "%CMD%"=="https" (node scripts\https.js %1 %2 %3 %4 %5 %6 %7 %8 %9 & exit /b %errorlevel%)
if /i "%CMD%"=="servico" (node scripts\servico.js %1 %2 %3 %4 %5 %6 %7 %8 %9 & exit /b %errorlevel%)
for %%c in (admin backup restaurar banco dados-ficticios) do if /i "%CMD%"=="%%c" (node server\start.js %CMD% %1 %2 %3 %4 %5 %6 %7 %8 %9 & exit /b %errorlevel%)
:uso
echo Uso: sisferias.cmd admin^|backup^|restaurar^|banco^|https^|servico^|dados-ficticios [opcoes]
exit /b 1
