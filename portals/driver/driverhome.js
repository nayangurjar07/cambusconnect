// driver/driverhome.js - Driver Portal Logic
document.addEventListener('DOMContentLoaded', () => {

    // 1. Get Session Info
    const driverEmail = localStorage.getItem('userEmail');
    if (!driverEmail) {
        window.location.href = 'driver-login.html';
        return;
    }

    // DOM Elements
    const driverNameDisplay   = document.getElementById('driver-name-display');
    const greetingTitle       = document.getElementById('greeting-title');
    const greetingSub         = document.getElementById('greeting-sub');
    const driverEmailDisplay  = document.getElementById('driver-email-display');
    const busNumberOption     = document.getElementById('bus-number-option');
    const busRouteOption      = document.getElementById('bus-route-option');
    const btnToggleShift      = document.getElementById('btn-toggle-shift');
    const btnIcon             = document.getElementById('btn-icon');
    const btnLabel            = document.getElementById('btn-label');
    const gpsStatusBadge      = document.getElementById('gps-status-badge');
    const gpsSignalArea       = document.getElementById('gps-signal-area');
    const gpsAreaLabel        = document.getElementById('gps-area-label');
    const latDisplay          = document.getElementById('lat-display');
    const lngDisplay          = document.getElementById('lng-display');
    const accuracyDisplay     = document.getElementById('accuracy-display');
    const durationDisplay     = document.getElementById('duration-display');
    const shiftStatusDisplay  = document.getElementById('shift-status-display');
    const formDriverAlert     = document.getElementById('form-driver-alert');
    const driverAlertMessage  = document.getElementById('driver-alert-message');
    const driverAlertType     = document.getElementById('driver-alert-type');
    const historyList         = document.getElementById('driver-history-list');
    const headcountCard       = document.getElementById('headcount-card');
    const btnDecrementHeadcount = document.getElementById('btn-decrement-headcount');
    const btnIncrementHeadcount = document.getElementById('btn-increment-headcount');
    const headcountDisplay    = document.getElementById('headcount-display');
    const infoCollegeName     = document.getElementById('info-college-name');
    const sidebarBrandName    = document.getElementById('sidebar-brand-name');

    // Populate driver email
    if (driverEmailDisplay) driverEmailDisplay.textContent = driverEmail;

    // Set greeting date
    if (greetingSub) {
        const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        greetingSub.textContent = `Loading... • ${today}`;
    }

    // Branding
    if (window.activeBranding) {
        const { shortName, logoUrl } = window.activeBranding;
        if (infoCollegeName && shortName) infoCollegeName.textContent = shortName;
        if (sidebarBrandName && shortName) sidebarBrandName.textContent = shortName;
        if (greetingSub && shortName) {
            const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            greetingSub.textContent = `${shortName} • ${today}`;
        }
    }

    let driverProfile  = null;
    let assignedBus    = null;
    let isTracking     = false;
    let watchId        = null;
    let shiftStartTime = null;
    let timerInterval  = null;
// driver/driverhome.js - Driver Portal Logic
    let activeSessionId = null;
    let hasAutoRestored = false;
    let busListenerUnsubscribe = null;
    let boardingsListenerUnsubscribe = null;

    // Scanner variables
    let html5QrScanner = null;
    const dbReferenceLogs = {}; // Anti-loop scan cache
    const SHARED_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;

    function getFirestoreDb() {
        return window.db || firebase.firestore();
    }

    function getSharedLockKey(student) {
        const rawKey = student ? (student.id || student.collegeId || student.enrollment || student.email || student.studentId || '') : '';
        return String(rawKey).trim().toLowerCase();
    }

    function getActiveBusLockDocRef() {
        if (!assignedBus || !assignedBus.id) return null;
        return getFirestoreDb().collection('buses').doc(assignedBus.id);
    }

    async function writeSharedScanLock(lockKey, student, busId, busNumber, portalName) {
        if (!lockKey) return;
        const nowIso = new Date().toISOString();
        const lockedUntil = new Date(Date.now() + SHARED_LOCK_DURATION_MS).toISOString();
        const busDoc = getActiveBusLockDocRef();
        if (!busDoc) return;
        await busDoc.set({
            scanLocks: {
                [lockKey]: {
                    studentId: lockKey,
                    studentName: student?.name || 'Unknown',
                    studentCollegeId: student?.collegeId || '',
                    studentEmail: student?.email || '',
                    routeName: student?.busRoute || student?.routeName || 'Not Assigned',
                    busId: busId || '',
                    busNumber: busNumber || '',
                    lockedByPortal: portalName,
                    lockedAt: nowIso,
                    lockedUntil,
                }
            }
        }, { merge: true });
    }

    async function clearSharedScanLock(lockKey) {
        if (!lockKey) return;
        const busDoc = getActiveBusLockDocRef();
        if (!busDoc) return;
        await busDoc.update({
            [`scanLocks.${lockKey}`]: firebase.firestore.FieldValue.delete()
        }).catch(() => {});
    }

    async function ensureSharedLockClear(student) {
        const lockKey = getSharedLockKey(student);
        if (!lockKey) return { allowed: true };
        const busDoc = getActiveBusLockDocRef();
        if (!busDoc) return { allowed: true, lockKey };
        const snap = await busDoc.get();
        const locks = (snap.exists && snap.data() && snap.data().scanLocks) ? snap.data().scanLocks : {};
        const activeLock = locks[lockKey];
        if (!activeLock) {
            return { allowed: true, lockKey };
        }
        const lockedUntilMs = activeLock.lockedUntil ? new Date(activeLock.lockedUntil).getTime() : 0;
        if (!lockedUntilMs || lockedUntilMs <= Date.now()) {
            return { allowed: true, lockKey };
        }
        const remainingMs = lockedUntilMs - Date.now();
        const remainingSecs = Math.max(1, Math.ceil(remainingMs / 1000));
        const byPortal = activeLock.lockedByPortal || 'another device';
        const reason = `Already checked in from ${byPortal}. Lock remains for ${remainingSecs}s.`;
        playBeep(220, 300);
        if (scannerStatus) {
            scannerStatus.textContent = reason;
            scannerStatus.style.color = "#e53935";
        }
        showToast(false, "Access Denied", reason);
        return { allowed: false, reason, lockKey };
    }

    // ─── Tab Switching Logic ──────────────────────────────────────────────────
    const tabs = {
        'dashboard': { btn: document.getElementById('sidebar-tab-dashboard'), view: document.getElementById('view-dashboard') },
        'alerts': { btn: document.getElementById('sidebar-tab-alerts'), view: document.getElementById('view-alerts') },
        'pass-scan': { btn: document.getElementById('sidebar-tab-pass-scan'), view: document.getElementById('view-pass-scan') },
        'profile': { btn: document.getElementById('sidebar-tab-profile'), view: document.getElementById('view-profile') },
        'support': { btn: document.getElementById('sidebar-tab-support'), view: document.getElementById('view-support') }
    };

    const sidebar = document.getElementById('sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');

    function switchTab(tabId) {
        // Toggle view visibility and button active classes
        for (const [key, tab] of Object.entries(tabs)) {
            if (!tab.view || !tab.btn) continue;
            if (key === tabId) {
                tab.view.classList.remove('hidden');
                tab.btn.classList.add('active');
            } else {
                tab.view.classList.add('hidden');
                tab.btn.classList.remove('active');
            }
        }
        
        // Handle special operations when tabs are switched
        if (tabId === 'pass-scan') {
            startCameraScanner();
        } else {
            stopCameraScanner();
        }

        // Close sidebar on mobile
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
    }

    // Set click listeners for tabs
    for (const [key, tab] of Object.entries(tabs)) {
        if (tab.btn) {
            tab.btn.addEventListener('click', () => switchTab(key));
        }
    }

    // Mobile sidebar triggers
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('open');
            if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
        });
    }

    if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('open');
            if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
        });
    }

    // ─── Load Profile ──────────────────────────────────────────────────────────
    (async () => {
        try {
            const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
            if (typeof authGuard === 'function') {
                await authGuard();
            }
        } catch (err) {
            console.error("❌ Firebase/Auth unavailable in driver portal:", err);
            return;
        }

        dbHelper.getUsersCol().doc(driverEmail).get()
        .then(async doc => {
            if (doc.exists) {
                driverProfile = doc.data();
                const fullName  = driverProfile.name || driverEmail;
                const firstName = fullName.split(' ')[0];

                // Update greeting
                if (greetingTitle) greetingTitle.textContent = `Hello, ${firstName}!`;
                if (driverNameDisplay) driverNameDisplay.textContent = fullName.toUpperCase();

                // Update institute in greeting sub
                const instituteName = (window.activeBranding && window.activeBranding.shortName)
                    ? window.activeBranding.shortName
                    : (driverProfile.institute || 'Your Institute');
                if (infoCollegeName) infoCollegeName.textContent = instituteName;
                if (greetingSub) {
                    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    greetingSub.textContent = `${instituteName} • ${today}`;
                }

                // Update Profile name
                const profileDriverName = document.getElementById('profile-driver-name');
                if (profileDriverName) profileDriverName.textContent = fullName;

                // Resolve bus assignment
                try {
                    const busSnapshot = await dbHelper.getBusesCol()
                        .where('driverEmails', 'array-contains', driverEmail).get();
                    if (!busSnapshot.empty) {
                        const initialBusId = busSnapshot.docs[0].id;
                        loadBusDetails(initialBusId);
                        loadAllBusesForSelect(initialBusId);
                    } else if (driverProfile.assignedBusId) {
                        loadBusDetails(driverProfile.assignedBusId);
                        loadAllBusesForSelect(driverProfile.assignedBusId);
                    } else {
                        showNoBusAssigned();
                    }
                } catch (err) {
                    console.error('Bus assignment error:', err);
                    if (driverProfile.assignedBusId) {
                        loadBusDetails(driverProfile.assignedBusId);
                        loadAllBusesForSelect(driverProfile.assignedBusId);
                    } else {
                        showNoBusAssigned();
                    }
                }

            } else {
                alert('Driver profile not found. Contact admin.');
                localStorage.clear();
                window.location.href = 'driver-login.html';
            }
        })
        .catch(err => console.error('Profile fetch error:', err));
    })();

    function showNoBusAssigned() {
        assignedBus = null;
        if (busNumberOption) busNumberOption.textContent = 'No Bus Assigned';
        if (busRouteOption) busRouteOption.textContent = 'Unassigned Vehicle';
        const busStatusEl = document.getElementById('driver-bus-status');
        if (busStatusEl) busStatusEl.textContent = 'Unassigned';
        loadAllBusesForSelect(null);
    }

    // ─── Load All Buses for selector ─────────────────────────────────────────
    function loadAllBusesForSelect(selectedBusId) {
        const selectEl = document.getElementById('assigned-vehicle-select');
        if (!selectEl) return;
        
        dbHelper.getBusesCol().get().then(snapshot => {
            selectEl.innerHTML = '';
            
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                const opt = document.createElement('option');
                opt.value = doc.id;
                opt.textContent = `Bus #${data.number || doc.id} - ${data.route || 'No Route'}`;
                if (doc.id === selectedBusId) {
                    opt.selected = true;
                }
                selectEl.appendChild(opt);
                count++;
            });
            
            if (count === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'No buses registered in system';
                selectEl.appendChild(opt);
            }
        }).catch(err => {
            console.error("Error listing buses for selector:", err);
        });
    }

    // ─── Emergency Switch Active Bus ──────────────────────────────────────────
    function switchActiveBus(newBusId) {
        if (!newBusId || (assignedBus && assignedBus.id === newBusId)) return;
        
        console.log(`🔄 Emergency Switch: Changing active bus from ${assignedBus ? assignedBus.id : 'none'} to ${newBusId}`);
        
        const trackingActive = isTracking;
        
        // If we are tracking, stop GPS stream of old bus
        if (trackingActive) {
            stopGPSStream();
        }
        
        // Load details for new bus
        loadBusDetails(newBusId);
        
        // If we were tracking, start GPS stream on the new bus
        if (trackingActive) {
            setTimeout(() => {
                startGPSStream();
                // If on pass scan tab, restart scanner to point to the new bus
                const passScanTab = document.getElementById('sidebar-tab-pass-scan');
                if (passScanTab && passScanTab.classList.contains('active')) {
                    stopCameraScanner();
                    startCameraScanner();
                }
            }, 800);
        }
    }

    const assignedVehicleSelect = document.getElementById('assigned-vehicle-select');
    if (assignedVehicleSelect) {
        assignedVehicleSelect.addEventListener('change', (e) => {
            switchActiveBus(e.target.value);
        });
    }

    // ─── Load Bus Details ──────────────────────────────────────────────────────
    function loadBusDetails(busId) {
        if (busListenerUnsubscribe) {
            busListenerUnsubscribe();
            busListenerUnsubscribe = null;
        }
        if (boardingsListenerUnsubscribe) {
            boardingsListenerUnsubscribe();
            boardingsListenerUnsubscribe = null;
        }
        subscribeToBoardingsUpdates(busId);

        busListenerUnsubscribe = dbHelper.getBusesCol().doc(busId).onSnapshot(doc => {
            if (doc.exists) {
                assignedBus = { id: doc.id, ...doc.data() };
                // Update assignment controls
                if (busNumberOption) {
                    busNumberOption.textContent = `Bus #${assignedBus.number || assignedBus.id}`;
                }
                if (busRouteOption) {
                    busRouteOption.textContent = assignedBus.route || 'No Route Assigned';
                }
            } else {
                assignedBus = null;
                if (busNumberOption) {
                    busNumberOption.textContent = 'Bus Not Found';
                }
                if (busRouteOption) {
                    busRouteOption.textContent = 'Unassigned Fleet';
                }
                return;
            }

            // Sync headcount
            if (headcountDisplay) {
                headcountDisplay.value = assignedBus.headcount || 0;
            }

            // Pre-fill alert message
            if (driverAlertMessage && !driverAlertMessage.value) {
                driverAlertMessage.value = `📢 Route Notice: Bus #${assignedBus.number} (${assignedBus.route}) has consolidated routes starting now. Please check live tracking.`;
            }

            updateHeadcountUI();

            // Handle Route Optimization Banner Alert
            const optBanner = document.getElementById('opt-banner');
            const optBannerIconBox = document.getElementById('opt-banner-icon-box');
            const optBannerIcon = document.getElementById('opt-banner-icon');
            const optBannerTitle = document.getElementById('opt-banner-title');
            const optBannerMessage = document.getElementById('opt-banner-message');

            if (optBanner) {
                if (assignedBus.optimizedAction && assignedBus.optimizedAction !== 'NORMAL') {
                    optBanner.classList.remove('hidden');
                    if (optBannerMessage) {
                        optBannerMessage.textContent = assignedBus.instruction || 'Your bus schedule is modified.';
                    }

                    // Apply visual theme matching optimizedAction
                    if (assignedBus.optimizedAction === 'STANDBY_STATIONARY') {
                        optBanner.className = 'glass-card rounded-2xl p-5 border border-amber-200 bg-amber-50/85 backdrop-blur-md mb-6 flex items-start gap-4 transition-all duration-300';
                        if (optBannerIconBox) optBannerIconBox.className = 'w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md';
                        if (optBannerIcon) optBannerIcon.textContent = 'warning';
                        if (optBannerTitle) optBannerTitle.textContent = '⚠️ Standby Roster Activated';
                    } else if (assignedBus.optimizedAction === 'ACTIVE_COLLECTOR') {
                        optBanner.className = 'glass-card rounded-2xl p-5 border border-emerald-200 bg-emerald-50/85 backdrop-blur-md mb-6 flex items-start gap-4 transition-all duration-300';
                        if (optBannerIconBox) optBannerIconBox.className = 'w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md';
                        if (optBannerIcon) optBannerIcon.textContent = 'directions_bus';
                        if (optBannerTitle) optBannerTitle.textContent = '🚌 Active Collector Dispatch';
                    } else if (assignedBus.optimizedAction === 'HUB_LEAD') {
                        optBanner.className = 'glass-card rounded-2xl p-5 border border-indigo-200 bg-indigo-50/85 backdrop-blur-md mb-6 flex items-start gap-4 transition-all duration-300';
                        if (optBannerIconBox) optBannerIconBox.className = 'w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md';
                        if (optBannerIcon) optBannerIcon.textContent = 'call_merge';
                        if (optBannerTitle) optBannerTitle.textContent = '🎯 Hub Intersection Lead Bus';
                    } else if (assignedBus.optimizedAction === 'HUB_TRANSFER_RETURN') {
                        optBanner.className = 'glass-card rounded-2xl p-5 border border-blue-200 bg-blue-50/85 backdrop-blur-md mb-6 flex items-start gap-4 transition-all duration-300';
                        if (optBannerIconBox) optBannerIconBox.className = 'w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md';
                        if (optBannerIcon) optBannerIcon.textContent = 'swap_horiz';
                        if (optBannerTitle) optBannerTitle.textContent = '🔄 Hub Transfer & Return';
                    } else {
                        optBanner.className = 'glass-card rounded-2xl p-5 border border-slate-200 bg-slate-50/85 backdrop-blur-md mb-6 flex items-start gap-4 transition-all duration-300';
                        if (optBannerIconBox) optBannerIconBox.className = 'w-10 h-10 bg-slate-500 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md';
                        if (optBannerIcon) optBannerIcon.textContent = 'info';
                        if (optBannerTitle) optBannerTitle.textContent = 'Route Optimization Alert';
                    }
                } else {
                    optBanner.classList.add('hidden');
                }
            }

            // Handle Next Day Dispatch Banner
            const nextDayInfo = document.getElementById('driver-next-day-info');
            const nextDayText = document.getElementById('driver-next-day-text');
            const nextDayHoliday = document.getElementById('driver-next-day-holiday');

            if (nextDayInfo) {
                if (assignedBus.nextDayArrivalTime) {
                    nextDayInfo.classList.remove('hidden');
                    if (nextDayText) {
                        nextDayText.textContent = `Scheduled Next Day Arrival Time: ${assignedBus.nextDayArrivalTime}`;
                    }
                    if (nextDayHoliday) {
                        nextDayHoliday.textContent = `Tomorrow's Fleet State: ${assignedBus.nextDayState || 'NORMAL_COLLEGE'}`;
                    }
                } else {
                    nextDayInfo.classList.add('hidden');
                }
            }

            // Auto-restore active shift
            const wasShiftActive = localStorage.getItem('driverShiftActive');
            if (wasShiftActive === 'true' && !hasAutoRestored) {
                hasAutoRestored = true;
                const savedStart = localStorage.getItem('driverShiftStart');
                if (savedStart) {
                    shiftStartTime = new Date(savedStart);
                    console.log('🔄 Auto-restoring shift...');
                    startShift(true);
                }
            }
        });
    }

    function subscribeToBoardingsUpdates(busId) {
        const boardingsList = document.getElementById('boardings-list');
        if (!boardingsList) return;
        const dateStr = new Date().toISOString().split('T')[0];
        
        boardingsListenerUnsubscribe = (window.db || firebase.firestore()).collection(`buses/${busId}/boardings`)
            .onSnapshot(snapshot => {
                console.log(`📡 Boardings snapshot received. Count: ${snapshot.size || 0}`);
                boardingsList.innerHTML = '';
                const items = [];
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    // Filter for today's boardings
                    if (data.date !== dateStr && !docSnap.id.endsWith(`_${dateStr}`)) return;

                    let bTime = null;
                    try {
                        if (data.checkInTime) {
                            bTime = data.checkInTime.toDate ? data.checkInTime.toDate() : new Date(data.checkInTime);
                        } else {
                            bTime = new Date();
                        }
                    } catch (e) {
                        bTime = new Date();
                    }
                    items.push({ id: docSnap.id.split('_')[0], data, time: bTime });
                });

                items.sort((a, b) => b.time - a.time);

                if (items.length === 0) {
                    boardingsList.innerHTML = '<p style="text-align:center; color:#9ca3af; font-size:13px; padding:12px 0;">No passengers today.</p>';
                    return;
                }

                const escapeHTML = str => String(str).replace(/[&<>'"]/g, 
                    tag => ({
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        "'": '&#39;',
                        '"': '&quot;'
                    }[tag] || tag));

                items.forEach(item => {
                    const studentId = item.id;
                    const studentName = item.data.studentName || item.data.name || 'Unknown Student';
                    const routeName = item.data.routeName || item.data.busRoute || 'Not Assigned';
                    const timeStr = item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    const isCheckedOut = !!item.data.checkOutTime;
                    const statusColor = isCheckedOut ? '#f43f5e' : '#10b981';
                    const statusBg = isCheckedOut ? '#fff1f2' : '#ecfdf5';
                    const statusIcon = isCheckedOut ? 'logout' : 'login';
                    const statusText = isCheckedOut ? 'Checked Out' : 'Checked In';

                    const div = document.createElement('div');
                    div.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:12px; background:#f8fafc; border:1px solid #f1f5f9; border-radius:12px; margin-bottom:8px;";
                    div.innerHTML = `
                        <div style="min-width:0; flex:1;">
                            <p style="font-size:12px; font-weight:bold; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${escapeHTML(studentName)}</p>
                            <p style="font-size:9px; color:#94a3b8; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:2px 0 0 0;">ID: ${escapeHTML(studentId)} | Route: ${escapeHTML(routeName)}</p>
                        </div>
                        <div style="text-align:right; flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:4px; padding-left:8px;">
                            <div style="color:${statusColor}; background:${statusBg}; display:flex; align-items:center; gap:4px; padding:2px 6px; border-radius:6px; border:1px solid ${statusColor};">
                                <span class="material-symbols-outlined" style="font-size:12px; font-weight:bold;">${statusIcon}</span>
                                <span style="font-size:9px; font-weight:900; text-transform:uppercase;">${statusText}</span>
                            </div>
                            <span style="font-size:9px; font-weight:bold; color:#94a3b8;">${timeStr}</span>
                        </div>
                    `;
                    boardingsList.appendChild(div);
                });
            }, err => {
                console.warn("Boardings list unavailable:", err);
                boardingsList.innerHTML = '<p style="text-align:center; color:#9ca3af; font-size:13px; padding:12px 0;">Recent boardings are unavailable right now.</p>';
            });
    }

    // ─── Headcount UI ──────────────────────────────────────────────────────────
    const btnResetHeadcount = document.getElementById('btn-reset-headcount');

    function updateHeadcountUI() {
        if (!headcountCard) return;
        if (assignedBus) {
            headcountCard.style.opacity = '1';
            headcountCard.style.pointerEvents = 'auto';
            if (btnDecrementHeadcount) btnDecrementHeadcount.removeAttribute('disabled');
            if (btnIncrementHeadcount) btnIncrementHeadcount.removeAttribute('disabled');
            if (btnResetHeadcount) btnResetHeadcount.removeAttribute('disabled');
            if (headcountDisplay) headcountDisplay.removeAttribute('disabled');
        } else {
            headcountCard.style.opacity = '0.45';
            headcountCard.style.pointerEvents = 'none';
            if (btnDecrementHeadcount) btnDecrementHeadcount.setAttribute('disabled', 'true');
            if (btnIncrementHeadcount) btnIncrementHeadcount.setAttribute('disabled', 'true');
            if (btnResetHeadcount) btnResetHeadcount.setAttribute('disabled', 'true');
            if (headcountDisplay) headcountDisplay.setAttribute('disabled', 'true');
        }
    }

    if (btnIncrementHeadcount) {
        btnIncrementHeadcount.addEventListener('click', () => {
            if (!assignedBus) return;
            const cur = assignedBus.headcount || 0;
            if (cur >= 100) return;
            dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: cur + 1 }, { merge: true })
                .catch(err => console.error('Increment error:', err));
        });
    }

    if (btnDecrementHeadcount) {
        btnDecrementHeadcount.addEventListener('click', () => {
            if (!assignedBus) return;
            const cur = assignedBus.headcount || 0;
            if (cur <= 0) return;
            dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: cur - 1 }, { merge: true })
                .catch(err => console.error('Decrement error:', err));
        });
    }

    if (btnResetHeadcount) {
        btnResetHeadcount.addEventListener('click', () => {
            if (!assignedBus) return;
            dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: 0 }, { merge: true })
                .catch(err => console.error('Reset error:', err));
        });
    }

    if (headcountDisplay) {
        headcountDisplay.addEventListener('change', (e) => {
            if (!assignedBus) return;
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 100) val = 100;
            dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: val }, { merge: true })
                .catch(err => console.error('Manual change error:', err));
        });
    }

    // Deletion event delegation for boardings list
    const boardingsList = document.getElementById('boardings-list');
    if (boardingsList) {
        boardingsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-btn');
            if (btn) {
                const docId = btn.getAttribute('data-id');
                const studentId = btn.getAttribute('data-studentid');
                if (assignedBus && confirm("Are you sure you want to remove this passenger from the list?")) {
                    const dbRef = window.db || firebase.firestore();
                    dbRef.collection(`buses/${assignedBus.id}/boardings`).doc(docId).delete()
                        .then(() => {
                            const cur = assignedBus.headcount || 0;
                            const newVal = Math.max(0, cur - 1);
                            return dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: newVal }, { merge: true });
                        })
                        .then(() => {
                            if (studentId) {
                                delete dbReferenceLogs[studentId];
                                return clearSharedScanLock(studentId);
                            }
                        })
                        .then(() => {
                            showToast(true, "Passenger Removed", "Removed passenger and cleared their scan lock.");
                        })
                        .catch(err => {
                            console.error("Error removing passenger:", err);
                            showToast(false, "Removal Failed", err.message);
                        });
                }
            }
        });
    }

    // ─── Shift Toggle ──────────────────────────────────────────────────────────
    btnToggleShift.addEventListener('click', () => {
        if (!isTracking) startShift(); else stopShift();
    });

    // ─── Start Shift ───────────────────────────────────────────────────────────
    function startShift(isRestore = false) {
        if (!assignedBus) { alert('No bus configuration loaded. Please wait.'); return; }

        isTracking = true;
        updateHeadcountUI();

        if (isRestore) {
            const savedStart = localStorage.getItem('driverShiftStart');
            shiftStartTime  = savedStart ? new Date(savedStart) : new Date();
            activeSessionId = localStorage.getItem('driverActiveSessionId');
        } else {
            shiftStartTime = new Date();
            localStorage.setItem('driverShiftActive', 'true');
            localStorage.setItem('driverShiftStart', shiftStartTime.toISOString());
            dbHelper.getBusesCol().doc(assignedBus.id).set({ headcount: 0 }, { merge: true })
                .catch(err => console.error('Headcount reset error:', err));
        }

        // Update button → Stop
        btnToggleShift.className = 'btn-stop';
        btnIcon.textContent  = 'stop';
        btnLabel.textContent = 'Stop GPS Tracking';

        // Update GPS badge → Active
        gpsStatusBadge.className = 'active-badge';
        gpsStatusBadge.innerHTML = '<span class="active-dot"></span> Active';

        // Update signal area
        gpsSignalArea.className = 'gps-active-area';
        gpsAreaLabel.textContent = 'Streaming live location...';
        gpsAreaLabel.style.color = '#388e3c';

        // Update shift status
        if (shiftStatusDisplay) shiftStatusDisplay.textContent = 'On Shift';

        // Start timer
        timerInterval = setInterval(updateDuration, 1000);

        // Create Firestore session (new shift only)
        if (!isRestore) {
            dbHelper.getDriverSessionsCol().add({
                driverEmail:  driverEmail,
                driverName:   driverProfile ? (driverProfile.name || driverEmail) : driverEmail,
                busId:        assignedBus.id,
                busNumber:    assignedBus.number,
                route:        assignedBus.route,
                startTime:    firebase.firestore.FieldValue.serverTimestamp(),
                endTime:      null,
                status:       'Active'
            }).then(docRef => {
                activeSessionId = docRef.id;
                localStorage.setItem('driverActiveSessionId', activeSessionId);
                loadShiftsHistory();
            }).catch(err => console.error('Session create error:', err));
        }

        // GPS stream
        startGPSStream();

        // Start scanner if active tab is pass-scan
        const passScanTab = document.getElementById('sidebar-tab-pass-scan');
        if (passScanTab && passScanTab.classList.contains('active')) {
            startCameraScanner();
        }
    }

    // ─── Stop Shift ────────────────────────────────────────────────────────────
    function stopShift() {
        isTracking = false;
        updateHeadcountUI();

        stopGPSStream();
        stopCameraScanner();

        clearInterval(timerInterval);
        localStorage.removeItem('driverShiftActive');
        localStorage.removeItem('driverShiftStart');
        localStorage.removeItem('driverActiveSessionId');

        // Reset button
        btnToggleShift.className = 'btn-start';
        btnIcon.textContent  = 'play_arrow';
        btnLabel.textContent = 'Start GPS Tracking';

        // Reset GPS badge
        gpsStatusBadge.className = 'inactive-badge';
        gpsStatusBadge.innerHTML = '<span class="inactive-dot"></span> Inactive';

        // Reset signal area
        gpsSignalArea.className = 'gps-signal-area';
        gpsAreaLabel.textContent = 'Signal Ready: High Accuracy';
        gpsAreaLabel.style.color = '';

        // Reset stats
        latDisplay.textContent      = '0.0000';
        lngDisplay.textContent      = '0.0000';
        accuracyDisplay.textContent = '-- m';
        durationDisplay.textContent = '00:00:00';
        if (shiftStatusDisplay) shiftStatusDisplay.textContent = 'Shift Ready';

        // Update Firestore session
        if (activeSessionId) {
            dbHelper.getDriverSessionsCol().doc(activeSessionId).update({
                endTime: firebase.firestore.FieldValue.serverTimestamp(),
                status:  'Stopped'
            }).then(() => {
                activeSessionId = null;
                loadShiftsHistory();
            }).catch(err => console.error('Session stop error:', err));
        }

        // Update bus to Offline instead of Breakdown
        if (assignedBus) {
            dbHelper.getBusesCol().doc(assignedBus.id).set({
                status:     'Offline',
                lastUpdate: 'Shift ended',
                headcount:  0
            }, { merge: true }).catch(err => console.error('Bus stop error:', err));
        }
    }

    // ─── GPS Streams ──────────────────────────────────────────────────────────
    function startGPSStream() {
        if (!assignedBus) return;
        const useTracker = !!(assignedBus.tracking && assignedBus.tracking.trackerId);
        if (useTracker) {
            startTrackerGPS();
        } else {
            startPhoneGPS();
        }
    }

    function stopGPSStream() {
        if (watchId) {
            const useTracker = !!(assignedBus && assignedBus.tracking && assignedBus.tracking.trackerId);
            if (useTracker) clearInterval(watchId);
            else navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    }

    // ─── Duration Timer ────────────────────────────────────────────────────────
    function updateDuration() {
        const diff = new Date() - shiftStartTime;
        const hrs  = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        durationDisplay.textContent = `${hrs}:${mins}:${secs}`;
    }

    // ─── MapMyIndia IoT Tracker GPS ────────────────────────────────────────────
    function startTrackerGPS() {
        const trackerId = (assignedBus && assignedBus.tracking && assignedBus.tracking.trackerId) || (assignedBus && assignedBus.trackerId);
        if (!trackerId) {
            latDisplay.textContent = '--';
            lngDisplay.textContent = '--';
            accuracyDisplay.textContent = 'No Tracker Configured';
            return;
        }

        const pollTracker = async () => {
            try {
                const currentUser = firebase.auth().currentUser;
                const token = currentUser ? await currentUser.getIdToken() : '';
                const res = await fetch(`/api/bus-location?busId=${encodeURIComponent(assignedBus.id)}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.lat && data.lng) {
                        latDisplay.textContent = Number(data.lat).toFixed(6);
                        lngDisplay.textContent = Number(data.lng).toFixed(6);
                        accuracyDisplay.textContent = data.speed ? `${data.speed} km/h` : 'IoT Active';
                    } else {
                        latDisplay.textContent = '--';
                        lngDisplay.textContent = '--';
                        accuracyDisplay.textContent = 'Live location unavailable';
                    }
                } else {
                    latDisplay.textContent = '--';
                    lngDisplay.textContent = '--';
                    accuracyDisplay.textContent = 'Live location unavailable';
                }
            } catch (err) {
                console.warn('Tracker polling error:', err);
                latDisplay.textContent = '--';
                lngDisplay.textContent = '--';
                accuracyDisplay.textContent = 'Live location unavailable';
            }
        };

        pollTracker();
        watchId = setInterval(pollTracker, 10000);
    }

    // ─── Phone GPS ─────────────────────────────────────────────────────────────
    function startPhoneGPS() {
        if (!navigator.geolocation) {
            latDisplay.textContent = '--';
            lngDisplay.textContent = '--';
            accuracyDisplay.textContent = 'GPS Unavailable';
            return;
        }

        watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude: lat, longitude: lng, accuracy, speed } = position.coords;

                latDisplay.textContent      = lat.toFixed(6);
                lngDisplay.textContent      = lng.toFixed(6);
                accuracyDisplay.textContent = `±${Math.round(accuracy)}m`;

                dbHelper.getBusesCol().doc(assignedBus.id).set({
                    location:       { lat, lng },
                    status:         'On Time',
                    locationSource: 'driver_phone',
                    speed:          speed != null ? Math.round(speed * 3.6) : 0,
                    lastUpdate:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    updatedAt:      firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(err => console.error('Phone GPS write error:', err));
            },
            (error) => {
                console.warn('Phone GPS error:', error.message);
                latDisplay.textContent      = '--';
                lngDisplay.textContent      = '--';
                accuracyDisplay.textContent = 'GPS Unavailable';
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
        );
    }

    // ─── Camera QR Scanner Lifecycle ─────────────────────────────────────────
    const qrReaderPlaceholder = document.getElementById('qr-reader-placeholder');
    const scannerStatus = document.getElementById('scanner-status');
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const cameraBtnText = document.getElementById('camera-btn-text');
    const cameraBtnIcon = document.getElementById('camera-btn-icon');

    function startCameraScanner() {
        if (!assignedBus) {
            if (scannerStatus) {
                scannerStatus.textContent = "Bus details loading. Please wait...";
                scannerStatus.style.color = "#e53935";
            }
            return;
        }

        if (html5QrScanner && html5QrScanner.isScanning) {
            return;
        }

        if (qrReaderPlaceholder) qrReaderPlaceholder.style.display = 'none';
        if (scannerStatus) {
            scannerStatus.textContent = "Align student QR code inside the viewfinder";
            scannerStatus.style.color = "";
        }

        // Update button UI to scanning state (Matches reference)
        if (btnToggleCamera) btnToggleCamera.style.background = '#2563eb';
        if (cameraBtnText) cameraBtnText.textContent = "Stop Scanner Camera";
        const driverLaser = document.getElementById('driver-laser-line');
        if (driverLaser) driverLaser.style.display = 'block';

        const config = { 
            fps: 15, 
            qrbox: (width, height) => {
                const minEdge = Math.min(width, height);
                const qrboxSize = Math.max(180, Math.floor(minEdge * 0.75));
                return {
                    width: qrboxSize,
                    height: qrboxSize
                };
            }
        };
        html5QrScanner = new Html5Qrcode("qr-reader");

        html5QrScanner.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                console.log(`Driver Scanned QR: ${decodedText}`);
                handlePassScanInput(decodedText, true).catch(err => console.error("Scan error:", err));
            },
            (err) => {
                // Ignore verbose QR scanner logs
            }
        ).catch(err => {
            console.error("Failed to start camera feed:", err);
            if (scannerStatus) {
                scannerStatus.textContent = "Camera access failed/blocked by permissions.";
                scannerStatus.style.color = "#e53935";
            }
            stopCameraScanner();
        });
    }

    function stopCameraScanner() {
        if (qrReaderPlaceholder) qrReaderPlaceholder.style.display = 'flex';
        
        // Update button UI to idle state (Matches reference)
        if (btnToggleCamera) btnToggleCamera.style.background = '#2563eb';
        if (cameraBtnText) cameraBtnText.textContent = "Start Scanner Camera";
        const driverLaser = document.getElementById('driver-laser-line');
        if (driverLaser) driverLaser.style.display = 'none';

        if (html5QrScanner) {
            if (html5QrScanner.isScanning) {
                return html5QrScanner.stop().then(() => {
                    html5QrScanner = null;
                }).catch(err => {
                    console.error("Camera stop error:", err);
                    html5QrScanner = null;
                });
            } else {
                html5QrScanner = null;
            }
        }
        return Promise.resolve();
    }

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', () => {
            if (html5QrScanner && html5QrScanner.isScanning) {
                stopCameraScanner();
            } else {
                startCameraScanner();
            }
        });
    }

    const btnUploadQr = document.getElementById('btn-upload-qr');
    const qrFileInput = document.getElementById('qr-file-input');

    if (btnUploadQr && qrFileInput) {
        btnUploadQr.addEventListener('click', () => {
            qrFileInput.click();
        });

        qrFileInput.addEventListener('change', (e) => {
            if (e.target.files.length === 0) return;
            const file = e.target.files[0];
            
            // Stop camera scanner if it is currently active to avoid conflicts
            if (html5QrScanner && html5QrScanner.isScanning) {
                stopCameraScanner();
            }
            
            if (qrReaderPlaceholder) qrReaderPlaceholder.style.display = 'none';
            if (scannerStatus) {
                scannerStatus.textContent = "Processing gallery image...";
                scannerStatus.style.color = "#1d4ed8";
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });
                    
                    // Display uploaded image in the viewfinder
                    const viewfinder = document.getElementById('qr-reader');
                    if (viewfinder) {
                        viewfinder.innerHTML = '';
                        const displayCanvas = document.createElement('canvas');
                        displayCanvas.style.width = '100%';
                        displayCanvas.style.height = '100%';
                        displayCanvas.style.objectFit = 'contain';
                        displayCanvas.width = img.width;
                        displayCanvas.height = img.height;
                        const displayCtx = displayCanvas.getContext('2d');
                        displayCtx.drawImage(img, 0, 0);
                        viewfinder.appendChild(displayCanvas);
                    }
                    
                    if (code && code.data) {
                        console.log(`Driver Scanned file QR via jsQR: ${code.data}`);
                        handlePassScanInput(code.data, true).catch(err => console.error("Scan error:", err));
                        qrFileInput.value = "";
                    } else {
                        console.error("jsQR failed to decode QR code.");
                        playBeep(220, 300);
                        if (scannerStatus) {
                            scannerStatus.textContent = "Failed to find QR code in image.";
                            scannerStatus.style.color = "#e53935";
                        }
                        showToast(false, "Scanning Failed", "No valid QR code was detected in the selected image. Please make sure the screenshot is clear and not blurry.");
                        qrFileInput.value = "";
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ─── Pass Scanning Handler ───────────────────────────────────────────────
    let pendingCheckinStudent = null;

    async function handlePassScanInput(rawText, isCameraScan = false) {
        const toggleFastMode = document.getElementById('toggle-fast-mode');
        const isFastMode = toggleFastMode ? toggleFastMode.checked : true;

        if (isCameraScan && !isFastMode) {
            stopCameraScanner();
        }

        if (scannerStatus) {
            scannerStatus.textContent = "Verifying pass...";
            scannerStatus.style.color = "#2563eb";
        }

        if (rawText.length > 20 && !rawText.includes(' ')) {
            let payloadObject = null;
            try {
                const parts = rawText.split('.');
                payloadObject = JSON.parse(decodeURIComponent(escape(atob(parts[0]))));
            } catch (e) {
                payloadObject = null;
            }

            if (payloadObject && (payloadObject.studentId || payloadObject.collegeId)) {
                const studentId = payloadObject.studentId || payloadObject.collegeId;
                const studentName = payloadObject.name || payloadObject.studentName || 'Unknown';
                const routeName = payloadObject.routeName || payloadObject.busRoute || 'Not Assigned';

                // Check 4-Hour Anti-Loop Lock for JSON Passes
                /*
                const now = Date.now();
                const lastScanTime = dbReferenceLogs[studentId];
                if (lastScanTime !== undefined) {
                    const diffMs = now - lastScanTime;
                    const fourHoursMs = 4 * 60 * 60 * 1000;
                    if (diffMs < fourHoursMs) {
                        const remainingSecs = Math.ceil((fourHoursMs - diffMs) / 1000);
                        const reason = `4-Hour Anti-Loop Lock active. Cooldown: ${remainingSecs}s`;
                        playBeep(220, 300);
                        if (scannerStatus) {
                            scannerStatus.textContent = reason;
                            scannerStatus.style.color = "#e53935";
                        }
                        showToast(false, "Verification Denied", reason);
                        return;
                    }
                }
                */

                const matchedStudent = {
                    id: studentId,
                    name: studentName,
                    collegeId: studentId.substring(0, 8),
                    busRoute: routeName,
                    passValidity: '31 Dec 2026'
                };

                try {
                    if (isFastMode) {
                        // const sharedLock = await ensureSharedLockClear(matchedStudent);
                        // if (!sharedLock.allowed) return;
                        processBoardingScan(matchedStudent, "Verified QR JSON");
                    } else {
                        showConfirmationModal(matchedStudent, true, rawText);
                    }
                    
                    if (scannerStatus) {
                        scannerStatus.textContent = `Verified: ${studentName}`;
                        scannerStatus.style.color = "#2e7d32";
                    }
                } catch (err) {
                    console.error("Verification error:", err);
                    showToast(false, "Verification Error", err.message);
                    if (scannerStatus) {
                        scannerStatus.textContent = "Error: " + err.message;
                        scannerStatus.style.color = "#e53935";
                    }
                }
                return;
            }
        }

        // 2. Database lookups (Simulator or search)
        const queryText = rawText.trim().toLowerCase();
        const cleanCode = queryText.replace('cambus-', '');

        dbHelper.getUsersCol()
            .get()
            .then(async snapshot => {
                let matchedStudent = null;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const sId = (data.collegeId || '').toString().toLowerCase();
                    const sQr = (data.qrCode || `CAMBUS-${data.collegeId}`).toLowerCase();
                    const enroll = (data.enrollment || '').toString().toLowerCase();
                    const email = (data.email || doc.id || '').toString().toLowerCase();

                    if (sQr === queryText || sId === cleanCode || enroll === cleanCode || email === queryText) {
                        matchedStudent = { id: doc.id, ...data };
                    }
                });

                if (!matchedStudent) {
                    playBeep(220, 300);
                    const reason = "Student not found in registry.";
                    if (scannerStatus) {
                        scannerStatus.textContent = reason;
                        scannerStatus.style.color = "#e53935";
                    }
                    if (isFastMode) {
                        showToast(false, "Access Denied", reason);
                    } else {
                        showConfirmationModal(null, false, rawText, reason);
                    }
                    return;
                }

                // Enforce Multi-Tenant Domain isolation for DB Search
                const studentEmail = (matchedStudent.email || matchedStudent.id || '').toLowerCase().trim();
                const studentDomain = studentEmail.includes('@') ? studentEmail.split('@')[1] : '';
                if (allowedDomains && allowedDomains.length > 0) {
                    if (!studentDomain || !allowedDomains.includes(studentDomain)) {
                        playBeep(220, 300);
                        const reason = `Scan rejected. Student domain (${studentDomain || 'unknown'}) is not authorized for this institute.`;
                        if (scannerStatus) {
                            scannerStatus.textContent = reason;
                            scannerStatus.style.color = "#e53935";
                        }
                        if (isFastMode) {
                            showToast(false, "Access Denied", reason);
                        } else {
                            showConfirmationModal(matchedStudent, false, rawText, reason);
                        }
                        return;
                    }
                }

                // Check pass validity
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let validityDate = null;
                if (matchedStudent.passValidity) {
                    validityDate = new Date(matchedStudent.passValidity);
                }
                const isExpired = validityDate && validityDate < today;

                if (isExpired) {
                    playBeep(220, 300);
                    const reason = `Pass Expired on ${validityDate.toLocaleDateString()}`;
                    if (scannerStatus) {
                        scannerStatus.textContent = reason;
                        scannerStatus.style.color = "#e53935";
                    }
                    if (isFastMode) {
                        showToast(false, "Pass Expired", reason);
                    } else {
                        showConfirmationModal(matchedStudent, false, rawText, "Pass Expired");
                    }
                    if (scannerStatus) {
                        scannerStatus.textContent = `Expired: ${matchedStudent.name || 'Student'} | ${validityDate.toLocaleDateString()}`;
                        scannerStatus.style.color = "#e53935";
                    }
                    return;
                }

                // Check 4-Hour Anti-Loop Lock for Database Search check-ins
                /*
                const sId = matchedStudent.id || matchedStudent.collegeId || 'Unknown';
                const now = Date.now();
                const lastScanTime = dbReferenceLogs[sId];
                if (lastScanTime !== undefined) {
                    const diffMs = now - lastScanTime;
                    const fourHoursMs = 4 * 60 * 60 * 1000;
                    if (diffMs < fourHoursMs) {
                        const remainingSecs = Math.ceil((fourHoursMs - diffMs) / 1000);
                        const reason = `4-Hour Anti-Loop Lock active. Cooldown: ${remainingSecs}s`;
                        playBeep(220, 300);
                        if (scannerStatus) {
                            scannerStatus.textContent = reason;
                            scannerStatus.style.color = "#e53935";
                        }
                        if (isFastMode) {
                            showToast(false, "Access Denied", reason);
                        } else {
                            showConfirmationModal(matchedStudent, false, rawText, reason);
                        }
                        return;
                    }
                }
                */

                // Success
                if (isFastMode) {
                    // const sharedLock = await ensureSharedLockClear(matchedStudent);
                    // if (!sharedLock.allowed) return;
                    processBoardingScan(matchedStudent, "Verified DB Search");
                } else {
                    showConfirmationModal(matchedStudent, true, rawText);
                }
            })
            .catch(err => {
                console.error("Verification database search error:", err);
                playBeep(220, 300);
                showToast(false, "Database Error", err.message);
            });
    }

    async function processBoardingScan(student, type) {
        if (!assignedBus) return;
        const modeObj = document.querySelector('input[name="scan_mode"]:checked');
        const mode = modeObj ? modeObj.value : 'checkin';
        
        if (mode === 'verify') {
            playBeep(880, 150);
            showToast(true, "Verified", `${student.name || student.studentName} pass is valid.`);
            if (scannerStatus) {
                scannerStatus.textContent = `Verified: ${student.name || student.studentName}`;
                scannerStatus.style.color = "#3b82f6";
            }
            return;
        }

        const sId = student.id || student.collegeId || 'Unknown';
        const busNumber = assignedBus.number || assignedBus.id;
        const dateStr = new Date().toISOString().split('T')[0];
        const logRef = (window.db || firebase.firestore()).collection(`buses/${assignedBus.id}/boardings`).doc(`${sId}_${dateStr}`);
        
        try {
            const snap = await logRef.get();
            const data = snap.exists ? snap.data() : null;
            const busRef = dbHelper.getBusesCol().doc(assignedBus.id);

            if (mode === 'checkin') {
                if (data && data.checkInTime) {
                    playBeep(220, 300);
                    showToast(false, "Check-In Denied", "Student already checked in today.");
                    if(scannerStatus) {
                        scannerStatus.textContent = "Already Checked In";
                        scannerStatus.style.color = "#ef4444";
                    }
                    return;
                }
                
                await busRef.set({ headcount: firebase.firestore.FieldValue.increment(1) }, { merge: true });
                await logRef.set({
                    studentId: sId,
                    studentName: student.name || student.studentName || 'Unknown',
                    busNumber: busNumber,
                    checkInTime: firebase.firestore.FieldValue.serverTimestamp(),
                    checkInBus: assignedBus.id,
                    date: dateStr,
                    routeName: student.busRoute || student.routeName || 'Not Assigned'
                }, { merge: true });

                playBeep(880, 150);
                showToast(true, "Checked In", `${student.name || student.studentName} checked in.`);
                if (scannerStatus) {
                    scannerStatus.textContent = `Checked In: ${student.name || student.studentName}`;
                    scannerStatus.style.color = "#10b981";
                }
                
            } else if (mode === 'checkout') {
                if (!data || !data.checkInTime) {
                    playBeep(220, 300);
                    showToast(false, "Check-Out Denied", "Student hasn't checked in yet.");
                    if(scannerStatus) {
                        scannerStatus.textContent = "Not Checked In";
                        scannerStatus.style.color = "#ef4444";
                    }
                    return;
                }
                if (data.checkOutTime) {
                    playBeep(220, 300);
                    showToast(false, "Check-Out Denied", "Student already checked out today.");
                    if(scannerStatus) {
                        scannerStatus.textContent = "Already Checked Out";
                        scannerStatus.style.color = "#ef4444";
                    }
                    return;
                }
                
                await busRef.set({ headcount: firebase.firestore.FieldValue.increment(-1) }, { merge: true });
                await logRef.update({
                    checkOutTime: firebase.firestore.FieldValue.serverTimestamp(),
                    checkOutBus: assignedBus.id
                });

                playBeep(880, 150);
                showToast(true, "Checked Out", `${student.name || student.studentName} checked out.`);
                if (scannerStatus) {
                    scannerStatus.textContent = `Checked Out: ${student.name || student.studentName}`;
                    scannerStatus.style.color = "#f43f5e";
                }
            }
        } catch (err) {
            console.error("Boarding log failed:", err);
            playBeep(220, 300);
            showToast(false, "System Error", err.message);
        }
    }

    // ─── Confirmation Modal Logic ────────────────────────────────────────────
    const modalConfirmCheckin = document.getElementById('modal-confirm-checkin');
    const confirmStudentDetails = document.getElementById('confirm-student-details');
    const btnActionConfirm = document.getElementById('btn-action-confirm');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    const btnCloseConfirm = document.getElementById('btn-close-confirm');

    function showConfirmationModal(student, isValid, rawText = '', errorDetails = '') {
        pendingCheckinStudent = student;
        if (!modalConfirmCheckin || !confirmStudentDetails) return;

        if (!student) {
            confirmStudentDetails.innerHTML = `
                <div style="text-align:center; padding:16px; background:#ffebeb; border:1px solid #fed7d7; border-radius:12px; color:#e53935;">
                    <span class="material-symbols-outlined" style="font-size:48px;">warning</span>
                    <h4 style="font-weight:700; margin-top:8px;">UNREGISTERED PASS</h4>
                    <p style="font-size:12px; margin-top:4px;">No student profile corresponds to this scan.</p>
                    <p style="font-family:monospace; font-size:11px; margin-top:8px; background:#ffd1d1; padding:4px 8px; border-radius:6px; word-break:break-all;">${rawText}</p>
                    ${errorDetails ? `<p style="font-size:10px; font-weight:700; text-transform:uppercase; margin-top:8px;">${errorDetails}</p>` : ''}
                </div>
            `;
            if (btnActionConfirm) btnActionConfirm.style.display = 'none';
        } else if (!isValid) {
            confirmStudentDetails.innerHTML = `
                <div style="text-align:center; padding:16px; background:#fff3e0; border:1px solid #ffe0b2; border-radius:12px; color:#e65100;">
                    <span class="material-symbols-outlined" style="font-size:48px;">report_problem</span>
                    <h4 style="font-weight:700; margin-top:8px;">INVALID PASS</h4>
                    <p style="font-size:12px; margin-top:4px;">Reason: ${errorDetails}</p>
                    <div style="text-align:left; margin-top:12px; font-size:12px; border-top:1px solid #ffd1a9; padding-top:8px;">
                        <p><strong>Name:</strong> ${student.name || 'N/A'}</p>
                        <p><strong>Status:</strong> Expired or invalid</p>
                    </div>
                </div>
            `;
            if (btnActionConfirm) {
                btnActionConfirm.style.display = 'block';
                btnActionConfirm.textContent = 'Override & Add (+1)';
                btnActionConfirm.className = 'btn-modal-confirm';
                btnActionConfirm.style.background = '#e65100';
            }
        } else {
            const validityText = student.passValidity || '31 Dec 2026';
            confirmStudentDetails.innerHTML = `
                <div style="padding:4px; color:#1a1a2e;">
                    <div style="display:flex; align-items:center; gap:12px; background:#e8f5e9; border:1px solid #c8e6c9; padding:12px; border-radius:12px; margin-bottom:12px;">
                        <div style="width:40px; height:40px; border-radius:50%; background:#2e7d32; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700;">
                            ${(student.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 style="font-weight:700; margin:0; color:#2e7d32;">${student.name || 'N/A'}</h4>
                            <p style="font-size:11px; margin:2px 0 0; color:#43a047; font-weight:600;">Verified | Valid till ${validityText}</p>
                        </div>
                    </div>
                    <div style="font-size:12px; display:flex; flex-direction:column; gap:6px;">
                        <p style="margin:0; display:flex; justify-content:space-between;"><span style="color:#6b7280;">Status:</span> <span style="font-weight:600;">Verified</span></p>
                        <p style="margin:0; display:flex; justify-content:space-between;"><span style="color:#6b7280;">Validity:</span> <span style="font-weight:600;">${validityText}</span></p>
                    </div>
                </div>
            `;
            if (btnActionConfirm) {
                btnActionConfirm.style.display = 'block';
                btnActionConfirm.textContent = 'Confirm & Add (+1)';
                btnActionConfirm.className = 'btn-modal-confirm';
                btnActionConfirm.style.background = '#2e7d32';
            }
        }

        if (modalConfirmCheckin) {
            modalConfirmCheckin.classList.add('flex');
            modalConfirmCheckin.classList.remove('hidden');
        }
    }

    function closeConfirmModal() {
        if (modalConfirmCheckin) {
            modalConfirmCheckin.classList.remove('flex');
            modalConfirmCheckin.classList.add('hidden');
        }
        pendingCheckinStudent = null;
        
        // Return/resume scanning by making sure we start the scanner again if we are still on the pass-scan tab
        const passScanTab = document.getElementById('sidebar-tab-pass-scan');
        if (passScanTab && passScanTab.classList.contains('active')) {
            startCameraScanner();
        }
    }

    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirmModal);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirmModal);
    if (btnActionConfirm) {
        btnActionConfirm.addEventListener('click', () => {
            if (pendingCheckinStudent) {
                processBoardingScan(pendingCheckinStudent, "Modal Boarding");
            }
            closeConfirmModal();
        });
    }

    // ─── Simulator & Search Controls ─────────────────────────────────────────
    const btnSimScan = document.getElementById('btn-sim-scan');
    const simCollegeId = document.getElementById('sim-college-id');
    const btnVerifyStudent = document.getElementById('btn-verify-student');
    const inputVerifyStudent = document.getElementById('input-verify-student');

    if (btnSimScan && simCollegeId) {
        btnSimScan.addEventListener('click', () => {
            const val = simCollegeId.value.trim();
            if (!val) {
                showToast(false, "Input Required", "Please enter a valid pass QR payload or Student ID.");
                playBeep(220, 300);
                return;
            }
            handlePassScanInput(val, false).catch(err => console.error("Scan error:", err));
        });
        simCollegeId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnSimScan.click();
            }
        });
    }

    if (btnVerifyStudent && inputVerifyStudent) {
        btnVerifyStudent.addEventListener('click', () => {
            const val = inputVerifyStudent.value.trim();
            if (!val) {
                showToast(false, "Input Required", "Please enter student email or enrollment ID.");
                playBeep(220, 300);
                return;
            }
            handlePassScanInput(val, false).catch(err => console.error("Scan error:", err));
        });
        inputVerifyStudent.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnVerifyStudent.click();
            }
        });
    }

    // ─── Toast & Audio Beep Helpers ──────────────────────────────────────────
    let toastTimer = null;
    function showToast(success, title, msg) {
        const toast = document.getElementById('toast-verify-result');
        const icon = document.getElementById('toast-verify-icon');
        const toastTitle = document.getElementById('toast-verify-title');
        const toastMsg = document.getElementById('toast-verify-msg');
        
        if (!toast) return;
        if (toastTimer) clearTimeout(toastTimer);

        if (toastTitle) toastTitle.textContent = title;
        if (toastMsg) toastMsg.textContent = msg;

        if (success) {
            toast.style.background = '#0f172a'; // dark slate
            if (icon) {
                icon.textContent = 'check_circle';
                icon.style.color = '#4ade80'; // green
            }
        } else {
            toast.style.background = '#991b1b'; // dark red
            if (icon) {
                icon.textContent = 'cancel';
                icon.style.color = '#f87171'; // red
            }
        }

        toast.style.transform = 'translate(-50%, 0)';
        toast.style.opacity = '1';

        toastTimer = setTimeout(() => {
            toast.style.transform = 'translate(-50%, -120px)';
            toast.style.opacity = '0';
        }, 4000);
    }

    function playBeep(frequency, duration) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            
            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, duration);
        } catch (e) {
            console.log("Audio feedback skipped.");
        }
    }

    // ─── Support Ticket submission ──────────────────────────────────────────
    const formSupportTicket = document.getElementById('form-support-ticket');
    if (formSupportTicket) {
        formSupportTicket.addEventListener('submit', (e) => {
            e.preventDefault();
            const subject = document.getElementById('support-subject').value.trim();
            const description = document.getElementById('support-description').value.trim();
            if (!subject || !description) {
                alert('Please fill out all fields.');
                return;
            }

            const submitBtn = formSupportTicket.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            db.collection('support-queries').add({
                subject: subject,
                description: description,
                studentName: driverProfile ? (driverProfile.name || driverEmail) : driverEmail,
                studentEnrollment: driverEmail,
                category: 'Driver Assistance',
                status: 'Pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                alert('✅ Support ticket submitted successfully.');
                formSupportTicket.reset();
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Submit Ticket';
            }).catch(err => {
                console.error("Error submitting support query:", err);
                alert('Error submitting query: ' + err.message);
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">send</span> Submit Ticket';
            });
        });
    }

    // ─── Alert Form ────────────────────────────────────────────────────────────
    formDriverAlert.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!assignedBus) { alert('No bus assigned. Cannot send alert.'); return; }

        const type    = driverAlertType.value;
        const message = driverAlertMessage.value.trim();
        if (!message) { alert('Please enter a message.'); return; }

        const btn = document.getElementById('btn-send-alert');
        btn.disabled     = true;
        btn.textContent  = 'Broadcasting...';

        dbHelper.getNotificationsCol().add({
            type:          type,
            message:       message,
            targetRouteId: assignedBus.route,
            createdAt:     firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert('✅ Alert broadcasted to route: ' + assignedBus.route);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:17px;">send</span> Send Alert';
        }).catch(err => {
            alert('Error: ' + err.message);
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:17px;">send</span> Send Alert';
        });
    });

    // ─── Shift History ─────────────────────────────────────────────────────────
    function loadShiftsHistory() {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        dbHelper.getDriverSessionsCol()
            .where('driverEmail', '==', driverEmail)
            .get()
            .then(snapshot => {
                historyList.innerHTML = '';
                const sessions = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.startTime) {
                        const sTime = data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime);
                        if (sTime >= todayStart) {
                            sessions.push({ id: doc.id, ...data, sTime });
                        }
                    }
                });

                // Sort descending (most recent first)
                sessions.sort((a, b) => b.sTime - a.sTime);

                if (sessions.length === 0) {
                    historyList.innerHTML = '<p style="text-align:center; color:#9ca3af; font-size:13px; padding:12px 0;">No shift logs recorded today.</p>';
                    return;
                }

                sessions.forEach(data => {
                    const startStr = data.sTime ? data.sTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                    const endTimeVal = data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime)) : null;
                    const endStr   = endTimeVal ? endTimeVal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active';
                    const isActive = data.status === 'Active';
                    const item     = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <div>
                            <p style="font-size:13px; font-weight:700; color:#1a1a2e;">Bus ${data.busNumber || '--'}</p>
                            <p style="font-size:11px; color:#9ca3af;">${data.route || '--'}</p>
                        </div>
                        <div style="text-align:right;">
                            <p style="font-size:12px; font-weight:600; color:#374151;">${startStr} – ${endStr}</p>
                            <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:5px; background:${isActive ? '#e8f5e9' : '#f3f4f6'}; color:${isActive ? '#2e7d32' : '#6b7280'};">${data.status}</span>
                        </div>`;
                    historyList.appendChild(item);
                });
            }).catch(err => console.error('History error:', err));
    }

    loadShiftsHistory();

    // =========================================================================
    // 9. Export CSV Logic
    // =========================================================================
    const exportBtn = document.createElement('button');
    exportBtn.className = "text-[10px] bg-slate-800 text-white font-bold py-1 px-3 rounded-lg uppercase tracking-wider shadow-sm hover:bg-slate-700 ml-auto";
    exportBtn.style.cssText = "font-size:10px; background:#1e293b; color:#fff; font-weight:bold; padding:4px 12px; border-radius:8px; text-transform:uppercase; letter-spacing:0.05em; border:none; cursor:pointer;";
    exportBtn.innerHTML = '<span class="material-symbols-outlined text-[14px] align-middle mr-1" style="font-size:14px; vertical-align:middle; margin-right:4px;">download</span> Export CSV';
    exportBtn.onclick = async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        try {
            const snap = await getFirestoreDb().collection(`daily_boardings/${dateStr}/logs`).get();
            let csv = "Student ID,Name,Check-In Bus,Check-In Time,Check-Out Bus,Check-Out Time\n";
            snap.forEach(doc => {
                const d = doc.data();
                const ciTime = d.checkInTime && d.checkInTime.toDate ? d.checkInTime.toDate().toLocaleString() : '';
                const coTime = d.checkOutTime && d.checkOutTime.toDate ? d.checkOutTime.toDate().toLocaleString() : '';
                csv += `"${d.studentId || doc.id}","${d.studentName || ''}","${d.checkInBus || ''}","${ciTime}","${d.checkOutBus || ''}","${coTime}"\n`;
            });
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('href', url);
            a.setAttribute('download', `boardings_${dateStr}.csv`);
            a.click();
        } catch (e) {
            alert("Error exporting CSV: " + e.message);
        }
    };
    
    setTimeout(() => {
        const boardingsHeader = document.querySelector('#boardings-list').previousElementSibling;
        if (boardingsHeader) {
            boardingsHeader.style.display = 'flex';
            boardingsHeader.style.alignItems = 'center';
            boardingsHeader.appendChild(exportBtn);
        }
    }, 500);

});
