// ─── SAIF AI USER AUTH SYSTEM ───
// Works locally via IndexedDB. Plug in Supabase by replacing the
// _localLogin / _localRegister calls with supabase.auth equivalents.

const DB_NAME_AUTH = 'PromptFlowDB';
const STORE_AUTH = 'vault';

// ── DB Helpers (shared with app.js) ──
async function _authDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME_AUTH, 1);
        req.onupgradeneeded = e => {
            if (!e.target.result.objectStoreNames.contains(STORE_AUTH))
                e.target.result.createObjectStore(STORE_AUTH);
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror  = e => reject(e.target.error);
    });
}
async function _authGet(key) {
    const db = await _authDB();
    return new Promise(r => {
        const req = db.transaction(STORE_AUTH, 'readonly').objectStore(STORE_AUTH).get(key);
        req.onsuccess = () => r(req.result);
        req.onerror   = () => r(null);
    });
}
async function _authSet(key, val) {
    const db = await _authDB();
    db.transaction(STORE_AUTH, 'readwrite').objectStore(STORE_AUTH).put(val, key);
}

// ── Simple password hash (for local only, NOT production) ──
async function _hash(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2,'0')).join('');
}

// ── Current session ──
let _currentUser = null;   // { id, name, email, role, joinedAt }

// ── Admin credentials (change as needed) ──
const ADMIN_EMAIL = 'admin@saifai.com';
const ADMIN_PASS  = '123456';

