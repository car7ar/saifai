// ─── High-Reliability Persistence (IndexedDB) ───
const DB_NAME = 'PromptFlowDB';
const STORE_NAME = 'vault';

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = e => resolve(e.target.result);
        request.onerror = e => reject(e.target.error);
    });
}

async function dbSave(key, val) {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(JSON.parse(JSON.stringify(val)), key);
}

async function dbLoad(key) {
    const db = await initDB();
    return new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

// ─── Supabase Config (Placeholder) ───
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';
let sb = null;
try { if(typeof supabase !== 'undefined') sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch(e) { console.warn('Supabase not connected'); }

const _state = {
    items: [],
    cats: [],
    pages: [], 
    favs: [], // Restored missing property
    user: null, 
    filter: 'all',
    search: '',
    sort: 'new',
    editingId: null,
    tempImg: '',
    itemsToShow: 12 // Number of items to display initially
};

const state = new Proxy(_state, {
    set(target, prop, value) {
        target[prop] = value;
        render();
        if (['items', 'cats', 'favs', 'user', 'pages'].includes(prop)) {
            dbSave(prop, value);
        }
        return true;
    }
});

// ─── Initialization ───
async function init() {
    const savedItems = await dbLoad('items');
    const savedCats = await dbLoad('cats');
    const savedPages = await dbLoad('pages');
    const savedUser = await dbLoad('user');
    const savedFavs = await dbLoad('favs');

    if (savedItems && savedItems.length > 0) state.items = savedItems;
    else {
        state.items = [
            { id: 1, name: 'مملكة الكريستال الطافية', img: 'https://images.unsplash.com/photo-1675271591211-126ad94e495d?auto=format&fit=crop&q=80&w=800', prompt: 'Giant floating crystal kingdom in the clouds, mystical energy, 8k render, unreal engine 5 style, hyper detailed animation.', categories: ['خيال علمي', '3D Art'], date: Date.now() - 1000 },
            { id: 2, name: 'حارس الغابة المفقودة', img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800', prompt: 'Abstract forest spirit character, bioluminescent plants, glowing eyes, masterpiece, concept art by Greg Rutkowski.', categories: ['طبيعة'], date: Date.now() }
        ];
    }

    if (savedCats) state.cats = savedCats;
    else state.cats = ["خيال علمي", "طبيعة", "أنيمي", "معماري", "3D Art"];

    if (savedFavs) state.favs = savedFavs;
    if (savedPages) state.pages = savedPages;
    if (savedUser) state.user = savedUser;

    if (localStorage.getItem('pf_u_theme') === 'dark') document.body.classList.add('dark');
    render();
}

// ─── Actions ───
const actions = {
    setFilter: (f) => {
        location.hash = '#cat/' + encodeURIComponent(f);
    },
    viewCats: () => {
        location.hash = '#cats';
    },
    filterFavs: () => {
        location.hash = '#favs';
    },
    home: () => {
        location.hash = '#home';
    },
    viewAdmin: () => {
        location.href = 'admin.html';
    },
    viewProfile: () => {
        location.hash = '#profile';
    },
    viewPage: (id) => {
        location.hash = '#page/' + id;
    },
    search: (q) => { state.search = q; ux.render(); },
    sort: (s) => { state.sort = s; ux.render(); },

    toggleFav: (id) => {
        let f = [...state.favs];
        if (f.includes(id)) f = f.filter(i => i !== id);
        else f.push(id);
        state.favs = f;
    },

    login: () => { state.logged = true; ux.closeM(); ux.toast('تم فتح صلاحيات المسار الكامل!'); },
    logout: () => { state.logged = false; ux.toast('تم إغلاق صلاحيات المشرف'); },

    prepareAdd: () => {
        state.editingId = null;
        state.tempImg = '';
        ux.val('m-title', 'إضافة قطعة فنية للمتحف');
        ux.val('save-btn', 'حفظ القطعة للأبد');
        ux.valI('p-name', ''); ux.valI('p-img', ''); ux.valI('p-prompt', '');
        ux.renderModalCats([]);
        ux.updateLiveP();
        ux.openM('product-modal');
    },

    edit: (id) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        state.editingId = id;
        state.tempImg = item.img;
        ux.val('m-title', 'تعديل بيانات العمل');
        ux.val('save-btn', 'تحديث البيانات الآن');
        ux.valI('p-name', item.name); ux.valI('p-img', item.img); ux.valI('p-prompt', item.prompt);
        ux.renderModalCats(item.categories);
        ux.updateLiveP();
        ux.openM('product-modal');
    },

    save: () => {
        const name = ux.get('p-name'), img = state.tempImg || ux.get('p-img'), prompt = ux.get('p-prompt');
        const cats = [...document.querySelectorAll('#m-cats .chip.active')].map(c => c.textContent);
        if (!name || !img || !prompt || cats.length === 0) return ux.toast('أكمل جميع البيانات رجاءً', 'err');

        let list = [...state.items];
        if (state.editingId) {
            list = list.map(i => i.id === state.editingId ? { ...i, name, img, prompt, categories: cats } : i);
        } else {
            list.push({ id: Date.now(), name, img, prompt, categories: cats, date: Date.now() });
        }
        state.items = list;
        ux.closeM();
        ux.toast('تمت مزامنة البيانات بنجاح');
    },

    delete: (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه التحفة الفنية؟')) return;
        state.items = state.items.filter(i => i.id !== id);
        ux.toast('تم مسح البيانات من الذاكرة');
    },

    addCat: () => {
        const n = ux.get('new-cat');
        if (!n || state.cats.includes(n)) return;
        state.cats = [...state.cats, n];
        ux.val('new-cat', '');
        ux.renderMCats(); // Refresh list in modal
        ux.toast(`تم إنشاء ممر فني جديد: ${n}`);
    },

    delCat: (c) => {
        if (!confirm(`حذف قسم ${c}؟ سيتم إزالة هذا التصنيف من كافة الأعمال.`)) return;
        state.cats = state.cats.filter(i => i !== c);
        // Clean up items that had this category
        state.items = state.items.map(item => ({
            ...item,
            categories: item.categories.filter(cat => cat !== c)
        }));
        if (state.filter === c) state.filter = 'all';
        ux.renderMCats();
    },

    addPage: () => {
        const title = ux.get('new-page-title'), content = ux.get('new-page-content');
        if (!title || !content) return ux.toast('يرجى كتابة العنوان والمحتوى', 'err');
        const newPage = { id: Date.now().toString(), title, content };
        state.pages = [...state.pages, newPage];
        ux.val('new-page-title', ''); ux.val('new-page-content', '');
        ux.renderMPages();
        ux.toast('تم نشر الصفحة الجديدة بنجاح');
    },

    delPage: (id) => {
        if (!confirm('هل أنت متأكد من حذف هذه الصفحة نهائياً؟')) return;
        state.pages = state.pages.filter(p => p.id !== id);
        if (state.filter === 'page_'+id) state.filter = 'all';
        ux.renderMPages();
    },

    export: () => {
        const data = JSON.stringify({ items: state.items, cats: state.cats, favs: state.favs });
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `PromptFlow_Vault_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    },

    import: (input) => {
        const f = input.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = e => {
            const d = JSON.parse(e.target.result);
            if (d.items) {
                state.items = d.items; state.cats = d.cats; state.favs = d.favs || [];
                ux.toast('تمت استعادة البيانات بنجاح!');
            }
        };
        reader.readAsText(f);
    },

    copyFromPrev: () => {
        const txt = document.getElementById('prev-desc').innerText;
        ux.copy(encodeURIComponent(txt), document.getElementById('copy-p-btn'));
    },
    loadMore: () => {
        state.itemsToShow += 12;
    }
};

// ─── Rendering ───
function render() {
    // Toggle Hero Visibility: Show only on Home (all)
    const hero = document.getElementById('hero-section');
    if(hero) hero.style.display = state.filter === 'all' ? 'block' : 'none';

    // Toggle Filters Visibility
    const filters = document.querySelector('.filters');
    if(filters) filters.style.display = (state.filter === 'profile' || state.filter === 'admin_dash') ? 'none' : 'flex';

    renderSidebar();
    ux.render(); 
    // Show/Hide Admin FAB
    const fab = document.getElementById('fab');
    const mAdd = document.getElementById('m-add-btn');
    const isAdmin = state.user?.role === 'admin';
    if(fab) fab.style.display = isAdmin ? 'flex' : 'none';
    if(mAdd) mAdd.style.display = isAdmin ? 'flex' : 'none';
    updateThemeUI();
    if(window.lucide) lucide.createIcons();
}

function renderSidebar() {
    // 1. Reset all active states first
    const allNavItems = document.querySelectorAll('.sidebar-nav .nav-item');
    allNavItems.forEach(el => el.classList.remove('active'));
    
    // 2. Set active for static items
    if (state.filter === 'all') document.getElementById('nav-home')?.classList.add('active');
    if (state.filter === 'cats_page') document.getElementById('nav-cats')?.classList.add('active');
    if (state.filter === 'favs') document.getElementById('nav-favs')?.classList.add('active');
    if (state.filter === 'profile') document.getElementById('nav-profile')?.classList.add('active');

    // 3. Render Side Categories
    const box = document.getElementById('side-cats');
    if(box) {
        box.innerHTML = state.cats.map(c => `
            <div class="nav-item ${state.filter === c ? 'active' : ''}" onclick="actions.setFilter('${c}')">
                <i data-lucide="hash"></i> <span>${c}</span>
            </div>
        `).join('');
    }

    // 4. Render Dynamic Pages (Sidebar)
    const pBox = document.getElementById('dynamic-pages');
    if(pBox) {
        if (state.pages.length > 0) {
            pBox.innerHTML = `<div class="nav-head">صفحات الموقع</div>` + state.pages.map(p => `
                <div class="nav-item ${state.filter === 'page_'+p.id ? 'active' : ''}" onclick="actions.viewPage('${p.id}')">
                    <i data-lucide="file-text"></i> <span>${p.title}</span>
                </div>
            `).join('');
        } else {
            pBox.innerHTML = '';
        }
        
        // 5. Render Admin Actions (Inside the same pBox for alignment)
        const isAdmin = state.user?.role === 'admin';
        if (isAdmin) {
            pBox.innerHTML += `
                <div class="nav-head" style="margin-top:2rem;">الإدارة</div>
                <div class="nav-item" style="color:var(--p); font-weight:800;" onclick="actions.viewAdmin()">
                    <i data-lucide="layout-dashboard"></i> <span>لوحة التحكم</span>
                </div>
                <div class="nav-item" style="color:#ef4444;" onclick="userAuth.logout()">
                    <i data-lucide="power"></i> <span>تسجيل الخروج</span>
                </div>
            `;
        }
    }
}

function renderGrid() {
    const box = document.getElementById('main-grid');
    if(!box) return;
    let list = [...state.items];

    if (state.filter === 'favs') list = list.filter(i => state.favs.includes(i.id));
    else if (state.filter !== 'all' && state.filter !== 'cats_page') list = list.filter(i => i.categories.includes(state.filter));

    if (state.search) {
        const q = state.search.toLowerCase();
        list = list.filter(i => i.name.toLowerCase().includes(q) || i.prompt.toLowerCase().includes(q));
    }

    if (state.sort === 'new') list.sort((a, b) => b.date - a.date);
    else if (state.sort === 'old') list.sort((a, b) => a.date - b.date);
    else if (state.sort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));

    document.getElementById('view-title').textContent = state.filter === 'all' ? 'المعرض الرائد' : (state.filter === 'favs' ? 'المفضلات الخاصة' : `قسم ${state.filter}`);

    if (list.length === 0) {
        box.innerHTML = `<div class="empty"><i data-lucide="gem" size="64"></i><h3>المكان شاغر حالياً</h3><p>لا توجد تحف فنية في هذا المسار</p></div>`;
        if(window.lucide) lucide.createIcons(); return;
    }

    const log = state.logged;
    const totalAvailable = list.length;
    list = list.slice(0, state.itemsToShow);

    box.innerHTML = list.map(item => ux.cardHTML(item)).join('');

    // Load More Button
    if (totalAvailable > state.itemsToShow) {
        const btnBox = document.createElement('div');
        btnBox.style = "grid-column: 1/-1; display:flex; justify-content:center; padding: 2rem 0;";
        btnBox.innerHTML = `
            <button class="btn-copy" onclick="actions.loadMore()" style="height:55px; padding:0 3rem; font-size:0.9rem; border-radius:16px;">
                <i data-lucide="refresh-cw"></i> عرض المزيد من الأعمال
            </button>
        `;
        box.appendChild(btnBox);
    }

    if(window.lucide) lucide.createIcons();
}

function renderAuth() {
    const log = state.logged;
    // Redundant user-p removed. UI is handled by userAuth._updateAvatar() in auth.js

    
    const authBox = document.getElementById('auth-panel');
    if(authBox) {
        authBox.innerHTML = log
            ? `<div class="nav-item" style="color:var(--p); font-weight:800;" onclick="actions.viewAdmin()"><i data-lucide="layout-dashboard"></i><span>لوحة التحكم</span></div>
               <div class="nav-item" style="color:#f43f5e" onclick="actions.logout()"><i data-lucide="power"></i><span>خروج</span></div>`
            : `<div class="nav-item" onclick="ux.openM('login-modal')"><i data-lucide="shield-check"></i><span>دخول المشرف</span></div>`;
    }

    const adminM = document.getElementById('admin-menu');
    if(adminM) adminM.style.display = log ? 'block' : 'none';

    const mAdd = document.getElementById('m-add-btn');
    if(mAdd) mAdd.style.display = log ? 'flex' : 'none';
}

// ─── UX Utils ───
const ux = {
    openM: (id) => { 
        const el = document.getElementById(id);
        if(el) {
            el.classList.add('show');
            // Refresh lists if modal is a manage modal
            if(id === 'cat-modal') ux.renderMCats();
            if(id === 'page-modal') ux.renderMPages();
        }
        else console.warn(`Modal with ID "${id}" not found.`);
    },
    closeM: () => { document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); },
    bgClose: (e, id) => { if (e.target.id === id) ux.closeM(); },
    toast: (m, type = 'ok') => {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = m;
        t.className = 'active';
        setTimeout(() => t.className = '', 3000);
    },
    copy: (txt, btn) => {
        navigator.clipboard.writeText(decodeURIComponent(txt)).then(() => {
            const old = btn.innerHTML;
            btn.innerHTML = '<i data-lucide="check"></i> تم النسخ';
            btn.style.background = '#10b981';
            setTimeout(() => { btn.innerHTML = old; btn.style.background = ''; if(window.lucide) lucide.createIcons(); }, 2000);
        });
    },
    view: (id) => {
        const item = state.items.find(i => i.id === id);
        if (!item) return;
        ux.val('prev-name', item.name);
        document.getElementById('prev-img').src = item.img;
        document.getElementById('prev-tags').innerHTML = item.categories.map(c => `<span class="tag">${c}</span>`).join('');
        document.getElementById('prev-desc').innerText = item.prompt;

        const copyBtn = document.getElementById('copy-p-btn');
        copyBtn.onclick = () => ux.copy(encodeURIComponent(item.prompt), copyBtn);

        const log = state.logged;
        const eBtn = document.getElementById('admin-edit-p'), dBtn = document.getElementById('admin-del-p');
        eBtn.style.display = dBtn.style.display = log ? 'flex' : 'none';
        eBtn.onclick = () => { ux.closeM(); setTimeout(() => actions.edit(id), 200); };
        dBtn.onclick = () => { ux.closeM(); setTimeout(() => actions.delete(id), 200); };

        ux.openM('preview-modal');

        const expandBtn = document.getElementById('btn-expand-full');
        if (expandBtn) expandBtn.onclick = (e) => ux.fullP(e);
    },
    renderModalCats: (selected) => {
        const box = document.getElementById('m-cats');
        box.innerHTML = state.cats.map(c => `<div class="chip ${selected.includes(c) ? 'active' : ''}" onclick="this.classList.toggle('active'); ux.updateLiveP();">${c}</div>`).join('');
    },
    cardHTML: (item) => {
        const isFav = state.favs.includes(item.id);
        const isAdmin = state.user?.role === 'admin';
        return `
            <div class="card" onclick="ux.view(${item.id})">
                <div class="card-tags">${item.categories.map(c => `<span class="tag">${c}</span>`).join('')}</div>
                <div class="card-img">
                    <img src="${item.img}" alt="${item.name}" loading="lazy">
                    <button class="fav-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); actions.toggleFav(${item.id})">
                        <i data-lucide="heart" size="14" fill="${isFav ? '#fff' : 'none'}"></i>
                    </button>
                </div>
                <div class="card-body">
                    <h3 class="card-name">${item.name}</h3>
                    <div class="card-foot">
                        <button class="btn-copy" onclick="event.stopPropagation(); ux.copy('${encodeURIComponent(item.prompt)}', this)">
                            <i data-lucide="copy" size="12"></i> نسخ البرومبت
                        </button>
                    </div>
                </div>
                ${isAdmin ? `
                    <div class="admin-box">
                        <div class="btn-circle" onclick="event.stopPropagation(); actions.edit(${item.id})"><i data-lucide="edit-3" size="12"></i></div>
                        <div class="btn-circle del" onclick="event.stopPropagation(); actions.delete(${item.id})"><i data-lucide="trash-2" size="12"></i></div>
                    </div>
                ` : ''}
            </div>
        `;
    },
    updateLiveP: () => {
        const box = document.getElementById('live-preview-box');
        const name = ux.get('p-name') || 'عنوان العمل يظهر هنا';
        const img = state.tempImg || ux.get('p-img') || 'https://via.placeholder.com/400x400/111/fff?text=No+Image';
        const prompt = ux.get('p-prompt') || 'البرومبت الهندسي سيظهر في هذا المكان...';
        const cats = [...document.querySelectorAll('#m-cats .chip.active')].map(c => c.textContent);

        if(box) {
            box.innerHTML = `
                <div class="card" style="width:100%; pointer-events:none;">
                    <div class="card-tags">${cats.map(c => `<span class="tag">${c}</span>`).join('')}</div>
                    <div class="card-img" style="aspect-ratio: 1/1">
                        <img src="${img}" alt="preview">
                    </div>
                    <div class="card-body">
                        <h3 class="card-name">${name}</h3>
                        <p class="card-prompt">${prompt}</p>
                    </div>
                </div>
            `;
        }
    },
    handleFile: (input) => {
        const f = input.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = e => {
            state.tempImg = e.target.result;
            ux.updateLiveP();
        };
        r.readAsDataURL(f);
    },
    renderMCats: () => {
        const box = document.getElementById('modal-cat-list');
        if(!box) return;
        box.innerHTML = state.cats.map(c => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:10px 15px; border-radius:12px; border:1px solid var(--bord);">
                <span style="font-weight:700;">${c}</span>
                <button onclick="actions.delCat('${c}')" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" size="16"></i></button>
            </div>
        `).join('');
        if(window.lucide) lucide.createIcons();
    },
    renderMPages: () => {
        const box = document.getElementById('modal-page-list');
        if(!box) return;
        box.innerHTML = state.pages.length === 0 ? `<p style="text-align:center; opacity:0.5; padding:20px;">لا يوجد صفحات مخصصة حالياً</p>` : state.pages.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surf); padding:15px; border-radius:14px; border:1px solid var(--bord);">
                <div>
                   <div style="font-weight:900;">${p.title}</div>
                   <div style="font-size:0.7rem; opacity:0.5;">ID: ${p.id}</div>
                </div>
                <button onclick="actions.delPage('${p.id}')" style="background:#ef444415; border:none; color:#ef4444; width:35px; height:35px; border-radius:8px; cursor:pointer;"><i data-lucide="trash-2" size="16"></i></button>
            </div>
        `).join('');
        if(window.lucide) lucide.createIcons();
    },
    login: async () => {
        // Delegate to the unified auth system
        await userAuth.login();
        // Sync admin state after login
        if (userAuth.isAdmin()) {
            state.logged = true;
        }
    },
    logout: async () => {
        await userAuth.logout();
        state.logged = false;
    },
    toggleTheme: () => {
        const d = document.body.classList.toggle('dark');
        localStorage.setItem('pf_u_theme', d ? 'dark' : 'light');
        updateThemeUI();
    },
    get: (id) => document.getElementById(id).value.trim(),
    openSearch: () => {
        const q = prompt('ابحث عن البرومبت...');
        if(q !== null) actions.search(q);
    },
    val: (id, v) => {
        const el = document.getElementById(id);
        if(el) el.textContent = v;
    },
    valI: (id, v) => {
        const el = document.getElementById(id);
        if(el) el.value = v;
    },
    render: () => {
        const grid = document.getElementById('main-grid');
        if(!grid) return;
        grid.innerHTML = '';

        // Admin Dashboard Page View (Premium Redesign)
        if (state.filter === 'admin_dash' && state.logged) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; width:100%; animation: focusIn .5s cubic-bezier(0.16, 1, 0.3, 1);">
                    
                    <!-- Welcome Header -->
                    <div style="margin-bottom: 2.5rem;">
                        <h2 style="font-size: 2rem; font-weight: 900; margin-bottom: 0.5rem;">مرحباً بك، أيها المبدع 👋</h2>
                        <p style="opacity: 0.5; font-size: 0.95rem;">إليك نظرة سريعة على أداء منصة Saif AI اليوم.</p>
                    </div>

                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.5rem; margin-bottom: 2.5rem;">
                        <!-- Stats Section -->
                        <div class="card" style="padding:2rem; border-color:var(--p); background: linear-gradient(135deg, var(--p-s), transparent); position: relative; overflow: hidden;">
                            <div style="position: absolute; right: -20px; bottom: -20px; opacity: 0.05; transform: rotate(-15deg);"><i data-lucide="database" size="120"></i></div>
                            <div style="font-size:0.75rem; font-weight:900; color:var(--p); text-transform:uppercase; letter-spacing: 1px;">قاعدة البيانات</div>
                            <div style="font-size:3.5rem; font-weight:900; margin:1rem 0; line-height: 1;">${state.items.length}</div>
                            <p style="font-size:0.9rem; opacity:0.6;">إجمالي الأعمال الفنية المرفوعة</p>
                        </div>

                        <div class="card" style="padding:2rem;">
                            <div style="font-size:0.75rem; font-weight:900; color:var(--muted); text-transform:uppercase; letter-spacing: 1px;">التنظيم الفني</div>
                            <div style="font-size:2.5rem; font-weight:900; margin:1rem 0; line-height: 1;">${state.cats.length}</div>
                            <p style="font-size:0.9rem; opacity:0.6;">تصنيفات نشطة ومفعلة حالياً</p>
                            <div style="margin-top: 1.5rem; display:flex; gap:8px;">
                                <button class="btn-copy" onclick="ux.openM('cat-modal')" style="flex:1;">+ قسم جديد</button>
                            </div>
                        </div>

                        <div class="card" style="padding:2rem;">
                            <div style="font-size:0.75rem; font-weight:900; color:var(--muted); text-transform:uppercase; letter-spacing: 1px;">تفاعل النظام</div>
                            <div style="font-size:2.5rem; font-weight:900; margin:1rem 0; line-height: 1;">${state.favs.length}</div>
                            <p style="font-size:0.9rem; opacity:0.6;">إجمالي الإعجابات والمفضلات</p>
                            <div style="margin-top: 1.5rem; height: 4px; background: var(--bord); border-radius: 10px;">
                                <div style="width: 75%; height: 100%; background: var(--p); border-radius: 10px;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Actions Hub -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                        <div class="card" style="padding:2rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                                <h3 style="font-weight:900;">إدارة المحتوى السريع</h3>
                                <i data-lucide="zap" class="text-p" style="color:var(--p)"></i>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:10px;">
                                <button class="btn-copy" onclick="actions.prepareAdd()" style="height:55px; font-size:0.9rem; justify-content:center;">
                                    <i data-lucide="plus-circle" style="margin-left:8px;"></i> إضافة تحفة فنية جديدة
                                </button>
                                <button class="btn-icon" onclick="actions.viewCats()" style="height:55px; width:100%; justify-content:center; gap:10px; font-weight:700;">
                                    <i data-lucide="layout-grid"></i> استعراض الأقسام
                                </button>
                            </div>
                        </div>

                        <div class="card" style="padding:2rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                                <h3 style="font-weight:900;">البيانات والحماية</h3>
                                <i data-lucide="shield-check" style="color:#10b981"></i>
                            </div>
                            <p style="font-size:0.85rem; opacity:0.6; margin-bottom:1.5rem;">تأكد من أخذ نسخة احتياطية بشكل دوري لضمان سلامة بياناتك.</p>
                            <div style="display:flex; gap:10px;">
                                <button class="btn-icon" onclick="actions.export()" style="flex:1; height:50px; gap:8px; font-weight:700;">
                                    <i data-lucide="download"></i> تصدير (JSON)
                                </button>
                                <button class="btn-icon" onclick="document.getElementById('import-trigger').click()" style="flex:1; height:50px; gap:8px; font-weight:700;">
                                    <i data-lucide="upload"></i> استيراد نسخة
                                </button>
                            </div>
                            <input type="file" id="import-trigger" hidden onchange="actions.import(this)">
                        </div>
                    </div>

                </div>
            `;
            if(window.lucide) lucide.createIcons();
            return;
        }

        if (state.filter === 'cats_page') {
            document.getElementById('view-title').textContent = 'استكشف عوالمنا الفنية';
            grid.innerHTML = `
                <div style="grid-column: 1/-1; display:flex; flex-direction:column; gap:4rem; animation: focusIn .5s ease;">
                    ${state.cats.map(c => {
                        const catItems = state.items.filter(i => i.categories.includes(c)).slice(0, 4);
                        return `
                            <section>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; padding:0 10px; border-right:4px solid var(--p); padding-right:15px;">
                                    <div>
                                        <h2 style="font-size:1.4rem; font-weight:900;">${c}</h2>
                                        <p style="font-size:0.8rem; opacity:0.5;">أفضل البرومبتات في قسم ${c}</p>
                                    </div>
                                    <button class="btn-copy" onclick="actions.setFilter('${c}')" style="background:var(--p-s); color:var(--p); border:none; padding:8px 15px; border-radius:10px; font-weight:800; cursor:pointer;">
                                        رؤية الكل (${state.items.filter(i => i.categories.includes(c)).length})
                                    </button>
                                </div>
                                <div class="grid">
                                    ${catItems.length === 0 ? `
                                        <p style="opacity:0.3; padding:20px;">لا توجد أعمال حالياً</p>
                                    ` : catItems.map(item => ux.cardHTML(item)).join('')}
                                </div>
                            </section>
                        `;
                    }).join('')}
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Profile Page View
        if (state.filter === 'profile') {
            const user = userAuth.getUser();
            if (!user) { actions.home(); return; }
            
            document.getElementById('view-title').innerHTML = ''; 
            const joined = new Date(user.joinedAt).toLocaleDateString('ar', { year:'numeric', month:'short' });
            const favItems = state.items.filter(i => state.favs.includes(i.id));

            grid.innerHTML = `
                <div class="profile-page" style="grid-column: 1/-1; animation: focusIn .5s ease; gap:20px;">
                    
                    <div class="profile-header" style="text-align:center;">
                        <div class="profile-cover"></div>
                        <div class="profile-avatar-wrap">
                            <div class="profile-avatar" style="background:var(--p); color:white;">
                                <i data-lucide="${user.role === 'admin' ? 'shield-check' : 'user'}" size="40"></i>
                            </div>
                            <div class="profile-info">
                                <h2 style="font-size:1.4rem;">${user.name}</h2>
                                <p>${user.email}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div style="max-width:600px; margin: 30px auto 0; width:100%;">
                        <!-- Quick Actions/Stats Bar -->
                        <div style="background:var(--surf); border:1px solid var(--bord); border-radius:20px; padding:15px; display:flex; align-items:center; justify-content:space-between; margin-bottom:30px;">
                            <div style="display:flex; gap:20px;">
                                <div style="text-align:center;">
                                    <div style="font-weight:900; font-size:1.1rem; color:var(--p);">${state.favs.length}</div>
                                    <div style="font-size:0.6rem; opacity:0.5; font-weight:700;">مفضلة</div>
                                </div>
                                <div style="width:1px; background:var(--bord); height:30px;"></div>
                                <div style="text-align:center;">
                                    <div style="font-weight:900; font-size:0.8rem; height:1.1rem; display:flex; align-items:center;">${joined}</div>
                                    <div style="font-size:0.6rem; opacity:0.5; font-weight:700;">منذ</div>
                                </div>
                            </div>
                            <button onclick="userAuth.logout()" style="background:#ef444415; color:#ef4444; border:none; padding:8px 15px; border-radius:10px; font-size:0.75rem; font-weight:800; cursor:pointer;">
                                تسجيل الخروج
                            </button>
                        </div>

                        <!-- Gallery -->
                        <div style="margin-bottom:1.5rem; display:flex; align-items:center; gap:10px;">
                            <h3 style="font-size:1rem; font-weight:900;">مكتبة المفضلات</h3>
                            <div style="flex:1; height:1px; background:var(--bord);"></div>
                        </div>
                        
                        <div id="profile-favs-grid" class="grid">
                            ${favItems.length === 0 ? `
                                <div style="grid-column: 1/-1; padding:3rem; text-align:center; opacity:0.3; background:var(--bg); border-radius:20px;">
                                    <p style="font-size:0.8rem; font-weight:700;">المكتبة فارغة</p>
                                </div>
                            ` : favItems.map(item => ux.cardHTML(item)).join('')}
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        // Static Page View
        if (state.filter.startsWith('page_')) {
            const pid = state.filter.replace('page_', '');
            const page = state.pages.find(p => p.id === pid);
            if (page) {
                document.getElementById('view-title').textContent = page.title;
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; background:var(--surf); padding:3rem; border-radius:24px; border:1px solid var(--bord); line-height:1.8; animation: focusIn .5s ease;">
                        <h2 style="margin-bottom:2rem; font-size:2rem; font-weight:900;">${page.title}</h2>
                        <div style="font-size:1.1rem; opacity:0.8;">${page.content}</div>
                    </div>
                `;
                return;
            }
        }

        renderGrid();
    },
    openMenu: () => {
        const cBox = document.getElementById('m-cat-list');
        const pBox = document.getElementById('m-page-list');
        const pCont = document.getElementById('m-page-list-container');

        if(cBox) {
            cBox.innerHTML = `
                <div class="nav-item ${state.filter === 'all' ? 'active' : ''}" onclick="actions.home(); ux.closeM();">
                    <i data-lucide="layout-grid"></i> <span>المعرض العام</span>
                </div>
            ` + state.cats.map(c => `
                <div class="nav-item ${state.filter === c ? 'active' : ''}" onclick="actions.setFilter('${c}'); ux.closeM();">
                    <i data-lucide="hash"></i> <span>${c}</span>
                </div>
            `).join('');
        }

        if(pBox) {
            if(state.pages.length > 0) {
                pCont.style.display = 'block';
                pBox.innerHTML = state.pages.map(p => `
                    <div class="nav-item ${state.filter === 'page_'+p.id ? 'active' : ''}" onclick="actions.viewPage('${p.id}'); ux.closeM();">
                        <i data-lucide="file-text"></i> <span>${p.title}</span>
                    </div>
                `).join('');
            } else {
                pCont.style.display = 'none';
            }
        }

        ux.openM('mobile-menu');
        if(window.lucide) lucide.createIcons();
    },
    fullP: (e) => {
        if(e) { e.preventDefault(); e.stopPropagation(); }
        const el = document.getElementById('prev-desc');
        if(!el) return;
        const txt = el.innerText;
        const ov = document.getElementById('full-p-overlay');
        if (!ov) return;
        
        document.getElementById('full-p-box').innerText = txt;
        ov.style.cssText = "display:flex !important; visibility:visible !important; opacity:1 !important; background:rgba(0,0,0,0.98) !important; position:fixed !important; inset:0 !important; z-index:10000 !important;";
        
        if(window.lucide) setTimeout(() => lucide.createIcons(), 50);
    },
    closeFullP: (e) => {
        if(e) e.stopPropagation();
        const ov = document.getElementById('full-p-overlay');
        if (ov) ov.style.display = 'none';
    }
};
window.ux = ux;

function updateThemeUI() {
    const d = document.body.classList.contains('dark');
    const btn = document.getElementById('theme-btn');
    if(btn) btn.innerHTML = d ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
    if(window.lucide) lucide.createIcons();
}

// ─── Router Implementation ───
function router() {
    const hash = location.hash || '#home';
    ux.closeM(); // Close any open modals when navigating

    if (hash === '#home') {
        state.filter = 'all';
    } else if (hash === '#cats') {
        state.filter = 'cats_page';
    } else if (hash === '#favs') {
        state.filter = 'favs';
    } else if (hash === '#profile') {
        if (!userAuth.getUser()) { 
            location.hash = '#home';
            ux.openM('login-modal');
        } else {
            state.filter = 'profile';
        }
    } else if (hash.startsWith('#cat/')) {
        state.filter = decodeURIComponent(hash.split('/')[1]);
    } else if (hash.startsWith('#page/')) {
        state.filter = 'page_' + hash.split('/')[1];
    }

    render();
}

window.addEventListener('hashchange', router);

// ─── Launch ───
window.onload = () => {
    init();
    router();
};
