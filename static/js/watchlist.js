(() => {
    const PLACEHOLDER = '/static/images/placeholder.svg';
    const STAR = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="9" height="9"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const GENRES = {
        28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
        99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
        27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
        53:'Thriller', 10752:'War', 37:'Western',
    };

    let _all    = [];
    let _filter = 'all';
    let _sort   = 'recent';
    let _query  = '';
    let _pendingRemoveId = null;
    let _pendingRateId   = null;
    let _pendingNotesId  = null;
    let _selectedRating  = 0;

    /* ── Lazy image ──────────────────────────────────────── */
    function lazyImg(img) {
        if (!img?.dataset.src) return;
        const obs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                e.target.src = e.target.dataset.src;
                e.target.onload  = () => e.target.classList.add('loaded');
                e.target.onerror = () => { e.target.src = PLACEHOLDER; e.target.classList.add('loaded'); };
                obs.unobserve(e.target);
            });
        }, { rootMargin: '300px' });
        obs.observe(img);
    }

    /* ── Filter + sort + search ──────────────────────────── */
    function _filtered() {
        let list = [..._all];
        if (_filter === 'favorites') list = list.filter(m => m.favorite);
        else if (_filter === 'watching')  list = list.filter(m => !m.watched);
        else if (_filter === 'completed') list = list.filter(m => m.watched);

        if (_query) {
            const q = _query.toLowerCase();
            list = list.filter(m => m.title.toLowerCase().includes(q));
        }

        if (_sort === 'user_rating') list.sort((a, b) => (b.user_rating || 0) - (a.user_rating || 0));
        else if (_sort === 'rating')  list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        else if (_sort === 'release') list.sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''));
        else if (_sort === 'title')   list.sort((a, b) => a.title.localeCompare(b.title));
        return list;
    }

    /* ── Render grid ─────────────────────────────────────── */
    function render() {
        const grid  = document.getElementById('wlGrid');
        const empty = document.getElementById('wlEmpty');
        const count = document.getElementById('wlCount');
        const list  = _filtered();

        count.textContent = `${_all.length} movie${_all.length !== 1 ? 's' : ''} saved`;

        if (!list.length) {
            grid.innerHTML = '';
            empty.style.display = '';
            const isFiltered = _filter !== 'all' || _query;
            document.getElementById('wlEmptyTitle').textContent =
                isFiltered ? 'No movies match your filter' : 'Your Watchlist is Empty';
            document.getElementById('wlEmptySub').textContent =
                isFiltered ? 'Try a different filter or search term.'
                           : 'Start adding movies to keep track of what you want to watch.';
            return;
        }

        empty.style.display = 'none';
        grid.innerHTML = '';
        list.forEach(m => grid.appendChild(buildCard(m)));
    }

    function buildCard(m) {
        const year   = m.release_date ? m.release_date.slice(0, 4) : '—';
        const rating = m.rating ? Number(m.rating).toFixed(1) : '—';
        const status = m.favorite ? 'favorite' : (m.watched ? 'completed' : 'watching');
        const statusLabel = m.favorite ? '❤ Favorite' : (m.watched ? '✓ Completed' : '▶ Watching');
        const userRating  = m.user_rating ? Number(m.user_rating).toFixed(1) : null;
        const hasNotes    = m.notes && m.notes.trim().length > 0;

        const card = document.createElement('div');
        card.className = 'wl-card';
        card.dataset.id = m.movie_id;
        card.innerHTML = `
            <div class="wl-card-poster">
                <img class="lazy" data-src="${m.poster || PLACEHOLDER}" alt="${m.title}" loading="lazy">
                <span class="wl-status-badge ${status}">${statusLabel}</span>
                <span class="wl-rating-badge">${STAR} ${rating}</span>
                ${userRating ? `<span class="wl-user-rating">★ ${userRating}</span>` : ''}
                ${hasNotes   ? `<span class="wl-notes-dot" title="Has notes"></span>` : ''}
                <div class="wl-card-overlay">
                    <button class="wl-ov-btn${m.watched ? ' active' : ''}" data-action="watched" title="${m.watched ? 'Mark Unwatched' : 'Mark Watched'}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button class="wl-ov-btn" data-action="play" title="View Details">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <button class="wl-ov-btn${m.favorite ? ' fav-active' : ''}" data-action="favorite" title="${m.favorite ? 'Remove Favorite' : 'Add Favorite'}">
                        <svg viewBox="0 0 24 24" fill="${m.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    </button>
                    <button class="wl-ov-btn rate-btn" data-action="rate" title="Rate">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>
                    <button class="wl-ov-btn" data-action="notes" title="Notes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="wl-ov-btn danger" data-action="remove" title="Remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="wl-card-body">
                <div class="wl-card-title">${m.title}</div>
                <div class="wl-card-meta">
                    <span>${year}</span>
                    <span class="wl-card-meta-dot">•</span>
                    <span>${STAR} ${rating}</span>
                </div>
            </div>`;

        card.querySelector('[data-action="play"]').addEventListener('click', e => {
            e.stopPropagation();
            window.location.href = `/movie/${m.movie_id}`;
        });
        card.querySelector('[data-action="watched"]').addEventListener('click', e => {
            e.stopPropagation(); toggleWatched(m.movie_id);
        });
        card.querySelector('[data-action="favorite"]').addEventListener('click', e => {
            e.stopPropagation(); toggleFavorite(m.movie_id);
        });
        card.querySelector('[data-action="rate"]').addEventListener('click', e => {
            e.stopPropagation(); openRateModal(m.movie_id, m.title, m.user_rating || 0);
        });
        card.querySelector('[data-action="notes"]').addEventListener('click', e => {
            e.stopPropagation(); openNotesModal(m.movie_id, m.title, m.notes || '');
        });
        card.querySelector('[data-action="remove"]').addEventListener('click', e => {
            e.stopPropagation(); confirmRemove(m.movie_id, m.title);
        });
        card.addEventListener('click', () => { window.location.href = `/movie/${m.movie_id}`; });
        lazyImg(card.querySelector('img'));
        return card;
    }

    /* ── API calls ───────────────────────────────────────── */
    function _uid() { return window.CM_UID || 'local'; }
    function _apiFetch(url, opts = {}) {
        const headers = { 'Content-Type': 'application/json', 'X-User-ID': _uid(), ...(opts.headers || {}) };
        return fetch(url, { ...opts, headers }).then(r => r.json());
    }

    async function load() {
        try {
            const data = await _apiFetch('/api/watchlist');
            _all = data.ok ? data.results : [];
            render();
            if (_all.length >= 3) {
                loadTasteSummary();
                loadRecommendations();
            }
        } catch {
            document.getElementById('wlGrid').innerHTML = '';
            document.getElementById('wlEmpty').style.display = '';
        }
    }

    async function toggleWatched(movieId) {
        const res = await _apiFetch('/api/watchlist/watched', {
            method: 'POST', body: JSON.stringify({ movie_id: movieId }),
        });
        if (res.ok && res.item) {
            const idx = _all.findIndex(m => m.movie_id === movieId);
            if (idx !== -1) _all[idx] = res.item;
            render();
        }
    }

    async function toggleFavorite(movieId) {
        const res = await _apiFetch('/api/watchlist/favorite', {
            method: 'POST', body: JSON.stringify({ movie_id: movieId }),
        });
        if (res.ok && res.item) {
            const idx = _all.findIndex(m => m.movie_id === movieId);
            if (idx !== -1) _all[idx] = res.item;
            render();
        }
    }

    function confirmRemove(movieId, title) {
        _pendingRemoveId = movieId;
        document.getElementById('wlModalMsg').textContent =
            `"${title}" will be removed from your watchlist.`;
        document.getElementById('wlModal').classList.add('open');
    }

    async function doRemove() {
        if (!_pendingRemoveId) return;
        const id   = _pendingRemoveId;
        const card = document.querySelector(`.wl-card[data-id="${id}"]`);
        if (card) card.classList.add('removing');
        await _apiFetch('/api/watchlist/remove', {
            method: 'POST', body: JSON.stringify({ movie_id: id }),
        });
        setTimeout(() => { _all = _all.filter(m => m.movie_id !== id); render(); }, 300);
        closeModal('wlModal');
    }

    /* ── Rate modal ──────────────────────────────────────── */
    function openRateModal(movieId, title, currentRating) {
        _pendingRateId  = movieId;
        _selectedRating = currentRating || 0;
        document.getElementById('wlRateTitle').textContent = title;
        document.querySelectorAll('.wl-star-btn').forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.val) <= _selectedRating);
        });
        document.getElementById('wlRateModal').classList.add('open');
    }

    document.querySelectorAll('.wl-star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _selectedRating = parseInt(btn.dataset.val);
            document.querySelectorAll('.wl-star-btn').forEach(b => {
                b.classList.toggle('selected', parseInt(b.dataset.val) <= _selectedRating);
            });
        });
    });

    document.getElementById('wlRateConfirm').addEventListener('click', async () => {
        if (!_pendingRateId || !_selectedRating) { closeModal('wlRateModal'); return; }
        const res = await _apiFetch('/api/watchlist/rate', {
            method: 'POST', body: JSON.stringify({ movie_id: _pendingRateId, user_rating: _selectedRating }),
        });
        if (res.ok && res.item) {
            const idx = _all.findIndex(m => m.movie_id === _pendingRateId);
            if (idx !== -1) _all[idx] = res.item;
            render();
        }
        closeModal('wlRateModal');
    });
    document.getElementById('wlRateCancel').addEventListener('click', () => closeModal('wlRateModal'));

    /* ── Notes modal ─────────────────────────────────────── */
    function openNotesModal(movieId, title, currentNotes) {
        _pendingNotesId = movieId;
        document.getElementById('wlNotesTitle').textContent = title;
        document.getElementById('wlNotesInput').value = currentNotes || '';
        document.getElementById('wlNotesModal').classList.add('open');
    }

    document.getElementById('wlNotesConfirm').addEventListener('click', async () => {
        if (!_pendingNotesId) { closeModal('wlNotesModal'); return; }
        const notes = document.getElementById('wlNotesInput').value.trim();
        const res = await _apiFetch('/api/watchlist/notes', {
            method: 'POST', body: JSON.stringify({ movie_id: _pendingNotesId, notes }),
        });
        if (res.ok && res.item) {
            const idx = _all.findIndex(m => m.movie_id === _pendingNotesId);
            if (idx !== -1) _all[idx] = res.item;
            render();
        }
        closeModal('wlNotesModal');
    });
    document.getElementById('wlNotesCancel').addEventListener('click', () => closeModal('wlNotesModal'));

    /* ── Modal helpers ───────────────────────────────────── */
    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
        if (id === 'wlModal')      _pendingRemoveId = null;
        if (id === 'wlRateModal')  _pendingRateId   = null;
        if (id === 'wlNotesModal') _pendingNotesId  = null;
    }

    document.getElementById('wlModalConfirm').addEventListener('click', doRemove);
    document.getElementById('wlModalCancel').addEventListener('click', () => closeModal('wlModal'));

    ['wlModal', 'wlRateModal', 'wlNotesModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => {
            if (e.target === document.getElementById(id)) closeModal(id);
        });
    });

    /* ── Controls ────────────────────────────────────────── */
    document.getElementById('wlFilters').addEventListener('click', e => {
        const btn = e.target.closest('.wl-filter');
        if (!btn) return;
        document.querySelectorAll('.wl-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filter = btn.dataset.filter;
        render();
    });

    document.getElementById('wlSort').addEventListener('change', e => {
        _sort = e.target.value; render();
    });

    let _searchTimer;
    document.getElementById('wlSearch').addEventListener('input', e => {
        clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => { _query = e.target.value.trim(); render(); }, 250);
    });

    /* ── AI Taste Summary ────────────────────────────────── */
    async function loadTasteSummary(forceRefresh = false) {
        const section = document.getElementById('wlTasteSection');
        const card    = document.getElementById('wlTasteCard');
        if (!section || !card) return;

        section.style.display = '';
        card.innerHTML = `
            <div class="wl-taste-skel">
                <div class="wl-skel-line w90 skeleton"></div>
                <div class="wl-skel-line w75 skeleton"></div>
                <div class="wl-skel-line w60 skeleton"></div>
            </div>`;

        try {
            const data = await _apiFetch('/api/watchlist/summary');
            if (!data.ok || !data.result) { section.style.display = 'none'; return; }
            renderTaste(data.result);
        } catch {
            section.style.display = 'none';
        }
    }

    function renderTaste(t) {
        const card = document.getElementById('wlTasteCard');
        if (!card) return;

        const _chips = arr => (arr || []).map(v =>
            `<span class="wl-taste-chip">${v}</span>`).join('');

        card.innerHTML = `
            ${t.mood ? `<div class="wl-taste-mood">🎭 ${t.mood}</div>` : ''}
            <p class="wl-taste-summary">${t.taste_summary || ''}</p>
            <div class="wl-taste-grid">
                ${t.favorite_genres?.length ? `
                <div class="wl-taste-stat">
                    <div class="wl-taste-stat-label">Favorite Genres</div>
                    <div class="wl-taste-chips">${_chips(t.favorite_genres)}</div>
                </div>` : ''}
                ${t.favorite_actors?.length ? `
                <div class="wl-taste-stat">
                    <div class="wl-taste-stat-label">Favorite Actors</div>
                    <div class="wl-taste-chips">${_chips(t.favorite_actors)}</div>
                </div>` : ''}
                ${t.favorite_directors?.length ? `
                <div class="wl-taste-stat">
                    <div class="wl-taste-stat-label">Favorite Directors</div>
                    <div class="wl-taste-chips">${_chips(t.favorite_directors)}</div>
                </div>` : ''}
                ${t.preferred_runtime ? `
                <div class="wl-taste-stat">
                    <div class="wl-taste-stat-label">Preferred Runtime</div>
                    <div class="wl-taste-value">${t.preferred_runtime}</div>
                </div>` : ''}
                ${t.preferred_years ? `
                <div class="wl-taste-stat">
                    <div class="wl-taste-stat-label">Preferred Years</div>
                    <div class="wl-taste-value">${t.preferred_years}</div>
                </div>` : ''}
            </div>
            <p style="font-size:0.65rem;color:var(--text-dim);margin-top:1rem;text-align:right;">
                Generated by Gemini based on your watchlist.
            </p>`;
    }

    document.getElementById('wlTasteRefresh')?.addEventListener('click', function() {
        this.classList.add('spinning');
        loadTasteSummary(true).finally(() => this.classList.remove('spinning'));
    });

    /* ── AI Recommendations ──────────────────────────────── */
    const REC_CATEGORIES = [
        { key: 'because_you_liked', label: '🎬 Because You Liked...' },
        { key: 'hidden_gems',       label: '💎 Hidden Gems' },
        { key: 'underrated_telugu', label: '🌟 Underrated Telugu Movies' },
        { key: 'trending_for_you',  label: '🔥 Trending For You' },
        { key: 'weekend_picks',     label: '🍿 Weekend Picks' },
    ];

    async function loadRecommendations() {
        const section = document.getElementById('wlRecsSection');
        const body    = document.getElementById('wlRecsBody');
        if (!section || !body) return;

        section.style.display = '';
        // Show skeletons
        body.innerHTML = REC_CATEGORIES.map(cat => `
            <div class="wl-rec-row">
                <div class="wl-rec-row-title">${cat.label}</div>
                <div class="wl-rec-scroll">
                    ${[...Array(5)].map(() => `
                        <div class="wl-rec-card wl-rec-skel">
                            <div class="wl-rec-skel-poster skeleton"></div>
                            <div class="wl-rec-body">
                                <div class="wl-skel-line w80 skeleton" style="height:9px;margin-bottom:0.3rem;"></div>
                                <div class="wl-skel-line w60 skeleton" style="height:8px;"></div>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`).join('');

        try {
            const data = await _apiFetch('/api/watchlist/recommendations');
            if (!data.ok || !data.result) { section.style.display = 'none'; return; }
            renderRecs(data.result);
        } catch {
            section.style.display = 'none';
        }
    }

    function renderRecs(result) {
        const body = document.getElementById('wlRecsBody');
        if (!body) return;
        body.innerHTML = '';

        let anyVisible = false;
        REC_CATEGORIES.forEach(cat => {
            const movies = result[cat.key];
            if (!movies?.length) return;
            anyVisible = true;

            const row = document.createElement('div');
            row.className = 'wl-rec-row';
            row.innerHTML = `<div class="wl-rec-row-title">${cat.label}</div>
                             <div class="wl-rec-scroll" id="recScroll_${cat.key}"></div>`;
            body.appendChild(row);

            const scroll = row.querySelector(`#recScroll_${cat.key}`);
            movies.forEach(m => scroll.appendChild(buildRecCard(m)));
        });

        if (!anyVisible) document.getElementById('wlRecsSection').style.display = 'none';
    }

    function buildRecCard(m) {
        const poster = m.poster_url || PLACEHOLDER;
        const title  = m.title || 'Untitled';
        const year   = (m.release_date || '').slice(0, 4) || '';
        const reason = m.reason || '';

        const card = document.createElement('div');
        card.className = 'wl-rec-card';
        card.innerHTML = `
            <div class="wl-rec-poster-wrap">
                <img class="lazy" data-src="${poster}" alt="${title}" loading="lazy">
            </div>
            <div class="wl-rec-body">
                <div class="wl-rec-title">${title}${year ? ` (${year})` : ''}</div>
                ${reason ? `<div class="wl-rec-reason">${reason}</div>` : ''}
            </div>`;

        if (m.movie_id) {
            card.addEventListener('click', () => {
                window.location.href = `/movie/${m.movie_id}`;
            });
        }
        lazyImg(card.querySelector('img'));
        return card;
    }

    /* ── Boot ────────────────────────────────────────────── */
    const _urlTab = new URLSearchParams(location.search).get('tab');
    if (_urlTab && ['all','favorites','watching','completed'].includes(_urlTab)) {
        _filter = _urlTab;
        document.querySelectorAll('.wl-filter').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === _urlTab);
        });
    }
    load();
})();
