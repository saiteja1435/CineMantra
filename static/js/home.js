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
       LANGUAGE SWITCHER
    ═══════════════════════════════════════════════════════════ */
    const LANG_LABELS = { te: 'Telugu', hi: 'Hindi', en: 'English', ta: 'Tamil', ml: 'Malayalam', kn: 'Kannada', bn: 'Bengali', mr: 'Marathi' };
    const GENRE_IDS   = { action:28, comedy:35, romance:10749, thriller:53, crime:80, family:10751, horror:27, historical:36, drama:18 };

    let _lang = localStorage.getItem('cm-lang') || 'te';

    // Sync select on load
    const langSelectEl = document.getElementById('langSelect');
    if (langSelectEl) {
        langSelectEl.value = _lang;
        // change is handled globally in base.html (page reload)
        // but also support in-page reload for home page
        langSelectEl.addEventListener('change', () => {
            _lang = langSelectEl.value;
            localStorage.setItem('cm-lang', _lang);
            reloadAllRows();
            Toast.show(`🌐 Switched to ${LANG_LABELS[_lang] || _lang} movies`, 'info');
        });
    }

    function langApi(path) { return path + '?lang=' + _lang; }

    // Row title templates — {L} replaced with language name
    const ROW_TITLES = {
        'row-te-trending':    ['🔥 Trending {L}',         'Most watched {L} movies right now'],
        'row-te-popular':     ['🎬 Popular {L} Movies',   'All-time {L} crowd favourites'],
        'row-te-toprated':    ['⭐ Top Rated {L}',        'Critically acclaimed {L} cinema'],
        'row-te-upcoming':    ['🎬 Latest {L} Releases',  'New & upcoming {L} movies'],
        'row-te-nowplaying':  ['🍿 Now Playing {L}',      'Currently in theatres'],
        'row-te-webseries':   ['📺 Trending {L} Web Series', 'Top {L} OTT originals'],
        'row-te-classics':    ['🏆 Classic {L} Movies',   'Timeless {L} masterpieces'],
        'row-te-action':      ['⚔ {L} Action',            'High-octane {L} action'],
        'row-te-comedy':      ['😂 {L} Comedy',           'Laugh-out-loud {L} hits'],
        'row-te-romance':     ['❤️ {L} Romance',          'Best {L} love stories'],
        'row-te-thriller':    ['🔎 {L} Thrillers',        'Edge-of-your-seat {L} suspense'],
        'row-te-crime':       ['🕵️ {L} Crime',            'Gripping {L} crime dramas'],
        'row-te-family':      ['👨‍👩‍👧 {L} Family',           '{L} movies for the whole family'],
        'row-te-horror':      ['👻 {L} Horror',           'Spine-chilling {L} horror'],
        'row-te-historical':  ['🏛 {L} Historical',       'Epic {L} period dramas'],
        'row-te-mythological':['🕉 {L} Mythological',     '{L} mythological epics'],
    };

    function updateRowTitles() {
        const L = LANG_LABELS[_lang] || _lang;
        Object.entries(ROW_TITLES).forEach(([id, [title, sub]]) => {
            const sec = document.getElementById(id);
            if (!sec) return;
            const t = sec.querySelector('.row-title');
            const s = sec.querySelector('.row-subtitle');
            if (t) t.textContent = title.replace(/{L}/g, L);
            if (s) s.textContent = sub.replace(/{L}/g, L);
        });
    }

    function reloadAllRows() {
        updateRowTitles();
        // Clear & reload hero
        heroBanner.querySelectorAll('.hero-slide').forEach(s => s.remove());
        heroMovies = []; heroCurrent = 0; clearInterval(heroTimer);
        initHero();

        // Reload all movie rows with selected language
        const langRows = [
            ['row-te-trending',   '/api/movies/trending'],
            ['row-te-popular',    '/api/movies/popular'],
            ['row-te-nowplaying', '/api/movies/now-playing'],
            ['row-te-upcoming',   '/api/movies/upcoming'],
            ['row-te-toprated',   '/api/movies/top-rated'],
            ['row-te-webseries',  '/api/movies/web-series'],
            ['row-te-classics',   '/api/movies/classics'],
            ['row-te-action',     '/api/movies/genre/28'],
            ['row-te-comedy',     '/api/movies/genre/35'],
            ['row-te-romance',    '/api/movies/genre/10749'],
            ['row-te-thriller',   '/api/movies/genre/53'],
            ['row-te-crime',      '/api/movies/genre/80'],
            ['row-te-family',     '/api/movies/genre/10751'],
            ['row-te-horror',     '/api/movies/genre/27'],
            ['row-te-historical', '/api/movies/genre/36'],
            ['row-te-mythological','/api/movies/genre/18'],
        ];
        langRows.forEach(([id, path]) => loadRow(id, langApi(path)));
    }

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
       SCROLL TO ROW HELPER
    ═══════════════════════════════════════════════════════════ */
    function scrollToRow(rowId) {
        const el = document.getElementById(rowId);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ═══════════════════════════════════════════════════════════
       QUICK ACTION BUTTONS
    ═══════════════════════════════════════════════════════════ */
    const QA_SCROLL_MAP = {
        'trending':   'row-te-trending',
        'toprated':   'row-te-toprated',
        'new':        'row-te-nowplaying',
        'upcoming':   'row-te-upcoming',
        'history':    'row-recent',
        'watchlater': 'row-watchlist',
        'favorites':  'row-favorites',
    };

    document.querySelectorAll('.qa-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.qa-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            if (filter === 'surprise') return; // handled by surprise.js
            const target = QA_SCROLL_MAP[filter];
            if (target) scrollToRow(target);
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
                <span class="ott-card-badge"></span>
                ${reason ? `<span class="reason-badge">${reason}</span>` : ''}
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${genres.join(' • ') || 'Cinema'} • ${year}</p>
            </div>`;

        Utils.lazyLoad(card.querySelector('img'));

        card.addEventListener('click', () => {
            window.trackGenres?.(movie.genre_ids || []);
            window.cacheMovieForOffline?.(movie);
            window.location.href = '/movie/' + movieId;
        });
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

    async function attachOTTBadges(rowEl, movies) {
        const ids = movies.map(m => m.id).filter(Boolean);
        if (!ids.length) return;
        try {
            const data = await Utils.fetchJSON('/api/movies/ott-providers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids }),
            });
            if (!data.ok) return;
            rowEl.querySelectorAll('.movie-card').forEach(card => {
                const p = data.providers[card.dataset.movieId];
                const badge = card.querySelector('.ott-card-badge');
                if (!badge) return;
                if (p && p.logo) {
                    badge.innerHTML = `<img src="${p.logo}" alt="${p.name}" title="${p.name}">`;
                    badge.style.display = '';
                } else {
                    badge.style.display = 'none';
                }
            });
        } catch (e) {
            console.error('[OTT Badge]', e);
        }
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
                attachOTTBadges(rowEl, data.results);
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
                        #${index + 1} Trending ${LANG_LABELS[_lang] || _lang}
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
            // Clear existing slides
            heroBanner.querySelectorAll('.hero-slide').forEach(s => s.remove());
            document.getElementById('heroPlaceholder')?.remove();
            heroMovies = []; heroCurrent = 0; clearInterval(heroTimer);

            const data = await Utils.fetchJSON(langApi('/api/movies/trending'));
            if (!data.ok || !data.results || !data.results.length) {
                console.warn('[CineMantra] Hero: no trending data', data);
                return;
            }

            heroMovies = data.results.slice(0, 5);
            const controls = heroBanner.querySelector('.hero-slider-controls');

            heroMovies.forEach((movie, i) => {
                heroBanner.insertBefore(renderHeroSlide(movie, i), controls);
            });

            heroBanner.querySelector('.hero-slide')?.classList.add('active');
            buildDots(heroMovies.length);

            // Remove old listeners by cloning buttons
            const newPrev = prevBtn?.cloneNode(true);
            const newNext = nextBtn?.cloneNode(true);
            prevBtn?.parentNode?.replaceChild(newPrev, prevBtn);
            nextBtn?.parentNode?.replaceChild(newNext, nextBtn);
            newPrev?.addEventListener('click', () => { goToHero(heroCurrent - 1); resetHeroAuto(); });
            newNext?.addEventListener('click', () => { goToHero(heroCurrent + 1); resetHeroAuto(); });

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
    const GENRE_NAMES = {
        28:'Action', 35:'Comedy', 27:'Horror', 10749:'Romance',
        53:'Thriller', 80:'Crime', 18:'Drama', 10751:'Family',
        36:'Historical', 12:'Adventure', 878:'Sci-Fi', 14:'Fantasy',
    };

    function getTopGenres(n = 3) {
        try {
            const counts = JSON.parse(localStorage.getItem('cm-genre-history') || '{}');
            return Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, n)
                .map(([id]) => Number(id));
        } catch { return []; }
    }

    async function loadRecommendedRow() {
        const section = document.getElementById('row-recommended');
        const rowEl   = section?.querySelector('.cards-row');
        const titleEl = section?.querySelector('.row-title');
        const subEl   = section?.querySelector('.row-subtitle');
        if (!rowEl) return;
        showSkeletons(rowEl);

        const topGenres = getTopGenres(3);

        // If user has genre history, load genre-based recommendations
        if (topGenres.length) {
            try {
                // Fetch top 3 genres in parallel, merge & dedupe
                const fetches = topGenres.map(gid => Utils.fetchJSON(GENRE_API[gid] || '/api/telugu/trending'));
                const results = await Promise.all(fetches);

                const seen = new Set();
                const movies = [];
                results.forEach((data, i) => {
                    if (!data.ok) return;
                    (data.results || []).forEach(m => {
                        if (!seen.has(m.id)) {
                            seen.add(m.id);
                            m._matched_genre = topGenres[i]; // tag for label
                            movies.push(m);
                        }
                    });
                });

                if (movies.length) {
                    // Update section title
                    const labels = topGenres.map(g => GENRE_NAMES[g]).filter(Boolean);
                    if (titleEl) titleEl.textContent = `🎯 Recommended for You`;
                    if (subEl)   subEl.textContent   = `Based on your taste: ${labels.join(', ')}`;

                    rowEl.innerHTML = '';
                    movies.slice(0, 20).forEach(m => rowEl.appendChild(buildCard(m)));
                    return;
                }
            } catch (e) {
                console.error('[Recommended] Genre fetch failed:', e);
            }
        }

        // Fallback: personalized by watchlist/favorites/history
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
                return;
            }
        } catch (e) {
            console.error('[Recommended] Personalized failed:', e);
        }

        // Final fallback: now-playing
        try {
            const fb = await Utils.fetchJSON('/api/now-playing');
            if (fb.ok && fb.results?.length) {
                rowEl.innerHTML = '';
                fb.results.forEach(m => rowEl.appendChild(buildCard(m)));
            } else {
                clearRow(rowEl, 'Nothing to show right now.');
            }
        } catch {
            clearRow(rowEl, 'Unable to load movies.');
        }
    }

    /* ═══════════════════════════════════════════════════════════
       PERSONALIZED HERO — genre-based on login
    ═══════════════════════════════════════════════════════════ */
    const GENRE_API = {
        28:    '/api/telugu/action',
        35:    '/api/telugu/comedy',
        27:    '/api/telugu/horror',
        10749: '/api/telugu/romance',
        53:    '/api/telugu/thriller',
        80:    '/api/telugu/crime',
        18:    '/api/telugu/trending',
        10751: '/api/telugu/family',
        36:    '/api/telugu/historical',
    };

    function getTopGenre() {
        try {
            const raw = localStorage.getItem('cm-genre-history');
            if (!raw) return null;
            const counts = JSON.parse(raw);
            return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        } catch { return null; }
    }

    async function loadPersonalizedHero(genreId) {
        const api = GENRE_API[genreId];
        if (!api) return;
        try {
            const data = await Utils.fetchJSON(api);
            if (!data.ok || !data.results?.length) return;

            // Clear existing slides (keep controls)
            heroBanner.querySelectorAll('.hero-slide').forEach(s => s.remove());
            heroMovies  = data.results.slice(0, 5);
            heroCurrent = 0;
            clearInterval(heroTimer);

            const controls = heroBanner.querySelector('.hero-slider-controls');
            heroMovies.forEach((movie, i) => {
                heroBanner.insertBefore(renderHeroSlide(movie, i), controls);
            });
            heroBanner.querySelector('.hero-slide')?.classList.add('active');
            buildDots(heroMovies.length);
            startHeroAuto();

            const genreNames = { 28:'Action', 35:'Comedy', 27:'Horror', 10749:'Romance',
                53:'Thriller', 80:'Crime', 18:'Drama', 10751:'Family', 36:'Historical' };
            Toast.show(`🎬 Showing ${genreNames[genreId] || 'personalized'} picks for you`, 'info');
        } catch (e) {
            console.error('[Hero] Personalized load failed:', e);
        }
    }

    // Listen for login event from auth.js
    document.addEventListener('cm:user-login', () => {
        const topGenre = getTopGenre();
        if (topGenre) loadPersonalizedHero(Number(topGenre));
    });

    /* ═══════════════════════════════════════════════════════════
       ANCHOR SCROLL — handle /#row-* links
    ═══════════════════════════════════════════════════════════ */
    function handleAnchorScroll() {
        const hash = window.location.hash;
        if (!hash) return;
        const target = document.querySelector(hash);
        if (!target) return;
        setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 800);
    }
    window.addEventListener('load', handleAnchorScroll);

    // Intercept sidebar anchor links on the homepage — scroll instead of navigate
    document.querySelectorAll('.sidebar-nav a[href^="/#"]').forEach(a => {
        a.addEventListener('click', e => {
            if (window.location.pathname !== '/') return; // only on homepage
            e.preventDefault();
            const rowId = a.getAttribute('href').slice(2); // strip '/#'
            scrollToRow(rowId);
            // update active state
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            a.closest('.nav-item')?.classList.add('active');
        });
    });

    /* ═══════════════════════════════════════════════════════════
       ACTOR BIRTHDAYS TODAY
    ═══════════════════════════════════════════════════════════ */
    async function loadBirthdays() {
        const section = document.getElementById('row-birthdays');
        const strip   = document.getElementById('birthdayStrip');
        if (!section || !strip) return;
        try {
            const data = await Utils.fetchJSON('/api/actors/birthdays-today');
            const actors = (data.ok && data.results) ? data.results : [];
            if (!actors.length) return;
            section.style.display = '';
            actors.forEach(a => {
                const card = document.createElement('div');
                card.className = 'bday-card';
                const bday = a.birthday || '';
                const birthYear = bday ? parseInt(bday.slice(0, 4)) : 0;
                const age = birthYear ? (new Date().getFullYear() - birthYear) : 0;
                const imgHtml = a.profile_url
                    ? `<img class="bday-avatar" src="${a.profile_url}" alt="${a.name}" onerror="this.style.display='none'">`
                    : `<div class="bday-avatar-placeholder">🎂</div>`;
                card.innerHTML = `${imgHtml}
                    <span class="bday-name">${a.name}</span>
                    ${age ? `<span class="bday-age">🎂 ${age}</span>` : ''}`;
                card.addEventListener('click', () => window.location.href = '/person/' + a.id);
                strip.appendChild(card);
            });
        } catch(e) {
            console.error('[Birthdays] failed:', e);
        }
    }

    /* ═══════════════════════════════════════════════════════════
       BOOT
    ═══════════════════════════════════════════════════════════ */
    async function boot() {
        updateRowTitles();
        initHero();
        loadBirthdays();

        // Priority rows
        loadRow('row-te-trending',   langApi('/api/movies/trending'));
        loadRow('row-te-popular',    langApi('/api/movies/popular'));
        loadRow('row-te-nowplaying', langApi('/api/movies/now-playing'));
        loadRow('row-te-upcoming',   langApi('/api/movies/upcoming'));

        loadDbRow('row-continue',  '/api/watchlist', m => !m.watched);
        loadDbRow('row-favorites', '/api/watchlist', m => !!m.favorite);
        loadDbRow('row-recent',    '/api/recent');

        // Deferred rows
        setTimeout(() => {
            loadRow('row-te-toprated',     langApi('/api/movies/top-rated'));
            loadRow('row-te-ott-trending', '/api/ott/trending');
            loadRow('row-te-webseries',    langApi('/api/movies/web-series'));
            loadRow('row-te-ws-toprated',  '/api/telugu/web-series/top-rated');
            loadRow('row-te-ws-new',       '/api/telugu/web-series/new');
            loadRow('row-te-ws-drama',     '/api/telugu/web-series/drama');
            loadRow('row-te-ws-crime',     '/api/telugu/web-series/crime');
            loadRow('row-te-ws-thriller',  '/api/telugu/web-series/thriller');
            loadRow('row-te-ws-comedy',    '/api/telugu/web-series/comedy');
            loadRow('row-te-ws-romance',   '/api/telugu/web-series/romance');
            loadRow('row-te-ws-action',    '/api/telugu/web-series/action');
            loadRow('row-te-ott',          '/api/telugu/ott');
            loadRow('row-te-classics',     langApi('/api/movies/classics'));
            loadRow('row-te-action',       langApi('/api/movies/genre/28'));
            loadRow('row-te-comedy',       langApi('/api/movies/genre/35'));
            loadDbRow('row-watchlist',     '/api/watchlist');
        }, 400);

        // Low-priority rows
        setTimeout(() => {
            loadRow('row-te-family',       langApi('/api/movies/genre/10751'));
            loadRow('row-te-romance',      langApi('/api/movies/genre/10749'));
            loadRow('row-te-thriller',     langApi('/api/movies/genre/53'));
            loadRow('row-te-crime',        langApi('/api/movies/genre/80'));
            loadRow('row-te-horror',       langApi('/api/movies/genre/27'));
            loadRow('row-te-historical',   langApi('/api/movies/genre/36'));
            loadRow('row-te-mythological', langApi('/api/movies/genre/18'));
            loadRecommendedRow();
            loadBirthdays();
        }, 1200);
    }

    /* ═══════════════════════════════════════════════════════════
       OTT TRENDING ROW
    ═══════════════════════════════════════════════════════════ */
    async function loadOTTTrending() {
        loadRow('row-te-ott-trending', '/api/ott/trending');
    }

    /* ═══════════════════════════════════════════════════════════
       ACTOR BIRTHDAY ALERTS
    ═══════════════════════════════════════════════════════════ */
    async function loadBirthdays() {
        const section = document.getElementById('row-birthdays');
        const strip   = document.getElementById('birthdayStrip');
        if (!section || !strip) return;
        try {
            const data = await Utils.fetchJSON('/api/actors/birthdays-today');
            const actors = data.ok ? (data.results || []) : [];
            if (!actors.length) return;
            section.style.display = '';
            strip.innerHTML = '';
            actors.forEach(a => {
                const photo = a.profile_url || Utils.PLACEHOLDER;
                const card  = document.createElement('div');
                card.className = 'bday-card';
                card.innerHTML = `
                    <img src="${photo}" alt="${a.name}" onerror="this.src='${Utils.PLACEHOLDER}'">
                    <div class="bday-info">
                        <span class="bday-name">${a.name}</span>
                        <span class="bday-tag">🎂 Birthday Today!</span>
                    </div>`;
                card.addEventListener('click', () => window.location.href = '/person/' + a.id);
                strip.appendChild(card);
            });
            Toast.show(`🎂 ${actors.length} star${actors.length > 1 ? 's' : ''} celebrating birthday today!`, 'info');
        } catch(e) {
            console.error('[Birthdays]', e);
        }
    }

    boot();

})();
