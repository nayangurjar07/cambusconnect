// notifications.js - Notification Broadcast Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on notifications panel:", err);
    }
    initNotificationsPanel();

    function initNotificationsPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

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
        const notificationsList = document.getElementById('notifications-list');
        const addNotificationBtn = document.getElementById('add-notification-btn');
        const modalAddNotification = document.getElementById('modal-add-notification');
        const closeNotificationModalBtn = document.getElementById('close-notification-modal-btn');
        const cancelNotificationModalBtn = document.getElementById('cancel-notification-modal-btn');
        const formAddNotification = document.getElementById('form-add-notification');
        const announcementTargetRoute = document.getElementById('announcement-target-route');

        let buses = [];

        // Load Buses (Routes) to populate targets dropdown
        dbHelper.getBusesCol().onSnapshot(snapshot => {
            buses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateBusOptions();
        }, err => {
            console.error("Error loading routes for announcements:", err);
        });

        function updateBusOptions() {
            if (announcementTargetRoute) {
                announcementTargetRoute.innerHTML = '<option value="all">All Routes (General Announcement)</option>';
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.route;
                    option.textContent = `Route: ${bus.route} (Bus ${bus.number})`;
                    announcementTargetRoute.appendChild(option);
                });
            }
        }

        // Retrieve and render notifications
        loadNotifications();

        function loadNotifications() {
            if (!notificationsList) return;
            notificationsList.innerHTML = '<div class="text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>';

            dbHelper.getNotificationsCol().orderBy('createdAt', 'desc').limit(20).get()
                .then(snapshot => {
                    notificationsList.innerHTML = '';

                    if (snapshot.empty) {
                        notificationsList.innerHTML = '<div class="text-center py-12 text-slate-500">No notifications sent yet</div>';
                        return;
                    }

                    snapshot.forEach(doc => {
                        const notif = doc.data();
                        const card = document.createElement('div');
                        card.className = 'card-hover bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-slate-200/60';

                        const typeColors = {
                            'info': 'bg-blue-100 text-blue-700',
                            'alert': 'bg-red-100 text-red-700',
                            'delay': 'bg-amber-100 text-amber-700',
                            'crowd': 'bg-purple-100 text-purple-700'
                        };

                        const typeColor = typeColors[notif.type] || 'bg-slate-100 text-slate-700';
                        const date = notif.createdAt ? new Date(notif.createdAt.toDate()).toLocaleString() : 'Just now';
                        const targetLabel = notif.targetRouteId && notif.targetRouteId !== 'all' ? `Route: ${notif.targetRouteId}` : 'All Routes';

                        card.innerHTML = `
                            <div class="flex items-start justify-between mb-4">
                                <div class="flex items-center gap-2">
                                    <span class="px-3 py-1 ${typeColor} rounded-lg text-xs font-bold uppercase">${notif.type}</span>
                                    <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">${targetLabel}</span>
                                </div>
                                <span class="text-xs text-slate-500">${date}</span>
                            </div>
                            <p class="text-slate-800 font-semibold mb-4">${notif.message}</p>
                            <button class="btn-delete-notif px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold transition-all" data-id="${doc.id}">
                                Delete
                            </button>
                        `;

                        notificationsList.appendChild(card);
                    });

                    // Bind delete buttons
                    document.querySelectorAll('.btn-delete-notif').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const id = e.target.getAttribute('data-id');
                            if (id) deleteNotification(id);
                        });
                    });
                })
                .catch(err => {
                    console.error("Error loading notifications:", err);
                    notificationsList.innerHTML = '<div class="text-center py-8 text-red-500">Error loading notifications</div>';
                });
        }

        async function deleteNotification(notifId) {
            if (confirm('Delete this notification?')) {
                try {
                    await dbHelper.getNotificationsCol().doc(notifId).delete();
                    loadNotifications();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }

        // Broadcast Add Modal handlers
        if (addNotificationBtn && modalAddNotification) {
            addNotificationBtn.addEventListener('click', () => {
                modalAddNotification.classList.remove('hidden');
                modalAddNotification.classList.add('flex');
            });
        }

        function closeNotificationModal() {
            if (modalAddNotification) {
                modalAddNotification.classList.add('hidden');
                modalAddNotification.classList.remove('flex');
            }
        }
        if (closeNotificationModalBtn) closeNotificationModalBtn.addEventListener('click', closeNotificationModal);
        if (cancelNotificationModalBtn) cancelNotificationModalBtn.addEventListener('click', closeNotificationModal);

        if (formAddNotification) {
            formAddNotification.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);

                try {
                    await dbHelper.getNotificationsCol().add({
                        type: formData.get('type'),
                        message: formData.get('message'),
                        targetRouteId: formData.get('targetRouteId') || 'all',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Notification sent!');
                    e.target.reset();
                    closeNotificationModal();
                    loadNotifications();
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
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
