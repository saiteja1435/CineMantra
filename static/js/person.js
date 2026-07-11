(() => {
    console.log('Person page loaded');

    const PLACEHOLDER = '/static/images/placeholder.svg';
    const PERSON_ID   = document.getElementById('personPage').dataset.personId;

    const loadingEl = document.getElementById('ppLoading');
    const errorEl   = document.getElementById('ppError');
    const errorMsg  = document.getElementById('ppErrorMsg');
    const contentEl = document.getElementById('ppContent');

    // ── State helpers ─────────────────────────────────────────
    function showLoading() {
        loadingEl.style.display = '';
        errorEl.style.display   = 'none';
        contentEl.style.display = 'none';
    }

    function showError(msg) {
        loadingEl.style.display = 'none';
        errorEl.style.display   = '';
        errorMsg.textContent    = msg || 'Failed to load person details.';
        contentEl.style.display = 'none';
    }

    function showContent() {
        loadingEl.style.display = 'none';
        errorEl.style.display   = 'none';
        contentEl.style.display = '';
    }

    // ── Date formatter ────────────────────────────────────────
    function fmt(d) {
        if (!d) return null;
        return new Date(d).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    // ── Render ────────────────────────────────────────────────
    function render(p) {
        document.title = `${p.name || 'Person'} \u2014 CineMantra`;

        // Backdrop — blurred profile image
        const backdropEl = document.getElementById('ppBackdropImg');
        if (p.profile_url) {
            backdropEl.style.backgroundImage = `url('${p.profile_url}')`;
        }

        // Profile image
        const imgEl   = document.getElementById('ppImage');
        imgEl.src     = p.profile_url || PLACEHOLDER;
        imgEl.alt     = p.name || '';
        imgEl.onerror = () => { imgEl.src = PLACEHOLDER; };

        // Name
        document.getElementById('ppName').textContent = p.name || 'Unknown';

        // Known for department
        const knownForEl = document.getElementById('ppKnownFor');
        knownForEl.textContent = p.known_for ? `Known for \u00b7 ${p.known_for}` : '';

        // Meta badges
        const metaEl = document.getElementById('ppMeta');
        metaEl.innerHTML = '';

        const badges = [
            p.birthday   ? `\uD83C\uDF82 ${fmt(p.birthday)}` : null,
            p.birthplace ? `\uD83D\uDCCD ${p.birthplace}`    : null,
            p.gender     ? `\uD83D\uDC64 ${p.gender}`        : null,
            p.popularity ? `\u2B50 ${p.popularity} Popularity` : null,
        ];

        badges.forEach(text => {
            if (!text) return;
            const span = document.createElement('span');
            span.className   = 'pp-meta-badge';
            span.textContent = text;
            metaEl.appendChild(span);
        });

        // Biography
        const bioEl = document.getElementById('ppBio');
        bioEl.textContent = p.biography || 'No biography available.';

        showContent();
    }

    // ── Filmography ───────────────────────────────────────────────
    const STAR_SVG = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="11" height="11"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const _buckets = { all: [], telugu: [], tv: [], upcoming: [] };
    let   _active  = 'all';
    let   _sort    = 'latest';
    const TODAY    = new Date().toISOString().slice(0, 10);

    function _releaseDate(item) {
        return item.release_date || item.first_air_date || '';
    }

    function _year(item) {
        const d = _releaseDate(item);
        return d ? d.slice(0, 4) : '—';
    }

    function buildFilmCard(item) {
        const poster = item.poster_url || PLACEHOLDER;
        const title  = item.title || item.name || 'Untitled';
        const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '—';
        const char   = item.character || '';

        const card = document.createElement('div');
        card.className = 'pp-film-card';
        card.innerHTML = `
            <div class="pp-film-poster">
                <img src="${poster}" alt="${title}" loading="lazy"
                     onerror="this.src='${PLACEHOLDER}'">
                <span class="pp-film-rating">${STAR_SVG} ${rating}</span>
            </div>
            <div class="pp-film-info">
                <div class="pp-film-title">${title}</div>
                <div class="pp-film-year">${_year(item)}</div>
                ${char ? `<div class="pp-film-char">${char}</div>` : ''}
            </div>`;
        card.addEventListener('click', () => {
            window.location.href = `/movie/${item.id}`;
        });
        return card;
    }

    function sortCredits(items) {
        const copy = [...items];
        if (_sort === 'latest')  return copy.sort((a, b) => _releaseDate(b).localeCompare(_releaseDate(a)));
        if (_sort === 'rating')  return copy.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        if (_sort === 'popular') return copy.sort((a, b) => (b.popularity   || 0) - (a.popularity   || 0));
        return copy;
    }

    function renderGrid() {
        const grid  = document.getElementById('ppFilmGrid');
        const items = sortCredits(_buckets[_active]);
        grid.innerHTML = '';

        if (!items.length) {
            grid.innerHTML = '<p class="pp-empty">Nothing to show.</p>';
            return;
        }
        items.forEach(item => grid.appendChild(buildFilmCard(item)));
        console.log('Filmography rendered', { tab: _active, count: items.length });
    }

    function partitionCredits(credits) {
        const seen = new Set();
        credits.forEach(item => {
            const id      = item.id;
            const lang    = item.original_language || '';
            const release = _releaseDate(item);
            const media   = item.media_type || 'movie';

            // Deduplicate across buckets
            const key = `${id}_${media}`;
            if (seen.has(key)) return;
            seen.add(key);

            // All acting credits (movies only, not TV)
            if (media === 'movie') _buckets.all.push(item);

            // Upcoming — future release, any language
            if (release && release > TODAY) {
                _buckets.upcoming.push(item);
                return;
            }

            // Web series
            if (media === 'tv') { _buckets.tv.push(item); return; }

            // Telugu movies
            if (lang === 'te') _buckets.telugu.push(item);
        });
    }

    function initTabs() {
        document.querySelectorAll('#ppTabs .pp-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                _active = btn.dataset.tab;
                document.querySelectorAll('#ppTabs .pp-tab').forEach(b =>
                    b.classList.toggle('active', b === btn));
                renderGrid();
            });
        });

        document.getElementById('ppSort').addEventListener('change', e => {
            _sort = e.target.value;
            renderGrid();
        });

        // Update tab labels with counts, disable empty tabs
        document.querySelectorAll('#ppTabs .pp-tab').forEach(btn => {
            const count = _buckets[btn.dataset.tab]?.length || 0;
            btn.textContent = `${btn.textContent} (${count})`;
            if (!count) btn.disabled = true;
        });

        // Auto-select first non-empty tab
        const first = ['all', 'telugu', 'tv', 'upcoming'].find(t => _buckets[t].length);
        if (first && first !== _active) {
            _active = first;
            document.querySelectorAll('#ppTabs .pp-tab').forEach(b =>
                b.classList.toggle('active', b.dataset.tab === first));
        }
    }

    async function loadFilmography() {
        console.log('Loading filmography', { id: PERSON_ID });
        try {
            const data = await Utils.fetchJSON(`/api/person/${PERSON_ID}/credits`);
            console.log('Credits received', { ok: data.ok, total: data.credits?.length });

            if (!data.ok || !data.credits?.length) {
                document.getElementById('ppFilmography').style.display = 'none';
                return;
            }

            partitionCredits(data.credits);
            initTabs();
            renderGrid();
            document.getElementById('ppFilmography').style.display = '';
        } catch (e) {
            console.error('[Person] Credits fetch failed:', e);
            document.getElementById('ppFilmography').style.display = 'none';
        }
    }

    // ── Boot ──────────────────────────────────────────────────
    async function boot() {
        showLoading();
        console.log('Fetching person details', { id: PERSON_ID });

        try {
            const data = await Utils.fetchJSON(`/api/person/${PERSON_ID}`);
            console.log('Person details received', { ok: data.ok, name: data.person?.name });

            if (!data.ok || !data.person) {
                showError('Person not found.');
                return;
            }

            render(data.person);
        } catch (e) {
            console.error('[Person] Fetch failed:', e);
            showError('Could not load person details. Please try again.');
        }

        loadFilmography();
    }

    boot();
})();
