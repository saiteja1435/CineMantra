/* ============================================================
   CineMantra — Surprise Me
   1s dice roll → direct movie page navigation
   ============================================================ */
(() => {
    const POOLS = [
        '/api/telugu/trending',
        '/api/telugu/popular',
        '/api/telugu/top-rated',
        '/api/telugu/action',
        '/api/telugu/comedy',
        '/api/telugu/thriller',
        '/api/telugu/horror',
        '/api/telugu/romance',
    ];

    let _pool   = [];
    let _loaded = false;

    /* ── Build UI ─────────────────────────────────────────── */
    function _build() {
        const btn = document.createElement('button');
        btn.id = 'surpriseBtn';
        btn.innerHTML = `
            <div class="dice-3d" id="dice3d">
                <div class="dice-cube" id="diceCube">
                    <div class="dice-face front"><span class="pip p1"></span></div>
                    <div class="dice-face back"><span class="pip p1"></span><span class="pip p2"></span><span class="pip p3"></span><span class="pip p4"></span><span class="pip p5"></span><span class="pip p6"></span></div>
                    <div class="dice-face right"><span class="pip p1"></span><span class="pip p2"></span><span class="pip p3"></span></div>
                    <div class="dice-face left"><span class="pip p1"></span><span class="pip p2"></span><span class="pip p3"></span><span class="pip p4"></span></div>
                    <div class="dice-face top"><span class="pip p1"></span><span class="pip p2"></span></div>
                    <div class="dice-face bottom"><span class="pip p1"></span><span class="pip p2"></span><span class="pip p3"></span><span class="pip p4"></span><span class="pip p5"></span></div>
                </div>
            </div>
            Surprise Me`;
        document.body.appendChild(btn);

        // Full-screen dice roll overlay
        const diceScreen = document.createElement('div');
        diceScreen.id = 'diceRollOverlay';
        diceScreen.innerHTML = `
            <div class="dice-roll-wrap">
                <div class="dice-roll-cube">
                    <div class="dice-roll-face f-front"><div class="dice-roll-pip" style="grid-column:2;grid-row:2"></div></div>
                    <div class="dice-roll-face f-back"><div class="dice-roll-pip" style="grid-column:1;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:2"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:2"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:3"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:3"></div></div>
                    <div class="dice-roll-face f-right"><div class="dice-roll-pip" style="grid-column:3;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:2;grid-row:2"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:3"></div></div>
                    <div class="dice-roll-face f-left"><div class="dice-roll-pip" style="grid-column:1;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:3"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:3"></div></div>
                    <div class="dice-roll-face f-top"><div class="dice-roll-pip" style="grid-column:3;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:3"></div></div>
                    <div class="dice-roll-face f-bottom"><div class="dice-roll-pip" style="grid-column:1;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:1"></div><div class="dice-roll-pip" style="grid-column:2;grid-row:2"></div><div class="dice-roll-pip" style="grid-column:1;grid-row:3"></div><div class="dice-roll-pip" style="grid-column:3;grid-row:3"></div></div>
                </div>
            </div>
            <div class="dice-roll-label">Finding your movie...</div>`;
        document.body.appendChild(diceScreen);

        btn.addEventListener('click', pickRandom);

        // Pre-load pool silently in background
        _preload();
    }

    /* ── Pre-load movie pool ──────────────────────────────── */
    async function _preload() {
        if (_loaded) return;
        try {
            const picks = _shuffle([...POOLS]).slice(0, 2);
            const results = await Promise.all(
                picks.map(url => fetch(url).then(r => r.json()).catch(() => ({ ok: false })))
            );
            results.forEach(d => {
                if (d.ok && d.results?.length) _pool.push(...d.results);
            });
            _loaded = true;
        } catch {}
    }

    /* ── Pick random — 1s roll then navigate directly ─────── */
    async function pickRandom() {
        const btn = document.getElementById('surpriseBtn');
        if (btn.classList.contains('rolling')) return;
        btn.classList.add('rolling');
        document.getElementById('diceCube')?.classList.add('rolling');
        document.getElementById('diceRollOverlay').classList.add('open');

        // Fetch + 1s animation run in parallel
        const fetchPromise = _pool.length
            ? Promise.resolve()
            : fetch('/api/telugu/trending')
                .then(r => r.json())
                .then(d => { if (d.ok) _pool = d.results || []; })
                .catch(() => {});

        await Promise.all([fetchPromise, new Promise(r => setTimeout(r, 380))]);

        btn.classList.remove('rolling');
        document.getElementById('diceCube')?.classList.remove('rolling');
        document.getElementById('diceRollOverlay').classList.remove('open');

        if (!_pool.length) {
            window.Toast?.show('Could not load movies', 'error');
            return;
        }
        const movie = _pool[Math.floor(Math.random() * _pool.length)];
        window.location.href = '/movie/' + movie.id;
    }

    /* ── Helpers ──────────────────────────────────────────── */
    function _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    document.addEventListener('DOMContentLoaded', _build);
})();
