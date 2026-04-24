const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  applySiteText,
  markActiveNav,
  createEmptyTip,
  tagsFromText,
  resolveAssetUrl,
  setupImageLightbox,
} = window.SiteCommon;

const ART_PATH = "./data/art.json";
const PAGE_SIZE = 10;
const grid = document.getElementById("art-grid");

let allItems = [];
let paginationEl = null;
let comicViewer = null;

function readPageFromQuery() {
  const query = new URLSearchParams(window.location.search);
  const value = Number.parseInt(String(query.get("page") || "1"), 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function writePageToQuery(page) {
  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }
  window.history.replaceState(null, "", url.toString());
}

function ensurePaginationContainer() {
  if (paginationEl) return paginationEl;
  if (!grid) return null;
  paginationEl = document.createElement("section");
  paginationEl.className = "art-pagination";
  paginationEl.id = "art-pagination";
  grid.insertAdjacentElement("afterend", paginationEl);
  return paginationEl;
}

function resolveComicPages(item) {
  const raw = Array.isArray(item.pages) ? item.pages : [];
  return raw
    .map((src) => String(src || "").trim())
    .filter(Boolean)
    .map((src) => resolveAssetUrl(src));
}

function resolveCover(item) {
  return resolveAssetUrl(item.cover || item.image || "./assets/hero-art.svg");
}

function ensureComicViewer() {
  if (comicViewer) return comicViewer;

  const mask = document.createElement("div");
  mask.id = "comic-viewer";
  mask.className = "comic-viewer";
  mask.setAttribute("aria-hidden", "true");

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "comic-viewer-close";
  closeBtn.setAttribute("aria-label", "关闭漫画查看");
  closeBtn.textContent = "×";

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "comic-viewer-nav prev";
  prevBtn.setAttribute("aria-label", "上一页");
  prevBtn.textContent = "‹";

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "comic-viewer-nav next";
  nextBtn.setAttribute("aria-label", "下一页");
  nextBtn.textContent = "›";

  const img = document.createElement("img");
  img.className = "comic-viewer-img";
  img.alt = "";

  const caption = document.createElement("p");
  caption.className = "comic-viewer-caption";
  caption.hidden = true;

  const state = {
    pages: [],
    index: 0,
    title: "",
  };

  const render = () => {
    const total = state.pages.length;
    if (!total) return;
    const page = state.pages[state.index];
    img.src = page || "";
    img.alt = state.title ? `${state.title} 第${state.index + 1}页` : `第${state.index + 1}页`;
    caption.textContent = `${state.title ? `${state.title} · ` : ""}${state.index + 1} / ${total}`;
    caption.hidden = false;
    prevBtn.disabled = total <= 1;
    nextBtn.disabled = total <= 1;
  };

  const close = () => {
    mask.classList.remove("open");
    mask.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    img.removeAttribute("src");
    img.alt = "";
    caption.hidden = true;
    caption.textContent = "";
    state.pages = [];
    state.index = 0;
    state.title = "";
  };

  const step = (delta) => {
    const total = state.pages.length;
    if (!total) return;
    state.index = (state.index + delta + total) % total;
    render();
  };

  prevBtn.addEventListener("click", () => step(-1));
  nextBtn.addEventListener("click", () => step(1));
  closeBtn.addEventListener("click", close);
  mask.addEventListener("click", (event) => {
    if (event.target === mask) close();
  });

  window.addEventListener("keydown", (event) => {
    if (!mask.classList.contains("open")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  });

  mask.openComic = (pages, startIndex, title) => {
    const source = Array.isArray(pages) ? pages.filter(Boolean) : [];
    if (!source.length) return;
    state.pages = source;
    const safeIndex = Number.parseInt(String(startIndex), 10);
    state.index = Number.isFinite(safeIndex) ? Math.max(0, Math.min(source.length - 1, safeIndex)) : 0;
    state.title = String(title || "").trim();
    render();
    mask.classList.add("open");
    mask.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  };

  mask.closeComic = close;
  mask.append(closeBtn, prevBtn, nextBtn, img, caption);
  document.body.appendChild(mask);
  comicViewer = mask;
  return comicViewer;
}

function artCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";
  card.draggable = false;
  card.setAttribute("draggable", "false");
  card.addEventListener("dragstart", (event) => event.preventDefault());

  const comicPages = resolveComicPages(item);
  const isComic = String(item.type || "").trim().toLowerCase() === "comic" || comicPages.length > 0;
  if (isComic) card.classList.add("item-card-comic");

  const cover = document.createElement("img");
  cover.className = "item-cover";
  cover.alt = `${item.title || "未命名作品"} 作品图`;
  cover.loading = "lazy";
  cover.src = resolveCover(item);
  cover.draggable = false;
  cover.setAttribute("draggable", "false");

  const coverWrap = document.createElement("div");
  coverWrap.className = "item-cover-wrap";
  coverWrap.appendChild(cover);

  const body = document.createElement("div");
  body.className = "item-body";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  meta.textContent = item.year || "未填写年份";
  if (isComic) {
    const flag = document.createElement("span");
    flag.className = "art-type-flag";
    flag.textContent = "漫画";
    meta.append(" · ", flag);
  }

  const title = document.createElement("h3");
  title.className = "item-title";
  title.textContent = item.title || "未命名作品";

  const desc = document.createElement("p");
  desc.className = "item-desc";
  desc.textContent = item.description || "暂无描述。";

  const tags = document.createElement("div");
  tags.className = "item-tags";
  tagsFromText(item.tags).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.appendChild(chip);
  });

  body.append(meta, title, desc, tags);

  if (isComic) {
    const panel = document.createElement("details");
    panel.className = "comic-panel";

    const summary = document.createElement("summary");
    summary.className = "comic-panel-summary";
    summary.textContent = `内页（${comicPages.length}）`;

    const pagesWrap = document.createElement("div");
    pagesWrap.className = "comic-pages";

    const closePagesBtn = document.createElement("button");
    closePagesBtn.type = "button";
    closePagesBtn.className = "comic-pages-close";
    closePagesBtn.setAttribute("aria-label", "关闭内页");
    closePagesBtn.textContent = "×";
    closePagesBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      panel.open = false;
    });
    pagesWrap.appendChild(closePagesBtn);

    comicPages.forEach((src, index) => {
      const pageImg = document.createElement("img");
      pageImg.className = "comic-page-thumb";
      pageImg.loading = "lazy";
      pageImg.src = src;
      pageImg.alt = `${item.title || "漫画"} 第${index + 1}页`;
      pageImg.draggable = false;
      pageImg.setAttribute("draggable", "false");
      pageImg.dataset.noLightbox = "1";
      pageImg.tabIndex = 0;
      pageImg.setAttribute("role", "button");
      pageImg.setAttribute("aria-label", `${item.title || "漫画"} 第${index + 1}页（点击查看）`);
      const openComic = (event) => {
        event.preventDefault();
        const viewer = ensureComicViewer();
        viewer.openComic(comicPages, index, item.title || "漫画");
      };
      pageImg.addEventListener("click", openComic);
      pageImg.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          openComic(event);
        }
      });
      pagesWrap.appendChild(pageImg);
    });

    panel.append(summary, pagesWrap);
    coverWrap.appendChild(panel);
  }

  card.append(coverWrap, body);
  return card;
}

