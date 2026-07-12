(() => {
    const TV_ID      = document.getElementById('wsDetailPage').dataset.tvId;
    const IMG_W185   = 'https://image.tmdb.org/t/p/w185';
    const IMG_W342   = 'https://image.tmdb.org/t/p/w342';
    const IMG_ORIG   = 'https://image.tmdb.org/t/p/original';
    const PLACEHOLDER = '/static/images/placeholder.svg';
    const STAR_SVG   = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    function lazyImg(img) { Utils.lazyLoad(img); }
    function clearSkel(el) { el.classList.remove('skeleton'); el.innerHTML = ''; }
    function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' }) : '—'; }

    /* ── Scroll buttons ──────────────────────────────────── */
    function initScrollBtns(wrap) {
        const row   = wrap.querySelector('.md-cast-row, .md-gallery-row, .cards-row');
        const left  = wrap.querySelector('.scroll-left');
        const right = wrap.querySelector('.scroll-right');
        left?.addEventListener('click',  () => row?.scrollBy({ left: -400, behavior: 'smooth' }));
        right?.addEventListener('click', () => row?.scrollBy({ left:  400, behavior: 'smooth' }));
    }
    document.querySelectorAll('.md-scroll-wrap').forEach(initScrollBtns);

    /* ── Trailer modal ───────────────────────────────────── */
    const ytModal      = document.getElementById('ytModal');
    const ytIframe     = document.getElementById('ytIframe');
    const ytModalTitle = document.getElementById('ytModalTitle');
    const ytModalClose = document.getElementById('ytModalClose');
    const btnTrailer   = document.getElementById('btnTrailer');
    let _trailerKey = null;

    function openModal(key, title) {
        ytIframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&rel=0`;
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
    btnTrailer.addEventListener('click', () => { if (_trailerKey) openModal(_trailerKey, document.title); });

    /* ── Lightbox ────────────────────────────────────────── */
    const lightbox      = document.getElementById('lightbox');
    const lightboxImg   = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');
    lightboxClose.addEventListener('click', () => { lightbox.classList.remove('open'); document.body.style.overflow = ''; });
    lightbox.addEventListener('click', e => { if (e.target === lightbox) { lightbox.classList.remove('open'); document.body.style.overflow = ''; } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); lightbox.classList.remove('open'); document.body.style.overflow = ''; } });

    /* ── Render backdrop ─────────────────────────────────── */
    function renderBackdrop(d) {
        const el = document.getElementById('mdBackdropImg');
        el.classList.remove('skeleton');
        el.style.backgroundImage = d.backdrop_url ? `url('${d.backdrop_url}')` : 'none';
        if (!d.backdrop_url) el.style.background = 'linear-gradient(135deg, #0D1B2A 0%, #1A2A4A 100%)';
    }

    /* ── Render info ─────────────────────────────────────── */
    function renderInfo(d) {
        document.title = `${d.name || d.title || 'Web Series'} — CineMantra`;

        // Poster
        const posterEl = document.getElementById('mdPoster');
        const img = document.createElement('img');
        img.className = 'md-poster';
        img.alt = d.name || '';
        img.onerror = () => { img.src = PLACEHOLDER; };
        img.src = d.poster_url || PLACEHOLDER;
        posterEl.replaceWith(img);

        // Title
        const titleEl = document.getElementById('mdTitleSkel');
        clearSkel(titleEl);
        titleEl.className   = 'md-title';
        titleEl.textContent = d.name || d.title || 'Untitled';

        // Tagline
        const tagEl = document.getElementById('mdTaglineSkel');
        clearSkel(tagEl);
        tagEl.className   = 'md-tagline';
        tagEl.textContent = d.tagline || '';

        // Meta badges
        const metaEl = document.getElementById('mdMeta');
        const seasons  = d.number_of_seasons  ? `${d.number_of_seasons} Season${d.number_of_seasons > 1 ? 's' : ''}` : '';
        const episodes = d.number_of_episodes ? `${d.number_of_episodes} Episodes` : '';
        const statusClass = (d.status || '').toLowerCase() === 'ended' ? 'status-released' : 'status-upcoming';
        metaEl.innerHTML = `
            <span class="md-badge rating">${STAR_SVG} ${d.vote_average ? d.vote_average.toFixed(1) : '—'} <span style="color:var(--text-dim);font-weight:400">(${(d.vote_count||0).toLocaleString()})</span></span>
            ${d.first_air_date ? `<span class="md-badge">${fmt(d.first_air_date)}</span>` : ''}
            ${seasons  ? `<span class="md-badge">${seasons}</span>`  : ''}
            ${episodes ? `<span class="md-badge">${episodes}</span>` : ''}
            <span class="md-badge ${statusClass}">${d.status || '—'}</span>`;

        // Genres
        document.getElementById('mdGenres').innerHTML =
            (d.genres || []).map(g => `<span class="genre-tag">${g.name}</span>`).join('');

        // Overview
        document.getElementById('mdOverview').textContent = d.overview || 'No overview available.';

        // Stats
        const seasons  = d.number_of_seasons  || 0;
        const episodes = d.number_of_episodes || 0;
        const statusLabel = d.status || '—';
        const statusClass = (d.status || '').toLowerCase() === 'ended' ? 'stat-status-ended' : 'stat-status-ongoing';
        document.getElementById('mdStats').innerHTML = `
            <div class="md-stat"><div class="md-stat-label">Original Name</div><div class="md-stat-value">${d.original_name || d.name || '—'}</div></div>
            <div class="md-stat"><div class="md-stat-label">Language</div><div class="md-stat-value">${(d.original_language||'—').toUpperCase()}</div></div>
            <div class="md-stat"><div class="md-stat-label">Seasons</div><div class="md-stat-value">${seasons || '—'}</div></div>
            <div class="md-stat"><div class="md-stat-label">Episodes</div><div class="md-stat-value">${episodes || '—'}</div></div>
            <div class="md-stat"><div class="md-stat-label">First Air Date</div><div class="md-stat-value">${fmt(d.first_air_date)}</div></div>
            <div class="md-stat"><div class="md-stat-label">Last Air Date</div><div class="md-stat-value">${fmt(d.last_air_date)}</div></div>
            <div class="md-stat"><div class="md-stat-label">Status</div><div class="md-stat-value"><span class="stat-status ${statusClass}">${statusLabel}</span></div></div>
            ${d.episode_run_time?.length ? `<div class="md-stat"><div class="md-stat-label">Ep. Runtime</div><div class="md-stat-value">${d.episode_run_time[0]} min</div></div>` : ''}`;

        // Networks
        const networks = (d.networks || []).slice(0, 6);
        const netEl = document.getElementById('mdCompanies');
        if (networks.length) {
            netEl.innerHTML = networks.map(n => {
                const logo = n.logo_path ? `<img src="https://image.tmdb.org/t/p/w92${n.logo_path}" alt="${n.name}" onerror="this.style.display='none'">` : '';
                return `<span class="md-network-badge">${logo}<span>${n.name}</span></span>`;
            }).join('');
        } else {
            const prod = (d.production_companies || []).slice(0, 5);
            netEl.innerHTML = prod.map(n => `<span class="md-company">${n.name}</span>`).join('');
        }
    }

    /* ── Render seasons ──────────────────────────────────── */
    function renderSeasons(seasons) {
        const section = document.getElementById('sectionSeasons');
        const grid    = document.getElementById('wsSeasonsGrid');
        const valid   = (seasons || []).filter(s => s.season_number > 0);
        if (!valid.length) { section.style.display = 'none'; return; }
        section.style.display = '';
        grid.innerHTML = '';
        valid.forEach(s => {
            const poster = s.poster_path ? `${IMG_W342}${s.poster_path}` : PLACEHOLDER;
            const card = document.createElement('div');
            card.className = 'ws-season-card';
            card.innerHTML = `
                <img class="ws-season-poster lazy" data-src="${poster}" alt="${s.name}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
                <div class="ws-season-body">
                    <div class="ws-season-name">${s.name}</div>
                    <div class="ws-season-meta">${s.episode_count || 0} Episodes${s.air_date ? ' • ' + s.air_date.slice(0,4) : ''}</div>
                </div>`;
            lazyImg(card.querySelector('img'));
            grid.appendChild(card);
        });
    }

    /* ── Render cast ─────────────────────────────────────── */
    function renderCast(cast) {
        const el = document.getElementById('mdCast');
        el.innerHTML = '';
        const top = (cast || []).slice(0, 15);
        if (!top.length) { el.innerHTML = '<p class="md-empty">No cast info.</p>'; return; }
        top.forEach(p => {
            const src = p.profile_path ? `${IMG_W185}${p.profile_path}` : PLACEHOLDER;
            const card = document.createElement('div');
            card.className = 'cast-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <img class="cast-img lazy" data-src="${src}" alt="${p.name}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
                <div class="cast-name">${p.name}</div>
                <div class="cast-char">${p.character || p.roles?.[0]?.character || ''}</div>`;
            card.addEventListener('click', () => { window.location.href = `/person/${p.id}`; });
            lazyImg(card.querySelector('img'));
            el.appendChild(card);
        });
    }

    /* ── Render gallery ──────────────────────────────────── */
    function renderGallery(backdrops) {
        const el = document.getElementById('mdGallery');
        el.innerHTML = '';
        const items = (backdrops || []).slice(0, 12);
        if (!items.length) { el.innerHTML = '<p class="md-empty">No images.</p>'; return; }
        items.forEach(img => {
            const thumbSrc = `${IMG_W342}${img.file_path}`;
            const fullSrc  = `${IMG_ORIG}${img.file_path}`;
            const item = document.createElement('div');
            item.className = 'gallery-item';
            const imgEl = document.createElement('img');
            imgEl.className   = 'lazy';
            imgEl.dataset.src = thumbSrc;
            imgEl.alt         = 'Gallery';
            item.appendChild(imgEl);
            item.addEventListener('click', () => {
                lightboxImg.src = fullSrc;
                lightbox.classList.add('open');
                document.body.style.overflow = 'hidden';
            });
            lazyImg(imgEl);
            el.appendChild(item);
        });
    }

    /* ── Render similar ──────────────────────────────────── */
    function buildCard(item) {
        const posterSrc = item.poster_url || PLACEHOLDER;
        const title     = item.name || item.title || 'Untitled';
        const year      = (item.first_air_date || item.release_date || '').slice(0,4) || '—';
        const rating    = item.vote_average ? item.vote_average.toFixed(1) : '—';
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${posterSrc}" alt="${title}" onerror="this.src='${PLACEHOLDER}'">
                <div class="card-overlay"><button class="card-play-btn"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></button></div>
                <span class="rating-badge">${STAR_SVG} ${rating}</span>
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${year}</p>
            </div>`;
        lazyImg(card.querySelector('img'));
        card.addEventListener('click', () => { window.location.href = `/webseries/${item.id}`; });
        return card;
    }

    /* ── Render trailer ──────────────────────────────────── */
    function renderTrailer(videos) {
        const wrap     = document.getElementById('trailerEmbedWrap');
        const notAvail = document.getElementById('trailerNotAvailable');
        const metaEl   = document.getElementById('trailerMeta');
        const titleEl  = document.getElementById('trailerEmbedTitle');
        const iframeEl = document.getElementById('trailerIframe');

        const yt_all   = (videos?.results || []).filter(v => v.site === 'YouTube');
        const trailers = yt_all.filter(v => v.type === 'Trailer');
        const teasers  = yt_all.filter(v => v.type === 'Teaser');
        const best = (trailers.find(v => v.name?.toLowerCase().includes('official'))
                   || trailers[0] || teasers[0] || null);

        if (!best) {
            wrap.style.display = 'none'; metaEl.style.display = 'none';
            notAvail.style.display = '';
            return;
        }
        _trailerKey = best.key;
        iframeEl.src = `https://www.youtube.com/embed/${best.key}?autoplay=0&rel=0&modestbranding=1`;
        titleEl.textContent = best.name || 'Main Trailer';
        wrap.style.display = ''; metaEl.style.display = '';
        notAvail.style.display = 'none';
        btnTrailer.disabled = false; btnTrailer.style.display = '';
    }

    /* ── OTT providers ───────────────────────────────────── */
    const YT_LOGO_SVG = `<svg viewBox="0 0 24 24" fill="#fff" width="28" height="28"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;

    function _buildOttCard(p, actionClass, actionLabel, isYt) {
        const card = document.createElement('a');
        card.className = 'ott-card' + (isYt ? ' ott-youtube' : '');
        card.href = p.url || '#'; card.target = '_blank'; card.rel = 'noopener'; card.title = p.name;
        const logoWrap = document.createElement('div');
        logoWrap.className = 'ott-logo-wrap';
        if (isYt) {
            logoWrap.innerHTML = YT_LOGO_SVG;
        } else if (p.logo) {
            const img = document.createElement('img');
            img.className = 'lazy'; img.dataset.src = p.logo; img.alt = p.name; img.loading = 'lazy';
            img.onerror = () => { img.style.display='none'; logoWrap.innerHTML=`<div class="ott-logo-placeholder">${p.name.slice(0,2).toUpperCase()}</div>`; };
            logoWrap.appendChild(img); lazyImg(img);
        } else {
            logoWrap.innerHTML = `<div class="ott-logo-placeholder">${p.name.slice(0,2).toUpperCase()}</div>`;
        }
        const nameEl = document.createElement('div'); nameEl.className='ott-card-name'; nameEl.textContent=p.name;
        const actEl  = document.createElement('div'); actEl.className=`ott-card-action ${actionClass}`; actEl.textContent=actionLabel;
        card.appendChild(logoWrap); card.appendChild(nameEl); card.appendChild(actEl);
        return card;
    }

    function _buildOttGroup(label, providers, actionClass, actionLabel) {
        if (!providers.length) return null;
        const group = document.createElement('div'); group.className='ott-group';
        const lbl = document.createElement('div'); lbl.className='ott-group-label'; lbl.textContent=label;
        const row = document.createElement('div'); row.className='ott-cards-row';
        providers.forEach(p => row.appendChild(_buildOttCard(p, actionClass, actionLabel, false)));
        group.appendChild(lbl); group.appendChild(row);
        return group;
    }

    async function loadOTT() {
        const body         = document.getElementById('ottBody');
        const skeleton     = document.getElementById('ottSkeleton');
        const countryBadge = document.getElementById('ottCountryBadge');
        const jwLink       = document.getElementById('ottJwLink');
        if (!body) return;
        try {
            const data = await Utils.fetchJSON(`/api/tv/${TV_ID}/streaming`);
            if (skeleton) skeleton.remove();
            body.innerHTML = '';
            const { stream=[], rent=[], buy=[], country, link, youtube_provider } = data;
            if (country && countryBadge) {
                countryBadge.textContent = country === 'IN' ? '🇮🇳 Available in India' : '🇺🇸 Available in United States';
                countryBadge.style.display = '';
            }
            if (link && jwLink) { jwLink.href = link; jwLink.style.display = ''; }
            if (!stream.length && !rent.length && !buy.length && !youtube_provider) {
                body.innerHTML = '<p class="md-empty">No streaming information available.</p>'; return;
            }
            const sg = _buildOttGroup('Stream', stream, 'ott-action-stream', 'Watch Now');
            const rg = _buildOttGroup('Rent',   rent,   'ott-action-rent',   'Rent');
            const bg = _buildOttGroup('Buy',    buy,    'ott-action-buy',    'Buy');
            if (sg) body.appendChild(sg);
            if (rg) body.appendChild(rg);
            if (bg) body.appendChild(bg);
            if (youtube_provider) {
                const ytGroup = document.createElement('div'); ytGroup.className='ott-group';
                const ytLbl = document.createElement('div'); ytLbl.className='ott-group-label'; ytLbl.textContent='YouTube';
                const ytRow = document.createElement('div'); ytRow.className='ott-cards-row';
                ytRow.appendChild(_buildOttCard(youtube_provider, 'ott-action-yt', 'Watch', true));
                ytGroup.appendChild(ytLbl); ytGroup.appendChild(ytRow);
                body.appendChild(ytGroup);
            }
        } catch {
            if (skeleton) skeleton.remove();
            body.innerHTML = '<p class="md-empty">No streaming information available.</p>';
        }
    }

    /* ── Watchlist / Favorites ───────────────────────────── */
    const btnFav       = document.getElementById('btnFav');
    const btnWatchlist = document.getElementById('btnWatchlist');

    function _wrapBtnText(btn) {
        if (!btn) return;
        [...btn.childNodes].filter(n => n.nodeType===3 && n.textContent.trim()).forEach(n => {
            const s = document.createElement('span'); s.className='btn-label'; s.textContent=n.textContent.trim(); n.replaceWith(s);
        });
    }
    function _syncWlBtn(item) {
        btnWatchlist?.classList.toggle('btn-active', !!item);
        const s = btnWatchlist?.querySelector('.btn-label');
        if (s) s.textContent = item ? '✓ In Watchlist' : 'Watchlist';
    }
    function _syncFavBtn(item) {
        btnFav?.classList.toggle('btn-active', !!(item?.favorite));
        const s = btnFav?.querySelector('.btn-label');
        if (s) s.textContent = item?.favorite ? '♥ Favorited' : 'Favorites';
    }

    async function initListButtons(details) {
        const id = parseInt(TV_ID, 10);
        _wrapBtnText(btnFav); _wrapBtnText(btnWatchlist);
        try {
            const res = await Utils.fetchJSON(`/api/watchlist/status/${id}`);
            _syncWlBtn(res.item); _syncFavBtn(res.item);
        } catch {}

        const _payload = () => ({
            movie_id: id, title: details.name || details.title || '',
            poster: details.poster_url || '', backdrop: details.backdrop_url || '',
            rating: details.vote_average || 0, release_date: details.first_air_date || '',
        });

        btnWatchlist?.addEventListener('click', async () => {
            const cur = await Utils.fetchJSON(`/api/watchlist/status/${id}`);
            if (cur.item) {
                await fetch('/api/watchlist/remove', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ movie_id: id }) });
                _syncWlBtn(null); Toast.show('Removed from Watchlist', 'info');
            } else {
                const r = await fetch('/api/watchlist/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(_payload()) }).then(x=>x.json());
                _syncWlBtn(r.item); Toast.show('Added to Watchlist', 'success');
            }
        });
        btnFav?.addEventListener('click', async () => {
            const r = await fetch('/api/watchlist/favorite', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(_payload()) }).then(x=>x.json());
            _syncFavBtn(r.item); Toast.show(r.favorite ? '♥ Added to Favorites' : 'Removed from Favorites', r.favorite ? 'success' : 'info');
        });
    }

    document.getElementById('btnShare').addEventListener('click', () => {
        if (navigator.share) navigator.share({ title: document.title, url: location.href });
        else navigator.clipboard?.writeText(location.href);
    });

    /* ── Boot ────────────────────────────────────────────── */
    async function boot() {
        let data;
        try {
            data = await Utils.fetchJSON(`/api/tv/${TV_ID}`);
        } catch {
            document.getElementById('mdTitleSkel').textContent = 'Failed to load.';
            return;
        }
        if (!data.ok) return;

        const { details, credits, images, videos, similar, recommended } = data;

        renderBackdrop(details);
        renderInfo(details);
        renderSeasons(details.seasons || []);
        renderCast((credits?.cast || credits?.aggregate_cast || []));
        renderGallery(images?.backdrops || []);
        renderTrailer(videos);

        // Similar row
        const simRow = document.getElementById('mdSimilar');
        const simItems = [...(recommended || []), ...(similar || [])].filter((v,i,a) => a.findIndex(x=>x.id===v.id)===i).slice(0,20);
        simRow.innerHTML = '';
        if (simItems.length) simItems.forEach(m => simRow.appendChild(buildCard(m)));
        else simRow.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem">Nothing to show.</p>';

        initListButtons(details);
        loadOTT();
    }

    boot();
})();
