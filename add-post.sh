#!/bin/bash
cd "$(dirname "$0")"

echo "[add-post] Syncing private posts and rebuilding public index..."
node tools/publish-private-posts.js
if [ $? -ne 0 ]; then
  echo "[add-post] Failed. Check private repo path, Front Matter, and local secrets file."
  exit 1
fi

echo "[add-post] Archiving synced private posts to old..."
node tools/archive-private-posts.js

echo "[add-post] Done."
exit 0