function renderPagination(currentPage, totalPages, totalItems, onPageChange) {
  const root = ensurePaginationContainer();
  if (!root) return;
  root.replaceChildren();

  if (totalPages <= 1) {
    root.hidden = true;
    return;
  }
  root.hidden = false;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn";
  prev.textContent = "上一页";
  prev.disabled = currentPage <= 1;
  prev.addEventListener("click", () => onPageChange(currentPage - 1));

  const info = document.createElement("p");
  info.className = "art-page-info";
  info.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 张`;

  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn";
  next.textContent = "下一页";
  next.disabled = currentPage >= totalPages;
  next.addEventListener("click", () => onPageChange(currentPage + 1));

  root.append(prev, info, next);
}

function renderPage(page) {
  if (!grid) return;
  const totalItems = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(totalPages, page));

  writePageToQuery(safePage);
  grid.replaceChildren();

  const start = (safePage - 1) * PAGE_SIZE;
  const subset = allItems.slice(start, start + PAGE_SIZE);
  if (!subset.length) {
    grid.appendChild(createEmptyTip("本页没有作品。"));
  } else {
    subset.forEach((item) => grid.appendChild(artCard(item)));
  }

  setupImageLightbox(grid);
  renderPagination(safePage, totalPages, totalItems, (nextPage) => {
    renderPage(nextPage);
    const top = grid.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  });
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  applySiteText(config);
  markActiveNav();

  if (!grid) return;

  try {
    const res = await fetch(ART_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error("无法加载 art.json");
    const payload = await res.json();
    const items = Array.isArray(payload.arts) ? payload.arts : [];
    if (!items.length) {
      grid.appendChild(createEmptyTip("未找到美术配置，请编辑 data/art.json。"));
      const root = ensurePaginationContainer();
      if (root) root.hidden = true;
      return;
    }

    // Reverse order: latest configured item appears first.
    allItems = [...items].reverse();
    renderPage(readPageFromQuery());

    window.addEventListener("popstate", () => {
      renderPage(readPageFromQuery());
    });
  } catch (error) {
    console.error(error);
    grid.appendChild(createEmptyTip("美术数据加载失败，请检查 data/art.json。"));
    const root = ensurePaginationContainer();
    if (root) root.hidden = true;
  }
}

init();
