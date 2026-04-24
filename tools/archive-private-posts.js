#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const LOCAL_CONFIG_FILE = path.join(ROOT, "tools", "publish.config.local.json");

const DEFAULT_CONFIG = {
  privateRepo: "E:/Blog_VB/ninocat_private",
  privateSourceDir: "content/blog",
  privateArchiveDir: "content/blog/blogold",
};

function stripBom(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = stripBom(fs.readFileSync(filePath, "utf8"));
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toAbs(base, p) {
  return path.isAbsolute(p) ? p : path.join(base, p);
}

function resolveConfig() {
  const local = readJsonIfExists(LOCAL_CONFIG_FILE) || {};
  const merged = { ...DEFAULT_CONFIG, ...local };

  if (process.env.PRIVATE_BLOG_REPO && process.env.PRIVATE_BLOG_REPO.trim()) {
    merged.privateRepo = process.env.PRIVATE_BLOG_REPO.trim();
  }

  const privateRepoAbs = toAbs(ROOT, merged.privateRepo);
  const sourceDirAbs = toAbs(privateRepoAbs, merged.privateSourceDir);
  const archiveDirAbs = toAbs(privateRepoAbs, merged.privateArchiveDir);

  return {
    privateRepoAbs,
    sourceDirAbs,
    archiveDirAbs,
  };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function uniqueArchivePath(archiveDirAbs, fileName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = path.join(archiveDirAbs, fileName);
  if (!fs.existsSync(candidate)) return candidate;

  const stamp = timestamp();
  let idx = 1;
  while (true) {
    candidate = path.join(archiveDirAbs, `${base}-${stamp}-${idx}${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
    idx += 1;
  }
}

function moveFile(sourceAbs, targetAbs) {
  try {
    fs.renameSync(sourceAbs, targetAbs);
    return;
  } catch (error) {
    if (error && error.code === "EXDEV") {
      fs.copyFileSync(sourceAbs, targetAbs);
      fs.unlinkSync(sourceAbs);
      return;
    }
    throw error;
  }
}

function archivePrivateMarkdown() {
  const config = resolveConfig();
  if (!fs.existsSync(config.sourceDirAbs)) {
    process.stdout.write(`[archive-private-posts] Source not found: ${config.sourceDirAbs}\n`);
    return 0;
  }

  ensureDir(config.archiveDirAbs);

  const mdFiles = fs
    .readdirSync(config.sourceDirAbs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);

  if (!mdFiles.length) {
    process.stdout.write("[archive-private-posts] No markdown files to archive.\n");
    return 0;
  }

  mdFiles.forEach((name) => {
    const src = path.join(config.sourceDirAbs, name);
    const dst = uniqueArchivePath(config.archiveDirAbs, name);
    moveFile(src, dst);
  });

  process.stdout.write(
    `[archive-private-posts] Archived ${mdFiles.length} file(s) from ${config.sourceDirAbs} to ${config.archiveDirAbs}\n`
  );
  return mdFiles.length;
}

function main() {
  archivePrivateMarkdown();
}

main();
