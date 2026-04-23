#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const LOCAL_CONFIG_FILE = path.join(ROOT, "tools", "publish.config.local.json");
const DEFAULT_CONFIG = {
  privateRepo: "",
  privateSourceDir: "content/blog",
  publicBlogDir: "content/blog",
  publicEncryptedDir: "content/blog_encrypted",
  postsIndexFile: "content/blog/posts.json",
  secretsFile: "tools/secrets/mi-passwords.local.json",
  defaultIterations: 310000,
  includePublicPosts: true,
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

function parseFrontMatter(markdownText) {
  const text = stripBom(markdownText).replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { meta: {}, body: text };

  const header = text.slice(4, end).trim();
  const body = text.slice(end + 4).replace(/^\n/, "");
  const meta = {};
  header.split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx < 0) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    meta[key] = value;
  });
  return { meta, body };
}

function toHiddenFlag(value) {
  const n = Number.parseInt(String(value || "0").trim(), 10);
  return Number.isFinite(n) && n === 1 ? 1 : 0;
}

function parseMi(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split("|");
  const question = String(parts[0] || "").trim();
  const id = String(parts[1] || "").trim();
  if (!question || !id) {
    throw new Error(`MI 字段格式错误，期望 "提问|密码编号"，实际值：${text}`);
  }
  return { question, id, raw: `${question}|${id}` };
}

