#!/bin/bash
cd "$(dirname "$0")"

echo "[update-posts-index] Publishing private posts to public content..."
node tools/publish-private-posts.js
if [ $? -ne 0 ]; then
  echo "[update-posts-index] Publish failed."
  exit 1
fi

echo "[update-posts-index] Archiving private markdown sources to blogold..."
node tools/archive-private-posts.js
if [ $? -ne 0 ]; then
  echo "[update-posts-index] Archive failed."
  exit 1
fi

echo "[update-posts-index] Done."
exit 0
