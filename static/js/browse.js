(() => {
    const page    = document.getElementById('browsePage');
    const grid    = document.getElementById('browseGrid');
    const empty   = document.getElementById('browseEmpty');
    if (!page || !grid) return;

    const _lang = () => localStorage.getItem('cm-lang') || 'te';
    const baseApi = page.dataset.api;
    // Append lang param to API URL
    const apiUrl = baseApi + (baseApi.includes('?') ? '&' : '?') + 'lang=' + _lang();
    const STAR    = `<svg viewBox="0 0 24 24" fill="#FFD54F" stroke="#FFD54F" stroke-width="1" width="11" height="11"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    function buildCard(movie) {
        const poster  = movie.poster_url || movie.backdrop_url || Utils.PLACEHOLDER;
        const title   = movie.title || movie.name || 'Untitled';
        const year    = Utils.year(movie.release_date);
        const rating  = Utils.rating(movie.vote_average);
        const genres  = Utils.genreNames(movie.genre_ids || []);

        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-poster">
                <img class="lazy" data-src="${poster}" alt="${title}"
                     onerror="this.src='${Utils.PLACEHOLDER}'">
                <div class="card-overlay">
                    <button class="card-play-btn" aria-label="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    </button>
                    <div class="card-overlay-actions">
                        <button aria-label="Add to watchlist">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                        <button aria-label="Favorite">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                    </div>
                </div>
                <span class="rating-badge">${STAR} ${rating}</span>
            </div>
            <div class="card-info">
                <h3 class="card-title">${title}</h3>
                <p class="card-genre">${genres.join(' • ') || 'Cinema'} • ${year}</p>
            </div>`;

        Utils.lazyLoad(card.querySelector('img'));
        card.addEventListener('click', () => {
            window.trackGenres?.(movie.genre_ids || []);
            window.location.href = '/movie/' + movie.id;
        });
        card.querySelectorAll('.card-overlay button').forEach(b => b.addEventListener('click', e => e.stopPropagation()));
        return card;
    }

    async function load() {
        try {
            const data = await Utils.fetchJSON(apiUrl);
            grid.innerHTML = '';
            const movies = data.ok ? (data.results || []) : [];
            if (!movies.length) {
                empty.style.display = 'flex';
                return;
            }
            movies.forEach(m => grid.appendChild(buildCard(m)));
        } catch (e) {
            grid.innerHTML = '';
            empty.style.display = 'flex';
            window.Toast?.show('Failed to load movies', 'error');
        }
    }

    load();
})();
