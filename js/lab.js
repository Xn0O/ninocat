const { loadSiteConfig, applyThemeConfig, initTheme, setupThemeToggle, applySiteText, markActiveNav, createEmptyTip } =
  window.SiteCommon;

const content = document.getElementById("lab-content");

const ASSET = {
  window: "./assets/Lab/Window.png",
  drawBase: "./assets/Lab/DrawBox.png",
  drawTop: "./assets/Lab/DrawBox_Top.png",
  pen: "./assets/Lab/Pen.png",
  eraser: "./assets/Lab/Eraser.png",
  bucket: "./assets/Lab/Paintbucket.png",
  colorBase: "./assets/Lab/ColorSelct.png",
  colorTop: "./assets/Lab/ColorSelct_Top.png",
};

const WINDOW_W = 1170;
const WINDOW_H = 1394;

const LAYOUT = {
  draw: { x: 264, y: 170, w: 860, h: 1054 },
  tools: { x: 84, y: 252, w: 108, h: 104, gap: 16 },
  color: { x: 78, y: 996, w: 122, h: 123 },
};

const TOOL = {
  pen: "pen",
  eraser: "eraser",
  bucket: "bucket",
};

const state = {
  tool: TOOL.pen,
  color: "#000000",
  drawing: false,
  widgetDrag: {
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    x: 0,
    y: 0,
  },
};

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

function resolveLabWindowWidth(config) {
  const painter = config?.labPainter && typeof config.labPainter === "object" ? config.labPainter : {};
  const lab = config?.lab && typeof config.lab === "object" ? config.lab : {};
  const value = painter.windowWidth ?? lab.windowWidth ?? config?.labWindowWidth;
  return normalizeCssSize(value, "1170px");
}

function toPercent(value, full) {
  return `${(value / full) * 100}%`;
}

