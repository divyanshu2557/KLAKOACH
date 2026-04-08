/* ══════════════════════════════════════════════════════════════
   Klakoach — Catalog Script
   ══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── State ─── */
  let allProducts = [];
  let filteredProducts = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let visibleCount = 12;
  const PAGE_SIZE = 12;
  let isListView = false;
  let favorites = JSON.parse(localStorage.getItem('klakoach_favorites') || '[]');
  let currentModalIndex = -1;

  /* ─── DOM Refs ─── */
  const dom = {
    progress: document.getElementById('scroll-progress'),
    cursor: document.getElementById('cursor-glow'),
    preloader: document.getElementById('preloader'),
    header: document.getElementById('site-header'),
    grid: document.getElementById('product-grid'),
    categoryFilters: document.getElementById('category-filters'),
    categoryCards: document.getElementById('category-cards'),
    footerCatLinks: document.getElementById('footer-cat-links'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    resultsCount: document.getElementById('results-count'),
    loadMoreWrapper: document.getElementById('load-more-wrapper'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    modal: document.getElementById('product-modal'),
    modalClose: document.getElementById('modal-close'),
    modalPrev: document.getElementById('modal-prev'),
    modalNext: document.getElementById('modal-next'),
    modalFav: document.getElementById('modal-fav'),
    modalImage: document.getElementById('modal-image'),
    modalBadge: document.getElementById('modal-badge'),
    modalCategory: document.getElementById('modal-category'),
    modalTitle: document.getElementById('modal-title'),
    modalDescription: document.getElementById('modal-description'),
    modalId: document.getElementById('modal-id'),
    modalStarCTA: document.getElementById('modal-star-cta'),
    starCTAText: document.getElementById('star-cta-text'),
    viewGrid: document.getElementById('view-grid'),
    viewList: document.getElementById('view-list'),
    favFilterBtn: document.getElementById('fav-filter-btn'),
    favCount: document.getElementById('fav-count'),
    backToTop: document.getElementById('back-to-top'),
    statBar: document.getElementById('stat-bar'),
    hero: document.getElementById('hero'),
    particlesCanvas: document.getElementById('hero-particles'),
    toastContainer: document.getElementById('toast-container')
  };

  /* ══════════════════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════════════════ */

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    function parseLine(line) {
      const result = [];
      let i = 0, field = '', inQuotes = false;
      while (i < line.length) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              field += '"'; i += 2;
            } else { inQuotes = false; i++; }
          } else { field += ch; i++; }
        } else {
          if (ch === '"') { inQuotes = true; i++; }
          else if (ch === ',') { result.push(field.trim()); field = ''; i++; }
          else { field += ch; i++; }
        }
      }
      result.push(field.trim());
      return result;
    }

    const headers = parseLine(lines[0]);
    const data = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = parseLine(lines[r]);
      if (cols.length < headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
      data.push(obj);
    }
    return data;
  }

  function cleanCategory(raw) {
    return String(raw || '')
      .replace(/"+/g, '')
      .replace(/\s*,\s*/g, ', ')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isValidImageUrl(url) {
    if (!url) return false;
    // Check for common image extensions or direct image CDN patterns
    const isImageFile = /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(url);
    const isCdnLink = /images\.(unsplash|pexels|meesho|home4u|m\.media-amazon|rukminim2|image\.made-in-china|rabyana)\.com/i.test(url) || url.includes('/cdn/shop/') || url.includes('gstatic.com');
    const isSearchPage = url.includes('pexels.com/search') || url.includes('unsplash.com/s/photos');
    
    return (isImageFile || isCdnLink) && !isSearchPage;
  }

  function getThemePlaceholder(cat) {
    const themeMap = {
      'Brass': 'https://images.pexels.com/photos/10398018/pexels-photo-10398018.jpeg',
      'Textiles': 'https://images.pexels.com/photos/2088231/pexels-photo-2088231.jpeg',
      'Ceramics': 'https://images.pexels.com/photos/30698565/pexels-photo-30698565.jpeg',
      'Small Showpieces & Table Decor': 'https://images.pexels.com/photos/6213685/pexels-photo-6213685.jpeg',
      'Wall Decor & Hangings': 'https://images.pexels.com/photos/10359734/pexels-photo-10359734.jpeg',
      'Wooden Items': 'https://images.pexels.com/photos/13271384/pexels-photo-13271384.jpeg',
      'Kitchen': 'https://images.pexels.com/photos/6913401/pexels-photo-6913401.jpeg',
      'Furniture': 'https://images.pexels.com/photos/1090638/pexels-photo-1090638.jpeg'
    };
    return themeMap[cat] || 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=60';
  }

  function makePlaceholder(item) {
    return (item.split(' ').slice(0, 2).map(w => w[0]).join('') || '✦').toUpperCase();
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-20px)';
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  }

  /* ══════════════════════════════════════════════════════
     INTERACTIVE EFFECTS
     ══════════════════════════════════════════════════════ */

  function initParticles() {
    const ctx = dom.particlesCanvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = dom.particlesCanvas.width = window.innerWidth;
      h = dom.particlesCanvas.height = window.innerHeight;
    }

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 2 + 0.5;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.life = Math.random() * 0.5 + 0.5;
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
      }
      draw() {
        ctx.fillStyle = `rgba(176, 139, 53, ${this.life * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function init() {
      resize();
      particles = [];
      for (let i = 0; i < 100; i++) particles.push(new Particle());
      window.addEventListener('resize', resize);
    }

    function loop() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => { p.update(); p.draw(); });
      requestAnimationFrame(loop);
    }

    init();
    loop();
  }

  function initCursor() {
    window.addEventListener('mousemove', e => {
      dom.cursor.style.left = e.clientX + 'px';
      dom.cursor.style.top = e.clientY + 'px';
    });
  }

  function initScrollTracking() {
    window.addEventListener('scroll', () => {
      // Progress bar
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      dom.progress.style.width = scrolled + "%";

      // Header & Back to top
      dom.header.classList.toggle('scrolled', window.scrollY > 20);
      dom.backToTop.classList.toggle('visible', window.scrollY > 600);

      // Reveal on scroll
      document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.85) el.classList.add('visible');
      });
    }, { passive: true });
  }

  /* ══════════════════════════════════════════════════════
     CORE LOGIC
     ══════════════════════════════════════════════════════ */

  function buildUI() {
    const cats = [...new Set(allProducts.map(p => p._category))].sort();

    // Stats bar observer
    const statObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        animateCounter(document.getElementById('stat-items'), allProducts.length);
        animateCounter(document.getElementById('stat-categories'), cats.length);
        statObserver.disconnect();
      }
    }, { threshold: 0.5 });
    statObserver.observe(dom.statBar);

    // Filters & Nav
    let filterHTML = `<button class="cat-filter-btn active" data-category="all">All</button>`;
    let navHTML = `<button class="nav-btn active" data-category="all">All</button>`;
    let footerHTML = '';
    let showcaseHTML = '';

    cats.forEach((cat, idx) => {
      const count = allProducts.filter(p => p._category === cat).length;
      filterHTML += `<button class="cat-filter-btn" data-category="${cat}">${cat} (${count})</button>`;
      navHTML += `<button class="nav-btn" data-category="${cat}">${cat}</button>`;
      footerHTML += `<li><a href="#catalog" onclick="filterByCategory('${cat}')">${cat}</a></li>`;

      // Find first valid image for showcase, if not valid, use curated theme placeholder
      const firstValid = allProducts.find(p => p._category === cat && isValidImageUrl(p.image_link));
      const showcaseImg = firstValid ? firstValid.image_link : getThemePlaceholder(cat);

      showcaseHTML += `
        <div class="cat-card reveal-on-scroll" style="transition-delay: ${idx * 0.1}s" onclick="filterByCategory('${cat}')">
          <img src="${showcaseImg}" class="cat-card-img" alt="${cat}" loading="lazy" onerror="this.src='${getThemePlaceholder(cat)}'">
          <div class="cat-card-content">
            <h3 class="cat-card-title">${cat}</h3>
            <span class="cat-card-count">${count} Artefacts</span>
          </div>
        </div>`;
    });

    dom.categoryFilters.innerHTML = filterHTML;
    document.getElementById('main-nav').innerHTML = navHTML;
    dom.footerCatLinks.innerHTML = footerHTML;
    dom.categoryCards.innerHTML = showcaseHTML;

    updateFavUI();
  }

  window.filterByCategory = function (cat) {
    activeCategory = cat;
    document.querySelectorAll('.cat-filter-btn, .nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.category === cat);
    });
    // Scroll to catalog
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    applyFilters();
  };

  function applyFilters() {
    const isShowingFavs = dom.favFilterBtn.classList.contains('active');

    filteredProducts = allProducts.filter(p => {
      const matchCat = activeCategory === 'all' || p._category === activeCategory;
      const matchSearch = !searchQuery ||
        p.item.toLowerCase().includes(searchQuery) ||
        p.description.toLowerCase().includes(searchQuery);
      const matchFav = !isShowingFavs || favorites.includes(String(p.id));
      return matchCat && matchSearch && matchFav;
    });
    visibleCount = PAGE_SIZE;
    renderGrid();
  }

  function renderGrid() {
    const toShow = filteredProducts.slice(0, visibleCount);
    dom.resultsCount.textContent = filteredProducts.length;

    if (filteredProducts.length === 0) {
      dom.grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:5rem">
        <p style="font-family:var(--font-display);font-size:1.5rem;color:var(--text-muted)">No treasures found in this collection.</p></div>`;
      dom.loadMoreWrapper.style.display = 'none';
      return;
    }

    dom.grid.innerHTML = toShow.map((p, idx) => {
      const isFav = favorites.includes(String(p.id));
      return `
        <article class="product-card reveal-on-scroll" data-id="${p.id}" tabindex="0">
          <div class="card-image-wrapper">
            <img class="card-image" src="${p.image_link}" alt="${p.item}" loading="lazy" onerror="this.src='${getThemePlaceholder(p._category)}'">
            <span class="card-badge">${p._category}</span>
            <button class="card-fav-mark ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite('${p.id}')">
              <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="${isFav ? 'var(--gold-300)' : 'rgba(255,255,255,0.5)'}"/></svg>
            </button>
          </div>
          <div class="card-body">
            <h3 class="card-title">${p.item}</h3>
            <p class="card-desc">${p.description}</p>
            <div class="card-footer">
              <span class="card-id">№ ${String(p.id).padStart(3, '0')}</span>
              <button class="card-view-btn">View Details</button>
            </div>
          </div>
        </article>`;
    }).join('');

    dom.loadMoreWrapper.style.display = visibleCount < filteredProducts.length ? 'block' : 'none';

    // Trigger reveal for new items
    setTimeout(() => {
      document.querySelectorAll('.product-card').forEach(c => c.classList.add('visible'));
    }, 50);
  }

  /* ══════════════════════════════════════════════════════
     FAVORITES & MODAL
     ══════════════════════════════════════════════════════ */

  window.toggleFavorite = function (id) {
    id = String(id);
    const idx = favorites.indexOf(id);
    if (idx > -1) {
      favorites.splice(idx, 1);
      showToast('Removed from favorites');
    } else {
      favorites.push(id);
      showToast('This product is now a Star Product');
    }
    localStorage.setItem('klakoach_favorites', JSON.stringify(favorites));
    updateFavUI();
    applyFilters();
    updateModalFavState();
  };

  function updateFavUI() {
    dom.favCount.textContent = favorites.length;
    dom.favFilterBtn.classList.toggle('has-items', favorites.length > 0);
  }

  function updateModalFavState() {
    if (currentModalIndex === -1) return;
    const p = filteredProducts[currentModalIndex];
    if (!p) return;

    const isFav = favorites.includes(String(p.id));
    dom.modalFav.classList.toggle('active', isFav);
    dom.modalFav.querySelector('svg').setAttribute('fill', isFav ? 'var(--gold-300)' : 'rgba(255,255,255,0.4)');
    
    // Update the CTA button
    const cta = dom.modalStarCTA;
    if (!dom.starCTAText) return;
    if (isFav) {
      cta.classList.add('active');
      dom.starCTAText.textContent = 'This is a Star Product';
    } else {
      cta.classList.remove('active');
      dom.starCTAText.textContent = 'Star this Product';
    }
  }

  function openModal(idx) {
    if (idx < 0 || idx >= filteredProducts.length) return;
    currentModalIndex = idx;
    const p = filteredProducts[idx];

    dom.modalImage.onerror = () => {
      dom.modalImage.onerror = null;
      dom.modalImage.src = getThemePlaceholder(p._category);
    };
    dom.modalImage.src = p.image_link;
    dom.modalTitle.textContent = p.item;
    dom.modalDescription.textContent = p.description;
    dom.modalCategory.textContent = p._category;
    dom.modalBadge.textContent = p._category;
    dom.modalId.textContent = `Artefact № ${String(p.id).padStart(3, '0')}`;

    updateModalFavState();
    dom.modal.classList.add('active');
    dom.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    dom.modal.classList.remove('active');
    dom.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function navigateModal(dir) {
    let nextIdx = currentModalIndex + dir;
    if (nextIdx < 0) nextIdx = filteredProducts.length - 1;
    if (nextIdx >= filteredProducts.length) nextIdx = 0;
    openModal(nextIdx);
  }

  /* ══════════════════════════════════════════════════════
     EVENTS & INIT
     ══════════════════════════════════════════════════════ */

  function bindEvents() {
    dom.searchInput.addEventListener('input', () => {
      searchQuery = dom.searchInput.value.toLowerCase();
      dom.searchClear.style.display = searchQuery ? 'flex' : 'none';
      applyFilters();
    });

    dom.searchClear.addEventListener('click', () => {
      dom.searchInput.value = '';
      searchQuery = '';
      dom.searchClear.style.display = 'none';
      applyFilters();
    });

    dom.favFilterBtn.addEventListener('click', () => {
      dom.favFilterBtn.classList.toggle('active');
      applyFilters();
    });

    dom.loadMoreBtn.addEventListener('click', () => {
      visibleCount += PAGE_SIZE;
      renderGrid();
    });

    dom.viewGrid.addEventListener('click', () => {
      dom.grid.classList.remove('list-view');
      dom.viewGrid.classList.add('active');
      dom.viewList.classList.remove('active');
    });

    dom.viewList.addEventListener('click', () => {
      dom.grid.classList.add('list-view');
      dom.viewList.classList.add('active');
      dom.viewGrid.classList.remove('active');
    });

    dom.grid.addEventListener('click', e => {
      const card = e.target.closest('.product-card');
      if (card) {
        const id = card.dataset.id;
        const idx = filteredProducts.findIndex(p => String(p.id) === id);
        openModal(idx);
      }
    });

    dom.modalClose.addEventListener('click', closeModal);
    dom.modal.addEventListener('click', e => {
      if (e.target === dom.modal) closeModal();
    });

    dom.modalStarCTA.addEventListener('click', () => {
      const p = filteredProducts[currentModalIndex];
      if (p) toggleFavorite(p.id);
    });
    dom.modalPrev.addEventListener('click', () => navigateModal(-1));
    dom.modalNext.addEventListener('click', () => navigateModal(1));
    dom.modalFav.addEventListener('click', () => {
      const p = filteredProducts[currentModalIndex];
      if (p) toggleFavorite(p.id);
    });

    dom.backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    document.addEventListener('keydown', e => {
      if (!dom.modal.classList.contains('active')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'ArrowLeft') navigateModal(-1);
      if (e.key === 'ArrowRight') navigateModal(1);
    });

    // Event Delegation for Categories
    dom.categoryFilters.addEventListener('click', e => {
      const btn = e.target.closest('.cat-filter-btn');
      if (btn) filterByCategory(btn.dataset.category);
    });

    const mainNav = document.getElementById('main-nav');
    if (mainNav) {
      mainNav.addEventListener('click', e => {
        const btn = e.target.closest('.nav-btn');
        if (btn) filterByCategory(btn.dataset.category);
      });
    }

    // Newsletter Submission
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
      newsletterForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = newsletterForm.querySelector('input').value;
        if (email) {
          showToast('Welcome to Quirey. You are now attuned to our collection.');
          newsletterForm.reset();
        }
      });
    }
  }

  function animateCounter(el, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        el.textContent = target;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current);
      }
    }, 30);
  }

  async function init() {
    initParticles();
    initCursor();
    initScrollTracking();

    try {
      const resp = await fetch('Book2.csv');
      if (!resp.ok) throw new Error(`Failed to load CSV (status ${resp.status})`);
      const text = await resp.text();
      const raw = parseCSV(text.replace(/^\uFEFF/, ''));
      allProducts = raw
        .filter(d => d.id && d.item)
        .map(d => ({
          ...d,
          id: String(d.id).trim(),
          item: String(d.item || '').trim(),
          description: String(d.description || '').trim(),
          image_link: String(d.image_link || '').trim(),
          _category: cleanCategory(d.category) || 'Uncategorized'
        }));

      if (allProducts.length === 0) {
        throw new Error('CSV loaded but no valid products were found.');
      }
      
      buildUI();
      bindEvents();
      applyFilters();

    } catch (err) {
      console.error(err);
      dom.grid.innerHTML = '<p>Failed to load collection treasures.</p>';
    } finally {
      setTimeout(() => {
        dom.preloader.classList.add('hidden');
        dom.hero.classList.add('loaded');
      }, 500);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
