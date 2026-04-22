const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  markActiveNav,
  createEmptyTip,
  markdownToHtml,
  parseFrontMatter,
  tagsFromText,
} = window.SiteCommon;

const POSTS_INDEX = "./content/blog/posts.json";
const titleNode = document.getElementById("post-title");
const metaNode = document.getElementById("post-meta");
const contentNode = document.getElementById("post-content");
const heroNode = document.querySelector("[data-hero-image]");

function getSlug() {
  const query = new URLSearchParams(location.search);
  return query.get("slug") || "";
}

async function findPostFile(slug) {
  const res = await fetch(POSTS_INDEX, { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 posts.json");
  const index = await res.json();
  const match = (index.posts || []).find((item) => item.slug === slug);
  return match?.file || "";
}

async function loadMarkdown(file) {
  const res = await fetch(file, { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载文章 Markdown");
  return res.text();
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  markActiveNav();

  const slug = getSlug();
  if (!slug) {
    titleNode.textContent = "缺少文章参数";
    contentNode.appendChild(createEmptyTip("请使用示例地址：blog-post.html?slug=示例文章标识"));
    return;
  }

  try {
    const file = await findPostFile(slug);
    if (!file) {
      titleNode.textContent = "文章不存在";
      contentNode.appendChild(createEmptyTip(`未找到 slug=${slug} 的文章配置。`));
      return;
    }

    const raw = await loadMarkdown(file);
    const { meta, body } = parseFrontMatter(raw);
    titleNode.textContent = meta.title || slug;

    const tags = tagsFromText(meta.tags).join(" / ");
    metaNode.textContent = [meta.date || "未填写日期", tags].filter(Boolean).join(" · ");

    if (heroNode && meta.cover) {
      heroNode.src = meta.cover;
      heroNode.alt = `${meta.title || slug} 文章头图`;
    }

    contentNode.innerHTML = markdownToHtml(body);
    document.title = `${meta.title || slug} - 博客`;
  } catch (error) {
    console.error(error);
    titleNode.textContent = "文章加载失败";
    contentNode.appendChild(createEmptyTip("请检查 posts.json 与 Markdown 文件路径。"));
  }
}

init();

