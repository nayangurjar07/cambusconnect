// support.js - Support Desk queries logic for Cambus Connect
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on support panel:", err);
    }
    initSupportPanel();

    function initSupportPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Display admin name from localStorage
        const adminNameDisplay = document.getElementById('admin-name-display');
        if (adminNameDisplay) {
            const adminName = localStorage.getItem('adminName');
            if (adminName) adminNameDisplay.textContent = adminName;
        }

        // Support Queries Badge & Loading
        const pendingBadge = document.getElementById('pending-badge');
        const refreshQueriesBtn = document.getElementById('refresh-queries-btn');

        let allQueries = [];
        let currentFilter = 'all';
        let selectedQueryId = null;

        loadSupportQueries();

        function loadSupportQueries() {
            dbHelper.getSupportQueriesCol().orderBy('createdAt', 'desc').limit(50)
                .onSnapshot(snapshot => {
                    allQueries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderSupportQueries();
                    updatePendingBadge();
                }, err => {
                    console.error("Error loading queries:", err);
                });
        }

        function updatePendingBadge() {
            const pendingCount = allQueries.filter(q => q.status === 'Pending').length;
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.classList.remove('hidden');
                } else {
                    pendingBadge.classList.add('hidden');
                }
            }

            // Update total count
            const totalQueries = document.getElementById('total-queries');
            if (totalQueries) {
                totalQueries.textContent = `${allQueries.length} Queries`;
            }
        }

        function renderSupportQueries() {
            const container = document.getElementById('support-queries-list');
            if (!container) return;

            container.innerHTML = '';

            // Filter queries
            let filtered = currentFilter === 'all'
                ? allQueries
                : allQueries.filter(q => q.status === currentFilter);

            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-12">
                        <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                        </div>
                        <p class="text-slate-500 font-semibold">No queries found</p>
                    </div>
                `;
                return;
            }

            filtered.forEach(query => {
                const card = createQueryCard(query);
                container.appendChild(card);
            });

            // Bind click handlers dynamically
            document.querySelectorAll('.btn-respond-query').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (id) openRespondModal(id);
                });
            });

            document.querySelectorAll('.btn-delete-query').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (id) deleteQuery(id);
                });
            });
        }

        function createQueryCard(query) {
            const card = document.createElement('div');
            card.className = 'card-hover bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border-2 border-slate-200 shadow-lg';

            const statusColors = {
                'Pending': 'bg-amber-100 text-amber-700',
                'In Progress': 'bg-blue-100 text-blue-700',
                'Resolved': 'bg-emerald-100 text-emerald-700',
                'Closed': 'bg-slate-200 text-slate-700'
            };

            const priorityColors = {
                'Low': 'bg-green-100 text-green-700',
                'Medium': 'bg-orange-100 text-orange-700',
                'High': 'bg-rose-100 text-rose-700'
            };

            const date = query.createdAt ? new Date(query.createdAt.toDate()).toLocaleDateString('en-US', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Just now';

            card.innerHTML = `
                <div class="flex items-start justify-between mb-4">
                    <div class="flex gap-2">
                        <span class="status-badge px-3 py-1 ${statusColors[query.status]} rounded-lg text-xs font-bold">${query.status}</span>
                        <span class="status-badge px-3 py-1 ${priorityColors[query.priority]} rounded-lg text-xs font-bold">${query.priority}</span>
                    </div>
                    <span class="text-xs text-slate-500 font-semibold">${date}</span>
                </div>
                
                <h4 class="font-black text-slate-800 text-lg mb-2">${query.subject}</h4>
                <p class="text-sm text-slate-600 mb-4 line-clamp-2">${query.description}</p>
                
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <p class="text-xs font-bold text-blue-700 mb-1">Student</p>
                        <p class="text-sm font-semibold text-slate-800">${query.studentName}</p>
                        <p class="text-xs text-slate-600">${query.studentPhone}</p>
                    </div>
                    <div class="p-3 bg-purple-50 rounded-xl border border-purple-100">
                        <p class="text-xs font-bold text-purple-700 mb-1">Category</p>
                        <p class="text-sm font-semibold text-slate-800">${query.category}</p>
                        <p class="text-xs text-slate-600">ID: ${query.studentEnrollment}</p>
                    </div>
                </div>
                
                ${query.response ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl mb-4">
                        <p class="text-xs font-bold text-emerald-700 mb-2">✅ Your Response</p>
                        <p class="text-sm text-slate-700">${query.response}</p>
                    </div>
                ` : ''}
                
                <div class="flex gap-2">
                    <button class="btn-respond-query flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md" data-id="${query.id}">
                        ${query.response ? 'Update' : 'Respond'}
                    </button>
                    <button class="btn-delete-query px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all" data-id="${query.id}">
                        Delete
                    </button>
                </div>
            `;

            return card;
        }

        // Filter tabs for support
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => {
                    t.classList.remove('border-blue-600', 'text-blue-600');
                    t.classList.add('border-transparent', 'text-slate-600');
                });
                tab.classList.add('border-blue-600', 'text-blue-600');
                tab.classList.remove('border-transparent', 'text-slate-600');

                currentFilter = tab.dataset.status;
                renderSupportQueries();
            });
        });

        // Response modal open
        function openRespondModal(queryId) {
            selectedQueryId = queryId;
            const query = allQueries.find(q => q.id === queryId);
            if (!query) return;

            document.getElementById('modal-query-details').innerHTML = `
                <div class="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 min-w-0">
                    <h4 class="font-black text-slate-800 text-lg sm:text-xl mb-3 break-words-safe">${query.subject}</h4>
                    <p class="text-slate-700 mb-4 text-sm break-words-safe">${query.description}</p>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div class="break-words-safe min-w-0"><span class="font-bold">Student:</span> ${query.studentName}</div>
                        <div class="break-words-safe min-w-0"><span class="font-bold">Priority:</span> ${query.priority}</div>
                        <div class="break-words-safe min-w-0"><span class="font-bold">Category:</span> ${query.category}</div>
                    </div>
                </div>
            `;

            document.getElementById('response-status').value = query.status;
            document.getElementById('response-message').value = query.response || '';

            document.getElementById('modal-respond-query').classList.remove('hidden');
            document.getElementById('modal-respond-query').classList.add('flex');
        }

        function closeRespondModal() {
            document.getElementById('modal-respond-query').classList.add('hidden');
            selectedQueryId = null;
        }

        const closeRespondModalBtn = document.getElementById('close-respond-modal-btn');
        const cancelRespondBtn = document.getElementById('cancel-respond-btn');

        if (closeRespondModalBtn) closeRespondModalBtn.addEventListener('click', closeRespondModal);
        if (cancelRespondBtn) cancelRespondBtn.addEventListener('click', closeRespondModal);

        const formRespondQuery = document.getElementById('form-respond-query');
        if (formRespondQuery) {
            formRespondQuery.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!selectedQueryId) return;

                try {
                    await dbHelper.getSupportQueriesCol().doc(selectedQueryId).update({
                        status: document.getElementById('response-status').value,
                        response: document.getElementById('response-message').value,
                        respondedBy: 'Admin',
                        respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Response sent!');
                    closeRespondModal();
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            });
        }

        async function deleteQuery(queryId) {
            if (confirm('Delete this query?')) {
                try {
                    await dbHelper.getSupportQueriesCol().doc(queryId).delete();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        if (refreshQueriesBtn) {
            refreshQueriesBtn.addEventListener('click', loadSupportQueries);
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
