const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  markActiveNav,
  createEmptyTip,
  markdownToHtml,
} = window.SiteCommon;

const ABOUT_PATH = "./content/about.md";
const aboutContainer = document.getElementById("about-content");

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applyHeaderImage(config);
  markActiveNav();

  try {
    const res = await fetch(ABOUT_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error("无法加载 about.md");
    const markdown = await res.text();
    aboutContainer.innerHTML = markdownToHtml(markdown);
  } catch (error) {
    console.error(error);
    aboutContainer.appendChild(createEmptyTip("关于页加载失败，请检查 content/about.md。"));
  }
}

init();