function sanitizeSlugLike(input) {
  return String(input || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeDateValue(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.getTime();
}

function quoteYaml(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "";
  if (/^[\w./:-]+$/.test(text)) return text;
  const escaped = text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return `"${escaped}"`;
}

function ensureUniqueSlugs(items) {
  const seen = new Map();
  return items.map((item) => {
    const count = seen.get(item.slug) || 0;
    seen.set(item.slug, count + 1);
    if (count === 0) return item;
    return { ...item, slug: `${item.slug}-${count + 1}` };
  });
}

function resolveConfig() {
  const local = readJsonIfExists(LOCAL_CONFIG_FILE) || {};
  const merged = { ...DEFAULT_CONFIG, ...local };

  if (process.env.PRIVATE_BLOG_REPO && process.env.PRIVATE_BLOG_REPO.trim()) {
    merged.privateRepo = process.env.PRIVATE_BLOG_REPO.trim();
  }
  if (!merged.privateRepo) {
    // 用户当前给定的私密仓库路径作为默认本地值，可被本地配置或环境变量覆盖。
    merged.privateRepo = "E:/Blog_VB/ninocat_private";
  }

  const asAbs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
  return {
    ...merged,
    privateRepo: asAbs(merged.privateRepo),
    privateSourceDirAbs: path.join(asAbs(merged.privateRepo), merged.privateSourceDir),
    publicBlogDirAbs: asAbs(merged.publicBlogDir),
    publicEncryptedDirAbs: asAbs(merged.publicEncryptedDir),
    postsIndexFileAbs: asAbs(merged.postsIndexFile),
    secretsFileAbs: asAbs(merged.secretsFile),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function collectPrivateMarkdown(config) {
  if (!fs.existsSync(config.privateSourceDirAbs)) {
    return [];
  }

  const entries = fs
    .readdirSync(config.privateSourceDirAbs, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".md"))
    .map((item) => {
      const abs = path.join(config.privateSourceDirAbs, item.name);
      const raw = fs.readFileSync(abs, "utf8");
      const stat = fs.statSync(abs);
      const { meta, body } = parseFrontMatter(raw);
      const fileBase = path.basename(item.name, path.extname(item.name));
      const hidden = toHiddenFlag(meta.hidden);
      const mi = parseMi(meta.MI || meta.mi || "");
      const slug = sanitizeSlugLike(meta.slug || fileBase) || fileBase;
      return {
        sourceName: item.name,
        sourceAbsPath: abs,
        sourceRaw: stripBom(raw).replace(/\r\n/g, "\n"),
        sourceBody: body,
        meta,
        hidden,
        mi,
        slug,
        dateValue: safeDateValue(meta.date, stat.mtimeMs),
      };
    })
    .filter((item) => item.hidden !== 1)
    .sort((a, b) => b.dateValue - a.dateValue);

  return ensureUniqueSlugs(entries);
}

function loadSecrets(config) {
  const data = readJsonIfExists(config.secretsFileAbs);
  if (!data || typeof data !== "object") return {};
  return data;
}

function resolvePasswordSecret(secrets, miId, defaultIterations) {
  const record = secrets[miId];
  if (typeof record === "string") {
    return { password: record, iterations: defaultIterations };
  }
  if (record && typeof record === "object" && typeof record.password === "string") {
    const iterations = Number.parseInt(String(record.iterations || ""), 10);
    return {
      password: record.password,
      iterations: Number.isFinite(iterations) && iterations > 10000 ? iterations : defaultIterations,
    };
  }
  return null;
}

function encryptMarkdownBody(bodyText, password, iterations) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(Buffer.from(password, "utf8"), salt, iterations, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(bodyText, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    cipher: "AES-256-GCM",
    kdf: {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      saltB64: salt.toString("base64"),
    },
    ivB64: iv.toString("base64"),
    ciphertextB64: ciphertext.toString("base64"),
    tagB64: tag.toString("base64"),
  };
}

function buildEncryptedStubMarkdown(post, encRef) {
  const meta = post.meta || {};
  const lines = ["---"];
  lines.push(`title: ${quoteYaml(meta.title || post.slug)}`);
  lines.push(`date: ${quoteYaml(meta.date || "")}`);
  lines.push(`summary: ${quoteYaml(meta.summary || "这是一篇加密文章，请在详情页输入密码后查看。")}`);
  lines.push(`tags: ${quoteYaml(meta.tags || "")}`);
  lines.push(`cover: ${quoteYaml(meta.cover || "")}`);
  lines.push(`slug: ${quoteYaml(post.slug)}`);
  lines.push("hidden: 0");
  lines.push(`MI: ${quoteYaml(post.mi.raw)}`);
  lines.push(`encRef: ${quoteYaml(encRef)}`);
  lines.push("---");
  lines.push("");
  lines.push("这是一篇加密文章，请在文章详情页输入密码后查看正文。");
  lines.push("");
  return lines.join("\n");
}

function buildPostsIndex(posts) {
  return {
    posts: posts.map((item) => {
      const base = {
        slug: item.slug,
        file: `./content/blog/${item.slug}.md`,
      };
      if (item.encrypted) {
        base.encrypted = true;
        base.miQuestion = item.miQuestion;
        base.miId = item.miId;
        base.encRef = `./content/blog_encrypted/${item.slug}.enc.json`;
      }
      return base;
    }),
  };
}

function collectPublicVisiblePosts(config) {
  if (!fs.existsSync(config.publicBlogDirAbs)) return [];

  const entries = fs
    .readdirSync(config.publicBlogDirAbs, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".md"))
    .map((item) => {
      const abs = path.join(config.publicBlogDirAbs, item.name);
      const raw = fs.readFileSync(abs, "utf8");
      const stat = fs.statSync(abs);
      const { meta } = parseFrontMatter(raw);
      const hidden = toHiddenFlag(meta.hidden);
      if (hidden === 1) return null;

      const base = path.basename(item.name, ".md");
      const slug = sanitizeSlugLike(meta.slug || base) || base;
      const mi = parseMi(meta.MI || meta.mi || "");
      const encRef = String(meta.encRef || "").trim();
      const encrypted = Boolean(mi && encRef);
      return {
        slug,
        encrypted,
        miQuestion: mi?.question || "",
        miId: mi?.id || "",
        dateValue: safeDateValue(meta.date, stat.mtimeMs),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.dateValue - a.dateValue);

  return ensureUniqueSlugs(entries);
}

function legacyBuildIndexFromPublic(config) {
  if (!fs.existsSync(config.publicBlogDirAbs)) {
    ensureDir(path.dirname(config.postsIndexFileAbs));
    fs.writeFileSync(config.postsIndexFileAbs, `${JSON.stringify({ posts: [] }, null, 2)}\n`, "utf8");
    return 0;
  }

  const entries = fs
    .readdirSync(config.publicBlogDirAbs, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".md"))
    .map((item) => {
      const abs = path.join(config.publicBlogDirAbs, item.name);
      const raw = fs.readFileSync(abs, "utf8");
      const stat = fs.statSync(abs);
      const { meta } = parseFrontMatter(raw);
      const hidden = toHiddenFlag(meta.hidden);
      const slug = sanitizeSlugLike(meta.slug || path.basename(item.name, ".md")) || path.basename(item.name, ".md");
      return {
        slug,
        hidden,
        dateValue: safeDateValue(meta.date, stat.mtimeMs),
      };
    })
    .filter((item) => item.hidden !== 1)
    .sort((a, b) => b.dateValue - a.dateValue);

  const deduped = ensureUniqueSlugs(entries);
  const indexPayload = buildPostsIndex(
    deduped.map((x) => ({ slug: x.slug, encrypted: false, miQuestion: "", miId: "" }))
  );
  ensureDir(path.dirname(config.postsIndexFileAbs));
  fs.writeFileSync(config.postsIndexFileAbs, `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8");
  return indexPayload.posts.length;
}

function publishFromPrivate(config) {
  const posts = collectPrivateMarkdown(config);
  const secrets = loadSecrets(config);
  ensureDir(config.publicBlogDirAbs);
  ensureDir(config.publicEncryptedDirAbs);

  const writtenPosts = [];
  for (const post of posts) {
    const publicMdFile = path.join(config.publicBlogDirAbs, `${post.slug}.md`);

    if (post.mi) {
      const secret = resolvePasswordSecret(secrets, post.mi.id, config.defaultIterations);
      if (!secret || !secret.password) {
        throw new Error(
          `文章 ${post.sourceName} 使用了 MI 编号 ${post.mi.id}，但在 ${config.secretsFileAbs} 中找不到密码映射。`
        );
      }

      const payload = encryptMarkdownBody(post.sourceBody, secret.password, secret.iterations);
      const encFile = path.join(config.publicEncryptedDirAbs, `${post.slug}.enc.json`);
      fs.writeFileSync(encFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

      const encRef = `./content/blog_encrypted/${post.slug}.enc.json`;
      fs.writeFileSync(publicMdFile, `${buildEncryptedStubMarkdown(post, encRef)}\n`, "utf8");
      writtenPosts.push({
        slug: post.slug,
        encrypted: true,
        miQuestion: post.mi.question,
        miId: post.mi.id,
      });
      continue;
    }

    fs.writeFileSync(publicMdFile, `${post.sourceRaw}\n`, "utf8");
    writtenPosts.push({
      slug: post.slug,
      encrypted: false,
      miQuestion: "",
      miId: "",
    });
  }

  if (config.includePublicPosts) {
    const existing = new Set(writtenPosts.map((x) => x.slug));
    const publicEntries = collectPublicVisiblePosts(config);
    publicEntries.forEach((entry) => {
      if (existing.has(entry.slug)) return;
      writtenPosts.push({
        slug: entry.slug,
        encrypted: entry.encrypted,
        miQuestion: entry.miQuestion,
        miId: entry.miId,
      });
    });
  }

  const indexPayload = buildPostsIndex(writtenPosts);
  ensureDir(path.dirname(config.postsIndexFileAbs));
  fs.writeFileSync(config.postsIndexFileAbs, `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8");
  return {
    total: writtenPosts.length,
    encrypted: writtenPosts.filter((x) => x.encrypted).length,
  };
}

function main() {
  const config = resolveConfig();
  const hasPrivateSource = fs.existsSync(config.privateSourceDirAbs);

  if (!hasPrivateSource) {
    const count = legacyBuildIndexFromPublic(config);
    process.stdout.write(
      `[publish-private-posts] 未检测到私密源目录：${config.privateSourceDirAbs}\n` +
        `[publish-private-posts] 已回退为公开目录索引模式，posts.json: ${count} 篇\n`
    );
    return;
  }

  const result = publishFromPrivate(config);
  process.stdout.write(
    `[publish-private-posts] 完成：共 ${result.total} 篇，其中加密 ${result.encrypted} 篇\n` +
      `[publish-private-posts] 私密源：${config.privateSourceDirAbs}\n` +
      `[publish-private-posts] 公开目录：${config.publicBlogDirAbs}\n`
  );
}

main();
