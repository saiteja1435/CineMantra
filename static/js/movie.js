(() => {
    const MOVIE_ID    = document.getElementById('moviePage').dataset.movieId;
    const IMG_W342    = 'https://image.tmdb.org/t/p/w342';
    const IMG_ORIG    = 'https://image.tmdb.org/t/p/original';
    const IMG_W185    = 'https://image.tmdb.org/t/p/w185';
    const PLACEHOLDER = '/static/images/placeholder.svg';

    const STAR_SVG = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    /* ── Lazy image loader ───────────────────────────────── */
    function lazyImg(img) {
        Utils.lazyLoad(img);
    }

    function clearSkel(el) { el.classList.remove('skeleton'); el.innerHTML = ''; }
    function runtime(m)    { return m ? `${Math.floor(m/60)}h ${m%60}m` : '\u2014'; }
    function fmt(d)        { return d ? new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' }) : '\u2014'; }

    /* ── Scroll buttons ──────────────────────────────────── */
    function initScrollBtns(wrap) {
        const row   = wrap.querySelector('.md-cast-row, .md-gallery-row, .cards-row, .yt-row, .lnews-row, .airec-row');
        const left  = wrap.querySelector('.scroll-left');
        const right = wrap.querySelector('.scroll-right');
        left?.addEventListener('click',  () => row?.scrollBy({ left: -400, behavior: 'smooth' }));
        right?.addEventListener('click', () => row?.scrollBy({ left:  400, behavior: 'smooth' }));
    }
    document.querySelectorAll('.md-scroll-wrap').forEach(initScrollBtns);

    /* ── Embedded Trailer ────────────────────────────────── */
    function renderEmbeddedTrailer(key, name) {
        const wrap        = document.getElementById('trailerEmbedWrap');
        const notAvail    = document.getElementById('trailerNotAvailable');
        const metaEl      = document.getElementById('trailerMeta');
        const titleEl     = document.getElementById('trailerEmbedTitle');
        const iframeEl    = document.getElementById('trailerIframe');

        if (!key) {
            wrap.style.display     = 'none';
            metaEl.style.display   = 'none';
            notAvail.style.display = '';
            console.log('Trailer not available for movie', MOVIE_ID);
            return;
        }

        iframeEl.src = `https://www.youtube.com/embed/${key}?autoplay=0&rel=0&modestbranding=1`;
        titleEl.textContent    = name || 'Main Trailer';
        wrap.style.display     = '';
        metaEl.style.display   = '';
        notAvail.style.display = 'none';
        console.log('Trailer iframe loaded', { key, name });
    }

    /* ── Trailer Modal ───────────────────────────────────── */
    const ytModal      = document.getElementById('ytModal');
    const ytIframe     = document.getElementById('ytIframe');
    const ytModalTitle = document.getElementById('ytModalTitle');
    const ytModalClose = document.getElementById('ytModalClose');
    const btnTrailer   = document.getElementById('btnTrailer');
    let _trailerKey    = null;
    let _trailerName   = null;

    function openModal(videoId, title) {
        ytIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
        ytModalTitle.textContent = title || '';
        ytModal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeModal() {
        ytModal.classList.remove('open');
        ytIframe.src = '';
        document.body.style.overflow = '';
    }

    ytModalClose.addEventListener('click', closeModal);
    ytModal.addEventListener('click', e => { if (e.target === ytModal) closeModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal(); closeLightbox(); }
    });
    btnTrailer.addEventListener('click', () => {
        if (_trailerKey) openModal(_trailerKey, _trailerName);
    });

    /* ── Lightbox ────────────────────────────────────────── */
    const lightbox      = document.getElementById('lightbox');
    const lightboxImg   = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    function openLightbox(src) {
        lightboxImg.src = src;
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    }
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

    /* ── Watchlist & Favorites ───────────────────────────── */
    const btnFav       = document.getElementById('btnFav');
    const btnWatchlist = document.getElementById('btnWatchlist');

    function _syncWlBtn(item) {
        if (!btnWatchlist) return;
        const added = !!item;
        btnWatchlist.classList.toggle('btn-active', added);
        const span = btnWatchlist.querySelector('span.btn-label');
        if (span) span.textContent = added ? '\u2713 In Watchlist' : 'Watchlist';
    }
    function _syncFavBtn(item) {
        if (!btnFav) return;
        const fav = item && item.favorite;
        btnFav.classList.toggle('btn-active', !!fav);
        const svg = btnFav.querySelector('svg path');
        if (svg) svg.setAttribute('fill', fav ? 'currentColor' : 'none');
    }

    function _wrapBtnText(btn) {
        if (!btn) return;
        [...btn.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => {
            const s = document.createElement('span');
            s.className = 'btn-label';
            s.textContent = n.textContent.trim();
            n.replaceWith(s);
        });
    }

    async function initListButtons(movieId, details) {
        if (!movieId) return;
        const id = parseInt(movieId, 10);
        _wrapBtnText(btnWatchlist);

        // Check current DB status
        try {
            const res = await Utils.fetchJSON(`/api/watchlist/status/${id}`);
            _syncWlBtn(res.item);
            _syncFavBtn(res.item);
        } catch { /* ignore */ }

        // Add to recent
        fetch('/api/recent/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-ID': window.CM_UID || 'local' },
            body: JSON.stringify({
                movie_id:     id,
                title:        details.title || '',
                poster:       details.poster_url   || '',
                backdrop:     details.backdrop_url || '',
                rating:       details.vote_average || 0,
                release_date: details.release_date || '',
            }),
        }).catch(() => {});

        const _payload = () => ({
            movie_id:     id,
            title:        details.title || '',
            poster:       details.poster_url   || '',
            backdrop:     details.backdrop_url || '',
            rating:       details.vote_average || 0,
            release_date: details.release_date || '',
        });

        btnWatchlist?.addEventListener('click', async () => {
            const cur = await Utils.fetchJSON(`/api/watchlist/status/${id}`);
            if (cur.item) {
                await fetch('/api/watchlist/remove', { method:'POST', headers:{'Content-Type':'application/json','X-User-ID':window.CM_UID||'local'}, body: JSON.stringify({ movie_id: id }) });
                _syncWlBtn(null);
                Toast.show('Removed from Watchlist', 'info');
            } else {
                const r = await fetch('/api/watchlist/add', { method:'POST', headers:{'Content-Type':'application/json','X-User-ID':window.CM_UID||'local'}, body: JSON.stringify(_payload()) }).then(x => x.json());
                _syncWlBtn(r.item);
                Toast.show(`Added to Watchlist`, 'success');
            }
        });

        btnFav?.addEventListener('click', async () => {
            const r = await fetch('/api/watchlist/favorite', { method:'POST', headers:{'Content-Type':'application/json','X-User-ID':window.CM_UID||'local'}, body: JSON.stringify(_payload()) }).then(x => x.json());
            _syncFavBtn(r.item);
            Toast.show(r.favorite ? '\u2665 Added to Favorites' : 'Removed from Favorites', r.favorite ? 'success' : 'info');
        });
    }

    /* ── Share ───────────────────────────────────────────── */
    document.getElementById('btnShare').addEventListener('click', () => {
        if (navigator.share) navigator.share({ title: document.title, url: location.href });
        else navigator.clipboard?.writeText(location.href);
    });

    /* ── Mini movie card ─────────────────────────────────── */
    function buildCard(movie) {
        const posterSrc = movie.poster_url || PLACEHOLDER;
        const title     = movie.title || movie.name || 'Untitled';
        const year      = movie.release_date ? movie.release_date.slice(0, 4) : '\u2014';
        const rating    = movie.vote_average ? movie.vote_average.toFixed(1) : '\u2014';
        const reason    = movie.reason || '';
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${posterSrc}" alt="${title}" loading="lazy">
                <div class="card-overlay">
                    <button class="card-play-btn" aria-label="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                </div>
                <span class="rating-badge">${STAR_SVG} ${rating}</span>
                ${reason ? `<span class="reason-badge">${reason}</span>` : ''}
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${year}</p>
            </div>`;
        card.addEventListener('click', () => { window.location.href = `/movie/${movie.id}`; });
        lazyImg(card.querySelector('img'));
        return card;
    }

    function populateCards(rowEl, movies) {
        rowEl.innerHTML = '';
        if (!movies?.length) {
            rowEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0;">Nothing to show.</p>';
            return;
        }
        movies.forEach(m => rowEl.appendChild(buildCard(m)));
    }

    /* ── YouTube video card ──────────────────────────────── */
    function buildYtCard(video) {
        const card = document.createElement('div');
        card.className = 'yt-card';
        card.innerHTML = `
            <div class="yt-thumb-wrap">
                <img class="lazy" data-src="${video.thumbnail}" alt="${video.title}" loading="lazy">
                <div class="yt-play-overlay">
                    <div class="yt-play-btn">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </div>
                </div>
                ${video.duration ? `<span class="yt-duration">${video.duration}</span>` : ''}
            </div>
            <div class="yt-info">
                <div class="yt-title">${video.title}</div>
                <div class="yt-meta">
                    <span>${video.channel}</span>
                    ${video.publishedAt ? `<span class="yt-meta-dot">\u2022</span><span>${video.publishedAt}</span>` : ''}
                </div>
            </div>`;
        card.addEventListener('click', () => openModal(video.videoId, video.title));
        lazyImg(card.querySelector('img'));
        return card;
    }

    /* ── Video Gallery — tab nav + shared carousel ───────── */
    const VG_TABS = [
        { id: 'behind',      label: 'Behind The Scenes', url: q => `/api/youtube/behind?q=${q}` },
        { id: 'featurettes', label: 'Featurettes',        url: q => `/api/youtube/featurettes?q=${q}` },
        { id: 'interviews',  label: 'Cast Interviews',    url: q => `/api/youtube/interviews?q=${q}` },
        { id: 'deleted',     label: 'Deleted Scenes',     url: q => `/api/youtube/deleted?q=${q}` },
        { id: 'songs',       label: 'Movie Songs',        url: q => `/api/youtube/songs?q=${q}`, validate: true },
    ];

    const _vgCache  = {};
    let   _vgActive = null;

    function _vgShowSkeletons() {
        const row = document.getElementById('vgCarousel');
        if (!row) return;
        row.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            row.innerHTML += `
                <div class="vg-skel-card">
                    <div class="vg-skel-thumb skeleton"></div>
                    <div class="vg-skel-line w80 skeleton"></div>
                    <div class="vg-skel-line w55 skeleton"></div>
                </div>`;
        }
    }

    function _vgRenderTab(id) {
        if (_vgActive === id) return;
        _vgActive = id;
        document.querySelectorAll('.vg-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.id === id));
        const row = document.getElementById('vgCarousel');
        if (!row) return;
        row.classList.remove('vg-animate');
        row.innerHTML = '';
        (_vgCache[id] || []).forEach(v => row.appendChild(buildYtCard(v)));
        row.scrollLeft = 0;
        void row.offsetWidth;
        row.classList.add('vg-animate');
    }

    async function loadTrailer() {
        console.log('Fetching videos for:', MOVIE_ID);
        try {
            const data = await Utils.fetchJSON(`/api/movie/${MOVIE_ID}/videos`);
            console.log('Video API response:', data);

            if (!data.ok || !data.trailer?.key) {
                console.warn('[Trailer] No trailer key in response — showing not available');
                renderEmbeddedTrailer(null, null);
                return;
            }

            console.log('Trailer key found:', data.trailer.key, '| name:', data.trailer.name);

            _trailerKey  = data.trailer.key;
            _trailerName = data.trailer.name || 'Main Trailer';

            renderEmbeddedTrailer(_trailerKey, _trailerName);
            btnTrailer.disabled      = false;
            btnTrailer.style.display = '';
        } catch (e) {
            console.warn('[Trailer] fetch failed:', e);
            renderEmbeddedTrailer(null, null);
        }
    }

    async function loadYouTube(movieName) {
        if (!movieName) return;
        const q       = encodeURIComponent(movieName);
        const section = document.getElementById('sectionVideoGallery');
        const tabsEl  = document.getElementById('vgTabs');
        if (!section || !tabsEl) return;

        section.style.display = '';
        _vgShowSkeletons();

        const results = await Promise.all(
            VG_TABS.map(tab =>
                Utils.fetchJSON(tab.url(q))
                    .then(d => ({ id: tab.id, videos: d.ok ? (d.results || []) : [] }))
                    .catch(() => ({ id: tab.id, videos: [] }))
            )
        );

        results.forEach(({ id, videos }) => { _vgCache[id] = videos; });

        tabsEl.innerHTML = '';
        let firstId = null;
        VG_TABS.forEach(tab => {
            const videos = _vgCache[tab.id] || [];
            const btn = document.createElement('button');
            btn.className   = 'vg-tab';
            btn.dataset.id  = tab.id;
            btn.textContent = tab.label;
            btn.disabled    = videos.length === 0;
            btn.addEventListener('click', () => _vgRenderTab(tab.id));
            tabsEl.appendChild(btn);
            if (!firstId && videos.length) firstId = tab.id;
        });

        if (firstId) {
            _vgRenderTab(firstId);
            const wrap = section.querySelector('.vg-carousel-wrap');
            if (wrap) initScrollBtns(wrap);
        } else {
            section.style.display = 'none';
        }
    }

    /* ── AI Review Summary ────────────────────────────────── */
    function _starStr(score) {
        const full  = Math.round(score / 2);
        const empty = 5 - full;
        return '★'.repeat(Math.max(0, full)) + '☆'.repeat(Math.max(0, empty));
    }

    async function loadAIReview(movieName, releaseDate, status) {
        if (!movieName) return;
        const section = document.getElementById('sectionAIReview');
        const card    = document.getElementById('airCard');
        if (!section || !card) return;

        section.style.display = '';
        console.log('[AI REVIEW] Loading reviews for:', movieName, '| release_date:', releaseDate, '| status:', status);

        try {
            const enc    = encodeURIComponent(movieName);
            const params = new URLSearchParams();
            if (releaseDate) params.set('release_date', releaseDate);
            if (status)      params.set('status', status);
            const url  = `/api/aireview/${enc}${params.toString() ? '?' + params.toString() : ''}`;
            const data = await Utils.fetchJSON(url);

            if (data.unreleased) {
                console.log('[AI REVIEW] Movie not yet released — showing placeholder.');
                card.innerHTML = `<p class="air-unreleased">&#x1F3AC; AI Review will be available after movie release.</p>`;
                return;
            }

            if (!data.ok || !data.result) {
                console.warn('[AI REVIEW] No result returned — hiding section.');
                section.style.display = 'none';
                return;
            }

            console.log('[AI REVIEW] AI Review restored successfully. sentiment:', data.result.overall_sentiment, 'rating:', data.result.rating_estimate);

            const r   = data.result;
            const sentiment = (r.overall_sentiment || '').toLowerCase();
            const sentClass = sentiment === 'positive' ? 'very-positive'
                            : sentiment === 'negative' ? 'negative' : 'mixed';

            card.innerHTML = `
                <div class="air-block-label">Summary</div>
                <p class="air-summary-text">${r.summary}</p>

                <div class="air-divider"></div>

                <div class="air-header">
                    <span class="air-sentiment ${sentClass}">${r.overall_sentiment}</span>
                    <span class="air-score-badge">
                        <span class="air-stars">${_starStr(r.rating_estimate)}</span>
                        ${r.rating_estimate} / 10
                    </span>
                    <span class="air-gemini-badge">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
                        Gemini
                    </span>
                </div>

                <div class="air-divider"></div>

                <div class="air-pc-grid">
                    <div>
                        <div class="air-block-label">&#x2705; Pros</div>
                        <ul class="air-list air-pros">
                            ${(r.pros || []).map(p => `<li><span class="air-icon">&#10003;</span>${p}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <div class="air-block-label">&#x274C; Cons</div>
                        <ul class="air-list air-cons">
                            ${(r.cons || []).map(c => `<li><span class="air-icon">&#10007;</span>${c}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div class="air-divider"></div>

                <div class="air-block-label">&#x2728; Highlights</div>
                <div class="air-highlights">
                    ${(r.highlights || []).map(h => `<span class="air-highlight-chip">${h}</span>`).join('')}
                </div>

                ${r.audience_verdict ? `
                <div class="air-divider"></div>
                <div class="air-block-label">&#x1F4AC; Audience Verdict</div>
                <p class="air-summary-text" style="font-style:italic;">${r.audience_verdict}</p>` : ''}

                <div class="air-divider"></div>

                <div class="air-block-label">&#x1F3AF; Recommended For</div>
                <div class="air-chips">
                    ${(r.recommended_for || []).map(a => `<span class="air-chip">${a}</span>`).join('')}
                </div>

                <p class="air-footer">Generated by Gemini after analyzing IMDb user reviews.</p>`;

        } catch {
            section.style.display = 'none';
        }
    }

    /* ── BACKDROP ────────────────────────────────────────── */
    function renderBackdrop(d) {
        const el  = document.getElementById('mdBackdropImg');
        const src = d.backdrop_url || null;
        el.classList.remove('skeleton');
        el.style.backgroundImage = src ? `url('${src}')` : 'none';
        if (!src) el.style.background = 'linear-gradient(135deg, #0D1B2A 0%, #1A2A4A 100%)';
    }

    /* ── INFO ────────────────────────────────────────────── */
    function renderInfo(d) {
        document.title = `${d.title || 'Movie'} \u2014 CineMantra`;

        console.log('[CineMantra] Movie detail:', { id: d.id, title: d.title, poster_url: d.poster_url, backdrop_url: d.backdrop_url });

        const posterEl  = document.getElementById('mdPoster');
        const posterSrc = d.poster_url || PLACEHOLDER;
        const img = document.createElement('img');
        img.className = 'md-poster';
        img.alt       = d.title || '';
        img.loading   = 'eager';
        img.onerror   = () => { img.src = PLACEHOLDER; };
        img.src       = posterSrc;
        posterEl.replaceWith(img);

        const titleEl = document.getElementById('mdTitleSkel');
        clearSkel(titleEl);
        titleEl.className   = 'md-title';
        titleEl.textContent = d.title || 'Untitled';

        const tagEl = document.getElementById('mdTaglineSkel');
        clearSkel(tagEl);
        tagEl.className   = 'md-tagline';
        tagEl.textContent = d.tagline || '';

        const metaEl      = document.getElementById('mdMeta');
        const statusClass = (d.status || '').toLowerCase() === 'released' ? 'status-released' : 'status-upcoming';
        metaEl.innerHTML  = `
            <span class="md-badge rating">${STAR_SVG} ${d.vote_average ? d.vote_average.toFixed(1) : '\u2014'} <span style="color:var(--text-dim);font-weight:400">(${(d.vote_count||0).toLocaleString()})</span></span>
            <span class="md-badge">${fmt(d.release_date)}</span>
            <span class="md-badge">${runtime(d.runtime)}</span>
            <span class="md-badge ${statusClass}">${d.status || '\u2014'}</span>`;

        document.getElementById('mdGenres').innerHTML =
            (d.genres || []).map(g => `<span class="genre-tag">${g.name}</span>`).join('');

        document.getElementById('mdOverview').textContent = d.overview || 'No overview available.';

        document.getElementById('mdStats').innerHTML = `
            <div class="md-stat"><div class="md-stat-label">Original Title</div><div class="md-stat-value">${d.original_title || '\u2014'}</div></div>
            <div class="md-stat"><div class="md-stat-label">Language</div><div class="md-stat-value">${(d.original_language||'\u2014').toUpperCase()}</div></div>`;

        document.getElementById('mdCompanies').innerHTML =
            (d.production_companies || []).slice(0, 5)
                .map(c => `<span class="md-company">${c.name}</span>`).join('');
    }

    /* ── CREW ────────────────────────────────────────────── */
    function renderCrew(crew) {
        const roles = { Director: null, Producer: null, Writer: null, 'Original Music Composer': null };
        crew.forEach(p => {
            if (p.job === 'Director'  && !roles.Director)  roles.Director = p.name;
            if (p.job === 'Producer'  && !roles.Producer)  roles.Producer = p.name;
            if ((p.job === 'Writer' || p.job === 'Screenplay') && !roles.Writer) roles.Writer = p.name;
            if (p.job === 'Original Music Composer' && !roles['Original Music Composer']) roles['Original Music Composer'] = p.name;
        });
        const labels = { Director:'Director', Producer:'Producer', Writer:'Writer', 'Original Music Composer':'Music' };
        const el = document.getElementById('mdCrew');
        el.innerHTML = '';
        Object.entries(roles).forEach(([role, name]) => {
            if (!name) return;
            const card = document.createElement('div');
            card.className = 'md-crew-card';
            card.innerHTML = `<div class="md-crew-role">${labels[role]}</div><div class="md-crew-name">${name}</div>`;
            el.appendChild(card);
        });
        if (!el.children.length) el.innerHTML = '<p class="md-empty">No crew info available.</p>';
    }

    /* ── CAST ────────────────────────────────────────────── */
    function renderCast(cast) {
        const el  = document.getElementById('mdCast');
        el.innerHTML = '';
        const top = cast.slice(0, 15);
        if (!top.length) { el.innerHTML = '<p class="md-empty">No cast info available.</p>'; return; }
        top.forEach(p => {
            const src  = p.profile_path ? `${IMG_W185}${p.profile_path}` : PLACEHOLDER;
            const card = document.createElement('div');
            card.className = 'cast-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <img class="cast-img lazy" data-src="${src}" alt="${p.name}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
                <div class="cast-name">${p.name}</div>
                <div class="cast-char">${p.character || ''}</div>`;
            card.addEventListener('click', () => {
                console.log('Person navigation clicked', { name: p.name, id: p.id });
                console.log('Opening person page ID:', p.id);
                window.location.href = `/person/${p.id}`;
            });
            lazyImg(card.querySelector('img'));
            el.appendChild(card);
        });
    }

    /* ── OTT Providers (premium) ────────────────────────── */
    const YT_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="#fff" width="28" height="28"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;

    function _buildOttCard(provider, actionClass, actionLabel, isYt) {
        const card = document.createElement('a');
        card.className = 'ott-card' + (isYt ? ' ott-youtube' : '');
        card.href      = provider.url || '#';
        card.target    = '_blank';
        card.rel       = 'noopener';
        card.title     = provider.name;

        const logoWrap = document.createElement('div');
        logoWrap.className = 'ott-logo-wrap';

        if (isYt) {
            logoWrap.innerHTML = YT_LOGO_SVG;
        } else if (provider.logo) {
            const img = document.createElement('img');
            img.className    = 'lazy';
            img.dataset.src  = provider.logo;
            img.alt          = provider.name;
            img.loading      = 'lazy';
            img.onerror      = () => {
                img.style.display = 'none';
                logoWrap.innerHTML = `<div class="ott-logo-placeholder">${provider.name.slice(0,2).toUpperCase()}</div>`;
            };
            logoWrap.appendChild(img);
            lazyImg(img);
        } else {
            logoWrap.innerHTML = `<div class="ott-logo-placeholder">${provider.name.slice(0,2).toUpperCase()}</div>`;
        }

        const nameEl = document.createElement('div');
        nameEl.className   = 'ott-card-name';
        nameEl.textContent = provider.name;

        const actionEl = document.createElement('div');
        actionEl.className   = `ott-card-action ${actionClass}`;
        actionEl.textContent = actionLabel;

        card.appendChild(logoWrap);
        card.appendChild(nameEl);
        card.appendChild(actionEl);
        return card;
    }

    function _buildOttGroup(label, providers, actionClass, actionLabel) {
        if (!providers.length) return null;
        const group = document.createElement('div');
        group.className = 'ott-group';
        const lbl = document.createElement('div');
        lbl.className   = 'ott-group-label';
        lbl.textContent = label;
        const row = document.createElement('div');
        row.className = 'ott-cards-row';
        providers.forEach(p => row.appendChild(_buildOttCard(p, actionClass, actionLabel, false)));
        group.appendChild(lbl);
        group.appendChild(row);
        return group;
    }

    async function loadOTT() {
        const section    = document.getElementById('sectionOTT');
        const body       = document.getElementById('ottBody');
        const skeleton   = document.getElementById('ottSkeleton');
        const countryBadge = document.getElementById('ottCountryBadge');
        const jwLink     = document.getElementById('ottJwLink');
        if (!section || !body) return;

        console.log('[OTT] Loading OTT Providers...');

        try {
            const data = await Utils.fetchJSON(`/api/movie/${MOVIE_ID}/streaming`);
            console.log('[OTT] OTT Providers Received', data);

            // Remove skeleton
            if (skeleton) skeleton.remove();
            body.innerHTML = '';

            const stream  = data.stream  || [];
            const rent    = data.rent    || [];
            const buy     = data.buy     || [];
            const ytProv  = data.youtube_provider || null;
            const country = data.country || null;
            const link    = data.link    || null;
            const total   = stream.length + rent.length + buy.length;

            // Country badge
            if (country && countryBadge) {
                const label = country === 'IN' ? '🇮🇳 Available in India'
                            : country === 'US' ? '🇺🇸 Available in United States'
                            : `Available in ${country}`;
                countryBadge.textContent = label;
                countryBadge.style.display = '';
                console.log(`[OTT] Country: ${country}`);
                if (country !== 'IN') console.log('[OTT] Fallback: US');
            }

            // JustWatch link
            if (link && jwLink) {
                jwLink.href = link;
                jwLink.style.display = '';
            }

            if (total === 0 && !ytProv) {
                body.innerHTML = `
                    <div class="ott-empty">
                        <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                            <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
                            <path d="M16 24h16M24 16v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                        <p>No streaming information available.</p>
                    </div>`;
                console.log('[OTT] OTT Section Rendered — no providers found');
                return;
            }

            // Stream group
            const streamGroup = _buildOttGroup('Stream', stream, 'ott-action-stream', 'Watch Now');
            if (streamGroup) body.appendChild(streamGroup);

            // Rent group
            const rentGroup = _buildOttGroup('Rent', rent, 'ott-action-rent', 'Rent');
            if (rentGroup) body.appendChild(rentGroup);

            // Buy group
            const buyGroup = _buildOttGroup('Buy', buy, 'ott-action-buy', 'Buy');
            if (buyGroup) body.appendChild(buyGroup);

            // YouTube provider card
            if (ytProv) {
                const ytGroup = document.createElement('div');
                ytGroup.className = 'ott-group';
                const ytLbl = document.createElement('div');
                ytLbl.className   = 'ott-group-label';
                ytLbl.textContent = 'YouTube';
                const ytRow = document.createElement('div');
                ytRow.className = 'ott-cards-row';
                ytRow.appendChild(_buildOttCard(ytProv, 'ott-action-yt', 'Watch', true));
                ytGroup.appendChild(ytLbl);
                ytGroup.appendChild(ytRow);
                body.appendChild(ytGroup);
            }

            console.log('[OTT] OTT Section Rendered');

        } catch (e) {
            console.warn('[OTT] load failed:', e);
            if (skeleton) skeleton.remove();
            body.innerHTML = '<p class="md-empty">No streaming information available.</p>';
        }
    }

    /* ── GALLERY ─────────────────────────────────────────── */
    function renderGallery(backdrops) {
        const el    = document.getElementById('mdGallery');
        el.innerHTML = '';
        const items = backdrops.slice(0, 12);
        if (!items.length) { el.innerHTML = '<p class="md-empty">No images available.</p>'; return; }
        items.forEach(img => {
            const src      = `${IMG_ORIG}${img.file_path}`;
            const thumbSrc = `${IMG_W342}${img.file_path}`;
            const item  = document.createElement('div');
            item.className = 'gallery-item';
            const imgEl = document.createElement('img');
            imgEl.className   = 'lazy';
            imgEl.dataset.src = thumbSrc;
            imgEl.loading     = 'lazy';
            imgEl.alt         = 'Gallery image';
            item.appendChild(imgEl);
            item.addEventListener('click', () => openLightbox(src));
            lazyImg(imgEl);
            el.appendChild(item);
        });
    }

    /* ── Recommendations (grouped: Genre / Actor / Director) ── */
    const _recCache = {};
    let   _recActive = null;

    function _recRenderTab(id) {
        if (_recActive === id) return;
        _recActive = id;
        document.querySelectorAll('.rec-tab').forEach(b =>
            b.classList.toggle('active', b.dataset.id === id));
        const rowEl = document.getElementById('mdRecommended');
        if (!rowEl) return;
        populateCards(rowEl, _recCache[id] || []);
        rowEl.scrollLeft = 0;
    }

    async function loadRecommendations() {
        const section = document.getElementById('sectionRecommended');
        const tabsEl  = document.getElementById('recTabs');
        const rowEl   = document.getElementById('mdRecommended');
        if (!section || !tabsEl || !rowEl) return;

        rowEl.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const s = document.createElement('div');
            s.className = 'movie-card is-skeleton';
            s.innerHTML = `<div class="card-poster"><div class="card-poster-skel skeleton"></div></div><div class="card-info"><div class="card-title-skel skeleton"></div><div class="card-genre-skel skeleton"></div></div>`;
            rowEl.appendChild(s);
        }

        try {
            const data = await Utils.fetchJSON(`/api/movie/${MOVIE_ID}/recommendations`);
            if (!data.ok) { section.style.display = 'none'; return; }
            console.log('Recommendation API response:', data);

            const TABS = [
                { id: 'recommended', icon: '\u2B50', data: data.recommended },
                { id: 'similar',     icon: '\uD83D\uDD0D', data: data.similar },
                { id: 'genre',       icon: '\uD83C\uDFAD', data: data.genre },
                { id: 'actor',       icon: '\uD83C\uDFC6', data: data.actor },
                { id: 'director',    icon: '\uD83C\uDFAC', data: data.director },
            ].filter(t => t.data?.movies?.length);

            if (!TABS.length) { section.style.display = 'none'; return; }

            TABS.forEach(t => { _recCache[t.id] = t.data.movies; });

            tabsEl.innerHTML = '';
            TABS.forEach((t, i) => {
                const btn = document.createElement('button');
                btn.className  = 'rec-tab' + (i === 0 ? ' active' : '');
                btn.dataset.id = t.id;
                btn.textContent = t.icon + ' ' + t.data.label;
                btn.addEventListener('click', () => _recRenderTab(t.id));
                tabsEl.appendChild(btn);
            });

            _recRenderTab(TABS[0].id);
            const wrap = section.querySelector('.rec-carousel-wrap');
            if (wrap) initScrollBtns(wrap);

        } catch {
            section.style.display = 'none';
        }
    }

    /* ── AI Recommendations ─────────────────────────────── */
    async function loadAIRecommendations() {
        const section   = document.getElementById('sectionAIRecommend');
        const row       = document.getElementById('airecRow');
        const reasonEl  = document.getElementById('airecReason');
        if (!section || !row) return;

        section.style.display = '';

        try {
            const data = await fetch('/api/ai/recommend', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-ID': window.CM_UID || 'local' },
                body:    JSON.stringify({ movie_id: parseInt(MOVIE_ID, 10) }),
            }).then(r => r.json());

            if (!data.ok || !data.result?.recommendations?.length) {
                section.style.display = 'none';
                return;
            }

            const { reason, recommendations } = data.result;
            if (reasonEl && reason) reasonEl.textContent = reason;

            row.innerHTML = '';
            recommendations.forEach(rec => {
                const imgSrc = rec.poster_url || PLACEHOLDER;

                const card = document.createElement('div');
                card.className = 'airec-card';
                card.innerHTML = `
                    <div class="airec-poster-wrap">
                        <img class="lazy" data-src="${imgSrc}" alt="${rec.title}" loading="lazy">
                    </div>
                    <div class="airec-body">
                        <div class="airec-title">${rec.title}</div>
                        <span class="airec-score">★ ${rec.match_score}% match</span>
                        <p class="airec-why">${rec.why}</p>
                    </div>`;

                if (rec.movie_id) {
                    card.addEventListener('click', () => {
                        window.location.href = `/movie/${rec.movie_id}`;
                    });
                } else {
                    card.style.cursor = 'default';
                }

                lazyImg(card.querySelector('img'));
                row.appendChild(card);
            });

            // Init scroll buttons
            const wrap = section.querySelector('.airec-scroll-wrap');
            if (wrap) initScrollBtns(wrap);

        } catch {
            section.style.display = 'none';
        }
    }

    /* ── Streaming availability + official trailer ─────── */
    

    /* ── Latest Reviews & News ───────────────────────────── */
    const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;

    function _buildNewsCard({ title, link, source, snippet, date, image }, fallbackImg) {
        const imgSrc  = image || fallbackImg || PLACEHOLDER;
        const summary = snippet ? snippet.slice(0, 120) + (snippet.length > 120 ? '\u2026' : '') : '';
        const card    = document.createElement('div');
        card.className = 'lnews-card';
        card.innerHTML = `
            <div class="lnews-img-wrap">
                <img class="lazy" data-src="${imgSrc}" alt="${title}" loading="lazy">
            </div>
            <div class="lnews-body">
                <span class="lnews-source">${source || ''}</span>
                <div class="lnews-title">${title || ''}</div>
                ${date ? `<span class="lnews-date">${date}</span>` : ''}
                <p class="lnews-snippet">${summary}</p>
                <a class="lnews-btn" href="${link}" target="_blank" rel="noopener">
                    Read More ${ARROW_SVG}
                </a>
            </div>`;
        lazyImg(card.querySelector('img'));
        return card;
    }

    async function loadLatestNews(movieName, fallbackImg) {
        if (!movieName) return;
        const section = document.getElementById('sectionLatestNews');
        const row     = document.getElementById('mdLatestNews');
        if (!section || !row) return;

        section.style.display = '';
        const wrap = section.querySelector('.md-scroll-wrap');
        if (wrap) initScrollBtns(wrap);

        try {
            const enc  = encodeURIComponent(movieName);
            const data = await Utils.fetchJSON(`/api/latestnews/${enc}`);
            const items = data.ok ? (data.results || []) : [];
            if (!items.length) { section.style.display = 'none'; return; }
            row.innerHTML = '';
            items.forEach(item => row.appendChild(_buildNewsCard(item, fallbackImg)));
        } catch {
            section.style.display = 'none';
        }
    }

    /* ── BOOT — parallel fetch, progressive render ───────── */
    async function boot() {
        let data;
        try {
            data = await Utils.fetchJSON(`/api/movie/${MOVIE_ID}`);
        } catch {
            document.getElementById('mdTitleSkel').textContent = 'Failed to load movie.';
            return;
        }
        if (!data.ok) return;

        const { details, credits, images, providers, similar } = data;

        renderBackdrop(details);
        renderInfo(details);

        const movieName   = details.title || details.original_title || '';
        const fallbackImg = details.backdrop_url || null;

        initListButtons(MOVIE_ID, details);

        Promise.all([
            Promise.resolve().then(() => renderCrew(credits.crew   || [])),
            Promise.resolve().then(() => renderCast(credits.cast   || [])),
            Promise.resolve().then(() => renderGallery(images.backdrops   || [])),
            Promise.resolve().then(() => populateCards(document.getElementById('mdSimilar'), similar)),
            loadRecommendations(),
            loadTrailer(),
            loadYouTube(movieName),
            loadLatestNews(movieName, fallbackImg),
            loadAIReview(movieName, details.release_date || null, details.status || null),
            loadAIRecommendations(),
            loadOTT(),
        ]);
    }

    boot();
})();
