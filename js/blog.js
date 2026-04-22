const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  markActiveNav,
  createEmptyTip,
  parseFrontMatter,
  tagsFromText,
} = window.SiteCommon;

const POSTS_INDEX = "./content/blog/posts.json";
const DEFAULT_COVER = "./assets/hero-blog.svg";
const PAGE_SIZE = 5;
const grid = document.getElementById("blog-grid");
const pagination = document.getElementById("blog-pagination");
const prevBtn = document.getElementById("blog-prev");
const nextBtn = document.getElementById("blog-next");
const pageInfo = document.getElementById("blog-page-info");

const state = {
  posts: [],
  page: 1,
};

function renderCard(post) {
  const card = document.createElement("a");
  card.className = "item-card item-card-link";
  card.href = `./blog-post.html?slug=${encodeURIComponent(post.slug)}`;
  card.setAttribute("aria-label", `打开文章：${post.title || post.slug}`);

  const cover = document.createElement("img");
  cover.className = "item-cover";
  cover.loading = "lazy";
  cover.alt = `${post.title} 头图`;
  cover.src = post.cover || DEFAULT_COVER;

  const body = document.createElement("div");
  body.className = "item-body";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  meta.textContent = post.date || "未填写日期";

  const title = document.createElement("h3");
  title.className = "item-title";
  title.textContent = post.title || post.slug;

  const desc = document.createElement("p");
  desc.className = "item-desc";
  desc.textContent = post.summary || "暂无摘要。";

  const tags = document.createElement("div");
  tags.className = "item-tags";
  post.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.appendChild(chip);
  });

  body.append(meta, title, desc, tags);
  card.append(cover, body);
  return card;
}

async function loadPosts() {
  const indexRes = await fetch(POSTS_INDEX, { cache: "no-store" });
  if (!indexRes.ok) {
    throw new Error("无法加载 posts.json");
  }
  const index = await indexRes.json();
  const files = Array.isArray(index.posts) ? index.posts : [];

  const loaded = await Promise.all(
    files.map(async (item) => {
      const res = await fetch(item.file, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`无法加载 Markdown 文件: ${item.file}`);
      }
      const raw = await res.text();
      const { meta, body } = parseFrontMatter(raw);
      return {
        slug: item.slug,
        title: meta.title || item.slug,
        date: meta.date || "",
        summary: meta.summary || body.slice(0, 120).replace(/\s+/g, " "),
        tags: tagsFromText(meta.tags),
        cover: meta.cover || DEFAULT_COVER,
      };
    })
  );

  loaded.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return loaded;
}

function getTotalPages() {
  const total = Math.ceil(state.posts.length / PAGE_SIZE);
  return total > 0 ? total : 1;
}

function normalizePage(value) {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(getTotalPages(), Math.max(1, n));
}

function syncPageQuery(page) {
  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }
  window.history.replaceState(null, "", url);
}

function renderPagination() {
  if (!pagination || !prevBtn || !nextBtn || !pageInfo) return;

  const totalPages = getTotalPages();
  pagination.hidden = state.posts.length <= PAGE_SIZE;
  prevBtn.disabled = state.page <= 1;
  nextBtn.disabled = state.page >= totalPages;
  pageInfo.textContent = `第 ${state.page} / ${totalPages} 页`;
}

function renderCurrentPage() {
  grid.replaceChildren();

  const start = (state.page - 1) * PAGE_SIZE;
  const visible = state.posts.slice(start, start + PAGE_SIZE);
  visible.forEach((post) => grid.appendChild(renderCard(post)));
  renderPagination();
}

function setPage(page, options = {}) {
  state.page = normalizePage(page);
  renderCurrentPage();
  if (options.syncQuery !== false) {
    syncPageQuery(state.page);
  }
}

function bindPagination() {
  if (!prevBtn || !nextBtn) return;
  prevBtn.addEventListener("click", () => {
    setPage(state.page - 1);
  });
  nextBtn.addEventListener("click", () => {
    setPage(state.page + 1);
  });
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  markActiveNav();

  try {
    state.posts = await loadPosts();
    if (!state.posts.length) {
      grid.appendChild(createEmptyTip("还没有文章，请在 content/blog/*.md 中添加。"));
      if (pagination) pagination.hidden = true;
      return;
    }

    bindPagination();
    const urlPage = new URLSearchParams(window.location.search).get("page");
    setPage(urlPage || 1);
  } catch (error) {
    console.error(error);
    grid.appendChild(createEmptyTip("博客加载失败，请检查 posts.json 与 Markdown 路径。"));
    if (pagination) pagination.hidden = true;
  }
}

init();
