// ─── ADMIN CENTER LOGIC ───

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

const state = {
    items: [],
    cats: [],
    pages: [],
    favs: [],
    editingId: null,
    editingPageId: null
};

// Auto-Render on change
const proxy = new Proxy(state, {
    set(target, prop, value) {
        target[prop] = value;
        render();
        if (['items', 'cats', 'pages'].includes(prop)) dbSave(prop, value);
        return true;
    }
});

async function init() {
    applyTheme(); // Load saved theme
    // Check Auth
    const logged = await dbLoad('logged');
    if (!logged) {
        alert('غير مسموح بالدخول! يرجى تسجيل الدخول أولاً.');
        location.href = 'index.html';
        return;
    }

    state.items = await dbLoad('items') || [];
    state.cats = await dbLoad('cats') || [];
    state.pages = await dbLoad('pages') || [];
    state.favs = await dbLoad('favs') || [];
    
    // Router logic
    window.addEventListener('hashchange', router);
    router(); // First load
}

function render() {
    renderStats();
    renderActivity();
    renderItems();
    renderCats();
    renderPages();
    lucide.createIcons();
}

function renderStats() {
    const box = document.getElementById('stats-box');
    box.innerHTML = `
        <div class="card stat-card" style="border-right:4px solid var(--p); background:linear-gradient(to left, var(--p-s), transparent);">
            <i data-lucide="database" size="100"></i>
            <div style="font-size:0.75rem; font-weight:900; color:var(--p); text-transform:uppercase; letter-spacing:1px;">إجمالي البرومبتات</div>
            <div style="font-size:3.5rem; font-weight:900; margin:0.5rem 0;">${state.items.length}</div>
            <div style="font-size:0.8rem; opacity:0.5;">+${Math.min(state.items.length, 5)} هذا الأسبوع</div>
        </div>
        <div class="card stat-card">
            <i data-lucide="layers" size="100"></i>
            <div style="font-size:0.75rem; font-weight:900; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">الأقسام النشطة</div>
            <div style="font-size:3.5rem; font-weight:900; margin:0.5rem 0;">${state.cats.length}</div>
            <div style="font-size:0.8rem; opacity:0.5;">منظمة بدقة</div>
        </div>
        <div class="card stat-card">
            <i data-lucide="file-text" size="100"></i>
            <div style="font-size:0.75rem; font-weight:900; color:var(--muted); text-transform:uppercase; letter-spacing:1px;">الصفحات المنشورة</div>
            <div style="font-size:3.5rem; font-weight:900; margin:0.5rem 0;">${state.pages.length}</div>
            <div style="font-size:0.8rem; opacity:0.5;">متوافقة مع SEO</div>
        </div>
    `;
}

