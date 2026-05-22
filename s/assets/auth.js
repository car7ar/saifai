// ─── SAIF AI SUPABASE AUTH SYSTEM ───
// Fully connected to Supabase Cloud for professional security.

const userAuth = {
    // ── Open auth modal ──
    openAuthModal() {
        const user = state.user;
        if (user) {
            actions.viewProfile();
        } else {
            userAuth.switchTab('login');
            ux.openM('login-modal');
        }
    },

    // ── Tab Switching ──
    switchTab(tab) {
        const login = document.getElementById('panel-login');
        const reg = document.getElementById('panel-register');
        const tabL = document.getElementById('auth-tab-login');
        const tabR = document.getElementById('auth-tab-reg');
        if (!login) return;

        const isLogin = tab === 'login';
        login.style.display = isLogin ? 'block' : 'none';
        reg.style.display = isLogin ? 'none' : 'block';

        const activeStyle = 'background:var(--p); color:white;';
        const inactiveStyle = 'background:var(--bg); color:var(--muted);';
        tabL.style.cssText += isLogin ? activeStyle : inactiveStyle;
        tabR.style.cssText += isLogin ? inactiveStyle : activeStyle;
    },

    // ── Login via Supabase ──
    async login() {
        const email = document.getElementById('login-email')?.value.trim().toLowerCase();
        const password = document.getElementById('login-pass')?.value;
        if (!email || !password) return userAuth._toast('أكمل البيانات');

        try {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;

            // Success
            userAuth._handleSession(data.user);
            ux.closeM();
            userAuth._toast(`أهلاً بك مجدداً! 🎉`);
        } catch (e) {
            console.error('Login Error:', e);
            let msg = e.message;
            if (msg === 'Invalid login credentials') msg = 'خطأ في البريد الإلكتروني أو كلمة المرور';
            userAuth._toast(msg);
        }
    },

    // ── Forgot Password ──
    async forgotPassword() {
        const email = document.getElementById('login-email')?.value.trim().toLowerCase();
        if (!email) return userAuth._toast('يرجى كتابة بريدك الإلكتروني أولاً');
        try {
            const { error } = await sb.auth.resetPasswordForEmail(email);
            if (error) throw error;
            userAuth._toast('تم إرسال رابط إعادة التعيين لبريدك 📧');
        } catch (e) {
            userAuth._toast(e.message);
        }
    },

    // ── Register via Supabase ──
    async register() {
        const name = document.getElementById('reg-name')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim().toLowerCase();
        const password = document.getElementById('reg-pass')?.value;
        if (!name || !email || !password) return userAuth._toast('أكمل جميع البيانات');

        try {
            const { data, error } = await sb.auth.signUp({
                email,
                password,
                options: { data: { full_name: name, role: 'user' } }
            });
            if (error) throw error;

            if (data.user && !data.session) {
                userAuth._toast('تم إرسال رابط التأكيد إلى بريدك الإلكتروني! 📧');
                ux.closeM();
            } else {
                userAuth._handleSession(data.user);
                ux.closeM();
                userAuth._toast('تم إنشاء الحساب بنجاح! 🚀');
            }
        } catch (e) {
            console.error('Registration Error:', e);
            userAuth._toast(e.message);
        }
    },

    // ── Logout ──
    async logout() {
        await sb.auth.signOut();
        state.user = null;
        userAuth._updateAvatar();
        render();
        ux.closeM();
        userAuth._toast('تم تسجيل الخروج');
        if (location.pathname.includes('admin')) location.href = 'index.html';
    },

    // ── Session Handling ──
    _handleSession(sbUser) {
        if (!sbUser) {
            state.user = null;
        } else {
            state.user = {
                id: sbUser.id,
                name: sbUser.user_metadata?.full_name || 'مستخدم',
                email: sbUser.email,
                role: sbUser.user_metadata?.role || 'user'
            };
        }
        userAuth._updateAvatar();
        render();
    },

    // ── Update View ──
    _updateAvatar() {
        const btns = [document.getElementById('user-avatar-btn'), document.getElementById('m-user-btn')];
        btns.forEach(btn => {
            if (!btn) return;
            const user = state.user;
            if (user) {
                const isAdmin = user.role === 'admin';
                const color = isAdmin ? '#ef4444' : 'var(--p)';
                btn.innerHTML = `<i data-lucide="${isAdmin ? 'shield-check' : 'user'}" size="20" style="color:${color}"></i>`;
                btn.style.background = isAdmin ? 'rgba(239,68,68,0.15)' : 'var(--p-s)';
                btn.style.borderColor = color;
                btn.style.width = '42px';
            } else {
                btn.innerHTML = '<i data-lucide="user" size="18" style="margin-left:8px;"></i> <span style="font-size:0.85rem; font-weight:800;">دخول</span>';
                btn.style.background = 'var(--p-s)';
                btn.style.borderColor = 'var(--bord)';
                btn.style.width = '100px';
                btn.style.borderRadius = '50px';
            }
            if (window.lucide) lucide.createIcons();
        });
    },

    _toast(msg) {
        if (typeof ux !== 'undefined' && ux.toast) { ux.toast(msg); return; }
        const t = document.getElementById('toast');
        if (!t) return;
        const msgEl = document.getElementById('toast-msg');
        if (msgEl) msgEl.textContent = msg;
        t.classList.add('active');
        setTimeout(() => t.classList.remove('active'), 3000);
    },

    async restoreSession() {
        const { data } = await sb.auth.getUser();
        if (data?.user) {
            userAuth._handleSession(data.user);
        }
    },
    getUser() { return state.user; },
    isAdmin() { return state.user?.role === 'admin'; }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to be ready in app.js
    setTimeout(async () => {
        if (typeof sb !== 'undefined' && sb) {
            await userAuth.restoreSession();
        }
    }, 500);
});
