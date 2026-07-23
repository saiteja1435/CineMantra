/* ============================================================
   CineMantra -- auth.js
   Firebase: Email/Password + Google Sign-In
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
    getAuth, GoogleAuthProvider, signInWithPopup, signOut,
    onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const firebaseConfig = {
    apiKey:            'AIzaSyB7KGxmc3FlZ4H6EH_3N-hDU4SN3Yk-5xE',
    authDomain:        'cinemantra.firebaseapp.com',
    projectId:         'cinemantra',
    storageBucket:     'cinemantra.firebasestorage.app',
    messagingSenderId: '461799461974',
    appId:             '1:461799461974:web:be373f976cd685e9eb17f7',
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const provider = new GoogleAuthProvider();

const userProfile = document.getElementById('userProfile');
const avatarEl    = userProfile?.querySelector('.avatar');
const usernameEl  = userProfile?.querySelector('.username');

let _dropdown = null;
let _isSignup = false;

/* ============================================================
   MODAL HTML
============================================================ */
const MODAL_HTML = `
<div class="auth-backdrop" id="authBackdrop"></div>
<div class="auth-box">
    <button class="auth-close" id="authClose">&times;</button>
    <div class="auth-logo">Cine<span>Mantra</span></div>
    <p class="auth-sub">Sign in to save your watchlist &amp; favorites</p>

    <button class="auth-google-btn" id="authGoogleBtn">
        <svg viewBox="0 0 48 48" width="20" height="20">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
        Continue with Google
    </button>

    <div class="auth-divider"><span>or</span></div>

    <input class="auth-email-input" id="authEmailInput" type="email"
           placeholder="Email address" autocomplete="email">
    <input class="auth-email-input" id="authPasswordInput" type="password"
           placeholder="Password" autocomplete="current-password">
    <p class="auth-error" id="authEmailError"></p>
    <button class="auth-otp-btn" id="authEmailLoginBtn">Sign In</button>
    <p class="auth-toggle-link">
        No account? <button id="authToggleSignup">Sign Up</button>
    </p>

    <p class="auth-terms">By signing in, you agree to our Terms &amp; Privacy Policy.</p>
</div>`;

/* ============================================================
   CREATE MODAL
============================================================ */
function _createModal() {
    const m = document.createElement('div');
    m.id = 'authModal';
    m.innerHTML = MODAL_HTML;
    document.body.appendChild(m);

    m.querySelector('#authClose').onclick    = closeModal;
    m.querySelector('#authBackdrop').onclick = closeModal;
    m.querySelector('#authGoogleBtn').onclick     = googleSignIn;
    m.querySelector('#authEmailLoginBtn').onclick = emailAuth;
    m.querySelector('#authToggleSignup').onclick  = () => {
        _isSignup = !_isSignup;
        m.querySelector('#authEmailLoginBtn').textContent = _isSignup ? 'Sign Up' : 'Sign In';
        m.querySelector('#authToggleSignup').textContent  = _isSignup ? 'Sign In' : 'Sign Up';
        m.querySelector('.auth-toggle-link').firstChild.textContent =
            _isSignup ? 'Have account? ' : 'No account? ';
        m.querySelector('#authEmailError').textContent = '';
    };
}

/* ============================================================
   EMAIL AUTH
============================================================ */
async function emailAuth() {
    const email    = document.getElementById('authEmailInput').value.trim();
    const password = document.getElementById('authPasswordInput').value;
    const errEl    = document.getElementById('authEmailError');
    errEl.textContent = '';

    if (!email || !password) { errEl.textContent = 'Enter email and password'; return; }
    if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; return; }

    const btn = document.getElementById('authEmailLoginBtn');
    btn.disabled = true;
    btn.textContent = 'Please wait...';

    try {
        if (_isSignup) {
            await createUserWithEmailAndPassword(auth, email, password);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        closeModal();
        document.dispatchEvent(new CustomEvent('cm:user-login'));
        window.Toast?.show('Login successful!', 'success');
    } catch (e) {
        console.error('[Auth] emailAuth:', e.code, e.message);
        errEl.textContent = _emailErr(e.code);
        btn.disabled = false;
        btn.textContent = _isSignup ? 'Sign Up' : 'Sign In';
    }
}

