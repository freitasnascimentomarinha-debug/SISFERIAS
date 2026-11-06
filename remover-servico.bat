@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

rem Pacote com o Node.js embutido (pasta runtime): nao precisa instalar nada.
if exist "%~dp0runtime\node.exe" set "PATH=%~dp0runtime;%PATH%"
title SISFERIAS - servico

rem Pede permissao de administrador, se ainda nao tiver.
net session >nul 2>&1
if errorlevel 1 (
  echo Solicitando permissao de administrador...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado. Instale a versao LTS em https://nodejs.org
  echo.
  pause
  exit /b 1
)

node scripts\servico.js remover
echo.
pause