function renderActivity() {
    const box = document.getElementById('recent-activity');
    if(!box) return;
    const activities = [
        { icon: 'plus-circle', text: 'تمت إضافة قطعة فنية جديدة', time: 'منذ دقيقتين', color: 'var(--p)' },
        { icon: 'edit', text: 'تم تحديث صفحة "سياسة الخصوصية"', time: 'منذ ساعة', color: '#10b981' },
        { icon: 'layers', text: 'تم إنشاء قسم "خيال علمي"', time: 'منذ 3 ساعات', color: '#f59e0b' }
    ];
    box.innerHTML = activities.map(a => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px; border-radius:12px; background:var(--bg);">
            <div style="width:35px; height:35px; border-radius:8px; background:${a.color}20; color:${a.color}; display:flex; align-items:center; justify-content:center;"><i data-lucide="${a.icon}" size="16"></i></div>
            <div style="flex:1;">
                <div style="font-size:0.85rem; font-weight:700;">${a.text}</div>
                <div style="font-size:0.7rem; opacity:0.5;">${a.time}</div>
            </div>
        </div>
    `).join('');
}

function renderItems() {
    const box = document.getElementById('items-list');
    if (state.items.length === 0) {
        box.innerHTML = '<p style="text-align:center; padding:2rem; opacity:0.4;">لا توجد أعمال لعرضها</p>';
        return;
    }
    box.innerHTML = state.items.map(item => `
        <div style="display:flex; align-items:center; gap:12px; background:var(--bg); padding:10px; border-radius:12px; border:1px solid var(--bord);">
            <img src="${item.img}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
            <div style="flex:1;">
                <div style="font-weight:700; font-size:0.9rem;">${item.name}</div>
                <div style="font-size:0.7rem; opacity:0.5;">${item.categories.join(' · ')}</div>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-icon" onclick="actions.edit(${item.id})"><i data-lucide="edit-3" size="16"></i></button>
                <button class="btn-icon del" onclick="actions.delete(${item.id})"><i data-lucide="trash-2" size="16"></i></button>
            </div>
        </div>
    `).join('');
}

function renderCats() {
    const box = document.getElementById('cats-manage');
    if(!box) return;
    box.innerHTML = state.cats.map(c => `
        <div class="chip active" style="display:flex; align-items:center; gap:8px;">
            ${c}
            <i data-lucide="x" size="12" style="cursor:pointer;" onclick="actions.delCat('${c}')"></i>
        </div>
    `).join('');
}

function renderPages() {
    const box = document.getElementById('pages-list');
    if(!box) return;
    if (state.pages.length === 0) {
        box.innerHTML = '<p style="font-size:0.75rem; opacity:0.4;">لا توجد صفحات حالياً</p>';
        return;
    }
    box.innerHTML = state.pages.map(p => `
        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg); padding:12px; border-radius:10px; border:1px solid var(--bord);">
            <div style="font-weight:700; font-size:0.85rem;">${p.title}</div>
            <div style="display:flex; gap:5px;">
                <button class="btn-icon" style="width:30px; height:30px;" onclick="actions.editPage('${p.id}')"><i data-lucide="edit-2" size="14"></i></button>
                <button class="btn-icon del" style="width:30px; height:30px;" onclick="actions.delPage('${p.id}')"><i data-lucide="trash-2" size="14"></i></button>
            </div>
        </div>
    `).join('');
}

const actions = {
    prepareAdd: () => {
        location.hash = '#add';
    },
    edit: (id) => {
        location.hash = `#edit/${id}`;
    },
    // Internal methods used by router
    _openAdd: () => {
        state.editingId = null;
        ux.val('m-title', 'إضافة عمل جديد');
        ux.valI('p-name', ''); ux.valI('p-img', ''); ux.valI('p-prompt', '');
        ux.renderModalCats([]);
        actions.liveUpdate();
        ux.openM('product-modal');
    },
    _openEdit: (id) => {
        const item = state.items.find(i => i.id === parseInt(id));
        if(!item) return;
        state.editingId = parseInt(id);
        ux.val('m-title', 'تعديل بيانات العمل');
        ux.valI('p-name', item.name); ux.valI('p-img', item.img); ux.valI('p-prompt', item.prompt);
        ux.renderModalCats(item.categories);
        actions.liveUpdate();
        ux.openM('product-modal');
    },
    liveUpdate: () => {
        const name = ux.get('p-name') || 'عنوان اللوحة';
        const img = ux.get('p-img') || 'https://via.placeholder.com/400';
        const prompt = ux.get('p-prompt') || 'وصف البرومبت سيظهر هنا بشكل منسق واحترافي...';
        const mainCat = document.getElementById('p-cat-main').value || 'عام';
        
        // Update labels
        document.getElementById('live-name').textContent = name;
        document.getElementById('live-img').src = img;
        document.getElementById('live-prompt').textContent = prompt;
        document.getElementById('live-tags').innerHTML = `<span class="tag">${mainCat}</span>`;
        
        // Populate dropdown if not already
        const sel = document.getElementById('p-cat-main');
        if(sel.options.length <= 1) {
            state.cats.forEach(c => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = c;
                sel.appendChild(opt);
            });
        }
    },
    toggleMobilePreview: () => {
        const pane = document.getElementById('live-preview-pane');
        const isOpen = pane.classList.toggle('show-mobile');
        
        // Change icon based on state
        const btnIcon = document.querySelector('#mobile-preview-btn i');
        if (btnIcon) {
            btnIcon.setAttribute('data-lucide', isOpen ? 'eye-off' : 'eye');
            if(window.lucide) lucide.createIcons();
        }

        // Add a back button only for mobile preview
        if (isOpen && !document.getElementById('m-prev-back')) {
            const b = document.createElement('button');
            b.id = 'm-prev-back';
            b.className = 'btn-icon';
            b.style = 'position:fixed; top:20px; right:20px; z-index:10002;';
            b.innerHTML = '<i data-lucide="arrow-right"></i>';
            b.onclick = () => actions.toggleMobilePreview();
            pane.appendChild(b);
            if(window.lucide) lucide.createIcons();
        }
    },
    save: () => {
        const name = ux.get('p-name'), img = ux.get('p-img'), prompt = ux.get('p-prompt');
        const mainCat = document.getElementById('p-cat-main').value;
        const chips = [...document.querySelectorAll('#m-cats .chip.active')].map(c => c.textContent.trim());
        const cats = [...new Set([mainCat, ...chips])].filter(Boolean);

        if(!name || !img || !prompt) return ux.toast('أكمل البيانات', 'err');

        let list = [...state.items];
        if (state.editingId) {
            list = list.map(i => i.id === state.editingId ? { ...i, name, img, prompt, categories: cats } : i);
        } else {
            list.push({ id: Date.now(), name, img, prompt, categories: cats, date: Date.now() });
        }
        proxy.items = list;
        ux.closeM();
        ux.toast('تم الحفظ بنجاح');
        // Return to content view
        location.hash = '#content';
    },
    delete: (id) => {
        if(!confirm('حذف هذا العمل؟')) return;
        proxy.items = state.items.filter(i => i.id !== id);
        ux.toast('تم الحذف');
    },
    addCat: () => {
        const n = ux.get('new-cat');
        if(!n || state.cats.includes(n)) return;
        proxy.cats = [...state.cats, n];
        ux.valI('new-cat', '');
        ux.toast('تمت إضافة القسم');
    },
    delCat: (c) => {
        if(!confirm(`حذف قسم ${c}؟`)) return;
        proxy.cats = state.cats.filter(i => i !== c);
    },
    export: () => {
        const data = JSON.stringify({ items: state.items, cats: state.cats, favs: state.favs });
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `SaifAI_Backup.json`; a.click();
    },
    import: (input) => {
        const f = input.files[0]; if(!f) return;
        const reader = new FileReader();
        reader.onload = e => {
            const d = JSON.parse(e.target.result);
            if(d.items) {
                proxy.items = d.items; proxy.cats = d.cats;
                if(d.pages) proxy.pages = d.pages;
                ux.toast('تم استيراد البيانات!');
            }
        };
        reader.readAsText(f);
    },

    // Pages Actions
    preparePage: () => {
        location.hash = '#add-page';
    },
    editPage: (id) => {
        location.hash = `#edit-page/${id}`;
    },
    _openAddPage: () => {
        state.editingPageId = null;
        ux.val('page-m-title', 'إنشاء صفحة جديدة');
        ux.valI('page-title', ''); ux.valI('page-content', '');
        ux.valI('page-slug', ''); ux.valI('page-seo', '');
        ux.openM('page-modal');
    },
    _openEditPage: (id) => {
        const p = state.pages.find(i => i.id === id);
        if(!p) return;
        state.editingPageId = id;
        ux.val('page-m-title', 'تعديل الصفحة');
        ux.valI('page-title', p.title); ux.valI('page-content', p.content || '');
        ux.valI('page-slug', p.slug || ''); ux.valI('page-seo', p.seo || '');
        ux.openM('page-modal');
    },
    savePage: () => {
        const title = ux.get('page-title'), content = ux.get('page-content');
        const slug = ux.get('page-slug'), seo = ux.get('page-seo');
        if(!title || !content) return ux.toast('أكمل البيانات', 'err');
        
        let list = [...state.pages];
        if (state.editingPageId) {
            list = list.map(p => p.id === state.editingPageId ? { ...p, title, content, slug, seo } : p);
        } else {
            list.push({ id: 'p_' + Date.now(), title, content, slug, seo });
        }
        proxy.pages = list;
        ux.closeM();
        ux.toast('تم حفظ الصفحة');
        location.hash = '#cats';
    },
    delPage: (id) => {
        if(!confirm('حذف هذه الصفحة؟')) return;
        proxy.pages = state.pages.filter(p => p.id !== id);
        ux.toast('تم حذف الصفحة');
    }
};

