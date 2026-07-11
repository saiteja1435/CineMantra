(() => {
    /* ═══════════════════════════════════════════════════════════
       SIDEBAR TOGGLE
    ═══════════════════════════════════════════════════════════ */
    const sidebar       = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mainContent   = document.getElementById('mainContent');

    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function isMobile() { return window.innerWidth <= 768; }

    function openSidebar() {
        if (isMobile()) { sidebar.classList.add('open'); overlay.classList.add('visible'); }
        else { sidebar.classList.remove('collapsed'); mainContent.style.marginLeft = 'var(--sidebar-w)'; }
    }
    function closeSidebar() {
        if (isMobile()) { sidebar.classList.remove('open'); overlay.classList.remove('visible'); }
        else { sidebar.classList.add('collapsed'); mainContent.style.marginLeft = '0'; }
    }

    let sidebarOpen = true;
    sidebarToggle.addEventListener('click', () => { sidebarOpen = !sidebarOpen; sidebarOpen ? openSidebar() : closeSidebar(); });
    overlay.addEventListener('click', () => { sidebarOpen = false; closeSidebar(); });
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            overlay.classList.remove('visible');
            sidebar.classList.remove('open');
            if (sidebarOpen) { sidebar.classList.remove('collapsed'); mainContent.style.marginLeft = 'var(--sidebar-w)'; }
        }
    });

    /* ═══════════════════════════════════════════════════════════
       ACTIVE NAV
    ═══════════════════════════════════════════════════════════ */
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            if (isMobile()) { sidebarOpen = false; closeSidebar(); }
        });
    });

    /* ═══════════════════════════════════════════════════════════
       HEADER SCROLL
    ═══════════════════════════════════════════════════════════ */
    const header = document.getElementById('topHeader');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    /* ═══════════════════════════════════════════════════════════
       THEME TOGGLE
    ═══════════════════════════════════════════════════════════ */
    const themeToggle = document.getElementById('themeToggle');
    const html        = document.documentElement;
    html.setAttribute('data-theme', localStorage.getItem('cm-theme') || 'dark');
    themeToggle.addEventListener('click', () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('cm-theme', next);
    });

    /* ═══════════════════════════════════════════════════════════
       QUICK ACTION BUTTONS
    ═══════════════════════════════════════════════════════════ */
    document.querySelectorAll('.qa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.qa-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    /* ═══════════════════════════════════════════════════════════
       HORIZONTAL SCROLL BUTTONS
    ═══════════════════════════════════════════════════════════ */
    document.querySelectorAll('.cards-scroll-wrapper').forEach(wrapper => {
        const row   = wrapper.querySelector('.cards-row');
        const left  = wrapper.querySelector('.scroll-left');
        const right = wrapper.querySelector('.scroll-right');
        left?.addEventListener('click',  () => row.scrollBy({ left: -480, behavior: 'smooth' }));
        right?.addEventListener('click', () => row.scrollBy({ left:  480, behavior: 'smooth' }));
    });

    /* ═══════════════════════════════════════════════════════════
       SEARCH KEYBOARD SHORTCUT
    ═══════════════════════════════════════════════════════════ */
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
    });

    /* ═══════════════════════════════════════════════════════════
       CARD BUILDER
    ═══════════════════════════════════════════════════════════ */
    const STAR_SVG = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    function buildCard(movie) {
        const posterSrc = movie.poster_url || movie.backdrop_url || Utils.PLACEHOLDER;
        const genres    = Utils.genreNames(movie.genre_ids || []);
        const year      = Utils.year(movie.release_date);
        const rating    = Utils.rating(movie.vote_average);
        const title     = movie.title || movie.name || 'Untitled';
        const reason    = movie.reason || '';
        const movieId   = movie.id;

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.movieId = movieId;

        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${posterSrc}" alt="${title}"
                     onerror="this.src='${Utils.PLACEHOLDER}'">
                <div class="card-overlay">
                    <button class="card-play-btn" aria-label="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <div class="card-overlay-actions">
                        <button aria-label="Add to watchlist">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button aria-label="Like">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                        <button aria-label="More info">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                        </button>
                    </div>
                </div>
                <span class="rating-badge">${STAR_SVG} ${rating}</span>
                ${reason ? `<span class="reason-badge">${reason}</span>` : ''}
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${genres.join(' • ') || 'Cinema'} • ${year}</p>
            </div>`;

        Utils.lazyLoad(card.querySelector('img'));

        card.addEventListener('click', () => { window.location.href = '/movie/' + movieId; });
        card.querySelectorAll('.card-overlay button').forEach(btn => {
            btn.addEventListener('click', e => e.stopPropagation());
        });

        return card;
    }

    /* ═══════════════════════════════════════════════════════════
       SKELETON CARDS
    ═══════════════════════════════════════════════════════════ */
    function buildSkeleton() {
        const card = document.createElement('div');
        card.className = 'movie-card is-skeleton';
        card.innerHTML = `
            <div class="card-poster">
                <div class="card-poster-skel skeleton"></div>
            </div>
            <div class="card-info">
                <div class="card-title-skel skeleton"></div>
                <div class="card-genre-skel skeleton"></div>
            </div>`;
        return card;
    }

    function showSkeletons(rowEl, count = 8) {
        rowEl.innerHTML = '';
        for (let i = 0; i < count; i++) rowEl.appendChild(buildSkeleton());
    }

    function clearRow(rowEl, msg) {
        rowEl.innerHTML = `<p style="color:var(--text-muted);padding:1rem;font-size:0.85rem;">${msg}</p>`;
    }

    /* ═══════════════════════════════════════════════════════════
       POPULATE A ROW
    ═══════════════════════════════════════════════════════════ */
    function populateRow(rowId, movies) {
        const rowEl = document.querySelector('#' + rowId + ' .cards-row');
        if (!rowEl) return;
        rowEl.innerHTML = '';
        if (!movies || !movies.length) {
            clearRow(rowEl, 'Nothing to show right now.');
            return;
        }
        movies.forEach(m => rowEl.appendChild(buildCard(m)));
    }

    async function loadRow(rowId, apiPath) {
        const rowEl = document.querySelector('#' + rowId + ' .cards-row');
        if (!rowEl) return;
        showSkeletons(rowEl);
        try {
            const data = await Utils.fetchJSON(apiPath);
            if (data.ok && data.results && data.results.length > 0) {
                rowEl.innerHTML = '';
                data.results.forEach(m => rowEl.appendChild(buildCard(m)));
            } else {
                clearRow(rowEl, 'Nothing to show right now.');
            }
        } catch (err) {
            console.error('[CineMantra] loadRow failed:', rowId, err);
            clearRow(rowEl, 'Unable to load movies.');
            Toast.show('Unable to load movies', 'error');
        }
    }

    /* ═══════════════════════════════════════════════════════════
       HERO SLIDER
    ═══════════════════════════════════════════════════════════ */
    const heroBanner = document.getElementById('heroBanner');
    const sliderDots = document.getElementById('sliderDots');
    const prevBtn    = document.getElementById('heroPrev');
    const nextBtn    = document.getElementById('heroNext');

    let heroMovies  = [];
    let heroCurrent = 0;
    let heroTimer   = null;

    function renderHeroSlide(movie, index) {
        const backdropURL = movie.backdrop_url || null;
        const posterURL   = movie.poster_url || movie.backdrop_url || Utils.PLACEHOLDER;
        const genres      = Utils.genreNames(movie.genre_ids || []);
        const year        = Utils.year(movie.release_date);
        const rating      = Utils.rating(movie.vote_average);
        const title       = movie.title || movie.name || 'Untitled';
        const overview    = movie.overview || '';

        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        slide.dataset.index = index;

        slide.innerHTML = `
            ${backdropURL
                ? `<div class="hero-bg-real" style="background-image:url('${backdropURL}')"></div>`
                : `<div class="hero-bg-placeholder"></div>`
            }
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <div class="hero-left">
                    <span class="trending-badge">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                        #${index + 1} Trending Telugu
                    </span>
                    <h1 class="hero-title">${title}</h1>
                    <div class="hero-meta">
                        <span class="hero-year">${year}</span>
                        <span class="hero-dot">•</span>
                        <span class="hero-rating">${STAR_SVG} ${rating}</span>
                        <span class="hero-dot">•</span>
                        <span class="hero-cert">UA</span>
                    </div>
                    <p class="hero-overview">${overview}</p>
                    <div class="hero-genres">
                        ${genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                    </div>
                    <div class="hero-actions">
                        <button class="btn-primary" onclick="window.location.href='/movie/${movie.id}'">
                            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Watch Trailer
                        </button>
                        <button class="btn-secondary" onclick="window.location.href='/movie/${movie.id}'">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            More Info
                        </button>
                        <button class="btn-icon" aria-label="Add to favorites">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                    </div>
                </div>
                <div class="hero-right">
                    <img class="hero-poster-img" src="${posterURL}"
                         alt="${title}"
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
        heroCurrent = (index + heroMovies.length) % heroMovies.length;
        slides[heroCurrent]?.classList.add('active');
        dots[heroCurrent]?.classList.add('active');
    }

    function startHeroAuto() { heroTimer = setInterval(() => goToHero(heroCurrent + 1), 8000); }
    function resetHeroAuto() { clearInterval(heroTimer); startHeroAuto(); }

    async function initHero() {
        try {
            const data = await Utils.fetchJSON('/api/telugu/trending');
            if (!data.ok || !data.results || !data.results.length) {
                console.warn('[CineMantra] Hero: no Telugu trending data', data);
                return;
            }

            heroMovies = data.results.slice(0, 5);
            const controls = heroBanner.querySelector('.hero-slider-controls');

            document.getElementById('heroPlaceholder')?.remove();

            heroMovies.forEach((movie, i) => {
                heroBanner.insertBefore(renderHeroSlide(movie, i), controls);
            });

            heroBanner.querySelector('.hero-slide')?.classList.add('active');
            buildDots(heroMovies.length);

            prevBtn?.addEventListener('click', () => { goToHero(heroCurrent - 1); resetHeroAuto(); });
            nextBtn?.addEventListener('click', () => { goToHero(heroCurrent + 1); resetHeroAuto(); });

            startHeroAuto();

        } catch (err) {
            console.error('[CineMantra] Hero load failed:', err);
            Toast.show('Unable to load hero banner', 'error');
        }
    }

    /* ═══════════════════════════════════════════════════════════
       DB ROWS — watchlist / favorites / recent
    ═══════════════════════════════════════════════════════════ */
    function buildDbCard(m) {
        const year    = m.release_date ? m.release_date.slice(0, 4) : '\u2014';
        const rating  = m.rating ? Number(m.rating).toFixed(1) : '\u2014';
        const movieId = m.movie_id;
        const poster  = m.poster || Utils.PLACEHOLDER;

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.movieId = movieId;
        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${poster}" alt="${m.title}"
                     onerror="this.src='${Utils.PLACEHOLDER}'">
                <div class="card-overlay">
                    <button class="card-play-btn" aria-label="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                </div>
                <span class="rating-badge">${STAR_SVG} ${rating}</span>
                ${m.favorite ? '<span class="reason-badge">\u2665 Favorite</span>' : (m.watched ? '<span class="reason-badge">\u2713 Watched</span>' : '')}
            </div>
            <div class="card-info">
                <h3 class="card-title">${m.title}</h3>
                <p class="card-genre">${year}</p>
            </div>`;
        Utils.lazyLoad(card.querySelector('img'));
        card.addEventListener('click', () => { window.location.href = '/movie/' + movieId; });
        card.querySelectorAll('.card-overlay button').forEach(btn => {
            btn.addEventListener('click', e => e.stopPropagation());
        });
        return card;
    }

    async function loadDbRow(rowId, apiPath, filterFn) {
        const rowEl   = document.querySelector('#' + rowId + ' .cards-row');
        const section = document.getElementById(rowId);
        if (!rowEl || !section) return;
        showSkeletons(rowEl, 6);
        try {
            const data = await Utils.fetchJSON(apiPath);
            let items = data.ok ? (data.results || []) : [];
            if (filterFn) items = items.filter(filterFn);
            if (!items.length) { section.style.display = 'none'; return; }
            section.style.display = '';
            rowEl.innerHTML = '';
            items.forEach(m => rowEl.appendChild(buildDbCard(m)));
        } catch {
            section.style.display = 'none';
        }
    }

    /* ═══════════════════════════════════════════════════════════
       RECOMMENDED ROW
    ═══════════════════════════════════════════════════════════ */
    async function loadRecommendedRow() {
        const rowEl = document.querySelector('#row-recommended .cards-row');
        if (!rowEl) return;
        showSkeletons(rowEl);

        const history   = JSON.parse(localStorage.getItem('cm-history')   || '[]').slice(0, 5);
        const favorites = JSON.parse(localStorage.getItem('cm-favorites') || '[]').slice(0, 5);
        const watchlist = JSON.parse(localStorage.getItem('cm-watchlist') || '[]').slice(0, 5);

        const params = new URLSearchParams();
        if (history.length)   params.set('history',   history.join(','));
        if (favorites.length) params.set('favorites', favorites.join(','));
        if (watchlist.length) params.set('watchlist', watchlist.join(','));

        try {
            const url  = '/api/recommend/personalized' + (params.toString() ? '?' + params : '');
            const data = await Utils.fetchJSON(url);
            const movies = data.ok ? (data.results || []) : [];
            if (movies.length) {
                rowEl.innerHTML = '';
                movies.forEach(m => rowEl.appendChild(buildCard(m)));
            } else {
                // fallback: now-playing
                const fb = await Utils.fetchJSON('/api/now-playing');
                if (fb.ok && fb.results && fb.results.length) {
                    rowEl.innerHTML = '';
                    fb.results.forEach(m => rowEl.appendChild(buildCard(m)));
                } else {
                    clearRow(rowEl, 'Nothing to show right now.');
                }
            }
        } catch (err) {
            console.error('[CineMantra] Recommended row failed:', err);
            // fallback silently
            try {
                const fb = await Utils.fetchJSON('/api/now-playing');
                if (fb.ok && fb.results && fb.results.length) {
                    rowEl.innerHTML = '';
                    fb.results.forEach(m => rowEl.appendChild(buildCard(m)));
                } else {
                    clearRow(rowEl, 'Nothing to show right now.');
                }
            } catch {
                clearRow(rowEl, 'Unable to load movies.');
            }
        }
    }

    /* ═══════════════════════════════════════════════════════════
       BOOT
    ═══════════════════════════════════════════════════════════ */
    async function boot() {
        initHero();

        // Priority rows — load immediately (above the fold)
        loadRow('row-te-trending',   '/api/telugu/trending');
        loadRow('row-te-popular',    '/api/telugu/popular');
        loadRow('row-te-nowplaying', '/api/telugu/now-playing');
        loadRow('row-te-upcoming',   '/api/telugu/upcoming');

        loadDbRow('row-continue',  '/api/watchlist', m => !m.watched);
        loadDbRow('row-favorites', '/api/watchlist', m => !!m.favorite);
        loadDbRow('row-recent',    '/api/recent');

        // Deferred rows — load after a short delay (below the fold)
        setTimeout(() => {
            loadRow('row-te-toprated',     '/api/telugu/top-rated');
            loadRow('row-te-webseries',    '/api/telugu/web-series');
            loadRow('row-te-ott',          '/api/telugu/ott');
            loadRow('row-te-classics',     '/api/telugu/classics');
            loadRow('row-te-action',       '/api/telugu/action');
            loadRow('row-te-comedy',       '/api/telugu/comedy');
            loadDbRow('row-watchlist',     '/api/watchlist');
        }, 400);

        // Low-priority rows — load last
        setTimeout(() => {
            loadRow('row-te-family',       '/api/telugu/family');
            loadRow('row-te-romance',      '/api/telugu/romance');
            loadRow('row-te-thriller',     '/api/telugu/thriller');
            loadRow('row-te-crime',        '/api/telugu/crime');
            loadRow('row-te-horror',       '/api/telugu/horror');
            loadRow('row-te-historical',   '/api/telugu/historical');
            loadRow('row-te-mythological', '/api/telugu/mythological');
            loadRecommendedRow();
        }, 1200);
    }

    boot();

})();
