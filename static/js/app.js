/* ============================================================
   CineMantra — app.js
   Global utilities: Watchlist, Favorites, Toast
   Loaded on every page via base.html
   ============================================================ */

/* ── localStorage keys ───────────────────────────────────── */
const CM_KEYS = {
    watchlist:  'cm-watchlist',
    favorites:  'cm-favorites',
    history:    'cm-history',
};

/* ── Storage helpers ─────────────────────────────────────── */
const Store = {
    get(key)          { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } },
    set(key, arr)     { localStorage.setItem(key, JSON.stringify(arr)); },
    has(key, id)      { return this.get(key).includes(id); },
    toggle(key, id)   {
        const arr = this.get(key);
        const idx = arr.indexOf(id);
        if (idx === -1) { arr.push(id); } else { arr.splice(idx, 1); }
        this.set(key, arr);
        return idx === -1; // true = added
    },
    add(key, id)      {
        const arr = this.get(key);
        if (!arr.includes(id)) { arr.unshift(id); this.set(key, arr.slice(0, 50)); }
    },
};

/* ── Toast ───────────────────────────────────────────────── */
const Toast = (() => {
    let container;
    function _ensure() {
        if (container) return;
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = [
            'position:fixed', 'bottom:1.5rem', 'right:1.5rem',
            'z-index:9999', 'display:flex', 'flex-direction:column',
            'gap:0.5rem', 'pointer-events:none',
        ].join(';');
        document.body.appendChild(container);
    }
    return {
        show(msg, type = 'info') {
            _ensure();
            const t = document.createElement('div');
            const colors = { info: '#3B82F6', success: '#10B981', error: '#EF4444', warn: '#F59E0B' };
            t.style.cssText = [
                'padding:0.65rem 1.1rem',
                'border-radius:10px',
                `background:${colors[type] || colors.info}`,
                'color:#fff',
                'font-size:0.82rem',
                'font-weight:600',
                'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
                'opacity:0',
                'transform:translateY(8px)',
                'transition:all 0.25s ease',
                'pointer-events:none',
                'max-width:280px',
                'line-height:1.4',
            ].join(';');
            t.textContent = msg;
            container.appendChild(t);
            requestAnimationFrame(() => {
                t.style.opacity = '1';
                t.style.transform = 'translateY(0)';
            });
            setTimeout(() => {
                t.style.opacity = '0';
                t.style.transform = 'translateY(8px)';
                setTimeout(() => t.remove(), 300);
            }, 2800);
        },
    };
})();

/* ── Watchlist / Favorites public API ────────────────────── */
const CM = {
    toggleWatchlist(id, title) {
        const added = Store.toggle(CM_KEYS.watchlist, id);
        Toast.show(added ? `Added "${title}" to Watchlist` : `Removed from Watchlist`, added ? 'success' : 'info');
        document.dispatchEvent(new CustomEvent('cm:watchlist', { detail: { id, added } }));
        return added;
    },
    toggleFavorite(id, title) {
        const added = Store.toggle(CM_KEYS.favorites, id);
        Toast.show(added ? `❤️ Added "${title}" to Favorites` : `Removed from Favorites`, added ? 'success' : 'info');
        document.dispatchEvent(new CustomEvent('cm:favorites', { detail: { id, added } }));
        return added;
    },
    addHistory(id) {
        Store.add(CM_KEYS.history, id);
    },
    isWatchlisted(id) { return Store.has(CM_KEYS.watchlist, id); },
    isFavorite(id)    { return Store.has(CM_KEYS.favorites, id); },
};

/* Expose globally */
window.CM    = CM;
window.Store = Store;
window.Toast = Toast;

