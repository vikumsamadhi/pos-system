@echo off
title POS Counter
cd /d "F:\pos-system"
set ELECTRON_RUN_AS_NODE=
start "" "node_modules\electron\dist\electron.exe" "F:\pos-system"
