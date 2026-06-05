(function () {
  var TRANS_KEY = 'vb_pixel_wave';
  var sweeping = false;

  // Build pixel grid
  var grid = document.createElement('div');
  grid.id = 'px-grid';
  grid.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;display:grid;grid-template-columns:repeat(60,1fr);grid-template-rows:repeat(45,1fr);gap:0;';
  document.body.appendChild(grid);

  var COLS = 60, ROWS = 45, rings = 5;
  var ringColors = ['#1a4fff','#3b5fff','#6366f1','#a855f7','#7c3aed'];
  var pixels = [];
  for (var i = 0; i < COLS * ROWS; i++) {
    var p = document.createElement('div');
    p.style.cssText = 'opacity:0;background:#a855f7;width:100%;height:100%;';
    grid.appendChild(p);
    pixels.push(p);
  }

  function pixelWave(cx, cy, buildUp, done) {
    var cellW = window.innerWidth / COLS, cellH = window.innerHeight / ROWS;
    var maxD = Math.sqrt(Math.pow(window.innerWidth, 2) + Math.pow(window.innerHeight, 2));
    var indexed = [];
    for (var i = 0; i < pixels.length; i++) {
      var px = (i % COLS) * cellW + cellW / 2;
      var py = Math.floor(i / COLS) * cellH + cellH / 2;
      var d = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
      indexed.push({ idx: i, dist: d });
    }
    indexed.sort(function (a, b) { return a.dist - b.dist; });

    // Assign each pixel to a ring by distance
    var ringSize = maxD / rings;
    indexed.forEach(function (p) {
      p.ring = Math.min(rings - 1, Math.floor(p.dist / ringSize));
    });

    grid.style.zIndex = '9999';

    // Each ring expands outward independently
    // Within each ring, pixels appear from inner edge to outer edge
    var ringInterval = 40;
    var expandDur = 30;

    for (var ri = 0; ri < rings; ri++) (function (ringIdx) {
      var ringPx = indexed.filter(function (p) { return p.ring === ringIdx; });
      // Sort within ring by distance (inner edge first)
      ringPx.sort(function (a, b) { return a.dist - b.dist; });
      var ringMinD = ringPx.length > 0 ? ringPx[0].dist : 0;
      var ringMaxD = ringPx.length > 0 ? ringPx[ringPx.length - 1].dist : 1;
      var ringRange = Math.max(1, ringMaxD - ringMinD);

      var baseDelay = ringIdx * ringInterval;
      ringPx.forEach(function (p) {
        var t = ringRange > 0 ? (p.dist - ringMinD) / ringRange : 0;
        var delay = baseDelay + t * expandDur + Math.random() * 4;
        // Color gradient: inner edge = blue-purple, outer edge = yellow-green
        var cr = Math.round(t * 170 + (1 - t) * 80);
        var cg = Math.round(t * 140 + (1 - t) * 40);
        var cb = Math.round(t * 60 + (1 - t) * 180);
        var color = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
        if (buildUp) {
          setTimeout(function () {
            pixels[p.idx].style.background = color;
            pixels[p.idx].style.opacity = '1';
          }, delay);
        } else {
          setTimeout(function () {
            pixels[p.idx].style.opacity = '0';
          }, baseDelay + t * expandDur * 0.5 + 20 + Math.random() * 4);
        }
      });
    })(ri);

    var totalMs = (rings - 1) * ringInterval + expandDur + 30;

    if (buildUp) {
      setTimeout(function () {
        for (var ci = 0; ci < pixels.length; ci++) pixels[ci].style.opacity = '1';
        if (done) done();
      }, totalMs);
    } else {
      setTimeout(function () {
        for (var ci = 0; ci < pixels.length; ci++) pixels[ci].style.opacity = '0';
        if (done) done();
      }, totalMs + 60);
    }
  }

  // ---- IN transition ----
  if (sessionStorage.getItem(TRANS_KEY) === '1') {
    sessionStorage.removeItem(TRANS_KEY);
    var cw = window.innerWidth / COLS, ch = window.innerHeight / ROWS;
    var ocx = window.innerWidth / 2, ocy = window.innerHeight / 2;
    var mD2 = Math.sqrt(Math.pow(window.innerWidth, 2) + Math.pow(window.innerHeight, 2));
    for (var j = 0; j < pixels.length; j++) {
      var px2 = (j % COLS) * cw + cw / 2, py2 = Math.floor(j / COLS) * ch + ch / 2;
      var d2 = Math.sqrt(Math.pow(px2 - ocx, 2) + Math.pow(py2 - ocy, 2));
      var ratio2 = d2 / mD2;
      var cr = Math.round(ratio2 * 170 + (1 - ratio2) * 80);
      var cg = Math.round(ratio2 * 140 + (1 - ratio2) * 40);
      var cb = Math.round(ratio2 * 60 + (1 - ratio2) * 180);
      pixels[j].style.background = 'rgb(' + cr + ',' + cg + ',' + cb + ')';
      pixels[j].style.opacity = '1';
    }
    grid.style.zIndex = '9999';
    pixelWave(window.innerWidth / 2, window.innerHeight / 2, false);
  }

  // ---- bfcache restore + late IN fallback ----
  function tryDissolve() {
    sweeping = false;
    if (grid.style.zIndex === '9999' || pixels[0].style.opacity === '1') {
      pixelWave(window.innerWidth / 2, window.innerHeight / 2, false);
    }
  }
  window.addEventListener('pageshow', tryDissolve);
  // Also check after page fully renders (handles edge cases)
  setTimeout(tryDissolve, 100);

  // ---- OUT transition ----
  function doSweep(url, mx, my) {
    if (sweeping) return;
    sweeping = true;
    var cx = mx != null ? mx : window.innerWidth / 2;
    var cy = my != null ? my : window.innerHeight / 2;
    pixelWave(cx, cy, true, function () {
      sessionStorage.setItem(TRANS_KEY, '1');
      window.location.href = url;
    });
  }

  // Click handlers
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || link.href || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (link.classList.contains('brand')) { e.preventDefault(); doSweep(link.href, e.clientX, e.clientY); return; }
    if (link.closest('.top-nav nav')) { e.preventDefault(); doSweep(link.href, e.clientX, e.clientY); return; }
    try {
      var fullUrl = new URL(href, window.location.origin);
      if (fullUrl.origin !== window.location.origin) return;
      if (!fullUrl.pathname.endsWith('.html')) return;
      e.preventDefault();
      doSweep(fullUrl.pathname + fullUrl.search, e.clientX, e.clientY);
    } catch (_) {}
  });
})();
