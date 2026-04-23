(function () {
  const editor = document.getElementById("md-editor");
  const dropZone = document.getElementById("drop-zone");
  const preview = document.getElementById("md-preview");
  const autoPreviewInput = document.getElementById("auto-preview");
  const refreshPreviewBtn = document.getElementById("refresh-preview");
  const previewPrefixInput = document.getElementById("preview-prefix");

  const imgPrefixInput = document.getElementById("img-prefix");
  const nameRuleInput = document.getElementById("name-rule");
  const autoCoverInput = document.getElementById("auto-cover");
  const pickImageFolderBtn = document.getElementById("pick-image-folder");
  const createImageSubdirBtn = document.getElementById("create-image-subdir");
  const createImageSubdirLabel = document.getElementById("create-image-subdir-label");
  const createImageSubdirHint = document.getElementById("create-image-subdir-hint");
  const imageFolderState = document.getElementById("image-folder-state");

  const fmTitleInput = document.getElementById("fm-title");
  const fmDateInput = document.getElementById("fm-date");
  const fmSummaryInput = document.getElementById("fm-summary");
  const fmTagsInput = document.getElementById("fm-tags");
  const fmCoverInput = document.getElementById("fm-cover");
  const fmHiddenInput = document.getElementById("fm-hidden");
  const fmMiIdInput = document.getElementById("fm-mi-id");
  const fmMiQuestionInput = document.getElementById("fm-mi-question");
  const fmApplyBtn = document.getElementById("fm-apply");
  const fmReadBtn = document.getElementById("fm-read");
  const fmNewBtn = document.getElementById("fm-new");

  const postFileNameInput = document.getElementById("post-file-name");
  const pickPostFolderBtn = document.getElementById("pick-post-folder");
  const postFolderState = document.getElementById("post-folder-state");
  const postFolderStateReadonly = document.getElementById("post-folder-state-readonly");
  const importMdBtn = document.getElementById("import-md");
  const importMdInput = document.getElementById("import-md-file");
  const exportMdBtn = document.getElementById("export-md");

  const copyBtn = document.getElementById("copy-md");
  const downloadBtn = document.getElementById("download-md");
  const clearLogBtn = document.getElementById("clear-log");
  const logList = document.getElementById("log-list");

  const imageMimeExt = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
  };

  let imageDirHandle = null;
  let imageRootDirHandle = null;
  let postDirHandle = null;
  let sequence = 1;
  let previewTimer = 0;

  const handleStore = {
    dbName: "blog-editor-handles",
    storeName: "handles",
    imageRootKey: "image-root",
    postDirKey: "post-dir",
  };

  const shared = window.SiteCommon || {};
  const sharedMarkdownToHtml =
    typeof shared.markdownToHtml === "function" ? shared.markdownToHtml : (text) => String(text || "");
  const sharedEnhanceCodeBlocks =
    typeof shared.enhanceCodeBlocks === "function" ? shared.enhanceCodeBlocks : () => {};
  const sharedRenderMath = typeof shared.renderMath === "function" ? shared.renderMath : () => {};

  function todayYmd() {
    const now = new Date();
    const pad = (v) => String(v).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function currentStamp() {
    const now = new Date();
    const pad = (v) => String(v).padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
      now.getMinutes()
    )}${pad(now.getSeconds())}`;
  }

  function supportsDirPicker() {
    return typeof window.showDirectoryPicker === "function";
  }

  function supportsFilePicker() {
    return typeof window.showOpenFilePicker === "function";
  }

  function appendLog(message) {
    const li = document.createElement("li");
    li.textContent = message;
    logList.appendChild(li);
    li.scrollIntoView({ block: "nearest" });
  }

  function supportsHandlePersistence() {
    return typeof indexedDB !== "undefined";
  }

  function openHandleStore() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(handleStore.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(handleStore.storeName)) {
          db.createObjectStore(handleStore.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveRememberedHandle(key, handle) {
    if (!supportsHandlePersistence() || !handle) return;
    try {
      const db = await openHandleStore();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(handleStore.storeName, "readwrite");
        tx.objectStore(handleStore.storeName).put(handle, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (error) {
      appendLog(`保存目录记忆失败：${error.message || error}`);
    }
  }

  async function loadRememberedHandle(key) {
    if (!supportsHandlePersistence()) return null;
    try {
      const db = await openHandleStore();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(handleStore.storeName, "readonly");
        const req = tx.objectStore(handleStore.storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle;
    } catch (_error) {
      return null;
    }
  }

  function sanitizeSlugLike(input) {
    return String(input || "")
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getExtFromFile(file) {
    const nameExt = String(file.name || "").match(/\.[a-zA-Z0-9]+$/);
    if (nameExt) return nameExt[0].toLowerCase();
    return imageMimeExt[file.type] || ".png";
  }

  function normalizePrefix(raw) {
    let prefix = String(raw || "").trim().replaceAll("\\", "/");
    if (!prefix) return "./assets/Blog";

    if (/^\/?assets\//i.test(prefix)) {
      prefix = `./${prefix.replace(/^\/+/, "")}`;
    }
    if (
      !/^(https?:|data:|blob:|mailto:|tel:|#|\/|\.\/|\.\.\/|[a-zA-Z]:\/)/.test(prefix)
    ) {
      prefix = `./${prefix.replace(/^\.?\//, "")}`;
    }

    return prefix.replace(/\/+$/, "");
  }

  function normalizeHiddenValue(raw) {
    const n = Number.parseInt(String(raw || "0").trim(), 10);
    return Number.isFinite(n) && n === 1 ? "1" : "0";
  }

  function buildMiField(question, id) {
    const q = String(question || "").trim();
    const miId = String(id || "").trim();
    if (!q && !miId) return "";
    if (!q || !miId) return "";
    return `${q}|${miId}`;
  }

  function parseMiField(raw) {
    const text = String(raw || "").trim();
    if (!text) return { question: "", id: "", raw: "" };
    const parts = text.split("|");
    return {
      question: String(parts[0] || "").trim(),
      id: String(parts[1] || "").trim(),
      raw: text,
    };
  }

  function validateMiInputs() {
    const q = String(fmMiQuestionInput?.value || "").trim();
    const id = String(fmMiIdInput?.value || "").trim();
    if (!q && !id) return true;
    if (!q || !id) {
      appendLog("MI 提问和 MI 编号需要同时填写，或同时留空。");
      return false;
    }
    return true;
  }

  function syncPrefixWithImageFolderName(folderName) {
    const name = String(folderName || "").trim();
    if (!name) return;

    const current = normalizePrefix(imgPrefixInput.value);
    const lowerCurrent = current.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerCurrent.endsWith(`/${lowerName}`) || lowerCurrent === lowerName) return;

    if (lowerCurrent.endsWith("/blog") && lowerName !== "blog") {
      imgPrefixInput.value = `${current}/${name}`;
      appendLog(`已自动同步图片前缀：${imgPrefixInput.value}`);
    }
  }

  function syncPrefixWithPostFileName() {
    const postBase = sanitizeSlugLike(postFileNameInput.value);
    if (!postBase) return;

    const current = normalizePrefix(imgPrefixInput.value);
    const lowerCurrent = current.toLowerCase();
    if (lowerCurrent === "./assets/blog" || lowerCurrent === "assets/blog") {
      imgPrefixInput.value = `${current}/${postBase}`;
      appendLog(`已按文章名同步图片前缀：${imgPrefixInput.value}`);
    }
  }

  function splitNameAndExt(name) {
    const match = String(name || "").match(/^(.*?)(\.[a-zA-Z0-9]+)?$/);
    return {
      stem: match ? match[1] : String(name || ""),
      ext: match && match[2] ? match[2].toLowerCase() : "",
    };
  }

  function fallbackImageName(file) {
    const prefix = sanitizeSlugLike(nameRuleInput.value) || "post";
    const ext = getExtFromFile(file);
    const fileName = `${prefix}-${currentStamp()}-${String(sequence).padStart(3, "0")}${ext}`;
    sequence += 1;
    return fileName;
  }

  function resolveTargetImageName(file) {
    const rawName = String(file.name || "").trim();
    if (!rawName) return fallbackImageName(file);

    const parsed = splitNameAndExt(rawName);
    const stem = sanitizeSlugLike(parsed.stem) || "image";
    const ext = parsed.ext || getExtFromFile(file);
    return `${stem}${ext}`;
  }

  async function ensureUniqueName(dirHandle, desired) {
    const dot = desired.lastIndexOf(".");
    const stem = dot > 0 ? desired.slice(0, dot) : desired;
    const ext = dot > 0 ? desired.slice(dot) : "";
    let idx = 1;
    let candidate = desired;

    while (true) {
      try {
        await dirHandle.getFileHandle(candidate, { create: false });
        candidate = `${stem}-${idx}${ext}`;
        idx += 1;
      } catch (error) {
        if (error && error.name === "NotFoundError") return candidate;
        throw error;
      }
    }
  }

  function markdownImageLine(url, alt) {
    return `![${alt}](${url})`;
  }

  function insertAtCursor(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    editor.value = `${before}${text}${after}`;
    const nextPos = start + text.length;
    editor.selectionStart = nextPos;
    editor.selectionEnd = nextPos;
    editor.focus();
    schedulePreview();
  }

  async function requestDirWritePermission(handle) {
    if (!handle || !handle.requestPermission) return true;
    const opts = { mode: "readwrite" };
    const q = await handle.queryPermission(opts);
    if (q === "granted") return true;
    const r = await handle.requestPermission(opts);
    return r === "granted";
  }

  async function setImageFolderHandle(handle, options = {}) {
    if (!handle) return;
    imageDirHandle = handle;
    if (options.asRoot !== false) {
      imageRootDirHandle = handle;
    }
    imageFolderState.textContent = `已选择图片目录：${handle.name}`;
    syncPrefixWithImageFolderName(handle.name);
    if (options.remember !== false) {
      await saveRememberedHandle(handleStore.imageRootKey, options.rootHandle || imageRootDirHandle || handle);
    }
  }

  async function setPostFolderHandle(handle, options = {}) {
    if (!handle) return;
    postDirHandle = handle;
    postFolderState.textContent = `已选择文章目录：${handle.name}`;
    if (postFolderStateReadonly) {
      postFolderStateReadonly.value = handle.name;
    }
    if (options.remember !== false) {
      await saveRememberedHandle(handleStore.postDirKey, handle);
    }
  }

  async function tryRestoreRememberedFolders() {
    const rememberedImageRoot = await loadRememberedHandle(handleStore.imageRootKey);
    if (rememberedImageRoot) {
      try {
        const allowed = await requestDirWritePermission(rememberedImageRoot);
        if (allowed) {
          imageRootDirHandle = rememberedImageRoot;
          imageDirHandle = rememberedImageRoot;
          imageFolderState.textContent = `已恢复图片目录：${rememberedImageRoot.name}`;
        }
      } catch (_error) {
      }
    }

    const rememberedPost = await loadRememberedHandle(handleStore.postDirKey);
    if (rememberedPost) {
      try {
        const allowed = await requestDirWritePermission(rememberedPost);
        if (allowed) {
          postDirHandle = rememberedPost;
          postFolderState.textContent = `已恢复文章目录：${rememberedPost.name}`;
          if (postFolderStateReadonly) {
            postFolderStateReadonly.value = rememberedPost.name;
          }
        }
      } catch (_error) {
      }
    }
  }

  function quoteYamlValue(value) {
    const text = String(value || "");
    if (!text.trim()) return "";
    if (/^[\w./-]+$/.test(text)) return text;
    const escaped = text.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
    return `"${escaped}"`;
  }

  function collectFrontMatterForm() {
    const hidden = normalizeHiddenValue(fmHiddenInput?.value || "0");
    const mi = buildMiField(fmMiQuestionInput?.value, fmMiIdInput?.value);

    return {
      title: fmTitleInput.value.trim(),
      date: fmDateInput.value.trim(),
      summary: fmSummaryInput.value.trim(),
      tags: fmTagsInput.value.trim(),
      cover: fmCoverInput.value.trim(),
      hidden,
      mi,
    };
  }

  function buildFrontMatterText(values) {
    const lines = ["---"];
    lines.push(`title: ${quoteYamlValue(values.title || "第一篇文章")}`);
    lines.push(`date: ${quoteYamlValue(values.date || todayYmd())}`);
    lines.push(`summary: ${quoteYamlValue(values.summary || "旧的文章等以后有空了再迁移进来！")}`);
    lines.push(`tags: ${quoteYamlValue(values.tags || "Blog")}`);
    lines.push(`cover: ${quoteYamlValue(normalizePrefix(values.cover || "./assets/Blog/P0/P0.jpg"))}`);
    lines.push(`hidden: ${quoteYamlValue(normalizeHiddenValue(values.hidden || "0"))}`);
    if (values.mi) {
      lines.push(`MI: ${quoteYamlValue(values.mi)}`);
    }
    lines.push("---");
    return `${lines.join("\n")}\n`;
  }

  function parseFrontMatterFromText(text) {
    const normalized = String(text || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n");
    if (!normalized.startsWith("---\n")) return null;
    const end = normalized.indexOf("\n---", 4);
    if (end < 0) return null;

    const headerRaw = normalized.slice(4, end).trim();
    const body = normalized.slice(end + 4).replace(/^\n/, "");
    const meta = {};
    headerRaw.split("\n").forEach((line) => {
      const idx = line.indexOf(":");
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
      meta[key] = value;
    });
    return { meta, body };
  }

  function ensureFrontMatterContent() {
    const parsed = parseFrontMatterFromText(editor.value);
    if (parsed) return editor.value;
    const merged = `${buildFrontMatterText(collectFrontMatterForm())}\n${editor.value.trimStart()}`;
    editor.value = merged;
    schedulePreview();
    appendLog("检测到缺少 Front Matter，已在导出前自动补齐。");
    return merged;
  }

  function applyFrontMatterToEditor() {
    if (!validateMiInputs()) return;
    const values = collectFrontMatterForm();
    const header = buildFrontMatterText(values);
    const parsed = parseFrontMatterFromText(editor.value);
    const body = parsed ? parsed.body : editor.value.replace(/^\uFEFF/, "");
    editor.value = `${header}\n${body.trimStart()}`;
    editor.selectionStart = editor.selectionEnd = editor.value.length;
    editor.focus();
    appendLog("已写入 Front Matter。");
    schedulePreview();
  }

  function readFrontMatterToForm() {
    const parsed = parseFrontMatterFromText(editor.value);
    if (!parsed) {
      appendLog("未在正文顶部检测到 Front Matter。");
      return;
    }
    const meta = parsed.meta;
    fmTitleInput.value = meta.title || "";
    fmDateInput.value = meta.date || "";
    fmSummaryInput.value = meta.summary || "";
    fmTagsInput.value = meta.tags || "";
    fmCoverInput.value = meta.cover || "";
    fmHiddenInput.value = normalizeHiddenValue(meta.hidden || "0");
    const mi = parseMiField(meta.MI || meta.mi || "");
    fmMiQuestionInput.value = mi.question;
    fmMiIdInput.value = mi.id;
    appendLog("已从正文读取 Front Matter。");
  }

  function createNewTemplate() {
    editor.value = `${buildFrontMatterText(collectFrontMatterForm())}\n正文内容\n`;
    editor.selectionStart = editor.selectionEnd = editor.value.length;
    editor.focus();
    appendLog("已创建新文章模板。");
    schedulePreview();
  }

  function maybeAutoSetCover(markdownUrl) {
    if (!autoCoverInput.checked) return;
    if (fmCoverInput.value.trim()) return;
    fmCoverInput.value = markdownUrl;
    appendLog(`已自动设置 cover：${markdownUrl}`);
  }

  async function writeImageIfPossible(file, desiredName) {
    if (!imageDirHandle) return { fileName: desiredName, wrote: false };

    const allowed = await requestDirWritePermission(imageDirHandle);
    if (!allowed) {
      appendLog("图片目录权限被拒绝，仅插入 Markdown。");
      imageDirHandle = null;
      imageFolderState.textContent = "图片目录权限被拒绝：仅插入 Markdown。";
      return { fileName: desiredName, wrote: false };
    }

    const fileName = await ensureUniqueName(imageDirHandle, desiredName);
    const fileHandle = await imageDirHandle.getFileHandle(fileName, { create: true });
    const writer = await fileHandle.createWritable();
    await writer.write(file);
    await writer.close();
    return { fileName, wrote: true };
  }

  async function consumeImages(files, sourceLabel) {
    const list = Array.from(files).filter((file) => file.type && file.type.startsWith("image/"));
    if (!list.length) {
      appendLog(`${sourceLabel}：未检测到图片文件。`);
      return;
    }

    if (!imageDirHandle) {
      appendLog("提示：未选择图片目录，当前只会写入 Markdown 路径，不会复制图片文件，可能导致 404。");
    }

    const prefix = normalizePrefix(imgPrefixInput.value);
    for (const file of list) {
      try {
        const desiredName = resolveTargetImageName(file);
        const result = await writeImageIfPossible(file, desiredName);
        const alt = splitNameAndExt(result.fileName).stem || "image";
        const mdUrl = `${prefix}/${result.fileName}`;
        insertAtCursor(`${markdownImageLine(mdUrl, alt)}\n\n`);
        maybeAutoSetCover(mdUrl);
        appendLog(
          `${sourceLabel}：${file.name || "(截图)"} -> ${result.fileName}${result.wrote ? "（已写入）" : "（仅语法）"}`
        );
      } catch (error) {
        appendLog(`${sourceLabel}：处理失败 ${file.name || "(截图)"}，原因：${error.message || error}`);
      }
    }
  }

  async function pickImageFolder() {
    if (!supportsDirPicker()) {
      appendLog("\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u76ee\u5f55\u9009\u62e9\uff08showDirectoryPicker\uff09\u3002");
      return false;
    }
    try {
      const pickerOptions = { mode: "readwrite", id: "blog-editor-image-folder" };
      const rememberedRoot = imageRootDirHandle || (await loadRememberedHandle(handleStore.imageRootKey));
      if (rememberedRoot) {
        pickerOptions.startIn = rememberedRoot;
      } else {
        const rememberedPost = postDirHandle || (await loadRememberedHandle(handleStore.postDirKey));
        if (rememberedPost) {
          pickerOptions.startIn = rememberedPost;
        }
      }

      const handle = await window.showDirectoryPicker(pickerOptions);
      await setImageFolderHandle(handle, { asRoot: true, remember: true });
      appendLog(`图片目录：${handle.name}`);
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") {
        appendLog("\u5df2\u53d6\u6d88\u9009\u62e9\u56fe\u7247\u76ee\u5f55\u3002");
        return false;
      }
      appendLog(`\u9009\u62e9\u56fe\u7247\u76ee\u5f55\u5931\u8d25\uff1a${error.message || error}`);
      return false;
    }
  }

  async function createImageSubdirForPost() {
    const postBase = sanitizeSlugLike(postFileNameInput.value || inferPostFileName());
    if (!postBase) {
      appendLog("\u8bf7\u5148\u586b\u5199\u6587\u7ae0\u6587\u4ef6\u540d\uff0c\u4f8b\u5982 P1\u3002");
      return;
    }

    if (!imageDirHandle) {
      appendLog("\u8bf7\u5148\u9009\u62e9\u56fe\u7247\u6839\u76ee\u5f55\uff08\u5efa\u8bae assets/Blog\uff09\u3002");
      const picked = await pickImageFolder();
      if (!picked) return;
    }

    const allowed = await requestDirWritePermission(imageDirHandle);
    if (!allowed) {
      appendLog("\u56fe\u7247\u76ee\u5f55\u6743\u9650\u88ab\u62d2\u7edd\uff0c\u65e0\u6cd5\u521b\u5efa\u5b50\u76ee\u5f55\u3002");
      return;
    }

    try {
      const subDir = await imageDirHandle.getDirectoryHandle(postBase, { create: true });
      if (!imageRootDirHandle) {
        imageRootDirHandle = imageDirHandle;
      }
      imageDirHandle = subDir;
      imageFolderState.textContent = `\u5df2\u5207\u6362\u56fe\u7247\u76ee\u5f55\uff1a${subDir.name}`;

      const current = normalizePrefix(imgPrefixInput.value);
      if (/^\.?\/?assets\/blog(?:\/.*)?$/i.test(current)) {
        imgPrefixInput.value = `./assets/Blog/${postBase}`;
      } else {
        imgPrefixInput.value = `${current}/${postBase}`;
      }

      appendLog(`\u5df2\u521b\u5efa\u5e76\u5207\u6362\u5230\u56fe\u7247\u5b50\u76ee\u5f55\uff1a${postBase}`);
      appendLog(`\u56fe\u7247 URL \u524d\u7f00\u5df2\u540c\u6b65\uff1a${imgPrefixInput.value}`);
    } catch (error) {
      appendLog(`\u521b\u5efa\u5b50\u76ee\u5f55\u5931\u8d25\uff1a${error.message || error}`);
    }
  }

  async function pickPostFolder() {
    if (!supportsDirPicker()) {
      appendLog("当前浏览器不支持目录选择（showDirectoryPicker）。");
      return false;
    }

    try {
      const pickerOptions = { mode: "readwrite", id: "blog-editor-post-folder" };
      const rememberedPost = postDirHandle || (await loadRememberedHandle(handleStore.postDirKey));
      if (rememberedPost) {
        pickerOptions.startIn = rememberedPost;
      }

      const handle = await window.showDirectoryPicker(pickerOptions);
      await setPostFolderHandle(handle, { remember: true });
      appendLog(`文章目录：${handle.name}`);
      if (String(handle.name || "").toLowerCase() !== "blog") {
        appendLog("提示：建议选择 ninocat_page/content/blog 目录，避免导出到错误位置。");
      }
      return true;
    } catch (error) {
      if (error && error.name === "AbortError") {
        appendLog("已取消选择文章目录。");
        return false;
      }
      appendLog(`选择文章目录失败：${error.message || error}`);
      return false;
    }
  }

  function inferPostFileName() {
    const manual = sanitizeSlugLike(postFileNameInput.value);
    if (manual) return manual;
    const title = sanitizeSlugLike(fmTitleInput.value);
    if (title) return title;
    return `post-${currentStamp()}`;
  }

  async function importMarkdownFile(file) {
    if (!file) return;

    const raw = await file.text();
    const text = String(raw || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    editor.value = text;

    const parsed = parseFrontMatterFromText(text);
    if (parsed && parsed.meta) {
      fmTitleInput.value = parsed.meta.title || "";
      fmDateInput.value = parsed.meta.date || fmDateInput.value;
      fmSummaryInput.value = parsed.meta.summary || "";
      fmTagsInput.value = parsed.meta.tags || fmTagsInput.value || "Blog";
      fmCoverInput.value = parsed.meta.cover || "";
      fmHiddenInput.value = normalizeHiddenValue(parsed.meta.hidden || "0");
      const mi = parseMiField(parsed.meta.MI || parsed.meta.mi || "");
      fmMiQuestionInput.value = mi.question;
      fmMiIdInput.value = mi.id;
      if (parsed.meta.cover) {
        const coverPath = String(parsed.meta.cover).trim();
        const slash = coverPath.lastIndexOf("/");
        if (slash > 0) {
          imgPrefixInput.value = normalizePrefix(coverPath.slice(0, slash));
        }
      }
      appendLog("已从导入文件读取 Front Matter。");
    } else {
      appendLog("导入文件未检测到 Front Matter，已按正文载入。");
    }

    const baseName = sanitizeSlugLike(String(file.name || "").replace(/\.[^.]+$/, ""));
    if (baseName) {
      postFileNameInput.value = baseName;
      syncPrefixWithPostFileName();
    }

    renderPreview();
    appendLog(`已导入 Markdown：${file.name || "未命名文件"}`);
  }

  async function importMarkdownByPicker() {
    if (supportsFilePicker()) {
      try {
        const pickerOptions = {
          id: "blog-editor-import-md",
          multiple: false,
          types: [
            {
              description: "Markdown",
              accept: {
                "text/markdown": [".md", ".markdown", ".mdown"],
                "text/plain": [".md", ".markdown", ".mdown"],
              },
            },
          ],
        };

        const rememberedPost = postDirHandle || (await loadRememberedHandle(handleStore.postDirKey));
        if (rememberedPost) {
          pickerOptions.startIn = rememberedPost;
        }

        const [fileHandle] = await window.showOpenFilePicker(pickerOptions);
        const file = await fileHandle.getFile();
        await importMarkdownFile(file);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          appendLog("已取消导入 Markdown。");
          return;
        }
        appendLog(`文件选择器导入失败，尝试备用方式：${error.message || error}`);
      }
    }

    if (importMdInput) {
      importMdInput.value = "";
      importMdInput.click();
    }
  }

  function safeDateValue(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }

  async function exportMarkdownToPostFolder() {
    if (!validateMiInputs()) return null;

    if (!postDirHandle) {
      const ok = await pickPostFolder();
      if (!ok) return null;
    }

    const allowed = await requestDirWritePermission(postDirHandle);
    if (!allowed) {
      appendLog("文章目录权限被拒绝。");
      postFolderState.textContent = "文章目录权限被拒绝。";
      postDirHandle = null;
      return null;
    }

    const base = inferPostFileName();
    const fileName = `${base}.md`;
    postFileNameInput.value = base;
    const content = ensureFrontMatterContent();

    const fileHandle = await postDirHandle.getFileHandle(fileName, { create: true });
    const writer = await fileHandle.createWritable();
    await writer.write(content);
    await writer.close();

    appendLog(`已导出：${fileName}`);
    return { fileName };
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(editor.value);
      appendLog("已复制 Markdown。");
    } catch (error) {
      appendLog(`复制失败：${error.message || error}`);
    }
  }

  function downloadMarkdown() {
    const content = editor.value || "";
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${inferPostFileName()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    appendLog("已下载 Markdown 文件。");
  }

  function resolvePreviewUrl(rawUrl) {
    const url = String(rawUrl || "").trim();
    if (!url) return url;

    if (
      /^(https?:|data:|blob:|mailto:|tel:|#)/i.test(url) ||
      url.startsWith("/") ||
      url.startsWith("//")
    ) {
      return url;
    }

    const rawPrefix = String(previewPrefixInput?.value || "").trim();
    const prefix = rawPrefix.replace(/\/+$/, "");
    if (!prefix) return url;

    if (url.startsWith("./")) {
      return `${prefix}/${url.slice(2)}`;
    }
    return `${prefix}/${url}`;
  }

  function rewriteMarkdownLinksForPreview(markdown) {
    const text = String(markdown || "").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const out = [];
    let inCode = false;

    for (const line of lines) {
      if (line.startsWith("```")) {
        inCode = !inCode;
        out.push(line);
        continue;
      }
      if (inCode) {
        out.push(line);
        continue;
      }

      const replaced = line.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (_m, p1, url, p3) => {
        return `${p1}${resolvePreviewUrl(url)}${p3}`;
      });
      out.push(replaced);
    }

    return out.join("\n");
  }

  function renderPreview() {
    const source = rewriteMarkdownLinksForPreview(editor.value);
    preview.innerHTML = sharedMarkdownToHtml(source);
    sharedEnhanceCodeBlocks(preview);
    sharedRenderMath(preview);
  }

  function schedulePreview() {
    if (!autoPreviewInput.checked) return;
    if (previewTimer) window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(renderPreview, 120);
  }

  function setDropActive(active) {
    dropZone.classList.toggle("active", active);
  }

  function bindDrop(target, label) {
    target.addEventListener("dragover", (event) => {
      event.preventDefault();
      setDropActive(true);
    });
    target.addEventListener("dragleave", () => {
      setDropActive(false);
    });
    target.addEventListener("drop", async (event) => {
      event.preventDefault();
      setDropActive(false);
      await consumeImages(event.dataTransfer?.files || [], label);
    });
  }

  function bindPaste() {
    editor.addEventListener("paste", async (event) => {
      const clipboardFiles = Array.from(event.clipboardData?.files || []).filter(
        (file) => file.type && file.type.startsWith("image/")
      );
      if (!clipboardFiles.length) return;
      event.preventDefault();
      await consumeImages(clipboardFiles, "粘贴");
    });
  }

  function bindFrontMatterButtons() {
    fmApplyBtn.addEventListener("click", applyFrontMatterToEditor);
    fmReadBtn.addEventListener("click", readFrontMatterToForm);
    fmNewBtn.addEventListener("click", createNewTemplate);
  }

  function initDefaults() {
    if (!fmDateInput.value) fmDateInput.value = todayYmd();
    if (fmHiddenInput && !fmHiddenInput.value) fmHiddenInput.value = "0";
  }

  function bindPublishButtons() {
    pickPostFolderBtn.addEventListener("click", pickPostFolder);
    if (importMdBtn) {
      importMdBtn.addEventListener("click", importMarkdownByPicker);
    }
    if (importMdInput) {
      importMdInput.addEventListener("change", async () => {
        const file = importMdInput.files && importMdInput.files[0];
        if (!file) return;
        await importMarkdownFile(file);
      });
    }
    exportMdBtn.addEventListener("click", exportMarkdownToPostFolder);
    postFileNameInput.addEventListener("change", syncPrefixWithPostFileName);
    postFileNameInput.addEventListener("blur", syncPrefixWithPostFileName);
  }

  function bindPreviewEvents() {
    refreshPreviewBtn.addEventListener("click", renderPreview);
    autoPreviewInput.addEventListener("change", () => {
      if (autoPreviewInput.checked) renderPreview();
    });
    previewPrefixInput.addEventListener("input", schedulePreview);
    editor.addEventListener("input", schedulePreview);
  }

  async function applySharedSiteConfig() {
    if (typeof shared.loadSiteConfig !== "function") return;
    try {
      const config = await shared.loadSiteConfig();
      if (typeof shared.applyThemeConfig === "function") {
        shared.applyThemeConfig(config);
      }
      if (typeof shared.initTheme === "function") {
        shared.initTheme(config);
      }
      if (typeof shared.setupThemeToggle === "function") {
        shared.setupThemeToggle();
      }
      if (typeof shared.applySiteText === "function") {
        shared.applySiteText(config);
      }
      if (typeof shared.markActiveNav === "function") {
        shared.markActiveNav();
      }
      if (config?.title) {
        document.title = `${config.title} - Markdown 博客编辑器`;
      }
    } catch (error) {
      appendLog(`加载站点主题配置失败：${error.message || error}`);
    }
  }

  async function init() {
    await applySharedSiteConfig();
    initDefaults();
    if (createImageSubdirLabel) {
      createImageSubdirLabel.textContent = "\u81ea\u52a8\u5b50\u76ee\u5f55";
    }
    if (createImageSubdirHint) {
      createImageSubdirHint.textContent =
        "\u6309\u201c\u6587\u7ae0\u6587\u4ef6\u540d\u201d\u521b\u5efa\u5e76\u5207\u6362\u5230\u56fe\u7247\u5b50\u76ee\u5f55\u3002";
    }
    if (createImageSubdirBtn) {
      createImageSubdirBtn.textContent = "\u521b\u5efa\u5e76\u5207\u6362";
      createImageSubdirBtn.title =
        "\u81ea\u52a8\u521b\u5efa assets/Blog/P{\u6587\u7ae0\u540d} \u5e76\u5207\u6362\u5230\u8be5\u76ee\u5f55";
    }

    if (!supportsDirPicker()) {
      imageFolderState.textContent = "当前浏览器不支持目录写入。";
      postFolderState.textContent = "当前浏览器不支持目录写入。";
    } else {
      await tryRestoreRememberedFolders();
    }

    pickImageFolderBtn.addEventListener("click", pickImageFolder);
    if (createImageSubdirBtn) {
      createImageSubdirBtn.addEventListener("click", createImageSubdirForPost);
    }
    copyBtn.addEventListener("click", copyMarkdown);
    downloadBtn.addEventListener("click", downloadMarkdown);
    clearLogBtn.addEventListener("click", () => {
      logList.replaceChildren();
    });

    bindFrontMatterButtons();
    bindPublishButtons();
    bindPreviewEvents();
    bindDrop(dropZone, "拖拽");
    bindDrop(editor, "拖拽");
    bindPaste();

    document.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    document.addEventListener("drop", (event) => {
      if (event.target !== dropZone && event.target !== editor) event.preventDefault();
    });

    renderPreview();
    appendLog("编辑器已就绪：支持拖图、导出、更新索引与图片预览。");
    appendLog("建议先选择私密仓库目录 E:/Blog_VB/ninocat_private/content/blog，再执行导出。");
  }

  init();
})();

