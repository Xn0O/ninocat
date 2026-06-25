@echo off
setlocal
cd /d "%~dp0"

echo [update-posts-index] Publishing private posts to public content...
node tools\publish-private-posts.js
if errorlevel 1 (
  echo [update-posts-index] Publish failed.
  exit /b 1
)

echo [update-posts-index] Archiving private markdown sources to blogold...
node tools\archive-private-posts.js
if errorlevel 1 (
  echo [update-posts-index] Archive failed.
  exit /b 1
)

echo [update-posts-index] Done.
exit /b 0
