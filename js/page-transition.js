(function () {
  var sweep = document.getElementById('page-sweep');
  if (!sweep) return;

  var TRANS_KEY = 'vb_page_sweep';
  var sweeping = false;

  // ---- IN: every page gets a full-screen purple block that slides left ----
  function playSlideIn() {
    // Reset any leftover state
    sweep.style.transition = 'none';
    // Cover full screen instantly
    sweep.style.zIndex = '2147483647';
    sweep.style.width = '100vw';
    sweep.style.transform = 'translateX(0)';
    sweep.offsetHeight;
    // Slide out to the left
    sweep.style.transition = 'transform 0.35s cubic-bezier(0.1, 0.8, 0.2, 1)';
    sweep.style.transform = 'translateX(-100%)';
    sweep.addEventListener('transitionend', function clean() {
      sweep.removeEventListener('transitionend', clean);
      sweep.style.transition = 'none';
      sweep.style.transform = '';
      sweep.style.width = '';
      sweep.style.zIndex = '';
      sweep.offsetHeight;
      sweep.style.transition = '';
    });
  }
  playSlideIn();
  // Handle browser back/forward (bfcache restores DOM but not JS state)
  window.addEventListener('pageshow', function () {
    sweeping = false; // bfcache restores JS state, reset guard
    if (sweep.style.width === '100vw' || sweep.style.zIndex === '2147483647') {
      playSlideIn();
    }
  });

  // ---- OUT: intercept nav clicks, sweep right->left, then navigate ----
  function doSweep(url) {
    if (sweeping) return;
    sweeping = true;

    // Immediately bring to front, then show stripes
    sweep.style.zIndex = '2147483647';
    sweep.classList.add('stripes');
    setTimeout(function () {
      sweep.classList.remove('stripes');
      sweep.style.transition = 'width 0.35s cubic-bezier(0.1, 0.8, 0.2, 1)';
      sweep.style.width = '100vw';
    }, 160);

    setTimeout(function () {
      sessionStorage.setItem(TRANS_KEY, '1');
      window.location.href = url;
    }, 550);
  }

  // Nav bar direct handler
  var navEl = document.querySelector('.top-nav nav');
  if (navEl) {
    navEl.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      e.preventDefault();
      e.stopPropagation();
      doSweep(link.href);
    });
  }

  // Document fallback for other .html links
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    // Brand link
    if (link.classList.contains('brand')) { e.preventDefault(); doSweep(link.href); return; }
    if (link.closest('.top-nav')) return; // handled above
    var href = link.getAttribute('href') || link.href || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      var fullUrl = new URL(href, window.location.origin);
      if (fullUrl.origin !== window.location.origin) return;
      if (!fullUrl.pathname.endsWith('.html')) return;
      e.preventDefault();
      // Fallback: navigate directly if doSweep fails
      try {
        doSweep(fullUrl.pathname + fullUrl.search);
      } catch (_) {
        window.location.href = fullUrl.href;
      }
    } catch (_) {
      // URL parse failed, navigate normally
    }
  });
})();


