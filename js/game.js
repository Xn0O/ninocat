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
} = window.SiteCommon;

const GAMES_PATH = "./data/games.json";
const gameGrid = document.getElementById("game-grid");
const filterRoot = document.getElementById("game-filter");
const state = {
  games: [],
  filter: "全部",
};

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

function normalizeLaunchMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m === "iframe" || m === "newtab" || m === "auto") return m;
  return "auto";
}

function normalizeGame(raw, index) {
  const playUrl = String(raw.embedUrl || raw.playUrl || "").trim();
  const openUrl = String(raw.openUrl || playUrl).trim();
  return {
    id: raw.id || `game-${index + 1}`,
    title: raw.title || "未命名游戏",
    description: raw.description || "暂无简介。",
    status: raw.status || "原型",
    category: raw.category || "未分类",
    tags: tagsFromText(raw.tags),
    devType: raw.devType || "solo",
    cover: raw.cover || "./assets/hero-game.svg",
    coverHover: raw.coverHover || raw.cover || "./assets/hero-game.svg",
    playUrl,
    openUrl,
    launchMode: normalizeLaunchMode(raw.launchMode),
    external: isAbsoluteUrl(openUrl),
    order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index + 1,
  };
}

function clearHintTimer() {
  /* 预留 */
}

function setEmbedHint(visible, message, fallbackUrl) {
  /* 预留 */
}

function closePlayer() {
  /* 预留 */
}

function openInSite(game) {
  const url = game.openUrl || game.playUrl;
  if (url) {
    window.open(url, "_blank");
  }
}

function cardForGame(game) {
  const card = document.createElement("article");
  card.className = "game-card";
  card.draggable = false;
  card.setAttribute("draggable", "false");
  card.addEventListener("dragstart", (event) => event.preventDefault());

  // 3D tilt on mouse hover
  const TILT_MAX = 8;
  function getTiltTarget() {
    // page-transition.js wraps .game-card in .card-wrap; ::after purple glow lives there
    return card.parentElement?.classList.contains("card-wrap") ? card.parentElement : card;
  }
  card.addEventListener("mousemove", (e) => {
    const wrap = getTiltTarget();
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotateY = ((x - cx) / cx) * TILT_MAX;
    const rotateX = -((y - cy) / cy) * TILT_MAX;
    wrap.style.transform = `perspective(800px) scale(1.08) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });
  card.addEventListener("mouseleave", () => {
    const wrap = getTiltTarget();
    wrap.style.transform = "";
  });

  const media = document.createElement("button");
  media.type = "button";
  media.className = "game-media";
  media.setAttribute("aria-label", `游玩 ${game.title}`);
  media.draggable = false;
  media.setAttribute("draggable", "false");
  if (game.playUrl || game.openUrl) {
    media.addEventListener("click", () => openInSite(game));
  } else {
    media.disabled = true;
  }

  const coverPrimary = document.createElement("img");
  coverPrimary.className = "game-cover game-cover-primary";
  coverPrimary.loading = "lazy";
  coverPrimary.alt = `${game.title} 封面`;
  coverPrimary.src = resolveAssetUrl(game.cover);
  coverPrimary.draggable = false;
  coverPrimary.setAttribute("draggable", "false");

  const coverHover = document.createElement("img");
  coverHover.className = "game-cover game-cover-hover";
  coverHover.loading = "lazy";
  coverHover.alt = `${game.title} 悬浮图`;
  coverHover.src = resolveAssetUrl(game.coverHover);
  coverHover.draggable = false;
  coverHover.setAttribute("draggable", "false");

  const bodyOverlay = document.createElement("div");
  bodyOverlay.className = "game-body-overlay";

  const meta = document.createElement("p");
  meta.className = "game-meta";
  meta.textContent = `${game.status} · ${game.category}${game.external ? " · 外部链接" : ""}`;

  const title = document.createElement("h3");
  title.className = "game-title";
  title.textContent = game.title;

  bodyOverlay.append(meta, title);
  media.append(coverPrimary, coverHover, bodyOverlay);

  const desc = document.createElement("p");
  desc.className = "game-desc";
  desc.textContent = game.description;

  const tags = document.createElement("div");
  tags.className = "game-tags";
  game.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.appendChild(chip);
  });

  const body = document.createElement("div");
  body.className = "game-body";

  // 桌面端 meta+title（手机端隐藏）
  const bodyMeta = document.createElement("p");
  bodyMeta.className = "game-meta game-meta-desktop";
  bodyMeta.textContent = `${game.status} · ${game.category}${game.external ? " · 外部链接" : ""}`;
  const bodyTitle = document.createElement("h3");
  bodyTitle.className = "game-title game-title-desktop";
  bodyTitle.textContent = game.title;

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const openPage = document.createElement("a");
  openPage.className = "btn";
  openPage.textContent = "打开完整页面";
  openPage.target = "_blank";
  openPage.rel = "noreferrer noopener";
  if (game.openUrl) {
    openPage.href = game.openUrl;
  } else {
    openPage.href = "#";
    openPage.setAttribute("aria-disabled", "true");
  }

  actions.append(openPage);
  body.append(bodyTitle, bodyMeta, desc, tags, actions);
  card.append(media, body);
  return card;
}

function renderFilters() {
  filterRoot.replaceChildren();
  const categories = [...new Set(state.games.map((g) => g.category))];
  const options = ["全部", ...categories];

  options.forEach((value) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `filter-btn ${state.filter === value ? "active" : ""}`;
    btn.textContent = value;
    btn.addEventListener("click", () => {
      state.filter = value;
      renderFilters();
      renderGames();
    });
    filterRoot.appendChild(btn);
  });
}

function renderGames() {
  gameGrid.replaceChildren();
  const visible =
    state.filter === "全部"
      ? state.games
      : state.games.filter((game) => game.category === state.filter);

  if (!visible.length) {
    gameGrid.appendChild(createEmptyTip("该分类下暂无游戏。"));
    return;
  }

  const solo = visible.filter((g) => g.devType !== "collab");
  const collab = visible.filter((g) => g.devType === "collab");

  function addSection(title, games) {
    if (!games.length) return;
    const header = document.createElement("div");
    header.className = "game-section-header";
    header.textContent = title;
    gameGrid.appendChild(header);
    games.forEach((game) => gameGrid.appendChild(cardForGame(game)));
  }

  addSection("独立开发", solo);
  addSection("合作开发", collab);
}

function bindPlayer() {
  if (playerClose) {
    playerClose.addEventListener("click", closePlayer);
  }
  frame.addEventListener("load", () => {
    clearHintTimer();
  });
}

async function loadGames() {
  const res = await fetch(GAMES_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error("无法加载 data/games.json");
  const payload = await res.json();
  const list = Array.isArray(payload.games) ? payload.games : [];
  return list.map(normalizeGame).sort((a, b) => a.order - b.order);
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
    state.games = await loadGames();
    if (!state.games.length) {
      gameGrid.appendChild(createEmptyTip("未找到游戏配置，请编辑 data/games.json。"));
    } else {
      renderFilters();
      renderGames();
    }
  } catch (error) {
    console.error(error);
    gameGrid.appendChild(createEmptyTip("游戏数据加载失败，请检查 data/games.json。"));
  }

  bindPlayer();
}

init();



