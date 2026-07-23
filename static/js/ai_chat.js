/* ============================================================
   CineMantra AI — Chat Assistant
   ============================================================ */
(() => {
    const SUGGESTIONS = [
        'Recommend horror movies',
        'Best action movies',
        'Top rated Telugu films',
        'Romantic movies to watch',
        'Suggest a thriller',
    ];

    let history = [];   // { role: 'user'|'bot', text }
    let isOpen  = false;

    /* ── Build UI ─────────────────────────────────────────── */
    function _buildUI() {
        // Trigger button
        const btn = document.createElement('button');
        btn.id = 'aiChatBtn';
        btn.setAttribute('aria-label', 'CineMantra AI');
        btn.innerHTML = `
            <svg class="ai-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="13" y2="14"/>
            </svg>
            <svg class="ai-close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>`;
        document.body.appendChild(btn);

        // Chat window
        const win = document.createElement('div');
        win.id = 'aiChatWindow';
        win.innerHTML = `
            <div class="ai-header">
                <div class="ai-header-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <div class="ai-header-info">
                    <div class="ai-header-name">Cine<span>Mantra</span> AI</div>
                    <div class="ai-header-status">Online</div>
                </div>
            </div>
            <div class="ai-messages" id="aiMessages"></div>
            <div class="ai-suggestions" id="aiSuggestions"></div>
            <div class="ai-input-row">
                <input type="text" id="aiInput" placeholder="Ask about movies, actors, genres..." autocomplete="off">
                <button class="ai-send-btn" id="aiSendBtn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"/>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
            </div>`;
        document.body.appendChild(win);

        btn.addEventListener('click', toggleChat);
        document.getElementById('aiSendBtn').addEventListener('click', sendMessage);
        document.getElementById('aiInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') sendMessage();
        });

        _renderSuggestions(SUGGESTIONS);
        _addBotMsg("Hi! I'm **CineMantra AI** 🎬 Ask me for movie recommendations, actor info, or anything about cinema!");
    }

    /* ── Toggle ───────────────────────────────────────────── */
    function toggleChat() {
        isOpen = !isOpen;
        document.getElementById('aiChatBtn').classList.toggle('open', isOpen);
        document.getElementById('aiChatWindow').classList.toggle('open', isOpen);
        if (isOpen) setTimeout(() => document.getElementById('aiInput')?.focus(), 300);
    }

    /* ── Suggestions ──────────────────────────────────────── */
    function _renderSuggestions(items) {
        const el = document.getElementById('aiSuggestions');
        if (!el) return;
        el.innerHTML = '';
        items.forEach(s => {
            const chip = document.createElement('button');
            chip.className = 'ai-suggestion-chip';
            chip.textContent = s;
            chip.addEventListener('click', () => {
                document.getElementById('aiInput').value = s;
                sendMessage();
            });
            el.appendChild(chip);
        });
    }

    /* ── Messages ─────────────────────────────────────────── */
    function _addUserMsg(text) {
        const el = document.getElementById('aiMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg user';
        div.innerHTML = `
            <div class="ai-msg-avatar">U</div>
            <div class="ai-msg-bubble">${_esc(text)}</div>`;
        el.appendChild(div);
        _scroll();
    }

    function _addBotMsg(text, movies = []) {
        const el = document.getElementById('aiMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg bot';

        // Convert **bold** to <strong>
        const html = _esc(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        let chipsHtml = '';
        if (movies.length) {
            chipsHtml = `<div class="ai-movie-chips">${
                movies.map(m => `<button class="ai-movie-chip" data-id="${m.id}">${_esc(m.title || m.name || '')}</button>`).join('')
            }</div>`;
        }

        div.innerHTML = `
            <div class="ai-msg-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="ai-msg-bubble">${html}${chipsHtml}</div>`;

        div.querySelectorAll('.ai-movie-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                window.location.href = '/movie/' + chip.dataset.id;
            });
        });

        el.appendChild(div);
        _scroll();
    }

    function _addTyping() {
        const el = document.getElementById('aiMessages');
        const div = document.createElement('div');
        div.className = 'ai-msg bot ai-typing';
        div.id = 'aiTyping';
        div.innerHTML = `
            <div class="ai-msg-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="ai-msg-bubble"><span></span><span></span><span></span></div>`;
        el.appendChild(div);
        _scroll();
    }

    function _removeTyping() {
        document.getElementById('aiTyping')?.remove();
    }

    function _scroll() {
        const el = document.getElementById('aiMessages');
        if (el) el.scrollTop = el.scrollHeight;
    }

    /* ── Send ─────────────────────────────────────────────── */
    async function sendMessage() {
        const input = document.getElementById('aiInput');
        const text  = input.value.trim();
        if (!text) return;

        input.value = '';
        document.getElementById('aiSuggestions').innerHTML = '';

        _addUserMsg(text);
        history.push({ role: 'user', text });

        _addTyping();

        try {
            const res = await fetch('/api/ai/chat', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ message: text, history }),
            });
            const data = await res.json();
            _removeTyping();

            if (data.ok) {
                _addBotMsg(data.reply, data.movies || []);
                history.push({ role: 'bot', text: data.reply });
                if (history.length > 20) history = history.slice(-20);
            } else {
                _addBotMsg("Sorry, I couldn't process that. Try asking about a movie or genre! 🎬");
            }
        } catch {
            _removeTyping();
            _addBotMsg("Connection error. Please try again.");
        }
    }

    /* ── Escape HTML ──────────────────────────────────────── */
    function _esc(s) {
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ── Init ─────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', _buildUI);
})();