// ---- Grid trail ----
(function () {
        var c = document.getElementById('grid-trail');
        if (!c) return;
        var ctx = c.getContext('2d');
        var cellSize = 10;
        var cols = 0, rows = 0, cells = [];

        function resize() {
          c.width = window.innerWidth;
          c.height = window.innerHeight;
          cols = Math.ceil(c.width / cellSize);
          rows = Math.ceil(c.height / cellSize);
          cells = new Array(cols * rows).fill(0);
        }
        resize();
        window.addEventListener('resize', resize);

        function draw() {
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.strokeStyle = 'rgba(168,85,247,0.15)';
          ctx.lineWidth = 0.5;
          for (var x = 0; x <= c.width; x += cellSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke(); }
          for (var y = 0; y <= c.height; y += cellSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
          for (var i = 0; i < cells.length; i++) {
            if (cells[i] > 0.01) {
              var v = cells[i];
              var r, g, b;
              if (v > 0.45) {
                var t = (v - 0.45) / 0.55;
                r = Math.round(t * 0 + (1 - t) * 168);
                g = Math.round(t * 47 + (1 - t) * 85);
                b = Math.round(t * 167 + (1 - t) * 247);
              } else if (v > 0.15) {
                var t = (v - 0.15) / 0.3;
                r = Math.round(t * 168 + (1 - t) * 163);
                g = Math.round(t * 85 + (1 - t) * 230);
                b = Math.round(t * 247 + (1 - t) * 53);
              } else {
                var t = v / 0.15;
                r = Math.round(t * 163 + (1 - t) * 80);
                g = Math.round(t * 230 + (1 - t) * 160);
                b = Math.round(t * 53 + (1 - t) * 30);
              }
              ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + Math.min(0.85, v * 0.6 + 0.25) + ')';
              ctx.fillRect((i % cols) * cellSize, Math.floor(i / cols) * cellSize, cellSize, cellSize);
              cells[i] *= 0.96;
            } else cells[i] = 0;
          }
          requestAnimationFrame(draw);
        }
        draw();

        // Click ripple
        document.addEventListener('click', function (e) {
          var rc = Math.floor(e.clientX / cellSize), rr = Math.floor(e.clientY / cellSize);
          var maxR2 = Math.sqrt(cols*cols + rows*rows);
          var ring = 0;
          var ripple = setInterval(function () {
            ring += 1;
            var innerR = (ring - 1) * 1.5, outerR = ring * 1.5;
            for (var dy = -Math.ceil(outerR); dy <= Math.ceil(outerR); dy++) {
              for (var dx = -Math.ceil(outerR); dx <= Math.ceil(outerR); dx++) {
                var c2 = rc + dx, r2 = rr + dy;
                if (c2 >= 0 && c2 < cols && r2 >= 0 && r2 < rows) {
                  var d2 = Math.sqrt(dx*dx + dy*dy);
                  if (d2 >= innerR && d2 < outerR) {
                    var val = Math.min(1, 0.4 + Math.random() * 0.4);
                    cells[r2 * cols + c2] = Math.min(1, cells[r2 * cols + c2] + val);
                  }
                }
              }
            }
            if (ring > maxR2 / 1.5) clearInterval(ripple);
          }, 30);
        });

        var lastX = -1, lastY = -1;
        document.addEventListener('mousemove', function (e) {
          var speed = lastX >= 0 ? Math.sqrt(Math.pow(e.clientX - lastX, 2) + Math.pow(e.clientY - lastY, 2)) : 0;
          lastX = e.clientX; lastY = e.clientY;
          if (speed < 6) return;
          var col = Math.floor(e.clientX / cellSize);
          var row = Math.floor(e.clientY / cellSize);
          var intensity = Math.min(1, speed / 50 + 0.3);
          for (var dx = -2; dx <= 2; dx++) {
            for (var dy = -2; dy <= 2; dy++) {
              var cx2 = col + dx, ry2 = row + dy;
              if (cx2 >= 0 && cx2 < cols && ry2 >= 0 && ry2 < rows) {
                var dist = Math.sqrt(dx*dx + dy*dy);
                if (dist <= 2.2) {
                  cells[ry2 * cols + cx2] = Math.min(1, cells[ry2 * cols + cx2] + intensity * (1 - dist / 3));
                }
              }
            }
          }
        });
      })();

// ---- Card hover border wrapper ----
(function () {
  function wrapCards() {
    document.querySelectorAll('.item-card:not(.wrapped), .ac:not(.wrapped), .game-card:not(.wrapped)').forEach(function (card) {
      var w = document.createElement('div');
      w.className = 'card-wrap';
      card.parentNode.insertBefore(w, card);
      w.appendChild(card);
      card.classList.add('wrapped');
    });
  }
  wrapCards();
  setInterval(wrapCards, 800);
})();