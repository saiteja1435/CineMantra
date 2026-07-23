(() => {
    const STAR_SVG = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const LANG_LABELS = { te:'Telugu', hi:'Hindi', en:'English', ta:'Tamil', ml:'Malayalam', kn:'Kannada', bn:'Bengali', mr:'Marathi' };

    function getLang() { return localStorage.getItem('cm-lang') || 'te'; }
    function langApi(path) { return path + '?lang=' + getLang(); }

    /* ── Card builder ─────────────────────────────────────── */
    function buildCard(item) {
        const posterSrc = item.poster_url || item.backdrop_url || Utils.PLACEHOLDER;
        const title     = item.title || item.name || 'Untitled';
        const year      = Utils.year(item.release_date || item.first_air_date);
        const rating    = Utils.rating(item.vote_average);
        const genres    = Utils.genreNames(item.genre_ids || []);
        const id        = item.id;

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${posterSrc}" alt="${title}"
                     onerror="this.src='${Utils.PLACEHOLDER}'">
                <div class="card-overlay">
                    <button class="card-play-btn" aria-label="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                </div>
                <span class="rating-badge">${STAR_SVG} ${rating}</span>
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${genres.join(' • ') || 'Web Series'} • ${year}</p>
            </div>`;

        Utils.lazyLoad(card.querySelector('img'));
        card.addEventListener('click', () => { window.location.href = '/webseries/' + id; });
        card.querySelectorAll('.card-overlay button').forEach(b => b.addEventListener('click', e => e.stopPropagation()));
        return card;
    }

    /* ── Skeleton ─────────────────────────────────────────── */
    function showSkeletons(rowEl, n = 8) {
        rowEl.innerHTML = '';
        for (let i = 0; i < n; i++) {
            const c = document.createElement('div');
            c.className = 'movie-card is-skeleton';
            c.innerHTML = `<div class="card-poster"><div class="card-poster-skel skeleton"></div></div>
                           <div class="card-info"><div class="card-title-skel skeleton"></div><div class="card-genre-skel skeleton"></div></div>`;
            rowEl.appendChild(c);
        }
    }

    /* ── Load row ─────────────────────────────────────────── */
    async function loadRow(rowId, apiPath) {
        const rowEl = document.querySelector('#row-' + rowId + ' .cards-row');
        if (!rowEl) return;
        showSkeletons(rowEl);
        try {
            const data = await Utils.fetchJSON(apiPath);
            rowEl.innerHTML = '';
            if (data.ok && data.results?.length) {
                data.results.forEach(m => rowEl.appendChild(buildCard(m)));
            } else {
                rowEl.innerHTML = '<p style="color:var(--text-muted);padding:1rem;font-size:0.85rem;">Nothing to show right now.</p>';
            }
        } catch {
            rowEl.innerHTML = '<p style="color:var(--text-muted);padding:1rem;font-size:0.85rem;">Unable to load.</p>';
        }
    }

    /* ── Update row titles with lang ──────────────────────── */
    function updateTitles() {
        const L = LANG_LABELS[getLang()] || getLang();
        const map = {
            'row-ws-trending': [`🔥 Trending ${L} Web Series`, `Most watched ${L} series right now`],
            'row-ws-toprated': [`⭐ Top Rated ${L} Web Series`, `Highest rated ${L} series`],
            'row-ws-new':      [`🆕 New ${L} Web Series`, `Latest ${L} series releases`],
        };
        Object.entries(map).forEach(([id, [title, sub]]) => {
            const sec = document.getElementById(id);
            if (!sec) return;
            const t = sec.querySelector('.row-title');
            const s = sec.querySelector('.row-subtitle');
            if (t) t.textContent = title;
            if (s) s.textContent = sub;
        });
    }

    /* ── Scroll buttons ───────────────────────────────────── */
    document.querySelectorAll('.cards-scroll-wrapper').forEach(wrapper => {
        const row   = wrapper.querySelector('.cards-row');
        const left  = wrapper.querySelector('.scroll-left');
        const right = wrapper.querySelector('.scroll-right');
        left?.addEventListener('click',  () => row.scrollBy({ left: -480, behavior: 'smooth' }));
        right?.addEventListener('click', () => row.scrollBy({ left:  480, behavior: 'smooth' }));
    });

    /* ── Filter tabs ──────────────────────────────────────── */
    document.querySelectorAll('.ws-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ws-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = document.getElementById(tab.dataset.row);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    /* ── Hero Slider ──────────────────────────────────────── */
    const heroBanner = document.getElementById('wsHeroBanner');
    const sliderDots = document.getElementById('wsSliderDots');
    const prevBtn    = document.getElementById('wsPrev');
    const nextBtn    = document.getElementById('wsNext');

    let heroItems   = [];
    let heroCurrent = 0;
    let heroTimer   = null;

    function renderHeroSlide(item, index) {
        const backdropURL = item.backdrop_url || null;
        const posterURL   = item.poster_url || item.backdrop_url || Utils.PLACEHOLDER;
        const title       = item.title || item.name || 'Untitled';
        const year        = Utils.year(item.release_date || item.first_air_date);
        const rating      = Utils.rating(item.vote_average);
        const genres      = Utils.genreNames(item.genre_ids || []);
        const overview    = (item.overview || '').slice(0, 200);
        const id          = item.id;
        const L           = LANG_LABELS[getLang()] || getLang();

        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        slide.dataset.index = index;
        slide.innerHTML = `
            ${backdropURL
                ? `<div class="hero-bg-real" style="background-image:url('${backdropURL}')"></div>`
                : `<div class="hero-bg-placeholder"></div>`}
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-left">
                    <span class="trending-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                        #${index + 1} Trending ${L} Web Series
                    </span>
                    <h1 class="hero-title">${title}</h1>
                    <div class="hero-meta">
                        <span class="hero-year">${year}</span>
                        <span class="hero-dot">•</span>
                        <span class="hero-rating">${STAR_SVG} ${rating}</span>
                        <span class="hero-dot">•</span>
                        <span class="hero-cert">${L}</span>
                    </div>
                    <p class="hero-overview">${overview}</p>
                    <div class="hero-genres">${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}</div>
                    <div class="hero-actions">
                        <button class="btn-primary" onclick="window.location.href='/webseries/${id}'">
                            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Watch Now
                        </button>
                        <button class="btn-secondary" onclick="window.location.href='/webseries/${id}'">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            More Info
                        </button>
                    </div>
                </div>
                <div class="hero-right">
                    <img class="hero-poster-img" src="${posterURL}" alt="${title}"
                         onerror="this.src='${Utils.PLACEHOLDER}'">
                </div>
            </div>`;
        return slide;
    }

    function buildDots(count) {
        sliderDots.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const btn = document.createElement('button');
            btn.className = 'dot' + (i === 0 ? ' active' : '');
            btn.dataset.index = i;
            btn.addEventListener('click', () => { goToHero(i); resetHeroAuto(); });
            sliderDots.appendChild(btn);
        }
    }

    function goToHero(index) {
        const slides = heroBanner.querySelectorAll('.hero-slide');
        const dots   = sliderDots.querySelectorAll('.dot');
        if (!slides.length) return;
        slides[heroCurrent]?.classList.remove('active');
        dots[heroCurrent]?.classList.remove('active');
        heroCurrent = (index + heroItems.length) % heroItems.length;
        slides[heroCurrent]?.classList.add('active');
        dots[heroCurrent]?.classList.add('active');
    }

    function startHeroAuto() { heroTimer = setInterval(() => goToHero(heroCurrent + 1), 7000); }
    function resetHeroAuto() { clearInterval(heroTimer); startHeroAuto(); }

    async function initHero() {
        clearInterval(heroTimer);
        heroBanner.querySelectorAll('.hero-slide').forEach(s => s.remove());
        document.getElementById('wsHeroPlaceholder')?.remove();
        heroItems = []; heroCurrent = 0;
        try {
            const data = await Utils.fetchJSON(langApi('/api/movies/web-series'));
            if (!data.ok || !data.results?.length) return;
            heroItems = data.results.slice(0, 5);
            const controls = heroBanner.querySelector('.hero-slider-controls');
            heroItems.forEach((item, i) => heroBanner.insertBefore(renderHeroSlide(item, i), controls));
            heroBanner.querySelector('.hero-slide')?.classList.add('active');
            buildDots(heroItems.length);
            prevBtn?.addEventListener('click', () => { goToHero(heroCurrent - 1); resetHeroAuto(); });
            nextBtn?.addEventListener('click', () => { goToHero(heroCurrent + 1); resetHeroAuto(); });
            startHeroAuto();
        } catch (e) { console.error('[WebSeries] Hero load failed:', e); }
    }

    /* ── Boot & reload ────────────────────────────────────── */
    function bootAll() {
        updateTitles();
        initHero();
        loadRow('ws-trending', langApi('/api/movies/web-series'));
        loadRow('ws-toprated', langApi('/api/movies/web-series'));
        loadRow('ws-new',      langApi('/api/movies/web-series'));
        setTimeout(() => {
            loadRow('ws-drama',    '/api/telugu/web-series/drama');
            loadRow('ws-crime',    '/api/telugu/web-series/crime');
            loadRow('ws-thriller', '/api/telugu/web-series/thriller');
            loadRow('ws-comedy',   '/api/telugu/web-series/comedy');
            loadRow('ws-romance',  '/api/telugu/web-series/romance');
            loadRow('ws-action',   '/api/telugu/web-series/action');
            loadRow('ws-ott',      '/api/telugu/ott');
        }, 400);
    }

    bootAll();
    document.addEventListener('cm:lang-change', bootAll);
})();
