const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  applySiteText,
  markActiveNav,
  createEmptyTip,
  markdownToHtml,
  enhanceCodeBlocks,
  renderMath,
  parseFrontMatter,
  tagsFromText,
  isHiddenMeta,
  parseMiMeta,
  resolveAssetUrl,
  setupImageLightbox,
} = window.SiteCommon;

const POSTS_INDEX = "./content/blog/posts.json";
const titleNode = document.getElementById("post-title");
const metaNode = document.getElementById("post-meta");
const contentNode = document.getElementById("post-content");
const heroNode = document.querySelector("[data-hero-image]");

function withCacheBust(url) {
  const u = new URL(String(url || ""), window.location.href);
  u.searchParams.set("_v", String(Date.now()));
  return u.toString();
}

function getSlug() {
  const query = new URLSearchParams(location.search);
  return query.get("slug") || "";
}

async function findPostEntry(slug) {
  const res = await fetch(withCacheBust(POSTS_INDEX), { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 posts.json");
  const index = await res.json();
  return (index.posts || []).find((item) => item.slug === slug) || null;
}

async function loadMarkdown(file) {
  const res = await fetch(withCacheBust(file), { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载文章 Markdown");
  return res.text();
}

async function loadEncryptedPayload(encRef) {
  const res = await fetch(withCacheBust(encRef), { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载加密正文文件");
  return res.json();
}

function base64ToBytes(base64) {
  const text = String(base64 || "").trim();
  const binary = window.atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(password, kdf) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const iterations = Number.parseInt(String(kdf?.iterations || "0"), 10);
  if (!Number.isFinite(iterations) || iterations < 10000) {
    throw new Error("KDF 迭代参数非法");
  }

  const salt = base64ToBytes(kdf?.saltB64);
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations,
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["decrypt"]
  );
}

async function decryptMarkdownBody(payload, password) {
  if (!payload || typeof payload !== "object") {
    throw new Error("加密正文数据为空");
  }
  const key = await deriveAesKey(password, payload.kdf);
  const iv = base64ToBytes(payload.ivB64);
  const ciphertext = base64ToBytes(payload.ciphertextB64);
  const tag = base64ToBytes(payload.tagB64);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const plainBuf = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    combined
  );

  return new TextDecoder().decode(plainBuf);
}

function showUnlockDialog(question, errorText = "") {
  return new Promise((resolve) => {
    const mask = document.createElement("div");
    mask.className = "mi-unlock-mask";

    const panel = document.createElement("div");
    panel.className = "mi-unlock-panel";

    const title = document.createElement("h2");
    title.textContent = "加密文章";

    const q = document.createElement("p");
    q.className = "mi-unlock-question";
    q.textContent = question || "请输入密码查看文章内容";

    const form = document.createElement("form");
    form.className = "mi-unlock-form";

    const input = document.createElement("input");
    input.type = "password";
    input.className = "mi-unlock-input";
    input.placeholder = "请输入密码";
    input.autocomplete = "current-password";
    input.required = true;

    const error = document.createElement("p");
    error.className = "mi-unlock-error";
    error.textContent = errorText;
    error.hidden = !errorText;

    const actions = document.createElement("div");
    actions.className = "mi-unlock-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn ghost";
    cancelBtn.textContent = "取消";

    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "btn";
    submitBtn.textContent = "解锁";

    actions.append(cancelBtn, submitBtn);
    form.append(input, error, actions);
    panel.append(title, q, form);
    mask.appendChild(panel);
    document.body.appendChild(mask);

    const close = (value) => {
      mask.remove();
      resolve(value);
    };

    cancelBtn.addEventListener("click", () => close(null));
    mask.addEventListener("click", (event) => {
      if (event.target === mask) close(null);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      close(input.value);
    });

    window.setTimeout(() => input.focus(), 0);
  });
}

function appendMeta(meta, mi) {
  metaNode.replaceChildren();

  const appendText = (text) => {
    const node = document.createElement("span");
    node.textContent = text;
    metaNode.appendChild(node);
  };

  if (meta.date) {
    appendText(meta.date);
  } else {
    appendText("未填写日期");
  }

  const tags = tagsFromText(meta.tags);
  if (tags.length) {
    appendText(" · ");
    tags.forEach((tag, index) => {
      const link = document.createElement("a");
      link.href = `./blog.html?tag=${encodeURIComponent(tag)}`;
      link.className = "post-tag-link";
      link.textContent = tag;
      metaNode.appendChild(link);
      if (index < tags.length - 1) appendText(" / ");
    });
  }

  if (mi) {
    appendText(" · 加密");
  }
}

async function renderEncryptedBody(mi, encRef) {
  let decryptError = "";
  const payload = await loadEncryptedPayload(encRef);

  while (true) {
    const password = await showUnlockDialog(mi?.question || "请输入密码", decryptError);
    if (password == null) {
      contentNode.replaceChildren();
      contentNode.appendChild(createEmptyTip("已取消解密。"));
      return;
    }

    try {
      const markdown = await decryptMarkdownBody(payload, password);
      contentNode.innerHTML = markdownToHtml(markdown);
      enhanceCodeBlocks(contentNode);
      renderMath(contentNode);
      setupImageLightbox(document.querySelector("main") || document);
      return;
    } catch (_error) {
      decryptError = "密码错误，或加密数据已损坏，请重试。";
    }
  }
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  applySiteText(config);
  markActiveNav();

  const slug = getSlug();
  if (!slug) {
    titleNode.textContent = "缺少文章参数";
    contentNode.appendChild(createEmptyTip("请使用示例地址：blog-post.html?slug=示例文章标识"));
    return;
  }

  try {
    const entry = await findPostEntry(slug);
    if (!entry || !entry.file) {
      titleNode.textContent = "文章不存在";
      contentNode.appendChild(createEmptyTip(`未找到 slug=${slug} 的文章配置。`));
      return;
    }

    const raw = await loadMarkdown(entry.file);
    const { meta, body } = parseFrontMatter(raw);

    if (isHiddenMeta(meta.hidden ?? entry.hidden)) {
      titleNode.textContent = "文章不存在";
      contentNode.replaceChildren();
      contentNode.appendChild(createEmptyTip("这篇文章不存在，或已被移除。"));
      return;
    }

    titleNode.textContent = meta.title || slug;

    const mi =
      parseMiMeta(meta.MI || meta.mi || "") ||
      (entry.miQuestion && entry.miId ? { question: entry.miQuestion, id: entry.miId } : null);
    const encRef = String(meta.encRef || entry.encRef || "").trim();
    const encrypted = Boolean((entry.encrypted || mi) && encRef);

    appendMeta(meta, encrypted ? mi : null);

    if (heroNode && meta.cover) {
      heroNode.src = resolveAssetUrl(meta.cover);
      heroNode.alt = `${meta.title || slug} 文章头图`;
      heroNode.draggable = false;
      heroNode.setAttribute("draggable", "false");
      if (!heroNode.dataset.dragLocked) {
        heroNode.addEventListener("dragstart", (event) => event.preventDefault());
        heroNode.dataset.dragLocked = "1";
      }
    }

    setupImageLightbox(document.querySelector("main") || document);

    if (encrypted) {
      await renderEncryptedBody(mi, encRef);
    } else {
      contentNode.innerHTML = markdownToHtml(body);
      enhanceCodeBlocks(contentNode);
      renderMath(contentNode);
    }

    document.title = `${meta.title || slug} - 博客`;
  } catch (error) {
    console.error(error);
    titleNode.textContent = "文章加载失败";
    contentNode.replaceChildren();
    contentNode.appendChild(createEmptyTip("请检查 posts.json、Markdown 或加密文件路径。"));
  }
}

init();



