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
} = window.SiteCommon;

const ART_PATH = "./data/art.json";
const grid = document.getElementById("art-grid");

function artCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";

  const cover = document.createElement("img");
  cover.className = "item-cover";
  cover.alt = `${item.title} 作品图`;
  cover.loading = "lazy";
  cover.src = item.image || "./assets/hero-art.svg";

  const body = document.createElement("div");
  body.className = "item-body";

  const meta = document.createElement("p");
  meta.className = "item-meta";
  meta.textContent = item.year || "未填写年份";

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
  card.append(cover, body);
  return card;
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  applySiteText(config);
  markActiveNav();

  try {
    const res = await fetch(ART_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error("无法加载 art.json");
    const payload = await res.json();
    const items = Array.isArray(payload.arts) ? payload.arts : [];
    if (!items.length) {
      grid.appendChild(createEmptyTip("未找到美术配置，请编辑 data/art.json。"));
      return;
    }
    items.forEach((item) => grid.appendChild(artCard(item)));
  } catch (error) {
    console.error(error);
    grid.appendChild(createEmptyTip("美术数据加载失败，请检查 data/art.json。"));
  }
}

init();



