const {
  loadSiteConfig,
  applyThemeConfig,
  initTheme,
  setupThemeToggle,
  applySiteText,
  markActiveNav,
} = window.SiteCommon;

const DEFAULT_STRIPS = [
  {
    key: "blog",
    href: "./blog.html",
    title: "博客",
    desc: "梦游产物",
    image: "./assets/backgr.jpg",
    speed: 0.12,
  },
  {
    key: "game",
    href: "./game.html",
    title: "游戏",
    desc: "钝意开发中！",
    image: "./assets/hero-game.svg",
    speed: 0.16,
  },
  {
    key: "art",
    href: "./art.html",
    title: "美术",
    desc: "存放处",
    image: "./assets/hero-art.svg",
    speed: 0.14,
  },
  {
    key: "about",
    href: "./about.html",
    title: "关于",
    desc: "nino",
    image: "./assets/hero-about.svg",
    speed: 0.1,
  },
];

function normalizeStrips(config) {
  const incoming = Array.isArray(config?.homeStrips) ? config.homeStrips : [];
  if (incoming.length !== 4) return DEFAULT_STRIPS;

  return incoming.map((item, index) => {
    const fallback = DEFAULT_STRIPS[index];
    const parsedSpeed = Number(item?.speed);
    const speed = Number.isFinite(parsedSpeed) ? parsedSpeed : fallback.speed;
    return {
      key: item?.key || fallback.key,
      href: item?.href || fallback.href,
      title: item?.title || fallback.title,
      desc: item?.desc || fallback.desc,
      image: item?.image || fallback.image,
      speed: Math.max(0, Math.min(1, speed)),
      fit: item?.fit === "contain" ? "contain" : "cover",
      position: typeof item?.position === "string" && item.position.trim() ? item.position.trim() : "center",
    };
  });
}

function renderStrips(strips) {
  const list = document.getElementById("home-strip-list");
  if (!list) return [];

  list.replaceChildren();

  const nodes = strips.map((item, index) => {
    const card = document.createElement("a");
    card.className = "home-strip";
    card.href = item.href;

    const bg = document.createElement("div");
    bg.className = "home-strip-bg";
    bg.style.backgroundImage = `url("${item.image}")`;
    bg.dataset.speed = String(item.speed);
    bg.style.setProperty("--strip-fit", item.fit);
    bg.style.setProperty("--strip-position", item.position);

    const shade = document.createElement("div");
    shade.className = "home-strip-shade";

    const content = document.createElement("div");
    content.className = "home-strip-content";

    const no = document.createElement("span");
    no.className = "home-strip-no";
    no.textContent = `0${index + 1}`;

    const title = document.createElement("h2");
    title.textContent = item.title;

    const desc = document.createElement("p");
    desc.textContent = item.desc;

    content.append(no, title, desc);
    card.append(bg, shade, content);
    list.appendChild(card);

    return { card, bg };
  });

  return nodes;
}

