document.addEventListener('DOMContentLoaded', () => {

    const notificationsList = document.getElementById('notifications-list');

    if (!notificationsList) {
        console.error("Notifications list element not found");
        return;
    }

    // Show loading state
    notificationsList.innerHTML = `
        <div class="glass-card rounded-3xl p-12 text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-4"></div>
            <p class="text-gray-700 font-semibold">Loading notifications...</p>
            <p class="text-gray-500 text-sm mt-2">Please wait a moment</p>
        </div>
    `;

    // Fetch notifications in real-time
    dbHelper.getNotificationsCol()
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(snapshot => {
            const notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            const studentData = JSON.parse(localStorage.getItem('student'));
            const studentRoute = studentData ? studentData.busRoute : null;

            const filtered = notifications.filter(n => {
                return !n.targetRouteId || n.targetRouteId === 'all' || n.targetRouteId === studentRoute;
            });

            renderNotifications(filtered);
        }, error => {
            console.error("Error fetching notifications from Firestore:", error);
            console.warn("⚠️ Firestore permissions restricted. Falling back to local sandbox notifications.");
            
            // Highlight running in demo mode
            const subTitle = document.querySelector('.max-w-3xl p.text-slate-500') || document.querySelector('p.text-slate-500');
            if (subTitle) {
                subTitle.innerHTML = `Running in Local Sandbox Mode (Firestore permissions restricted)`;
                subTitle.className = "text-amber-600 text-xs font-semibold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full inline-block mt-1";
            }
            
            const mockNotifications = [
                {
                    id: 'mock-notif-1',
                    type: 'delay',
                    message: '⚠️ Route Delay: Bus #101 is delayed by 12 minutes on the Palasia Main Campus shuttle due to road maintenance near Geeta Bhawan.',
                    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 15) }, // 15 mins ago
                    read: false,
                    actionable: false
                },
                {
                    id: 'mock-notif-2',
                    type: 'success',
                    message: '✅ Yearly Student Pass verified and issued. Tap on the "Bus Pass" tab in the sidebar to check your dynamic boarding QR code.',
                    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 2) }, // 2 hours ago
                    read: true,
                    actionable: false
                },
                {
                    id: 'mock-notif-3',
                    type: 'alert',
                    message: '🚨 Emergency Alert: All night shuttle routes are moving to alternate boarding bay 4 starting tonight for campus lighting upgrades.',
                    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 6) }, // 6 hours ago
                    read: true,
                    actionable: true
                },
                {
                    id: 'mock-notif-4',
                    type: 'crowd',
                    message: '👥 Crowd Update: Main gate loop is experiencing heavy rush. 2 additional backup buses have been deployed on Route 101.',
                    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 12) }, // 12 hours ago
                    read: true,
                    actionable: false
                },
                {
                    id: 'mock-notif-5',
                    type: 'info',
                    message: 'ℹ️ Winter Transit Schedule: New schedule timings are now active. View route details under the "Search Buses" tab.',
                    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 60 * 24 * 1.5) }, // 1.5 days ago
                    read: true,
                    actionable: false
                }
            ];
            
            renderNotifications(mockNotifications);
        });

    function renderNotifications(notifications) {
        notificationsList.innerHTML = '';

        if (notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="glass-card rounded-3xl p-16 text-center">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">No Notifications Yet</h3>
                    <p class="text-gray-500 text-lg">You're all caught up! Check back later for updates.</p>
                </div>
            `;
            return;
        }

        notifications.forEach((n, index) => {
            const time = n.createdAt
                ? new Date(n.createdAt.toDate()).toLocaleString()
                : 'Just now';

            // Enhanced type configurations with icons and gradients
            const typeConfig = {
                delay: {
                    gradient: 'from-orange-500 to-red-500',
                    bg: 'from-orange-50 to-red-50',
                    border: 'border-orange-300',
                    icon: '⚠️',
                    iconBg: 'bg-orange-100',
                    iconColor: 'text-orange-600',
                    label: 'Delay Alert',
                    labelColor: 'text-orange-700'
                },
                info: {
                    gradient: 'from-blue-500 to-indigo-500',
                    bg: 'from-blue-50 to-indigo-50',
                    border: 'border-blue-300',
                    icon: 'ℹ️',
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    label: 'Information',
                    labelColor: 'text-blue-700'
                },
                crowd: {
                    gradient: 'from-green-500 to-emerald-500',
                    bg: 'from-green-50 to-emerald-50',
                    border: 'border-green-300',
                    icon: '👥',
                    iconBg: 'bg-green-100',
                    iconColor: 'text-green-600',
                    label: 'Crowd Update',
                    labelColor: 'text-green-700'
                },
                alert: {
                    gradient: 'from-red-500 to-pink-500',
                    bg: 'from-red-50 to-pink-50',
                    border: 'border-red-300',
                    icon: '🚨',
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    label: 'Alert',
                    labelColor: 'text-red-700'
                },
                success: {
                    gradient: 'from-teal-500 to-cyan-500',
                    bg: 'from-teal-50 to-cyan-50',
                    border: 'border-teal-300',
                    icon: '✅',
                    iconBg: 'bg-teal-100',
                    iconColor: 'text-teal-600',
                    label: 'Success',
                    labelColor: 'text-teal-700'
                }
            };

            const config = typeConfig[n.type] || typeConfig.info;
            const isUnread = !n.read;

            const notificationCard = `
                <div class="notification-card glass-card rounded-3xl p-6 border-l-4 ${config.border} animate-slideIn" style="animation-delay: ${index * 0.1}s">
                    <div class="flex items-start gap-4">
                        <!-- Icon -->
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 ${config.iconBg} rounded-2xl flex items-center justify-center text-2xl shadow-sm">
                                ${config.icon}
                            </div>
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex items-start justify-between gap-4 mb-2">
                                <div class="flex items-center gap-3">
                                    <span class="px-3 py-1 bg-gradient-to-r ${config.gradient} text-white text-xs font-bold uppercase tracking-wide rounded-lg shadow-sm">
                                        ${config.label}
                                    </span>
                                    ${isUnread ? '<span class="w-2 h-2 bg-red-500 rounded-full pulse-ring"></span>' : ''}
                                </div>
                                <span class="text-xs text-gray-500 font-medium whitespace-nowrap">${time}</span>
                            </div>
                            <p class="text-gray-800 font-medium leading-relaxed">${n.message}</p>
                            
                            <!-- Action Buttons (if needed) -->
                            ${n.actionable ? `
                                <div class="mt-4 flex gap-2">
                                    <button class="px-4 py-2 bg-gradient-to-r ${config.gradient} text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all">
                                        View Details
                                    </button>
                                    <button class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-all">
                                        Dismiss
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;

            notificationsList.insertAdjacentHTML('beforeend', notificationCard);
        });
    }
});