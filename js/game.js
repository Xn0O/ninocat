const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applyHeaderImage,
  markActiveNav,
  createEmptyTip,
  tagsFromText,
} = window.SiteCommon;

const GAMES_PATH = "./data/games.json";
const gameGrid = document.getElementById("game-grid");
const filterRoot = document.getElementById("game-filter");
const randomBtn = document.getElementById("random-play");

const modal = document.getElementById("game-modal");
const modalTitle = document.getElementById("modal-title");
const modalClose = document.getElementById("modal-close");
const frame = document.getElementById("game-frame");
const embedHint = document.getElementById("embed-hint");
const embedOpenLink = document.getElementById("embed-open-link");

const state = {
  games: [],
  filter: "全部",
  hintTimer: null,
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
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.hintTimer = null;
  }
}

function setEmbedHint(visible, message, fallbackUrl) {
  if (!embedHint || !embedOpenLink) return;
  embedHint.hidden = !visible;
  embedOpenLink.hidden = !visible;
  if (visible) {
    embedHint.textContent = message;
    embedOpenLink.href = fallbackUrl || "#";
  }
}

function openInNewTab(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function closeModal() {
  clearHintTimer();
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  frame.src = "about:blank";
  setEmbedHint(false, "", "");
}

function openModal(game) {
  if (!game.playUrl) return;

  if (game.launchMode === "newtab") {
    openInNewTab(game.openUrl);
    return;
  }

  modalTitle.textContent = game.title;
  frame.src = game.playUrl;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  setEmbedHint(false, "", "");

  // 远程站点可能通过 X-Frame-Options/CSP 阻止 iframe 嵌入。
  if (game.launchMode === "auto") {
    clearHintTimer();
    state.hintTimer = setTimeout(() => {
      setEmbedHint(true, "该页面可能阻止跨站 iframe 嵌入，请改为打开完整页面。", game.openUrl);
    }, 2600);
  }
}

function cardForGame(game) {
  const card = document.createElement("article");
  card.className = "game-card";

  const media = document.createElement("button");
  media.type = "button";
  media.className = "game-media";
  media.setAttribute("aria-label", `试玩 ${game.title}`);
  if (game.playUrl) {
    media.addEventListener("click", () => openModal(game));
  } else {
    media.disabled = true;
  }

  const coverPrimary = document.createElement("img");
  coverPrimary.className = "game-cover game-cover-primary";
  coverPrimary.loading = "lazy";
  coverPrimary.alt = `${game.title} 封面`;
  coverPrimary.src = game.cover;

  const coverHover = document.createElement("img");
  coverHover.className = "game-cover game-cover-hover";
  coverHover.loading = "lazy";
  coverHover.alt = `${game.title} 悬浮图`;
  coverHover.src = game.coverHover;

  media.append(coverPrimary, coverHover);

  const body = document.createElement("div");
  body.className = "game-body";

  const meta = document.createElement("p");
  meta.className = "game-meta";
  meta.textContent = `${game.status} · ${game.category}${game.external ? " · 外部链接" : ""}`;

  const title = document.createElement("h3");
  title.className = "game-title";
  title.textContent = game.title;

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

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const previewBtn = document.createElement("button");
  previewBtn.type = "button";
  previewBtn.className = "btn";
  previewBtn.textContent = game.launchMode === "newtab" ? "打开网页" : "弹窗试玩";
  if (game.playUrl) {
    previewBtn.addEventListener("click", () => openModal(game));
  } else {
    previewBtn.disabled = true;
  }

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

  actions.append(previewBtn, openPage);
  body.append(meta, title, desc, tags, actions);
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

  visible.forEach((game) => gameGrid.appendChild(cardForGame(game)));
}

function bindModal() {
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.close) {
      closeModal();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
  frame.addEventListener("load", () => {
    clearHintTimer();
  });
}

function bindRandom() {
  randomBtn.addEventListener("click", () => {
    const list = state.games.filter((g) => g.playUrl || g.openUrl);
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    if (pick.launchMode === "newtab") {
      openInNewTab(pick.openUrl);
    } else {
      openModal(pick);
    }
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

  bindModal();
  bindRandom();
}

init();
