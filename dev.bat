@echo off
setlocal
title Execution Frame Trainer Dev Server
cd /d "%~dp0"
set OPEN=1
node scripts/server.mjs
if errorlevel 1 pause