const ux = {
    openM: (id) => document.getElementById(id).classList.add('show'),
    closeM: (nav = true) => { 
        document.querySelectorAll('.overlay').forEach(o => o.classList.remove('show')); 
        if (nav && (location.hash.includes('add') || location.hash.includes('edit'))) {
             history.back();
        }
    },
    toast: (m) => {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = m;
        t.classList.add('active');
        setTimeout(() => t.classList.remove('active'), 3000);
    },
    val: (id, v) => document.getElementById(id).textContent = v,
    valI: (id, v) => document.getElementById(id).value = v,
    get: (id) => document.getElementById(id).value.trim(),
    insertTag: (tag) => {
        const area = document.getElementById('page-content');
        const start = area.selectionStart;
        const end = area.selectionEnd;
        const text = area.value;
        const selected = text.substring(start, end) || 'نص هنا';
        
        let open = `<${tag}>`, close = `</${tag}>`;
        if (tag === 'img') { open = `<img src="رابط_الصورة" alt="" style="width:100%; border-radius:15px; margin:1rem 0;">`; close = ''; }
        if (tag === 'a') { open = `<a href="#" style="color:var(--p); font-weight:700;">`; close = '</a>'; }
        if (tag === 'hr') { open = '<hr style="border:none; border-top:1px solid #eee; margin:1.5rem 0;">'; close = ''; }
        if (tag === 'ul') { open = '<ul style="padding-right:1.5rem; line-height:2;">\n  <li>'; close = '</li>\n</ul>'; }
        if (tag === 'ol') { open = '<ol style="padding-right:1.5rem; line-height:2;">\n  <li>'; close = '</li>\n</ol>'; }
        if (tag === 'blockquote') { open = '<blockquote style="border-right:4px solid var(--p); padding:0.8rem 1.2rem; background:var(--bg); border-radius:0 10px 10px 0; margin:1rem 0; font-style:italic;">'; close = '</blockquote>'; }
        
        // Premium Components
        if (tag === 'button') { open = '<button style="background:var(--p); color:white; border:none; padding:12px 24px; border-radius:12px; font-weight:800; cursor:pointer; margin:1rem 0; display:inline-flex; align-items:center; gap:8px;">'; close = '</button>'; }
        if (tag === 'card') { open = '<div style="background:var(--surf); border:1px solid var(--bord); padding:1.5rem; border-radius:20px; box-shadow:var(--sh); margin:1.5rem 0;">\n  <h3 style="margin-bottom:10px;">عنوان البطاقة</h3>\n  <p style="opacity:0.6;">'; close = '</p>\n</div>'; }
        if (tag === 'grid') { open = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin:1.5rem 0;">\n  <div style="background:var(--bg); aspect-ratio:1; border-radius:15px; display:flex; align-items:center; justify-content:center;">صورة 1</div>\n  <div style="background:var(--bg); aspect-ratio:1; border-radius:15px; display:flex; align-items:center; justify-content:center;">صورة 2</div>\n</div>'; close = ''; }


        const insertion = open + (close ? selected : '') + close;
        area.value = text.substring(0, start) + insertion + text.substring(end);
        area.focus();
        ux.syncPreview();
    },
    setEditorTab: (tab) => {
        const editBtn = document.getElementById('tab-edit');
        const prevBtn = document.getElementById('tab-prev');
        const textarea = document.getElementById('page-content');
        const preview  = document.getElementById('page-preview');
        const toolbar  = document.getElementById('editor-toolbar');
        if (!textarea) return;
        if (tab === 'preview') {
            textarea.style.display = 'none';
            preview.style.display = 'block';
            toolbar.style.display = 'none';
            ux.syncPreview();
            if(editBtn) { editBtn.style.background='transparent'; editBtn.style.color='var(--muted)'; editBtn.style.border='1px solid var(--bord)'; }
            if(prevBtn) { prevBtn.style.background='var(--p)'; prevBtn.style.color='white'; prevBtn.style.border='none'; }
        } else {
            textarea.style.display = 'block';
            preview.style.display = 'none';
            toolbar.style.display = 'flex';
            if(editBtn) { editBtn.style.background='var(--p)'; editBtn.style.color='white'; editBtn.style.border='none'; }
            if(prevBtn) { prevBtn.style.background='transparent'; prevBtn.style.color='var(--muted)'; prevBtn.style.border='1px solid var(--bord)'; }
            textarea.focus();
        }
    },
    syncPreview: () => {
        const preview = document.getElementById('page-preview');
        const content = document.getElementById('page-content');
        if (preview && content) preview.innerHTML = content.value || '<p style="opacity:0.4;">المحتوى سيظهر هنا...</p>';
    },
    renderModalCats: (selected) => {
        const box = document.getElementById('m-cats');
        box.innerHTML = state.cats.map(c => `<div class="chip ${selected.includes(c) ? 'active' : ''}" onclick="this.classList.toggle('active')">${c}</div>`).join('');
    }
};

function switchSection(id, btn) {
    location.hash = id;
}

function router() {
    const hash = location.hash || '#dash';
    ux.closeM(false); // Close visually without navigating back
    
    if (hash === '#dash') _switchUI('dash');
    else if (hash === '#content') _switchUI('content');
    else if (hash === '#cats') _switchUI('cats');
    else if (hash === '#data') _switchUI('data');
    else if (hash === '#add') { _switchUI('content'); actions._openAdd(); }
    else if (hash.startsWith('#edit/')) { _switchUI('content'); actions._openEdit(hash.split('/')[1]); }
    else if (hash === '#add-page') { _switchUI('cats'); actions._openAddPage(); }
    else if (hash.startsWith('#edit-page/')) { _switchUI('cats'); actions._openEditPage(hash.split('/')[1]); }
    
    render();
}

function _switchUI(id) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    // Show target
    const el = document.getElementById(`section-${id}`);
    if(el) el.classList.add('active');
    
    // Update Sidebar
    document.querySelectorAll('.admin-nav-item, .m-nav-btn').forEach(i => i.classList.remove('active'));
    // Find matching nav item
    document.querySelectorAll(`[onclick*="switchSection('${id}'"]`).forEach(i => i.classList.add('active'));

    // Update Title
    const titles = { dash: 'نظرة عامة', content: 'إدارة الأعمال الفنية', cats: 'الأقسام والصفحات', data: 'البيانات والحماية' };
    document.getElementById('section-title').textContent = titles[id] || 'لوحة التحكم';
}

function toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('admin-theme', isDark ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const theme = localStorage.getItem('admin-theme') || 'dark'; // Admin defaults to dark
    if (theme === 'dark') document.body.classList.add('dark');
    else document.body.classList.remove('dark');
    
    const icon = document.querySelector('#theme-btn i');
    if (icon) {
        icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
        if(window.lucide) lucide.createIcons();
    }
}

async function logout() {
    if(!confirm('هل تريد الخروج من لوحة التحكم؟')) return;
    await dbSave('logged', false);
    location.href = 'index.html';
}

init();
