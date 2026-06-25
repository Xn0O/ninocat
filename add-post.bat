@echo off
setlocal
cd /d "%~dp0"

echo [add-post] Syncing private posts and rebuilding public index...
node tools\publish-private-posts.js
if errorlevel 1 (
  echo [add-post] Failed. Check private repo path, Front Matter, and local secrets file.
  exit /b 1
)

echo [add-post] Done.
exit /b 0
