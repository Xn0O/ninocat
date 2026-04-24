const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applySiteText,
  markActiveNav,
  createEmptyTip,
} = window.SiteCommon;

const content = document.getElementById("lab-content");

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applySiteText(config);
  markActiveNav();

  if (!content) return;

  const title = document.createElement("h1");
  title.textContent = "实验区";

  const intro = document.createElement("p");
  intro.textContent = "这里将用于放置各种网页互动小玩意。";

  content.append(title, intro, createEmptyTip("现在什么都没有，以后会更新~"));
  document.title = "实验区 - Nino";
}

init();

