// lost-found.js - Lost & Found Management Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on lost-found panel:", err);
    }
    initLostFoundPanel();

    function initLostFoundPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

        function escapeHtml(str) {
            if (typeof window.escapeHtml === 'function') return window.escapeHtml(str);
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        // Display admin name from localStorage
        const adminNameDisplay = document.getElementById('admin-name-display');
        if (adminNameDisplay) {
            const adminName = localStorage.getItem('adminName');
            if (adminName) adminNameDisplay.textContent = adminName;
        }

        // Support Queries Badge (one-time fetch for efficiency)
        const pendingBadge = document.getElementById('pending-badge');
        dbHelper.getSupportQueriesCol().where('status', '==', 'Pending').get().then(snapshot => {
            const pendingCount = snapshot.size;
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.classList.remove('hidden');
                } else {
                    pendingBadge.classList.add('hidden');
                }
            }
        }).catch(err => {
            console.error("Error loading pending queries badge:", err);
        });

        // DOM Elements
        const lostFoundList = document.getElementById('lost-found-list');

        // State
        let allItems = [];
        let currentSearch = '';
        let currentStatus = 'all';

        const searchInput = document.getElementById('admin-lost-search');
        const filterChips = document.querySelectorAll('.admin-filter-chip');
        const countDisplay = document.getElementById('admin-lost-count');
        const statTotal = document.getElementById('stat-total-items');
        const statActive = document.getElementById('stat-active-lost');
        const statResolved = document.getElementById('stat-found-resolved');

        function getItemDate(item) {
            if (!item || !item.createdAt) return null;
            if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate();
            const parsed = new Date(item.createdAt);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        // Fetch lost items with limit (prevents unbounded reads at scale)
        dbHelper.getLostItemsCol().orderBy('createdAt', 'desc').limit(50)
            .onSnapshot(snapshot => {
                allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateStats();
                filterAndRender();
            }, err => {
                console.error("Error loading lost & found:", err);
                if (lostFoundList) {
                    lostFoundList.innerHTML = '<div class="text-center py-8 text-red-500 font-semibold">Error loading items in real-time. Check permissions.</div>';
                }
            });

        function updateStats() {
            const activeItems = allItems.filter(item => !item.isDeleted);
            const lostCount = activeItems.filter(item => (item.status || 'Lost').toLowerCase() === 'lost').length;
            const foundCount = activeItems.filter(item => (item.status || '').toLowerCase() === 'found').length;

            if (statTotal) statTotal.textContent = activeItems.length;
            if (statActive) statActive.textContent = lostCount;
            if (statResolved) statResolved.textContent = foundCount;
        }

        function filterAndRender() {
            if (!lostFoundList) return;

            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);

            const filtered = allItems.filter(item => {
                if (item.isDeleted === true) return false;

                const createdDate = getItemDate(item);
                if (createdDate && createdDate < cutoff) return false;

                // Status filter
                if (currentStatus !== 'all') {
                    const st = (item.status || 'Lost').toLowerCase();
                    if (st !== currentStatus.toLowerCase()) return false;
                }

                // Search query
                if (currentSearch) {
                    const q = currentSearch.toLowerCase();
                    const name = (item.item || item.itemName || '').toLowerCase();
                    const desc = (item.description || '').toLowerCase();
                    const reporter = (item.userName || item.reportedBy || '').toLowerCase();
                    const route = (item.route || item.location || '').toLowerCase();
                    const email = (item.userEmail || '').toLowerCase();
                    const phone = (item.userPhone || '').toLowerCase();

                    if (!name.includes(q) && !desc.includes(q) && !reporter.includes(q) && !route.includes(q) && !email.includes(q) && !phone.includes(q)) {
                        return false;
                    }
                }

                return true;
            });

            if (countDisplay) {
                countDisplay.textContent = `Showing ${filtered.length} of ${allItems.length} reports`;
            }

            renderItems(filtered);
        }

        // Search Input Event
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearch = e.target.value.trim();
                filterAndRender();
            });
        }

        // Filter Chips Event
        filterChips.forEach(chip => {
            chip.addEventListener('click', () => {
                filterChips.forEach(c => {
                    c.classList.remove('bg-primary', 'text-white', 'shadow-sm');
                    c.classList.add('bg-slate-100', 'text-slate-600');
                });
                chip.classList.add('bg-primary', 'text-white', 'shadow-sm');
                chip.classList.remove('bg-slate-100', 'text-slate-600');
                currentStatus = chip.dataset.status;
                filterAndRender();
            });
        });

        function renderItems(items) {
            lostFoundList.innerHTML = '';

            if (items.length === 0) {
                lostFoundList.innerHTML = `
                    <div class="bg-white/80 border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                        <span class="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                        <p class="font-bold text-slate-700 text-base">No Matching Reports Found</p>
                        <p class="text-xs text-slate-400 mt-1">Try clearing your search query or filters</p>
                    </div>
                `;
                return;
            }

            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 hover:shadow-md transition-all space-y-4';

                const statusValue = (item.status || 'Lost').toString();
                const isFound = statusValue.toLowerCase() === 'found';
                const statusBadge = isFound
                    ? `<span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Found / Claimed</span>`
                    : `<span class="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Lost</span>`;

                const createdDate = getItemDate(item);
                const dateStr = createdDate ? createdDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending sync';

                card.innerHTML = `
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 ${isFound ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} rounded-xl flex items-center justify-center font-black text-sm">
                                <span class="material-symbols-outlined text-[20px]">${isFound ? 'check_circle' : 'inventory_2'}</span>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-900 text-base">${escapeHtml(item.item || item.itemName || 'Unnamed Item')}</h4>
                                <p class="text-[11px] text-slate-400 mt-0.5">Report ID: ${escapeHtml(item.id.slice(0, 10))} • ${dateStr}</p>
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <p class="text-slate-700 text-sm leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-medium">
                        ${escapeHtml(item.description || 'No description provided.')}
                    </p>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                            <p class="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Student</p>
                            <p class="font-bold text-slate-900 text-sm">${escapeHtml(item.userName || item.reportedBy || 'Unknown')}</p>
                            <p class="text-slate-500 text-[11px] mt-0.5">${item.userId ? `ID: ${escapeHtml(item.userId)}` : ''}</p>
                        </div>
                        <div class="p-3 bg-purple-50/70 border border-purple-100 rounded-xl">
                            <p class="text-[10px] font-bold text-purple-700 uppercase tracking-wider mb-1">${item.locationType === 'CAMPUS' ? 'Campus Location' : 'Route & Transit'}</p>
                            <p class="font-bold text-slate-900 text-sm">${escapeHtml(item.location || item.route || 'Campus Area')}</p>
                        </div>
                        <div class="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                            <p class="text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-1">Contact Details</p>
                            <p class="font-semibold text-slate-800 truncate">${escapeHtml(item.userEmail || item.userPhone || 'No contact')}</p>
                            ${item.userPhone && item.userPhone !== 'Not Available' ? `<p class="text-[11px] text-indigo-600 font-bold mt-0.5">Ph: ${escapeHtml(item.userPhone)}</p>` : ''}
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-wrap">
                        <div class="flex items-center gap-2">
                            ${!isFound ? `
                                <button class="btn-mark-status px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer" data-id="${item.id}" data-status="Found">
                                    <span class="material-symbols-outlined text-[16px]">check</span>
                                    Mark as Found
                                </button>
                            ` : `
                                <button class="btn-mark-status px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer" data-id="${item.id}" data-status="Lost">
                                    <span class="material-symbols-outlined text-[16px]">undo</span>
                                    Reopen as Lost
                                </button>
                            `}
                            ${item.userEmail && item.userEmail.includes('@') ? `
                                <a href="mailto:${item.userEmail}?subject=Cambus Connect: Regarding your lost report (${encodeURIComponent(item.item || 'Item')})" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-[16px]">mail</span>
                                    Email Student
                                </a>
                            ` : ''}
                        </div>
                        <button class="btn-delete-item px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer" data-id="${item.id}">
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                            Delete
                        </button>
                    </div>
                `;

                lostFoundList.appendChild(card);
            });

            // Bind Actions
            document.querySelectorAll('.btn-mark-status').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const targetBtn = e.currentTarget;
                    const id = targetBtn.getAttribute('data-id');
                    const newStatus = targetBtn.getAttribute('data-status');
                    if (!id || !newStatus) return;

                    targetBtn.disabled = true;
                    try {
                        await dbHelper.getLostItemsCol().doc(id).update({
                            status: newStatus,
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    } catch (err) {
                        console.error("Error updating status:", err);
                        alert("Failed to update status: " + err.message);
                    } finally {
                        targetBtn.disabled = false;
                    }
                });
            });

            document.querySelectorAll('.btn-delete-item').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (id && confirm('Are you sure you want to delete this lost & found report?')) {
                        try {
                            await dbHelper.getLostItemsCol().doc(id).delete();
                        } catch (err) {
                            console.error("Error deleting report:", err);
                            alert("Failed to delete: " + err.message);
                        }
                    }
                });
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Logout?')) {
                    auth.signOut().then(() => {
                        localStorage.clear();
                        window.location.href = '../admin-login.html';
                    });
                }
            });
        }
    }
});