function setupScrollParallax(pairs) {
  if (!pairs.length) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionFactor = prefersReducedMotion ? 0.75 : 1;

  const update = () => {
    const viewportHeight = window.innerHeight;

    pairs.forEach(({ card, bg }) => {
      const rect = card.getBoundingClientRect();
      const speed = Math.max(0, Math.min(1, Number(bg.dataset.speed || 0.12)));
      // progress: 0 = card just below viewport, 1 = card just above viewport
      const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      const centered = (progress - 0.5) * 2;
      // Card-based parallax: intentionally stronger so motion is clearly visible.
      const maxShift = Math.min(180, rect.height * 0.85) * motionFactor;
      const moveY = centered * speed * maxShift;
      bg.style.transform = `translate3d(0, ${moveY}px, 0) scale(1.12)`;
    });
  };

  let ticking = false;
  const schedule = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

function setupHomeTitleRole(config) {
  const role = document.getElementById("home-title-role");
  if (!role) return;
  const titleLine = role.closest(".home-title-line");
  const roleHit =
    role.parentElement && role.parentElement.classList.contains("home-title-role-hit")
      ? role.parentElement
      : (() => {
          const hit = document.createElement("span");
          hit.className = "home-title-role-hit";
          hit.setAttribute("role", "button");
          hit.setAttribute("aria-label", role.alt || "主页小人互动");
          hit.tabIndex = 0;
          role.parentNode?.insertBefore(hit, role);
          hit.appendChild(role);
          return hit;
        })();

  const toy = config?.homeToy || {};
  const stand = toy.stand || "./assets/toy-stand.svg";
  const transition = toy.transition || stand;
  const raise = toy.raise || transition;
  const frameMs = Math.max(80, Number(toy.frameMs) || 180);
  const shakeMs = Math.max(80, Number(toy.shakeMs) || 220);
  const roleScale = Number(toy.roleScale);
  const resolvedRoleScale = Number.isFinite(roleScale) && roleScale > 0 ? roleScale : 1;
  const roleXPercent = Number(toy.roleXPercent);
  const roleYPercent = Number(toy.roleYPercent);
  const resolvedRoleX = Number.isFinite(roleXPercent) ? roleXPercent : 0;
  const resolvedRoleY = Number.isFinite(roleYPercent) ? roleYPercent : 0;
  const rawTitleGap = toy.titleGap ?? toy.roleTitleGap;

  const resolveTitleGap = (value) => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return `${value}px`;
    }
    if (typeof value !== "string") return "";
    const text = value.trim();
    if (!text) return "";
    if (/^\d+(\.\d+)?(px|rem|em|vw|vh|%)$/i.test(text)) return text;
    if (/^(clamp|calc|min|max)\(.+\)$/i.test(text)) return text;
    return "";
  };
  const resolvedTitleGap = resolveTitleGap(rawTitleGap);

  role.src = stand;
  role.style.setProperty("--toy-shake-ms", `${shakeMs}ms`);
  role.style.setProperty("--home-role-scale", String(resolvedRoleScale));
  role.style.setProperty("--home-role-offset-x", `${resolvedRoleX}%`);
  role.style.setProperty("--home-role-offset-y", `${resolvedRoleY}%`);
  if (titleLine && resolvedTitleGap) {
    titleLine.style.setProperty("--home-title-gap", resolvedTitleGap);
  }

  const syncTitleSafeGap = () => {
    if (!titleLine) return;
    if (resolvedRoleY <= 0) {
      titleLine.style.setProperty("--home-title-safe-gap", "0px");
      return;
    }
    const roleHeight = role.getBoundingClientRect().height || role.offsetHeight || 0;
    const yShift = (roleHeight * resolvedRoleY) / 100;
    const safeGap = Math.min(240, Math.max(0, yShift));
    titleLine.style.setProperty("--home-title-safe-gap", `${safeGap.toFixed(1)}px`);
  };

  syncTitleSafeGap();
  role.addEventListener("load", syncTitleSafeGap);
  window.addEventListener("resize", syncTitleSafeGap);

  role.draggable = false;
  role.setAttribute("draggable", "false");

  let holding = false;
  let pressTimer = 0;
  let releaseTimer = 0;
  let capturedPointerId = null;

  const clearTimers = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      pressTimer = 0;
    }
    if (releaseTimer) {
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
    }
  };

  const setState = (state) => {
    if (state === "raise") {
      role.src = raise;
      role.classList.add("raised");
      return;
    }
    role.classList.remove("raised");
    role.src = state === "transition" ? transition : stand;
  };

  const startHold = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();

    holding = true;
    clearTimers();
    setState("transition");

    if (event.pointerId !== undefined && roleHit.setPointerCapture) {
      try {
        roleHit.setPointerCapture(event.pointerId);
        capturedPointerId = event.pointerId;
      } catch (_) {
        capturedPointerId = null;
      }
    }

    pressTimer = window.setTimeout(() => {
      if (holding) {
        setState("raise");
      }
    }, frameMs);
  };

  const endHold = () => {
    if (!holding) return;
    holding = false;
    clearTimers();
    setState("transition");

    releaseTimer = window.setTimeout(() => {
      if (!holding) {
        setState("stand");
      }
    }, frameMs);

    if (capturedPointerId !== null && roleHit.releasePointerCapture) {
      try {
        roleHit.releasePointerCapture(capturedPointerId);
      } catch (_) {
        // Ignore release errors when pointer capture is already lost.
      }
    }
    capturedPointerId = null;
  };

  roleHit.addEventListener("pointerdown", startHold);
  roleHit.addEventListener("pointerup", endHold);
  roleHit.addEventListener("pointercancel", endHold);
  roleHit.addEventListener("lostpointercapture", endHold);
  window.addEventListener("pointerup", endHold);
  roleHit.addEventListener("dragstart", (event) => event.preventDefault());
  roleHit.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applySiteText(config);
  markActiveNav();

  const strips = normalizeStrips(config);
  const pairs = renderStrips(strips);
  setupScrollParallax(pairs);
  setupHomeTitleRole(config);

  if (config.title) {
    document.title = config.title;
  }
}

init();
