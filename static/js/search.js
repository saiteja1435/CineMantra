(() => {
    const PLACEHOLDER = '/static/images/placeholder.svg';
    const STAR_SVG    = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="10" height="10"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const GENRES = {
        28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
        99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
        27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
        53:'Thriller', 10752:'War', 37:'Western',
    };

    // Use the header search bar as the single input
    const srInput   = document.getElementById('searchInput');
    const srSubmit  = document.getElementById('srSubmit');   // hidden stub
    const srClear   = document.getElementById('srClear');    // hidden stub
    const srSpinner = document.getElementById('srSpinner');
    const srError   = document.getElementById('srError');
    const srErrorMsg= document.getElementById('srErrorMsg');
    const srEmpty   = document.getElementById('srEmpty');
    const srGrid    = document.getElementById('srGrid');
    const srMeta    = document.getElementById('srMeta');
    const srIntent  = document.getElementById('srIntent');
    const srPills   = document.getElementById('srFilterPills');
    const srCount   = document.getElementById('srCount');
    const srChips   = document.getElementById('srChips');

    /* ── Cache (30 min) ──────────────────────────────────── */
    const _cache = {};
    const _TTL   = 1800000;

    function _cacheGet(q) {
        const e = _cache[q];
        if (!e) return null;
        if (Date.now() - e.ts > _TTL) { delete _cache[q]; return null; }
        return e.data;
    }
    function _cacheSet(q, data) { _cache[q] = { ts: Date.now(), data }; }

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
        }, { rootMargin: '400px 200px' });
        obs.observe(img);
    }

    /* ── UI state helpers ────────────────────────────────── */
    const srDefault      = document.getElementById('srDefault');
    const srResultsWrap  = document.getElementById('srResultsWrap');
    const srResultsHeader = document.getElementById('srResultsHeader');

    function _showResultsPane() {
        srDefault.style.display     = 'none';
        srResultsWrap.style.display = '';
    }

    function _showDefaultPane() {
        srDefault.style.display     = '';
        srResultsWrap.style.display = 'none';
    }

    function _hideAll() {
        srSpinner.style.display      = 'none';
        srError.style.display        = 'none';
        srEmpty.style.display        = 'none';
        srMeta.style.display         = 'none';
        srResultsHeader.style.display = 'none';
        srGrid.innerHTML             = '';
    }

    function _showSpinner() {
        _showResultsPane();
        _hideAll();
        srSpinner.style.display = 'flex';
        _showSkeletons();
    }

    function _showSkeletons() {
        srGrid.innerHTML = '';
        for (let i = 0; i < 12; i++) {
            srGrid.innerHTML += `
                <div class="sr-card sr-card-skel">
                    <div class="sr-skel-poster"><div class="skeleton"></div></div>
                    <div class="sr-card-body">
                        <div class="sr-skel-line w80 skeleton"></div>
                        <div class="sr-skel-line w55 skeleton"></div>
                        <div class="sr-skel-line w70 skeleton"></div>
                    </div>
                </div>`;
        }
    }

    function _showError(msg) {
        _showResultsPane();
        _hideAll();
        srErrorMsg.textContent = msg || 'Something went wrong. Please try again.';
        srError.style.display  = 'flex';
    }

    function _showEmpty() {
        _showResultsPane();
        _hideAll();
        const emptyQuery = document.getElementById('srEmptyQuery');
        if (emptyQuery) emptyQuery.textContent = srInput ? srInput.value.trim() : '';
        srEmpty.style.display = 'flex';
    }

    /* ── Filter pills ────────────────────────────────────── */
    const PILL_LABELS = {
        language: '🌐', genre: '🎬', year_min: '📅', year_max: '📅',
        actor: '🎭', director: '🎥', ott: '📺', sort: '↕',
        runtime_max: '⏱', rating_min: '⭐', similar_to: '🔗',
    };

    function _renderMeta(intent, filters) {
        srIntent.textContent = `🤖 ${intent}`;
        srPills.innerHTML = '';
        const skip = new Set(['intent', 'free_text', 'keywords', '_ott_snippet']);
        Object.entries(filters).forEach(([k, v]) => {
            if (!v || skip.has(k)) return;
            const pill = document.createElement('span');
            pill.className = 'sr-pill';
            const icon = PILL_LABELS[k] || '';
            const label = k === 'year_min' ? `After ${v}`
                        : k === 'year_max' ? `Before ${v}`
                        : k === 'runtime_max' ? `≤${Math.floor(v/60)}h ${v%60}m`
                        : k === 'rating_min' ? `Rating ≥${v}`
                        : k === 'sort' ? `Sort: ${v}`
                        : String(v);
            pill.textContent = `${icon} ${label}`;
            srPills.appendChild(pill);
        });
        srMeta.style.display = 'flex';
    }

    /* ── Build result card ───────────────────────────────── */
    function _buildCard(movie) {
        const poster  = movie.poster_url || PLACEHOLDER;
        const title   = movie.title || movie.name || 'Untitled';
        const year    = (movie.release_date || '').slice(0, 4) || '—';
        const rating  = movie.vote_average ? Number(movie.vote_average).toFixed(1) : '—';
        const reason  = movie.ai_reason || '';
        const genreIds = movie.genre_ids || [];
        const genreNames = genreIds.slice(0, 3).map(id => GENRES[id]).filter(Boolean);

        const card = document.createElement('div');
        card.className = 'sr-card';

        card.innerHTML = `
            <div class="sr-card-poster-wrap">
                <img class="lazy" data-src="${poster}" alt="${title}" loading="lazy">
                <span class="sr-card-rating">${STAR_SVG} ${rating}</span>
                <span class="sr-card-lang-badge">${_LANG_LABELS[movie.original_language] || movie.original_language || ''}</span>
            </div>
            <div class="sr-card-body">
                <div class="sr-card-title">${title}</div>
                <div class="sr-card-meta">
                    <span class="sr-card-year">${year}</span>
                </div>
                ${genreNames.length ? `
                <div class="sr-card-genres">
                    ${genreNames.map(g => `<span class="sr-card-genre-tag">${g}</span>`).join('')}
                </div>` : ''}
                ${reason ? `<p class="sr-card-reason">✦ ${reason}</p>` : ''}
            </div>`;

        lazyImg(card.querySelector('img'));
        card.addEventListener('click', () => {
            window.location.href = `/movie/${movie.id}`;
        });
        return card;
    }

    const _LANG_LABELS = { te:'Telugu', hi:'Hindi', en:'English', ta:'Tamil', ml:'Malayalam', kn:'Kannada', bn:'Bengali', mr:'Marathi' };

    /* ── Render results ──────────────────────────────────── */
    function _renderResults(results, intentLabel) {
        _showResultsPane();
        _hideAll();

        results = results || [];
        console.log('Results count:', results.length);

        if (!results.length) { _showEmpty(); return; }

        if (intentLabel) {
            srIntent.textContent = `🔍 ${intentLabel}`;
            srPills.innerHTML = '';
            srMeta.style.display = 'flex';
        }

        srCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} found`;
        srResultsHeader.style.display = 'flex';

        srGrid.innerHTML = '';
        results.forEach(m => srGrid.appendChild(_buildCard(m)));
        console.log('Search results rendered:', results.length);
    }

    const _INTENT_LABELS = {
        person:   'Actor / Director search',
        discover: 'Genre / Language / Year filter',
        search:   'Movie title search',
    };

    /* ── Run search ──────────────────────────────────────── */
    async function runSearch(query) {
        query = query.trim();
        if (!query) return;

        console.log('Search page query:', query);

        const url = new URL(window.location);
        url.searchParams.set('q', query);
        window.history.pushState({}, '', url);

        if (srInput) srInput.value = query;

        const cached = _cacheGet(query);
        if (cached) { _renderResults(cached.results, cached.intentLabel); return; }

        _showSpinner();

        try {
            // 1. Smart search (fast, rule-based)
            console.log('Calling smart search API:', '/api/smart-search?q=' + query);
            const smart = await Utils.fetchJSON('/api/smart-search?q=' + encodeURIComponent(query));
            console.log('Smart search response:', smart);
            console.log('Results count:', smart.results?.length ?? 0);

            if (smart.ok && smart.results?.length) {
                const intentLabel = _INTENT_LABELS[smart.intent] || 'Smart Search';
                _cacheSet(query, { results: smart.results, intentLabel });
                _renderResults(smart.results, intentLabel);

                // 2. Enhance with AI search in background (non-blocking)
                fetch('/api/ai/search', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ query }),
                }).then(r => r.json()).then(ai => {
                    if (ai.ok && ai.results?.length > smart.results.length) {
                        _cacheSet(query, { results: ai.results, intentLabel: '🤖 AI Search' });
                        _renderResults(ai.results, '🤖 AI Search');
                    }
                }).catch(() => {});
                return;
            }

            // 3. Fallback: general keyword search
            console.log('Calling search API (fallback): /api/search?q=' + query);
            const fallback = await Utils.fetchJSON('/api/search?q=' + encodeURIComponent(query));
            console.log('Search response (fallback):', fallback);

            if (fallback.ok && fallback.results?.length) {
                _cacheSet(query, { results: fallback.results, intentLabel: 'Movie title search' });
                _renderResults(fallback.results, 'Movie title search');
                return;
            }

            _showEmpty();

        } catch (err) {
            console.error('[Search]', err);
            _showError('Search failed. Please try again.');
        }
    }

    /* ── Events ──────────────────────────────────────────── */

    // Header search bar: Enter key triggers search on this page
    if (srInput) {
        srInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') runSearch(srInput.value);
        });
    }

    // Suggestion chips + genre cards
    document.querySelectorAll('.sr-chip, .sr-genre-card').forEach(btn => {
        btn.addEventListener('click', () => runSearch(btn.dataset.q));
    });

    /* ── Auto-run from URL param ─────────────────────────── */
    const urlQ = new URLSearchParams(window.location.search).get('q');
    if (urlQ) {
        runSearch(urlQ);
    }

})();
