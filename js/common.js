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

  function normalizeCssNumberOrPercent(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return String(value);
    }
    if (typeof value !== "string") return fallback;
    const text = value.trim();
    if (!text) return fallback;
    if (/^\d+(\.\d+)?%?$/.test(text)) return text;
    return fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rgbaFromColor(color, alpha, fallback) {
    const rgb = parseColorToRgb(color);
    if (!rgb) return fallback;
    const a = clamp(Number(alpha), 0, 1);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a.toFixed(3)})`;
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

  function normalizeNavItems(config) {
    const fallback = [
      { key: "blog", label: "Blog", href: "./blog.html" },
      { key: "game", label: "Game", href: "./game.html" },
      { key: "art", label: "Art", href: "./art.html" },
      { key: "about", label: "About", href: "./about.html" },
    ];

    const flatItems = Array.isArray(config?.navItems) ? config.navItems : [];
    const nestedItems = Array.isArray(config?.nav?.items) ? config.nav.items : [];
    const source = flatItems.length ? flatItems : nestedItems;
    if (!source.length) return fallback;

    const normalized = source
      .map((item) => {
        const key = typeof item?.key === "string" ? item.key.trim() : "";
        const label = typeof item?.label === "string" ? item.label.trim() : "";
        const href = typeof item?.href === "string" ? item.href.trim() : "";
        if (!label || !href) return null;
        return {
          key,
          label,
          href,
        };
      })
      .filter(Boolean);

    return normalized.length ? normalized : fallback;
  }

  function applyNavConfig(config) {
    const navRoot = document.querySelector(".top-nav nav");
    if (!navRoot) return;

    const items = normalizeNavItems(config);
    navRoot.replaceChildren();

    items.forEach((item) => {
      const anchor = document.createElement("a");
      anchor.href = item.href;
      anchor.textContent = item.label;
      if (item.key) {
        anchor.dataset.nav = item.key;
      }
      navRoot.appendChild(anchor);
    });
  }

  function applyNavGlassConfig(config) {
    const root = document.documentElement.style;
    const nestedNav = config?.nav && typeof config.nav === "object" ? config.nav : {};
    const nestedGlass = nestedNav?.glass && typeof nestedNav.glass === "object" ? nestedNav.glass : {};
    const flatGlass = config?.navGlass && typeof config.navGlass === "object" ? config.navGlass : {};
    const glass = Object.keys(flatGlass).length ? flatGlass : nestedGlass;
    const quick = config?.navGlassQuick && typeof config.navGlassQuick === "object" ? config.navGlassQuick : {};

    const setColorVar = (name, value) => {
      if (typeof value !== "string") return;
      const text = value.trim();
      if (!text) return;
      root.setProperty(name, text);
    };

    // Quick mode: user adjusts only 4 knobs in site.json, detailed values are auto-derived.
    if (Object.keys(quick).length) {
      const quickColor = typeof quick.color === "string" ? quick.color.trim() : "#ffffff";
      const rawOpacity = Number(quick.opacity);
      const opacity = Number.isFinite(rawOpacity) ? clamp(rawOpacity, 0, 1) : 0.1;

      setColorVar("--nav-glass-base", rgbaFromColor(quickColor, opacity, "rgba(255, 255, 255, 0.1)"));
      setColorVar(
        "--nav-glass-tint",
        rgbaFromColor(quickColor, clamp(opacity * 0.42, 0.08, 0.45), "rgba(255, 255, 255, 0.08)")
      );
      setColorVar(
        "--nav-glass-glow",
        rgbaFromColor(quickColor, clamp(opacity * 0.9, 0.22, 0.9), "rgba(255, 255, 255, 0.22)")
      );
      setColorVar("--nav-glass-border", `rgba(255, 255, 255, ${clamp(opacity * 0.58, 0.18, 0.5).toFixed(3)})`);
      setColorVar("--nav-ink", "#ffffff");
      setColorVar("--nav-muted-ink", `rgba(255, 255, 255, ${clamp(opacity * 0.9, 0.7, 0.95).toFixed(3)})`);
      setColorVar("--nav-pill-bg", `rgba(255, 255, 255, ${clamp(opacity * 0.2, 0.08, 0.2).toFixed(3)})`);
      setColorVar("--nav-pill-active-bg", "#ffffff");
      setColorVar("--nav-pill-active-ink", rgbaFromColor(quickColor, 1, "#ffffff"));
      root.setProperty("--nav-blur", normalizeCssSize(quick.blur, "16px"));
      root.setProperty("--nav-saturate", normalizeCssNumberOrPercent(quick.saturate, "100%"));
    }

    setColorVar("--nav-glass-base", glass.base ?? config?.navGlassBase);
    setColorVar("--nav-glass-tint", glass.tint ?? config?.navGlassTint);
    setColorVar("--nav-glass-glow", glass.glow ?? config?.navGlassGlow);
    setColorVar("--nav-glass-border", glass.border ?? config?.navGlassBorder);
    setColorVar("--nav-ink", glass.ink ?? config?.navInk);
    setColorVar("--nav-muted-ink", glass.mutedInk ?? config?.navMutedInk);
    setColorVar("--nav-pill-bg", glass.pill ?? glass.pillBg ?? config?.navPillBg);
    setColorVar("--nav-pill-active-bg", glass.pillActive ?? config?.navPillActiveBg);
    setColorVar("--nav-pill-active-ink", glass.pillActiveInk ?? config?.navPillActiveInk);

    root.setProperty("--nav-blur", normalizeCssSize(glass.blur ?? config?.navBlur, "16px"));
    root.setProperty(
      "--nav-saturate",
      normalizeCssNumberOrPercent(glass.saturate ?? config?.navSaturate, "180%")
    );
  }

  function setupBackToTop() {
    if (document.getElementById("back-to-top-btn")) return;

    const btn = document.createElement("button");
    btn.id = "back-to-top-btn";
    btn.className = "back-to-top";
    btn.type = "button";
    btn.textContent = "";
    btn.setAttribute("aria-label", "返回页面顶部");
    document.body.appendChild(btn);

    const updateVisibility = () => {
      if (window.scrollY > 260) {
        btn.classList.add("visible");
      } else {
        btn.classList.remove("visible");
      }
    };

    btn.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
  }

  async function loadSiteConfig() {
    if (!siteConfigPromise) {
      siteConfigPromise = fetch(SITE_CONFIG_PATH, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`加载站点配置失败: ${res.status}`);
          }
          return res.text().then((text) => JSON.parse(text.replace(/^\uFEFF/, "")));
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
          navItems: [
            { key: "blog", label: "Blog", href: "./blog.html" },
            { key: "game", label: "Game", href: "./game.html" },
            { key: "art", label: "Art", href: "./art.html" },
            { key: "about", label: "About", href: "./about.html" },
          ],
          navGlass: {
            base: "rgba(132, 0, 255, 0.78)",
            tint: "rgba(242, 185, 255, 0.36)",
            glow: "rgba(104, 0, 255, 0.7)",
            border: "rgba(255, 255, 255, 0.45)",
            ink: "#ffffff",
            mutedInk: "rgba(255, 255, 255, 0.9)",
            pill: "rgba(255, 255, 255, 0.14)",
            pillActive: "#ffffff",
            pillActiveInk: "#5900b8",
            blur: "16px",
            saturate: "180%",
          },
          navGlassQuick: {
            color: "#ffffff",
            opacity: 0.1,
            blur: "16px",
            saturate: "100%",
          },
          eyebrow: "eyebrow",
          subtitle: "subtitle",
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
          applyNavGlassConfig(config);
          applyNavConfig(config);
          setupBackToTop();
          applyPageHeroText(config);
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
      btn.textContent = "";
      btn.setAttribute("aria-label", current === "dark" ? "切换到浅色主题" : "切换到深色主题");
      btn.title = current === "dark" ? "切换到浅色主题" : "切换到深色主题";
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

  function applyPageHeroText(config) {
    const page = document.body?.dataset?.page;
    if (!page) return;

    const flatTexts = config?.pageHeroTexts && typeof config.pageHeroTexts === "object" ? config.pageHeroTexts : {};
    const nestedTexts =
      config?.pages?.heroTexts && typeof config.pages.heroTexts === "object" ? config.pages.heroTexts : {};
    const texts = Object.keys(flatTexts).length ? flatTexts : nestedTexts;
    const pageText = texts?.[page];
    if (!pageText || typeof pageText !== "object") return;

    const setHeroText = (slot, value) => {
      if (typeof value !== "string") return;
      const text = value.trim();
      if (!text) return;
      document.querySelectorAll(`[data-page-hero="${slot}"]`).forEach((el) => {
        el.textContent = text;
      });
    };

    setHeroText("eyebrow", pageText.eyebrow);
    setHeroText("title", pageText.title);
    setHeroText("description", pageText.description ?? pageText.desc);
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
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />')
      .replace(/&lt;(https?:\/\/[^<>\s]+)&gt;/g, '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>')
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  }

  function normalizeCodeLang(raw) {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return "plain";
    if (text === "c#" || text === "cs" || text === "csharp") return "csharp";
    if (text === "c++" || text === "cpp" || text === "cc" || text === "cxx") return "cpp";
    if (text === "py" || text === "python") return "python";
    if (text === "htm" || text === "html" || text === "xml") return "html";
    if (text === "hlsl") return "hlsl";
    return text;
  }

  function escapeRegExp(input) {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightCode(code, lang) {
    const normalizedLang = normalizeCodeLang(lang);
    const protectedHtml = new Map();
    let tokenCounter = 0;
    let text = escapeHtml(code);

    const tokenKey = () => {
      const n = tokenCounter++;
      let x = n;
      let letters = "";
      do {
        letters = String.fromCharCode(65 + (x % 26)) + letters;
        x = Math.floor(x / 26) - 1;
      } while (x >= 0);
      return `\uE000${letters}\uE001`;
    };

    const protect = (pattern, cssToken) => {
      text = text.replace(pattern, (m) => {
        const key = tokenKey();
        protectedHtml.set(key, `<span class="tok-${cssToken}">${m}</span>`);
        return key;
      });
    };

    const highlightKeywords = (keywords) => {
      if (!keywords.length) return;
      const re = new RegExp(`\\b(${keywords.map(escapeRegExp).join("|")})\\b`, "g");
      text = text.replace(re, '<span class="tok-kw">$1</span>');
    };

    if (normalizedLang === "csharp") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "str");
      highlightKeywords([
        "public",
        "private",
        "protected",
        "internal",
        "class",
        "struct",
        "enum",
        "interface",
        "namespace",
        "using",
        "void",
        "int",
        "float",
        "double",
        "decimal",
        "string",
        "bool",
        "var",
        "new",
        "return",
        "if",
        "else",
        "switch",
        "case",
        "for",
        "foreach",
        "while",
        "do",
        "break",
        "continue",
        "null",
        "true",
        "false",
        "static",
        "readonly",
        "const",
        "this",
        "base",
      ]);
    } else if (normalizedLang === "cpp") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "str");
      highlightKeywords([
        "int",
        "float",
        "double",
        "char",
        "bool",
        "void",
        "class",
        "struct",
        "enum",
        "namespace",
        "template",
        "typename",
        "auto",
        "const",
        "constexpr",
        "static",
        "public",
        "private",
        "protected",
        "virtual",
        "override",
        "new",
        "delete",
        "return",
        "if",
        "else",
        "switch",
        "case",
        "for",
        "while",
        "do",
        "break",
        "continue",
        "nullptr",
        "true",
        "false",
      ]);
    } else if (normalizedLang === "hlsl") {
      protect(/\/\*[\s\S]*?\*\//g, "comment");
      protect(/\/\/[^\n]*/g, "comment");
      protect(/"(?:\\.|[^"\\])*"/g, "str");
      highlightKeywords([
        "float",
        "float2",
        "float3",
        "float4",
        "float3x3",
        "float4x4",
        "half",
        "int",
        "uint",
        "bool",
        "Texture2D",
        "SamplerState",
        "cbuffer",
        "struct",
        "return",
        "if",
        "else",
        "for",
        "while",
        "static",
        "const",
        "true",
        "false",
      ]);
    } else if (normalizedLang === "python") {
      protect(/#([^\n]*)/g, "comment");
      protect(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, "str");
      highlightKeywords([
        "def",
        "class",
        "import",
        "from",
        "as",
        "if",
        "elif",
        "else",
        "for",
        "while",
        "try",
        "except",
        "finally",
        "with",
        "return",
        "yield",
        "lambda",
        "pass",
        "break",
        "continue",
        "True",
        "False",
        "None",
      ]);
    } else if (normalizedLang === "html") {
      protect(/&lt;!--[\s\S]*?--&gt;/g, "comment");
      text = text.replace(/(&lt;\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?&gt;)/g, (_m, p1, name, attrs, p4) => {
        const highlightedAttrs = attrs
          .replace(/([a-zA-Z_:][\w:.-]*)(=)/g, '<span class="tok-attr">$1</span>$2')
          .replace(/(&quot;[^&]*?&quot;|'[^']*?')/g, '<span class="tok-str">$1</span>');
        return `${p1}<span class="tok-tag">${name}</span>${highlightedAttrs}${p4}`;
      });
    }

    for (const [key, value] of protectedHtml.entries()) {
      text = text.split(key).join(value);
    }

    return text;
  }

  function markdownToHtml(markdownText) {
    const text = String(markdownText || "").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const out = [];
    let inCode = false;
    let codeLang = "plain";
    let codeBuffer = [];
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

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const safe = escapeHtml(line);
      const fenceMatch = line.match(/^```(.*)$/);

      if (fenceMatch) {
        closeLists();
        if (!inCode) {
          inCode = true;
          codeLang = normalizeCodeLang(fenceMatch[1]);
          codeBuffer = [];
        } else {
          const highlighted = highlightCode(codeBuffer.join("\n"), codeLang);
          out.push(`<pre class="code-block" data-lang="${codeLang}"><code class="language-${codeLang}">${highlighted}</code></pre>`);
          inCode = false;
          codeLang = "plain";
          codeBuffer = [];
        }
        continue;
      }

      if (inCode) {
        codeBuffer.push(line);
        continue;
      }

      if (line.trim() === "") {
        closeLists();
        continue;
      }

      if (/^(\s*)([-*_])(?:\s*\2){2,}\s*$/.test(line)) {
        closeLists();
        out.push("<hr />");
        continue;
      }

      if (/^#{1,4}\s/.test(line)) {
        closeLists();
        const m = safe.match(/^(#{1,4})\s(.+)$/);
        if (m) {
          const level = m[1].length;
          out.push(`<h${level}>${inlineMarkdown(m[2])}</h${level}>`);
        }
        continue;
      }

      if (/^>\s?/.test(line)) {
        closeLists();
        const quoteLines = [];
        while (i < lines.length) {
          const current = lines[i];
          if (/^>\s?/.test(current)) {
            quoteLines.push(current.replace(/^>\s?/, ""));
            i += 1;
            continue;
          }
          if (current.trim() === "" && /^>\s?/.test(lines[i + 1] || "")) {
            quoteLines.push("");
            i += 1;
            continue;
          }
          break;
        }
        i -= 1;
        out.push(`<blockquote>${markdownToHtml(quoteLines.join("\n"))}</blockquote>`);
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        if (!inOl) {
          closeLists();
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${inlineMarkdown(safe.replace(/^\d+\.\s+/, ""))}</li>`);
        continue;
      }

      if (/^[-*]\s+/.test(line)) {
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

    if (inCode) {
      const highlighted = highlightCode(codeBuffer.join("\n"), codeLang);
      out.push(`<pre class="code-block" data-lang="${codeLang}"><code class="language-${codeLang}">${highlighted}</code></pre>`);
    }
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

  function isHiddenMeta(value) {
    const n = Number.parseInt(String(value || "0").trim(), 10);
    return Number.isFinite(n) && n === 1;
  }

  function parseMiMeta(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const parts = text.split("|");
    const question = String(parts[0] || "").trim();
    const id = String(parts[1] || "").trim();
    if (!question || !id) return null;
    return { question, id, raw: `${question}|${id}` };
  }

  function createEmptyTip(text) {
    const node = document.createElement("div");
    node.className = "empty-tip";
    node.textContent = text;
    return node;
  }

  function enhanceCodeBlocks(root = document) {
    if (!root || typeof root.querySelectorAll !== "function") return;

    root.querySelectorAll("pre.code-block").forEach((pre) => {
      if (pre.querySelector(".code-copy-btn")) return;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "code-copy-btn";
      copyBtn.textContent = "复制";
      copyBtn.setAttribute("aria-label", "复制代码");

      let resetTimer = 0;
      copyBtn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        const text = code ? code.textContent || "" : "";
        if (!text) return;

        try {
          await navigator.clipboard.writeText(text);
          copyBtn.textContent = "已复制";
        } catch (error) {
          copyBtn.textContent = "复制失败";
        }

        if (resetTimer) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => {
          copyBtn.textContent = "复制";
        }, 1400);
      });

      pre.insertBefore(copyBtn, pre.firstChild);
    });
  }

  window.SiteCommon = {
    loadSiteConfig,
    applyThemeConfig,
    initTheme,
    setupThemeToggle,
    applyHeaderImage,
    applyPageHeroText,
    applyNavGlassConfig,
    applyNavConfig,
    setupBackToTop,
    applySiteText,
    markActiveNav,
    parseFrontMatter,
    markdownToHtml,
    enhanceCodeBlocks,
    tagsFromText,
    isHiddenMeta,
    parseMiMeta,
    createEmptyTip,
    applyBrandConfig,
    setTheme,
    getTheme,
  };
})();
