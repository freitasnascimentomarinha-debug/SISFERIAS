@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title SISFERIAS

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe e instale a versao LTS em https://nodejs.org e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo.
  echo  Versao do Node.js muito antiga. Instale a versao LTS mais recente em https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Instalando dependencias - somente na primeira vez...
  call npm install
  if errorlevel 1 goto erro
)

if not exist "dist\index.html" (
  echo Compilando a interface - somente na primeira vez...
  call npm run build
  if errorlevel 1 goto erro
)

call npm start
goto fim

:erro
echo.
echo  Ocorreu um erro. Verifique a mensagem acima.
:fim
pause
