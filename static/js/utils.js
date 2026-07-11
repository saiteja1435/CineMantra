const Utils = {

    PLACEHOLDER: '/static/images/placeholder.svg',

    GENRES: {
        28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
        99:'Documentary', 18:'Drama', 10751:'Family', 14:'Fantasy', 36:'History',
        27:'Horror', 10402:'Music', 9648:'Mystery', 10749:'Romance', 878:'Sci-Fi',
        10770:'TV Movie', 53:'Thriller', 10752:'War', 37:'Western',
    },

    // ── Poster URL cache ──────────────────────────────────────
    _posterCache: new Map(),

    cachedPoster(url) {
        if (!url) return this.PLACEHOLDER;
        if (this._posterCache.has(url)) {
            return this._posterCache.get(url);
        }
        this._posterCache.set(url, url);
        return url;
    },

    // ── Single shared IntersectionObserver for ALL lazy images ─
    _lazyObserver: null,

    _getLazyObserver() {
        if (this._lazyObserver) return this._lazyObserver;
        const load = (el) => {
            const src = el.dataset.src;
            if (!src) return;
            // Check poster cache first
            if (Utils._posterCache.has(src)) {
                el.src = Utils._posterCache.get(src);
                el.classList.add('loaded');
                return;
            }
            el.src = src;
            el.onload  = () => { Utils._posterCache.set(src, src); el.classList.add('loaded'); };
            el.onerror = () => { el.src = Utils.PLACEHOLDER; el.classList.add('loaded'); };
        };
        this._lazyObserver = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                load(e.target);
                this._lazyObserver.unobserve(e.target);
            });
        }, { rootMargin: '300px 200px' });
        console.log('[CineMantra] Poster cache loaded: shared IntersectionObserver created');
        return this._lazyObserver;
    },

    lazyLoad(img) {
        if (!img || !img.dataset.src) return;
        if (!('IntersectionObserver' in window)) {
            img.src = img.dataset.src;
            img.onload  = () => img.classList.add('loaded');
            img.onerror = () => { img.src = this.PLACEHOLDER; img.classList.add('loaded'); };
            return;
        }
        this._getLazyObserver().observe(img);
    },

    async fetchJSON(url) {
        let res;
        try {
            res = await fetch(url);
        } catch (networkErr) {
            console.error('[CineMantra] Network error fetching', url, networkErr);
            throw networkErr;
        }
        if (!res.ok) {
            const err = new Error('HTTP ' + res.status + ' for ' + url);
            console.error('[CineMantra] Bad response:', err.message);
            throw err;
        }
        try {
            return await res.json();
        } catch (parseErr) {
            console.error('[CineMantra] JSON parse error for', url, parseErr);
            throw parseErr;
        }
    },

    posterURL(movie) {
        return movie.poster_url || movie.backdrop_url || this.PLACEHOLDER;
    },

    backdropURL(movie) {
        return movie.backdrop_url || null;
    },

    genreNames(ids) {
        ids = ids || [];
        return ids.slice(0, 3).map(id => this.GENRES[id] || '').filter(Boolean);
    },

    year(dateStr) {
        return dateStr ? dateStr.slice(0, 4) : '\u2014';
    },

    rating(vote) {
        return vote ? Number(vote).toFixed(1) : '\u2014';
    },
};
