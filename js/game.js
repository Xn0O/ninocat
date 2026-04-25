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
const randomBtn = document.getElementById("random-play");

const player = document.getElementById("game-player");
const playerTitle = document.getElementById("player-title");
const playerClose = document.getElementById("player-close");
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

function closePlayer() {
  clearHintTimer();
  if (player) player.hidden = true;
  document.body.classList.remove("game-player-open");
  frame.src = "about:blank";
  setEmbedHint(false, "", "");
}

function openInSite(game) {
  if (!game.playUrl) {
    if (game.openUrl) {
      window.location.href = game.openUrl;
    }
    return;
  }

  if (game.launchMode === "newtab") {
    window.location.href = game.openUrl;
    return;
  }

  playerTitle.textContent = `${game.title} · 本站游玩`;
  frame.src = game.playUrl;
  if (player) player.hidden = false;
  document.body.classList.add("game-player-open");
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
  card.draggable = false;
  card.setAttribute("draggable", "false");
  card.addEventListener("dragstart", (event) => event.preventDefault());

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
  previewBtn.textContent = game.launchMode === "newtab" || !game.playUrl ? "打开网页" : "本站游玩";
  if (game.playUrl || game.openUrl) {
    previewBtn.addEventListener("click", () => openInSite(game));
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

function bindPlayer() {
  if (playerClose) {
    playerClose.addEventListener("click", closePlayer);
  }
  frame.addEventListener("load", () => {
    clearHintTimer();
  });
}

function bindRandom() {
  randomBtn.addEventListener("click", () => {
    const list = state.games.filter((g) => g.playUrl || g.openUrl);
    if (!list.length) return;
    const pick = list[Math.floor(Math.random() * list.length)];
    openInSite(pick);
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
  bindRandom();
}

init();



