// lost-found.js - Lost & Found Management Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', () => {
    // Check if firebase is available (loaded as modular import/global)
    const initInterval = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(initInterval);
            initLostFoundPanel();
        }
    }, 100);

    function initLostFoundPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Display admin name from localStorage
        const adminNameDisplay = document.getElementById('admin-name-display');
        if (adminNameDisplay) {
            const adminName = localStorage.getItem('adminName');
            if (adminName) adminNameDisplay.textContent = adminName;
        }

        // Support Queries Badge
        const pendingBadge = document.getElementById('pending-badge');
        dbHelper.getSupportQueriesCol().where('status', '==', 'Pending').onSnapshot(snapshot => {
            const pendingCount = snapshot.size;
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.classList.remove('hidden');
                } else {
                    pendingBadge.classList.add('hidden');
                }
            }
        }, err => {
            console.error("Error loading pending queries badge:", err);
        });

        // DOM Elements
        const lostFoundList = document.getElementById('lost-found-list');

        // Retrieve and render lost items
        loadLostFound();

        function loadLostFound() {
            if (!lostFoundList) return;
            lostFoundList.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>';

            dbHelper.getLostItemsCol().orderBy('createdAt', 'desc').limit(50).get()
                .then(snapshot => {
                    lostFoundList.innerHTML = '';

                    if (snapshot.empty) {
                        lostFoundList.innerHTML = '<div class="text-center py-12 text-slate-500">No lost & found reports yet</div>';
                        return;
                    }

                    const cutoff = new Date();
                    cutoff.setDate(cutoff.getDate() - 30);

                    snapshot.forEach(doc => {
                        const item = doc.data();
                        const createdDate = item.createdAt && typeof item.createdAt.toDate === 'function'
                            ? item.createdAt.toDate()
                            : (item.createdAt ? new Date(item.createdAt) : null);
                        
                        if (item.isDeleted === true) return;
                        if (!createdDate || Number.isNaN(createdDate.getTime()) || createdDate < cutoff) return;
                        
                        const card = document.createElement('div');
                        card.className = 'card-hover bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-slate-200/60';

                        const statusValue = (item.status || 'Lost').toString();
                        const normalizedStatus = statusValue.toLowerCase();
                        const statusColor = normalizedStatus === 'found' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700';
                        const date = createdDate ? createdDate.toLocaleString() : 'Just now';

                        card.innerHTML = `
                            <div class="flex items-start justify-between mb-4">
                                <div>
                                    <h4 class="font-black text-slate-800 text-lg mb-1">${item.item || item.itemName || 'Unknown Item'}</h4>
                                    <span class="px-3 py-1 ${statusColor} rounded-lg text-xs font-bold uppercase">${statusValue}</span>
                                </div>
                                <span class="text-xs text-slate-500">${date}</span>
                            </div>
                            <p class="text-slate-600 mb-4">${item.description || 'No description'}</p>
                            <div class="grid grid-cols-2 gap-3 mb-4 text-sm">
                                <div class="p-3 bg-blue-50 rounded-xl">
                                    <p class="text-xs font-bold text-blue-700 mb-1">Reported By</p>
                                    <p class="text-slate-800">${item.userName || item.reportedBy || 'Unknown'}</p>
                                </div>
                                <div class="p-3 bg-purple-50 rounded-xl">
                                    <p class="text-xs font-bold text-purple-700 mb-1">Route</p>
                                    <p class="text-slate-800">${item.route || item.location || 'Not specified'}</p>
                                </div>
                            </div>
                            <button class="btn-delete-item px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all" data-id="${doc.id}">
                                Delete
                            </button>
                        `;

                        lostFoundList.appendChild(card);
                    });

                    // Bind delete buttons
                    document.querySelectorAll('.btn-delete-item').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const id = e.target.getAttribute('data-id');
                            if (id) deleteLostFound(id);
                        });
                    });
                })
                .catch(err => {
                    console.error("Error loading lost & found:", err);
                    lostFoundList.innerHTML = '<div class="text-center py-8 text-red-500">Error loading items</div>';
                });
        }

        async function deleteLostFound(itemId) {
            if (confirm('Delete this item?')) {
                try {
                    await dbHelper.getLostItemsCol().doc(itemId).delete();
                    loadLostFound();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
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
