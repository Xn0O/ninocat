(function () {
  const SITE_CONFIG_PATH = "./data/site.json";
  const THEME_KEY = "vb_theme";

  let siteConfigPromise = null;

  function normalizeCssSize(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return `${value}px`;
    }

    if (typeof value !== "string") return fallback;
    const text = value.trim();
    if (!text) return fallback;

    if (/^\d+(\.\d+)?(px|rem|em|vw|vh|%)$/i.test(text)) return text;
    if (/^(clamp|calc|min|max)\(.+\)$/i.test(text)) return text;
    return fallback;
  }

  function applyBrandConfig(config) {
    const root = document.documentElement.style;
    const brand = config?.brand && typeof config.brand === "object" ? config.brand : {};

    const fromFlat = typeof config?.brandIcon === "string" ? config.brandIcon.trim() : "";
    const fromNested = typeof brand.icon === "string" ? brand.icon.trim() : "";
    const iconPath = fromFlat || fromNested;
    if (iconPath) {
      const safePath = iconPath.replaceAll('"', '\\"');
      root.setProperty("--brand-icon-url", `url("${safePath}")`);
    }

    const textSize = normalizeCssSize(brand.textSize ?? config?.brandTextSize, "1.08rem");
    const logoSize = normalizeCssSize(
      brand.logoSize ?? brand.iconSize ?? config?.brandLogoSize ?? config?.brandIconSize,
      "22px"
    );
    const brandGap = normalizeCssSize(brand.gap ?? config?.brandGap, "8px");

    root.setProperty("--brand-text-size", textSize);
    root.setProperty("--brand-icon-size", logoSize);
    root.setProperty("--brand-gap", brandGap);
  }

  async function loadSiteConfig() {
    if (!siteConfigPromise) {
      siteConfigPromise = fetch(SITE_CONFIG_PATH, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`加载站点配置失败: ${res.status}`);
          }
          return res.json();
        })
        .catch(() => ({
          title: "nino",
          brandIcon: "./assets/Home_Toy/M_0.png",
          brand: {
            icon: "./assets/Home_Toy/M_0.png",
            textSize: "1.08rem",
            logoSize: "22px",
            gap: "8px",
          },
          eyebrow: "涂鸦 / 实验",
          subtitle: "博客 / 游戏 / 美术 / 关于",
          defaultTheme: "dark",
          themes: {
            light: {
              bg: "#f2f2f2",
              surface: "#ffffff",
              surfaceAlt: "#e6e6e6",
              text: "#111111",
              muted: "#555555",
              accent: "#000000",
            },
            dark: {
              bg: "#0d0d0d",
              surface: "#1c1c1c",
              surfaceAlt: "#2a2a2a",
              text: "#f5f5f5",
              muted: "#b3b3b3",
              accent: "#ffffff",
            },
          },
          headerImages: {
            default: "./assets/hero-home.svg",
          },
        }))
        .then((config) => {
          applyBrandConfig(config);
          return config;
        });
    }
    return siteConfigPromise;
  }

  function setThemeVariables(themeName, values) {
    const root = document.documentElement.style;
    root.setProperty(`--${themeName}-bg`, values.bg);
    root.setProperty(`--${themeName}-surface`, values.surface);
    root.setProperty(`--${themeName}-surface-alt`, values.surfaceAlt);
    root.setProperty(`--${themeName}-text`, values.text);
    root.setProperty(`--${themeName}-muted`, values.muted);
    root.setProperty(`--${themeName}-accent`, values.accent);
    root.setProperty(
      `--${themeName}-surface-alt-ink`,
      values.surfaceAltText || pickReadableTextColor(values.surfaceAlt, values.text)
    );
    root.setProperty(`--${themeName}-accent-ink`, values.accentText || pickReadableTextColor(values.accent, values.bg));
  }

  function parseColorToRgb(value) {
    if (typeof value !== "string") return null;
    const color = value.trim();

    const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const raw = hex[1];
      if (raw.length === 3) {
        return {
          r: parseInt(raw[0] + raw[0], 16),
          g: parseInt(raw[1] + raw[1], 16),
          b: parseInt(raw[2] + raw[2], 16),
        };
      }
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
      };
    }

    const rgb = color.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgb) return null;
    const parts = rgb[1].split(",").map((part) => part.trim());
    if (parts.length < 3) return null;

    const toChannel = (input) => {
      if (input.endsWith("%")) {
        const pct = Number(input.slice(0, -1));
        if (!Number.isFinite(pct)) return null;
        return Math.round((Math.max(0, Math.min(100, pct)) / 100) * 255);
      }
      const n = Number(input);
      if (!Number.isFinite(n)) return null;
      return Math.round(Math.max(0, Math.min(255, n)));
    };

    const r = toChannel(parts[0]);
    const g = toChannel(parts[1]);
    const b = toChannel(parts[2]);
    if (r === null || g === null || b === null) return null;
    return { r, g, b };
  }

  function relativeLuminance({ r, g, b }) {
    const toLinear = (channel) => {
      const v = channel / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  function pickReadableTextColor(backgroundColor, fallback) {
    const rgb = parseColorToRgb(backgroundColor);
    if (!rgb) return fallback || "#111111";

    const luminance = relativeLuminance(rgb);
    const contrastWithDark = (luminance + 0.05) / 0.05;
    const contrastWithLight = 1.05 / (luminance + 0.05);
    return contrastWithDark >= contrastWithLight ? "#111111" : "#f5f5f5";
  }

  function applyThemeConfig(config) {
    const light = config?.themes?.light;
    const dark = config?.themes?.dark;
    if (light) setThemeVariables("light", light);
    if (dark) setThemeVariables("dark", dark);
  }

  function setTheme(theme) {
    document.body.dataset.theme = theme === "light" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, document.body.dataset.theme);
    } catch (error) {
      console.warn("无法存储主题偏好。", error);
    }
  }

  function getTheme() {
    return document.body.dataset.theme === "light" ? "light" : "dark";
  }

  function initTheme(config) {
    let selected = config?.defaultTheme === "light" ? "light" : "dark";
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "light" || saved === "dark") {
        selected = saved;
      }
    } catch (error) {
      console.warn("无法读取主题偏好。", error);
    }
    setTheme(selected);
  }

  function setupThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    const syncLabel = () => {
      const current = getTheme();
      btn.textContent = current === "dark" ? "切换浅色" : "切换深色";
      btn.setAttribute("aria-label", current === "dark" ? "切换到浅色主题" : "切换到深色主题");
    };

    btn.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
      syncLabel();
    });

    syncLabel();
  }

  function applyHeaderImage(config) {
    const heroImage = document.querySelector("[data-hero-image]");
    if (!heroImage) return;

    const page = document.body.dataset.page || "default";
    const fallback = { src: "./assets/hero-home.svg", fit: "cover", position: "center", ratio: "21 / 8" };

    const parseHeaderEntry = (entry) => {
      if (!entry) return null;
      if (typeof entry === "string") {
        return { src: entry };
      }
      if (typeof entry !== "object") return null;

      const resolved = {
        src: entry.src || entry.url || "",
        fit: entry.fit,
        position: entry.position,
        ratio: entry.ratio,
      };
      return resolved;
    };

    const sanitizeFit = (value) => (value === "contain" ? "contain" : "cover");
    const sanitizePosition = (value) => (typeof value === "string" && value.trim() ? value.trim() : "center");
    const sanitizeRatio = (value) => {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return String(value);
      }
      if (typeof value !== "string") return "21 / 8";
      const ratioText = value.trim();
      if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(ratioText)) return ratioText;
      if (/^\d+(\.\d+)?$/.test(ratioText)) return ratioText;
      return "21 / 8";
    };

    const pageEntry = parseHeaderEntry(config?.headerImages?.[page]);
    const defaultEntry = parseHeaderEntry(config?.headerImages?.default);
    const merged = {
      ...fallback,
      ...(defaultEntry || {}),
      ...(pageEntry || {}),
    };

    heroImage.src = merged.src || fallback.src;
    heroImage.style.setProperty("--hero-fit", sanitizeFit(merged.fit));
    heroImage.style.setProperty("--hero-position", sanitizePosition(merged.position));
    heroImage.style.setProperty("--hero-ratio", sanitizeRatio(merged.ratio));
  }

  function applySiteText(config) {
    if (config.title) {
      document.querySelectorAll("[data-site='title']").forEach((el) => {
        el.textContent = config.title;
      });
    }
    if (config.eyebrow) {
      document.querySelectorAll("[data-site='eyebrow']").forEach((el) => {
        el.textContent = config.eyebrow;
      });
    }
    if (config.subtitle) {
      document.querySelectorAll("[data-site='subtitle']").forEach((el) => {
        el.textContent = config.subtitle;
      });
    }
  }

  function markActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    const nav = document.querySelector(`[data-nav='${page}']`);
    if (nav) nav.classList.add("active");
  }

  function escapeHtml(input) {
    return input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function parseFrontMatter(markdown) {
    const trimmed = markdown.replace(/^\uFEFF/, "");
    if (!trimmed.startsWith("---\n")) {
      return { meta: {}, body: trimmed };
    }

    const end = trimmed.indexOf("\n---", 4);
    if (end < 0) {
      return { meta: {}, body: trimmed };
    }

    const header = trimmed.slice(4, end).trim();
    const body = trimmed.slice(end + 4).trimStart();
    const meta = {};

    header.split(/\r?\n/).forEach((line) => {
      const sep = line.indexOf(":");
      if (sep < 0) return;
      const key = line.slice(0, sep).trim();
      const value = line.slice(sep + 1).trim();
      meta[key] = value;
    });

    return { meta, body };
  }

  function inlineMarkdown(raw) {
    return raw
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  }

  function markdownToHtml(markdownText) {
    const text = markdownText.replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const out = [];
    let inCode = false;
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
    };

    for (const line of lines) {
      const safe = escapeHtml(line);

      if (safe.startsWith("```")) {
        closeLists();
        if (!inCode) {
          out.push("<pre><code>");
          inCode = true;
        } else {
          out.push("</code></pre>");
          inCode = false;
        }
        continue;
      }

      if (inCode) {
        out.push(`${safe}\n`);
        continue;
      }

      if (safe.trim() === "") {
        closeLists();
        continue;
      }

      if (/^#{1,4}\s/.test(safe)) {
        closeLists();
        const m = safe.match(/^(#{1,4})\s(.+)$/);
        if (m) {
          const level = m[1].length;
          out.push(`<h${level}>${inlineMarkdown(m[2])}</h${level}>`);
        }
        continue;
      }

      if (/^>\s?/.test(safe)) {
        closeLists();
        out.push(`<blockquote>${inlineMarkdown(safe.replace(/^>\s?/, ""))}</blockquote>`);
        continue;
      }

      if (/^\d+\.\s+/.test(safe)) {
        if (!inOl) {
          closeLists();
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${inlineMarkdown(safe.replace(/^\d+\.\s+/, ""))}</li>`);
        continue;
      }

      if (/^[-*]\s+/.test(safe)) {
        if (!inUl) {
          closeLists();
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${inlineMarkdown(safe.replace(/^[-*]\s+/, ""))}</li>`);
        continue;
      }

      closeLists();
      out.push(`<p>${inlineMarkdown(safe)}</p>`);
    }

    if (inCode) out.push("</code></pre>");
    closeLists();
    return out.join("\n");
  }

  function tagsFromText(value) {
    if (!value) return [];
    return value
      .split(/[|,;/]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  function createEmptyTip(text) {
    const node = document.createElement("div");
    node.className = "empty-tip";
    node.textContent = text;
    return node;
  }

  window.SiteCommon = {
    loadSiteConfig,
    applyThemeConfig,
    initTheme,
    setupThemeToggle,
    applyHeaderImage,
    applySiteText,
    markActiveNav,
    parseFrontMatter,
    markdownToHtml,
    tagsFromText,
    createEmptyTip,
    applyBrandConfig,
    setTheme,
    getTheme,
  };
})();