/* ── Header search bar — runs on every page ─────────────── */
(function initHeaderSearch() {
    const searchInput    = document.getElementById('searchInput');
    const searchDropdown = document.getElementById('searchDropdown');
    if (!searchInput || !searchDropdown) return;

    console.log('Search initialized');

    const STAR_SMALL = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="11" height="11"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    let _timer;

    function openDropdown()  { searchDropdown.classList.add('open'); }
    function closeDropdown() { searchDropdown.classList.remove('open'); searchDropdown.innerHTML = ''; }

    function showMsg(msg) {
        searchDropdown.innerHTML = `<div class="search-dropdown-msg">${msg}</div>`;
        openDropdown();
    }

    function renderDropdown(movies) {
        if (!movies.length) { showMsg('No movies found.'); return; }
        searchDropdown.innerHTML = '';
        movies.slice(0, 8).forEach(movie => {
            const poster   = movie.poster_url || Utils.PLACEHOLDER;
            const title    = movie.title || movie.name || 'Untitled';
            const year     = movie.release_date ? movie.release_date.slice(0, 4) : '—';
            const rating   = movie.vote_average ? movie.vote_average.toFixed(1) : '—';
            const overview = (movie.overview || '').slice(0, 80) + ((movie.overview || '').length > 80 ? '…' : '');
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <img class="search-result-poster"
                     src="${poster}" alt="${title}"
                     onerror="this.src='${Utils.PLACEHOLDER}'">
                <div class="search-result-info">
                    <div class="search-result-title">${title}</div>
                    <div class="search-result-meta">
                        <span>${year}</span><span>•</span>
                        <span class="search-result-rating">${STAR_SMALL} ${rating}</span>
                    </div>
                    <div class="search-result-overview">${overview}</div>
                </div>`;
            item.addEventListener('click', () => { window.location.href = '/movie/' + movie.id; });
            searchDropdown.appendChild(item);
        });
        openDropdown();
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(_timer);
        const q = searchInput.value.trim();
        if (!q) { closeDropdown(); return; }
        _timer = setTimeout(async () => {
            console.log('Search query:', q);
            try {
                const data = await Utils.fetchJSON('/api/smart-search?q=' + encodeURIComponent(q));
                console.log('Search response received:', data);
                if (data.ok && data.results && data.results.length) {
                    renderDropdown(data.results);
                    console.log('Search results rendered:', data.results.length);
                    return;
                }
            } catch { /* fall through */ }
            // Fallback: plain TMDB search
            try {
                const fallback = await Utils.fetchJSON('/api/search?q=' + encodeURIComponent(q));
                console.log('Search response received (fallback):', fallback);
                if (!fallback.ok) { showMsg('Search is temporarily unavailable.'); return; }
                renderDropdown(fallback.results || []);
                console.log('Search results rendered:', (fallback.results || []).length);
            } catch {
                showMsg('Search is temporarily unavailable.');
            }
        }, 350);
    });

    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeDropdown(); searchInput.blur(); }
        if (e.key === 'Enter') {
            clearTimeout(_timer);
            const q = searchInput.value.trim();
            if (q) window.location.href = '/search?q=' + encodeURIComponent(q);
        }
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.search-wrap')) closeDropdown();
    });
})();

document.addEventListener('DOMContentLoaded', () => {
    console.log('CineMantra loaded');

    /* ── Sidebar toggle ──────────────────────────────────── */
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar       = document.getElementById('sidebar');
    const mainContent   = document.getElementById('mainContent');

    // Restore saved state
    if (localStorage.getItem('cm-sidebar-collapsed') === 'true') {
        sidebar?.classList.add('collapsed');
        mainContent?.classList.add('sidebar-collapsed');
    }

    sidebarToggle?.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        mainContent?.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('cm-sidebar-collapsed', isCollapsed);
    });

    /* ── Active nav item ─────────────────────────────────── */
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item a').forEach(a => {
        const href = a.getAttribute('href');
        if (href === '#') return;
        if (href === '/' ? path === '/' : path.startsWith(href)) {
            a.closest('.nav-item')?.classList.add('active');
        }
    });
});
