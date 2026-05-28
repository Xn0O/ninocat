(function () {
  var SPACE_PATH = './data/space.json';
  var PAGE_SIZE = 10;

  var sc = window.SiteCommon;
  if (!sc) return;

  var feedEl = document.getElementById('space-feed');
  var paginationEl = document.getElementById('space-pagination');
  var prevBtn = document.getElementById('space-prev');
  var nextBtn = document.getElementById('space-next');
  var pageInfoEl = document.getElementById('space-page-info');

  var state = {
    moments: [],
    page: 1
  };

  function getTotalPages() {
    var total = Math.ceil(state.moments.length / PAGE_SIZE);
    return total > 0 ? total : 1;
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    var d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min;
  }

  function createMoment(moment) {
    var article = document.createElement('article');
    article.className = 'moment-card';

    // Header: timestamp
    var header = document.createElement('div');
    header.className = 'moment-header';
    var time = document.createElement('time');
    time.className = 'moment-date';
    time.dateTime = moment.created_at || '';
    time.textContent = formatDate(moment.created_at);
    header.appendChild(time);
    article.appendChild(header);

    // Content text (supports markdown)
    var content = document.createElement('div');
    content.className = 'moment-content';
    var text = (moment.content || '').trim();
    if (text) {
      content.innerHTML = sc.markdownToHtml ? sc.markdownToHtml(text) : text;
    } else {
      content.textContent = '（空内容）';
      content.style.color = 'var(--muted)';
    }
    article.appendChild(content);

    // Images grid
    var images = Array.isArray(moment.images) ? moment.images.filter(Boolean) : [];
    if (images.length) {
      var imgGrid = document.createElement('div');
      imgGrid.className = 'moment-images';
      var count = Math.min(images.length, 9);
      imgGrid.dataset.count = String(count);
      if (count > 3) {
        imgGrid.className += ' moment-images-multi';
      }
      images.forEach(function (src) {
        var img = document.createElement('img');
        img.className = 'moment-image';
        img.loading = 'lazy';
        img.src = sc.resolveAssetUrl(src);
        img.alt = '空间图片';
        img.draggable = false;
        imgGrid.appendChild(img);
      });
      article.appendChild(imgGrid);
    }

    return article;
  }

  function renderCurrentPage() {
    if (!feedEl) return;
    feedEl.replaceChildren();

    var totalPages = getTotalPages();
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = state.moments.slice(start, start + PAGE_SIZE);

    if (!pageItems.length) {
      feedEl.appendChild(sc.createEmptyTip('还没有动态，期待你的第一条动态 :)'));
      if (paginationEl) paginationEl.hidden = true;
      return;
    }

    pageItems.forEach(function (moment) {
      feedEl.appendChild(createMoment(moment));
    });

    setupMomentGallery();

    // Update pagination
    if (paginationEl) {
      paginationEl.hidden = state.moments.length <= PAGE_SIZE;
    }
    if (pageInfoEl) {
      pageInfoEl.textContent = '第 ' + state.page + ' / ' + totalPages + ' 页';
    }
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages;
  }

  function setPage(page) {
    var total = getTotalPages();
    state.page = Math.max(1, Math.min(total, page));
    renderCurrentPage();
  }

  function setupMomentGallery() {
    if (!feedEl || !sc.ensureImageLightbox) return;
    var lightbox = sc.ensureImageLightbox();
    feedEl.querySelectorAll('.moment-card').forEach(function (card) {
      var imgs = card.querySelectorAll('.moment-image');
      if (imgs.length < 1) return;
      var sources = [];
      imgs.forEach(function (img) {
        var src = String(img.currentSrc || img.src || '').trim();
        if (src) sources.push({ src: src, alt: img.alt || '' });
      });
      if (sources.length < 1) return;
      imgs.forEach(function (img, idx) {
        if (img.dataset.galleryBound === '1') return;
        img.dataset.galleryBound = '1';
        img.classList.add('zoomable-image');
        img.style.cursor = 'pointer';
        img.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          lightbox.openGallery(sources, idx);
        });
      });
    });
  }

  function bindPagination() {
    if (prevBtn) {
      prevBtn.addEventListener('click', function () { setPage(state.page - 1); });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () { setPage(state.page + 1); });
    }
  }

  async function init() {
    var config = await sc.loadSiteConfig();
    sc.applyThemeConfig(config);
    sc.initTheme(config);
    sc.applySiteText(config);

    if (!feedEl) return;

    // Loading state
    var loadingMsg = document.createElement('p');
    loadingMsg.className = 'space-loading';
    loadingMsg.textContent = '加载中...';
    feedEl.appendChild(loadingMsg);

    try {
      var res = await fetch(SPACE_PATH, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var payload = await res.json();
      var moments = Array.isArray(payload.moments) ? payload.moments : [];
      // Sort newest first
      state.moments = [].concat(moments).sort(function (a, b) {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      bindPagination();
      setPage(1);
    } catch (err) {
      console.error('Space data load failed:', err);
      feedEl.replaceChildren();
      feedEl.appendChild(sc.createEmptyTip('空间数据加载失败。'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
