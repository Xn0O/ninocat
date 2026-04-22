#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "content", "blog");
const OUTPUT_FILE = path.join(BLOG_DIR, "posts.json");

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function parseFrontMatter(markdownText) {
  const text = stripBom(markdownText).replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};

  const meta = {};
  const header = text.slice(4, end).trim();
  for (const line of header.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }
  return meta;
}

function safeDateValue(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function getMarkdownEntries() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".md"))
    .map((item) => {
      const abs = path.join(BLOG_DIR, item.name);
      const raw = fs.readFileSync(abs, "utf8");
      const stat = fs.statSync(abs);
      const meta = parseFrontMatter(raw);
      const base = path.basename(item.name, path.extname(item.name));
      const slug = String(meta.slug || base).trim() || base;
      const dateValue = safeDateValue(meta.date) ?? stat.mtimeMs;
      return {
        fileName: item.name,
        slug,
        dateValue,
      };
    })
    .sort((a, b) => b.dateValue - a.dateValue);
}

function ensureUniqueSlugs(items) {
  const seen = new Map();
  return items.map((item) => {
    const current = seen.get(item.slug) || 0;
    seen.set(item.slug, current + 1);
    if (current === 0) return item;
    return { ...item, slug: `${item.slug}-${current + 1}` };
  });
}

function buildIndex(entries) {
  return {
    posts: entries.map((entry) => ({
      slug: entry.slug,
      file: `./content/blog/${entry.fileName.replaceAll("\\", "/")}`,
    })),
  };
}

function main() {
  const entries = ensureUniqueSlugs(getMarkdownEntries());
  const index = buildIndex(entries);
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  process.stdout.write(`posts.json updated: ${index.posts.length} posts\n`);
}

main();
