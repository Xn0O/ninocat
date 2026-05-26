(function () {
  var ART_PATH = './data/art.json';

  var sc = window.SiteCommon;
  if (!sc) return;

  var slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    var grid = document.getElementById('gallery-grid');
    if (grid) grid.appendChild(sc.createEmptyTip('缺少图集参数。'));
    return;
  }

  function slugify(text) {
    return text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9一-鿿\-]/g, '');
  }

  sc.loadSiteConfig().then(function (config) {
    sc.applyThemeConfig(config);
    sc.initTheme(config);
    sc.setupThemeToggle();
    sc.applyHeaderImage(config);
    sc.applySiteText(config);
    sc.markActiveNav();

    return fetch(ART_PATH, { cache: 'no-store' });
  }).then(function (res) {
    if (!res.ok) throw new Error('无法加载 art.json');
    return res.json();
  }).then(function (payload) {
    var items = Array.isArray(payload.arts) ? payload.arts : [];
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (slugify(items[i].title || '') === slug) {
        found = items[i];
        break;
      }
    }
    if (!found) {
      var grid = document.getElementById('gallery-grid');
      if (grid) grid.appendChild(sc.createEmptyTip('未找到该图集。'));
      return;
    }
    renderGallery(found);
  }).catch(function (err) {
    console.error(err);
    var grid = document.getElementById('gallery-grid');
    if (grid) grid.appendChild(sc.createEmptyTip('图集加载失败。'));
  });

  function renderGallery(item) {
    document.title = (item.title || '图集') + ' - Nino';

    var titleEl = document.getElementById('gallery-title');
    if (titleEl) titleEl.textContent = item.title || '未命名图集';

    var metaEl = document.getElementById('gallery-meta');
    if (metaEl) {
      var parts = [];
      if (item.year) parts.push(item.year);
      if (item.tags) parts.push(item.tags);
      metaEl.textContent = parts.join(' · ');
    }

    var descEl = document.getElementById('gallery-desc');
    if (descEl) {
      descEl.textContent = item.description || '';
    }

    // Hero image
    var heroImg = document.querySelector('[data-hero-image]');
    if (heroImg) {
      var src = sc.resolveAssetUrl(item.cover || (item.images && item.images[0]) || '');
      if (src) heroImg.src = src;
    }

    // Render images
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;

    var images = Array.isArray(item.images) ? item.images.filter(Boolean) : [];
    if (!images.length) {
      grid.appendChild(sc.createEmptyTip('这个图集还没有图片。'));
      return;
    }

    images.forEach(function (path) {
      var img = document.createElement('img');
      img.loading = 'lazy';
      img.src = sc.resolveAssetUrl(path);
      img.alt = (item.title || '图集') + ' 图片';
      img.draggable = false;
      grid.appendChild(img);
    });

    sc.setupImageLightbox(grid);
  }
})();