function applyBox(el, box) {
  el.style.left = toPercent(box.x, WINDOW_W);
  el.style.top = toPercent(box.y, WINDOW_H);
  el.style.width = toPercent(box.w, WINDOW_W);
  el.style.height = toPercent(box.h, WINDOW_H);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(
    d.getSeconds()
  )}`;
}

function parseHexColor(hex) {
  const text = String(hex || "").trim();
  const m = text.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const value = m[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: 255,
  };
}

function rgbaToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function isSameColor(data, idx, color) {
  return (
    data[idx] === color.r &&
    data[idx + 1] === color.g &&
    data[idx + 2] === color.b &&
    data[idx + 3] === color.a
  );
}

function setPixel(data, idx, color) {
  data[idx] = color.r;
  data[idx + 1] = color.g;
  data[idx + 2] = color.b;
  data[idx + 3] = color.a;
}

function floodFill(ctx, sx, sy, hexColor) {
  const fill = parseHexColor(hexColor);
  if (!fill) return;

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;

  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const start = (sy * w + sx) * 4;
  const target = {
    r: data[start],
    g: data[start + 1],
    b: data[start + 2],
    a: data[start + 3],
  };

  if (target.r === fill.r && target.g === fill.g && target.b === fill.b && target.a === fill.a) {
    return;
  }

  const stack = [[sx, sy]];
  while (stack.length) {
    const point = stack.pop();
    const x = point[0];
    const y = point[1];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = (y * w + x) * 4;
    if (!isSameColor(data, idx, target)) continue;
    setPixel(data, idx, fill);

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  ctx.putImageData(image, 0, 0);
}

function setActiveTool(toolButtons, nextTool) {
  state.tool = nextTool;
  Object.entries(toolButtons).forEach(([tool, btn]) => {
    btn.classList.toggle("active", tool === nextTool);
  });
}

function mapPointerToCanvas(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
  const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor(x))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor(y))),
  };
}

function isTouchPointer(event) {
  return String(event?.pointerType || "").toLowerCase() === "touch";
}

function isMousePointer(event) {
  const type = String(event?.pointerType || "").toLowerCase();
  return !type || type === "mouse";
}

function updateWidgetTransform(widget) {
  widget.style.transform = `translate(${state.widgetDrag.x}px, ${state.widgetDrag.y}px)`;
}

function isEdgeDragStart(event, windowEl) {
  if (!isMousePointer(event)) return false;
  if (event.button !== undefined && event.button !== 0) return false;
  const rect = windowEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const edge = 34;
  const onEdge = x < edge || y < edge || x > rect.width - edge || y > rect.height - edge;
  if (!onEdge) return false;
  if (event.target instanceof Element && event.target.closest(".paint-draw-layer, .paint-tools, .paint-color")) return false;
  return true;
}

function isEdgeHover(event, windowEl) {
  if (!isMousePointer(event)) return false;
  const rect = windowEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const edge = 34;
  const onEdge = x < edge || y < edge || x > rect.width - edge || y > rect.height - edge;
  if (!onEdge) return false;
  if (event.target instanceof Element && event.target.closest(".paint-draw-layer, .paint-tools, .paint-color")) return false;
  return true;
}

function bindWindowDrag(widget, windowEl) {
  const syncEdgeCursor = (event) => {
    if (!event || state.widgetDrag.active) return;
    const hit = isEdgeHover(event, windowEl);
    windowEl.classList.toggle("edge-draggable", hit);
  };

  const onDown = (event) => {
    if (!isEdgeDragStart(event, windowEl)) return;
    event.preventDefault();
    state.widgetDrag.active = true;
    windowEl.classList.add("edge-draggable");
    state.widgetDrag.startX = event.clientX;
    state.widgetDrag.startY = event.clientY;
    state.widgetDrag.baseX = state.widgetDrag.x;
    state.widgetDrag.baseY = state.widgetDrag.y;
    if (windowEl.setPointerCapture && event.pointerId !== undefined) {
      try {
        windowEl.setPointerCapture(event.pointerId);
      } catch (_) {}
    }
  };

  const onMove = (event) => {
    if (!state.widgetDrag.active) return;
    const dx = event.clientX - state.widgetDrag.startX;
    const dy = event.clientY - state.widgetDrag.startY;
    state.widgetDrag.x = state.widgetDrag.baseX + dx;
    state.widgetDrag.y = state.widgetDrag.baseY + dy;
    updateWidgetTransform(widget);
  };

  const onUp = (event) => {
    state.widgetDrag.active = false;
    if (event) {
      syncEdgeCursor(event);
    } else {
      windowEl.classList.remove("edge-draggable");
    }
  };

  windowEl.addEventListener("pointerdown", onDown);
  windowEl.addEventListener("pointermove", (event) => {
    syncEdgeCursor(event);
    onMove(event);
  });
  windowEl.addEventListener("pointerup", onUp);
  windowEl.addEventListener("pointercancel", onUp);
  windowEl.addEventListener("lostpointercapture", onUp);
  windowEl.addEventListener("pointerleave", () => {
    if (!state.widgetDrag.active) {
      windowEl.classList.remove("edge-draggable");
    }
  });
}

function makeToolButton(icon, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "paint-tool-btn";
  btn.setAttribute("aria-label", label);
  const img = document.createElement("img");
  img.src = icon;
  img.alt = label;
  img.draggable = false;
  img.setAttribute("draggable", "false");
  btn.appendChild(img);
  return btn;
}

async function init() {
  const config = await loadSiteConfig();
  applyThemeConfig(config);
  initTheme(config);
  setupThemeToggle();
  applySiteText(config);
  markActiveNav();

  if (!content) return;
  content.replaceChildren();

  const widget = document.createElement("section");
  widget.className = "paint-widget";
  widget.style.setProperty("--lab-window-width", resolveLabWindowWidth(config));

  const windowEl = document.createElement("div");
  windowEl.className = "paint-window";

  const windowBase = document.createElement("img");
  windowBase.className = "paint-window-base";
  windowBase.src = ASSET.window;
  windowBase.alt = "Win98 画图窗口";
  windowBase.draggable = false;
  windowBase.setAttribute("draggable", "false");

  const drawLayer = document.createElement("div");
  drawLayer.className = "paint-draw-layer";
  applyBox(drawLayer, LAYOUT.draw);

  const drawBase = document.createElement("img");
  drawBase.className = "paint-draw-base";
  drawBase.src = ASSET.drawBase;
  drawBase.alt = "";
  drawBase.setAttribute("aria-hidden", "true");
  drawBase.draggable = false;
  drawBase.setAttribute("draggable", "false");

  const canvas = document.createElement("canvas");
  canvas.className = "paint-canvas";
  canvas.width = LAYOUT.draw.w;
  canvas.height = LAYOUT.draw.h;
  canvas.setAttribute("aria-label", "绘画区域");

  const drawTop = document.createElement("img");
  drawTop.className = "paint-draw-top";
  drawTop.src = ASSET.drawTop;
  drawTop.alt = "";
  drawTop.setAttribute("aria-hidden", "true");
  drawTop.draggable = false;
  drawTop.setAttribute("draggable", "false");

  drawLayer.append(drawBase, canvas, drawTop);

  const tools = document.createElement("div");
  tools.className = "paint-tools";
  const toolTotalHeight = LAYOUT.tools.h * 3 + LAYOUT.tools.gap * 2;
  applyBox(tools, { x: LAYOUT.tools.x, y: LAYOUT.tools.y, w: LAYOUT.tools.w, h: toolTotalHeight });
  tools.style.setProperty("--tool-gap", `${LAYOUT.tools.gap}px`);

  const penBtn = makeToolButton(ASSET.pen, "铅笔");
  const eraserBtn = makeToolButton(ASSET.eraser, "橡皮");
  const bucketBtn = makeToolButton(ASSET.bucket, "油漆桶");
  tools.append(penBtn, eraserBtn, bucketBtn);

  const toolButtons = {
    [TOOL.pen]: penBtn,
    [TOOL.eraser]: eraserBtn,
    [TOOL.bucket]: bucketBtn,
  };
  setActiveTool(toolButtons, TOOL.pen);

  const colorPanel = document.createElement("div");
  colorPanel.className = "paint-color";
  applyBox(colorPanel, LAYOUT.color);

  const colorBase = document.createElement("img");
  colorBase.className = "paint-color-base";
  colorBase.src = ASSET.colorBase;
  colorBase.alt = "";
  colorBase.setAttribute("aria-hidden", "true");
  colorBase.draggable = false;
  colorBase.setAttribute("draggable", "false");

  const colorSwatch = document.createElement("div");
  colorSwatch.className = "paint-color-swatch";
  colorSwatch.style.background = state.color;

  const colorTop = document.createElement("img");
  colorTop.className = "paint-color-top";
  colorTop.src = ASSET.colorTop;
  colorTop.alt = "";
  colorTop.setAttribute("aria-hidden", "true");
  colorTop.draggable = false;
  colorTop.setAttribute("draggable", "false");

  const colorHit = document.createElement("button");
  colorHit.type = "button";
  colorHit.className = "paint-color-hit";
  colorHit.setAttribute("aria-label", "选择颜色");
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "paint-color-native-input";
  colorInput.value = state.color;
  colorInput.setAttribute("aria-label", "choose color");
  colorPanel.append(colorBase, colorSwatch, colorTop, colorHit, colorInput);

  windowEl.append(windowBase, drawLayer, tools, colorPanel);

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn paint-export-btn";
  exportBtn.textContent = "导出绘图";

  widget.append(windowEl, exportBtn);
  content.append(widget);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    content.replaceChildren(createEmptyTip("浏览器不支持 Canvas，无法使用画图实验。"));
    return;
  }
  ctx.imageSmoothingEnabled = false;

  const drawStrokePoint = (x, y) => {
    if (state.tool === TOOL.eraser) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 26;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = state.color;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  };

  let lastPoint = null;
  const activeTouchPointers = new Set();

  const onCanvasDown = (event) => {
    const touch = isTouchPointer(event);
    if (touch) {
      if (event.pointerId !== undefined) {
        activeTouchPointers.add(event.pointerId);
      }
      if (activeTouchPointers.size > 1) {
        state.drawing = false;
        lastPoint = null;
        return;
      }
    } else {
      event.preventDefault();
    }

    const point = mapPointerToCanvas(event, canvas);
    if (state.tool === TOOL.bucket) {
      floodFill(ctx, point.x, point.y, state.color);
      return;
    }
    state.drawing = true;
    lastPoint = point;
    drawStrokePoint(point.x, point.y);
    if (!touch && canvas.setPointerCapture && event.pointerId !== undefined) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch (_) {}
    }
  };

  const onCanvasMove = (event) => {
    if (isTouchPointer(event) && activeTouchPointers.size > 1) return;
    if (!state.drawing) return;
    const point = mapPointerToCanvas(event, canvas);

    if (lastPoint) {
      if (state.tool === TOOL.eraser) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 26;
      } else {
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = state.color;
        ctx.lineWidth = 10;
      }
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    } else {
      drawStrokePoint(point.x, point.y);
    }

    lastPoint = point;
  };

  const onCanvasUp = (event) => {
    if (isTouchPointer(event) && event.pointerId !== undefined) {
      activeTouchPointers.delete(event.pointerId);
    }
    state.drawing = false;
    lastPoint = null;
  };

  canvas.addEventListener("pointerdown", onCanvasDown);
  canvas.addEventListener("pointermove", onCanvasMove);
  canvas.addEventListener("pointerup", onCanvasUp);
  canvas.addEventListener("pointercancel", onCanvasUp);
  canvas.addEventListener("lostpointercapture", onCanvasUp);

  penBtn.addEventListener("click", () => setActiveTool(toolButtons, TOOL.pen));
  eraserBtn.addEventListener("click", () => setActiveTool(toolButtons, TOOL.eraser));
  bucketBtn.addEventListener("click", () => setActiveTool(toolButtons, TOOL.bucket));

  colorHit.addEventListener("click", () => {
    colorInput.value = state.color;
    colorInput.click();
  });

  colorInput.addEventListener("input", (event) => {
    const next = String(event.target?.value || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(next)) return;
    state.color = next.toLowerCase();
    colorSwatch.style.background = state.color;
  });

  bindWindowDrag(widget, windowEl);

  exportBtn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `lab-draw-${nowStamp()}.png`;
    a.click();
  });
}

init().catch((error) => {
  console.error(error);
  if (content) {
    content.replaceChildren(createEmptyTip("实验区加载失败，请检查脚本与素材路径。"));
  }
});