/* ============================================================
   GOOGLE SIGN-IN
============================================================ */
async function googleSignIn() {
    const errEl = document.getElementById('authEmailError');
    if (errEl) errEl.textContent = '';
    try {
        await signInWithPopup(auth, provider);
        closeModal();
        document.dispatchEvent(new CustomEvent('cm:user-login'));
        window.Toast?.show('Login successful!', 'success');
    } catch (e) {
        console.error('[Auth] googleSignIn:', e.code, e.message);
        if (errEl && e.code !== 'auth/popup-closed-by-user') {
            errEl.textContent = 'Google sign-in failed. Try again.';
        }
    }
}

/* ============================================================
   MODAL OPEN / CLOSE
============================================================ */
function openModal() {
    if (!document.getElementById('authModal')) {
        _createModal();
    } else {
        const m = document.getElementById('authModal');
        m.querySelector('#authEmailError').textContent = '';
        m.querySelector('#authEmailInput').value = '';
        m.querySelector('#authPasswordInput').value = '';
    }
    document.getElementById('authModal').classList.add('open');
}

function closeModal() {
    document.getElementById('authModal')?.classList.remove('open');
}

/* ============================================================
   USER DROPDOWN
============================================================ */
function _createDropdown() {
    const d = document.createElement('div');
    d.id = 'userDropdown';
    d.innerHTML = `
        <div class="ud-info">
            <span class="ud-name"  id="udName"></span>
            <span class="ud-email" id="udEmail"></span>
        </div>
        <div class="ud-divider"></div>
        <button class="ud-item ud-signout" id="udSignOut">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
        </button>`;
    userProfile.parentElement.style.position = 'relative';
    userProfile.parentElement.appendChild(d);
    document.getElementById('udSignOut').onclick = async (e) => {
        e.stopPropagation();
        d.classList.remove('open');
        await signOut(auth);
        window.Toast?.show('Signed out', 'info');
    };
    document.addEventListener('click', e => {
        if (!userProfile.parentElement.contains(e.target)) d.classList.remove('open');
    });
    return d;
}

/* ============================================================
   UPDATE NAVBAR
============================================================ */
function _updateNavbar(user) {
    if (!userProfile) return;
    if (user) {
        const name = user.displayName || user.email?.split('@')[0] || 'User';
        if (user.photoURL) {
            avatarEl.style.backgroundImage = 'url(' + user.photoURL + ')';
            avatarEl.style.backgroundSize  = 'cover';
            avatarEl.textContent = '';
        } else {
            avatarEl.style.backgroundImage = '';
            avatarEl.textContent = user.displayName
                ? user.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                : 'U';
        }
        usernameEl.textContent = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';
        if (!_dropdown) _dropdown = _createDropdown();
        document.getElementById('udName').textContent  = name;
        document.getElementById('udEmail').textContent = user.email || '';
        userProfile.onclick = e => { e.stopPropagation(); _dropdown.classList.toggle('open'); };
    } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.textContent = 'CM';
        usernameEl.textContent = 'Sign In';
        _dropdown?.classList.remove('open');
        userProfile.onclick = (e) => { e.stopPropagation(); openModal(); };
    }
}

/* ============================================================
   AUTH STATE
============================================================ */
onAuthStateChanged(auth, user => {
    _updateNavbar(user);
    window.CM_USER = user || null;
    window.CM_UID  = user ? user.uid : 'local';
});

document.addEventListener('DOMContentLoaded', () => {
    if (userProfile) {
        userProfile.onclick = openModal;
        userProfile.classList.add('auth-clickable');
    }
});

/* ============================================================
   ERROR MESSAGES
============================================================ */
function _emailErr(code) {
    const map = {
        'auth/user-not-found':         'Email not found. Please sign up',
        'auth/wrong-password':         'Wrong password. Please try again',
        'auth/email-already-in-use':   'Email already registered. Sign in instead',
        'auth/invalid-email':          'Enter a valid email address',
        'auth/weak-password':          'Password too weak. Use 6+ characters',
        'auth/too-many-requests':      'Too many attempts. Please wait',
        'auth/invalid-credential':     'Wrong email or password',
        'auth/network-request-failed': 'Network error. Check your connection',
        'auth/operation-not-allowed':  'Email login not enabled in Firebase console',
    };
    return map[code] || ('Error: ' + (code || 'Unknown'));
}