// ─────────────────────────────────────────
const userAuth = {
    // ── Open auth modal (shows profile if logged in) ──
    openAuthModal() {
        if (_currentUser) {
            if (typeof actions !== 'undefined' && actions.viewProfile) {
                actions.viewProfile();
            } else {
                userAuth._renderProfile();
                if (typeof ux !== 'undefined') ux.openM('profile-modal');
            }
        } else {
            userAuth.switchTab('login');
            if (typeof ux !== 'undefined') ux.openM('login-modal');
        }
    },

    // ── Tab Switching ──
    switchTab(tab) {
        const login = document.getElementById('panel-login');
        const reg   = document.getElementById('panel-register');
        const tabL  = document.getElementById('auth-tab-login');
        const tabR  = document.getElementById('auth-tab-reg');
        if (!login) return;

        const isLogin = tab === 'login';
        login.style.display = isLogin ? 'block' : 'none';
        reg.style.display   = isLogin ? 'none' : 'block';

        const activeStyle   = 'background:var(--p); color:white;';
        const inactiveStyle = 'background:var(--bg); color:var(--muted);';
        tabL.style.cssText += isLogin ? activeStyle : inactiveStyle;
        tabR.style.cssText += isLogin ? inactiveStyle : activeStyle;
    },

    // ── Login ──
    async login() {
        const email = document.getElementById('login-email')?.value.trim().toLowerCase();
        const pass  = document.getElementById('login-pass')?.value;
        if (!email || !pass) return userAuth._toast('أكمل البيانات');

        // ── Admin check ──
        if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
            _currentUser = { id: 'admin', name: 'Admin Saif', email, role: 'admin', joinedAt: Date.now() };
            await _authSet('session', _currentUser);
            userAuth._afterLogin();
            return;
        }

        // ── Regular user check ──
        const users = await _authGet('users') || {};
        const stored = users[email];
        if (!stored) return userAuth._toast('البريد غير مسجل');
        const hashed = await _hash(pass);
        if (hashed !== stored.passHash) return userAuth._toast('كلمة المرور غير صحيحة');

        _currentUser = { id: stored.id, name: stored.name, email, role: 'user', joinedAt: stored.joinedAt };
        await _authSet('session', _currentUser);
        userAuth._afterLogin();
    },

    // ── Register ──
    async register() {
        const name  = document.getElementById('reg-name')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
        const pass  = document.getElementById('reg-pass')?.value;
        if (!name || !email || !pass) return userAuth._toast('أكمل جميع البيانات');
        if (pass.length < 6)         return userAuth._toast('كلمة المرور 6 أحرف على الأقل');

        const users = await _authGet('users') || {};
        if (users[email])            return userAuth._toast('البريد مسجّل بالفعل!');

        const hashed = await _hash(pass);
        const id = 'u_' + Date.now();
        users[email] = { id, name, passHash: hashed, joinedAt: Date.now() };
        await _authSet('users', users);

        _currentUser = { id, name, email, role: 'user', joinedAt: Date.now() };
        await _authSet('session', _currentUser);
        userAuth._afterLogin();
    },

    // ── Logout ──
    async logout() {
        _currentUser = null;
        await _authSet('session', null);
        if (typeof state !== 'undefined') state.user = null;
        userAuth._updateAvatar();
        if (typeof ux !== 'undefined') ux.closeM();
        if (typeof render !== 'undefined') render();
        userAuth._toast('تم تسجيل الخروج بنجاح');
        if (location.pathname.includes('admin')) location.href = 'index.html';
    },

    // ── After login callback ──
    _afterLogin() {
        if (typeof ux !== 'undefined') ux.closeM();
        if (typeof state !== 'undefined') state.user = _currentUser;
        userAuth._updateAvatar();
        if (typeof render !== 'undefined') render();
        userAuth._toast(`أهلاً ${_currentUser.name.split(' ')[0]}! 🎉`);
    },

    // ── Update Avatar Button in Header ──
    _updateAvatar() {
        const btns = [document.getElementById('user-avatar-btn'), document.getElementById('m-user-btn')];
        btns.forEach(btn => {
            if (!btn) return;
            if (_currentUser) {
                const color = _currentUser.role === 'admin' ? '#ef4444' : 'var(--p)';
                btn.innerHTML = `<i data-lucide="${_currentUser.role === 'admin' ? 'shield-check' : 'user'}" size="20" style="color:${color}"></i>`;
                btn.style.background = _currentUser.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'var(--p-s)';
                btn.style.borderColor = color;
                btn.style.width = '42px';
            } else {
                btn.innerHTML = '<i data-lucide="user" size="18" style="margin-left:8px;"></i> <span style="font-size:0.85rem; font-weight:800;">دخول</span>';
                btn.style.background = 'var(--p-s)';
                btn.style.borderColor = 'var(--bord)';
                btn.style.width = '100px';
                btn.style.borderRadius = '50px';
                btn.style.padding = '0 15px';
            }
            if (window.lucide) lucide.createIcons();
        });
    },

    // ── Render Profile Modal Content ──
    _renderProfile() {
        if (!_currentUser) return;
        const el = id => document.getElementById(id);
        const initial = _currentUser.name.charAt(0).toUpperCase();
        el('profile-avatar').textContent = initial;
        el('profile-avatar').style.background = _currentUser.role === 'admin' ? '#ef4444' : 'var(--p)';
        el('profile-name').textContent  = _currentUser.name;
        el('profile-email').textContent = _currentUser.email;

        try {
            if (typeof state !== 'undefined' && state.favs) {
                const favCount = state.favs.length;
                el('profile-favs-count').textContent = favCount;
                const listEl = el('profile-favs-list');
                const favItems = state.items.filter(i => state.favs.includes(i.id));
                
                if (favItems.length === 0) {
                    listEl.innerHTML = '<p style="font-size:0.75rem; opacity:0.4; text-align:center;">لم تحفظ أي برومبت بعد</p>';
                } else {
                    listEl.innerHTML = favItems.map(i => `
                        <div style="display:flex; align-items:center; gap:10px; background:var(--bg); padding:10px; border-radius:12px; border:1px solid var(--bord); cursor:pointer;" onclick="ux.view(${i.id})">
                            <img src="${i.img}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                            <div style="flex:1; overflow:hidden;">
                                <div style="font-weight:700; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${i.name}</div>
                                <div style="font-size:0.65rem; opacity:0.5;">${i.categories[0] || 'عام'}</div>
                            </div>
                            <i data-lucide="chevron-left" size="14"></i>
                        </div>
                    `).join('');
                    if (window.lucide) lucide.createIcons();
                }
            }
        } catch(e) { console.error('Profile Render Error:', e); }

        const joined = new Date(_currentUser.joinedAt);
        el('profile-since').textContent = joined.toLocaleDateString('ar', { year:'numeric', month:'short' });
    },

    // ── Toast ──
    _toast(msg) {
        if (typeof ux !== 'undefined' && ux.toast) { ux.toast(msg); return; }
        const t = document.getElementById('toast');
        if (!t) return;
        const msgEl = document.getElementById('toast-msg');
        if(msgEl) msgEl.textContent = msg;
        t.classList.add('active');
        setTimeout(() => t.classList.remove('active'), 3000);
    },

    // ── Restore session on page load ──
    async restoreSession() {
        const session = await _authGet('session');
        if (session && session.id) {
            _currentUser = session;
            if (typeof state !== 'undefined') state.user = session;
            userAuth._updateAvatar();
        }
    },

    getUser() { return _currentUser; },
    isAdmin()  { return _currentUser?.role === 'admin'; }
};

document.addEventListener('DOMContentLoaded', async () => {
    await userAuth.restoreSession();
    if (window.lucide) lucide.createIcons();
});
