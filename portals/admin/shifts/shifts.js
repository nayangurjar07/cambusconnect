// shifts.js - Shift Management & Live Fleet Monitoring for Cambus Connect

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on shifts panel:", err);
    }
    initShiftPanel();

    function initShiftPanel() {
        const db = firebase.firestore();

        // -------------------------------------------------------------------------
        // A. Tab Toggle Navigation Logic
        // -------------------------------------------------------------------------
        const tabs = {
            'tab-live': 'view-live',
            'tab-history': 'view-history',
            'tab-settings': 'view-settings',
            'tab-submitted': 'view-submitted'
        };

        Object.keys(tabs).forEach(tabId => {
            const btn = document.getElementById(tabId);
            if (!btn) return;
            btn.addEventListener('click', () => {
                Object.keys(tabs).forEach(id => {
                    const currentBtn = document.getElementById(id);
                    const currentView = document.getElementById(tabs[id]);
                    if (id === tabId) {
                        currentBtn.classList.add('border-primary', 'text-primary');
                        currentBtn.classList.remove('border-transparent', 'text-slate-500');
                        currentView.classList.remove('hidden');
                    } else {
                        currentBtn.classList.remove('border-primary', 'text-primary');
                        currentBtn.classList.add('border-transparent', 'text-slate-500');
                        currentView.classList.add('hidden');
                    }
                });
            });
        });


        // -------------------------------------------------------------------------
        // B. Active Fleet & Live Headcounts Logic
        // -------------------------------------------------------------------------
        const activeRunsContainer = document.getElementById('active-runs-container');
        const activeEmptyState = document.getElementById('active-empty-state');
        const kpiActiveRuns = document.getElementById('kpi-active-runs');
        const kpiTotalHeadcount = document.getElementById('kpi-total-headcount');

        let busesMap = {};
        let activeSessions = [];

        // Real-time listener for buses (captures real-time headcount updates)
        dbHelper.getBusesCol().onSnapshot(snapshot => {
            busesMap = {};
            snapshot.forEach(doc => {
                busesMap[doc.id] = { id: doc.id, ...doc.data() };
            });
            renderActiveRuns();
        }, err => {
            console.error("❌ Error loading buses for live shifts:", err);
        });

        // Real-time listener for active sessions
        dbHelper.getDriverSessionsCol().where('status', '==', 'Active').onSnapshot(snapshot => {
            activeSessions = [];
            snapshot.forEach(doc => {
                activeSessions.push({ id: doc.id, ...doc.data() });
            });
            renderActiveRuns();
        }, err => {
            console.error("❌ Error loading active sessions:", err);
        });

        function renderActiveRuns() {
            if (!activeRunsContainer) return;
            activeRunsContainer.innerHTML = '';

            let totalOnboard = 0;
            const activeCount = activeSessions.length;

            if (activeCount === 0) {
                if (activeEmptyState) activeEmptyState.classList.remove('hidden');
                activeRunsContainer.classList.add('hidden');
            } else {
                if (activeEmptyState) activeEmptyState.classList.add('hidden');
                activeRunsContainer.classList.remove('hidden');

                activeSessions.forEach(session => {
                    const busData = busesMap[session.busId] || {};
                    const headcount = typeof busData.headcount !== 'undefined' ? busData.headcount : (session.headcount || 0);
                    totalOnboard += headcount;

                    // Resolve Crew Details
                    const driverName = session.driverName || busData.driver || 'No Driver';
                    const driverPhone = session.driverPhone || busData.phone || 'N/A';
                    const conductorName = session.conductorName || busData.conductor || 'No Conductor';
                    const conductorPhone = session.conductorPhone || busData.conductorPhone || 'N/A';
                    const route = session.route || busData.route || 'No Route';
                    const busNumber = session.busNumber || busData.number || '--';

                    const startTimeStr = session.startTime ? new Date(session.startTime.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                    const card = document.createElement('div');
                    card.className = 'bg-white rounded-3xl p-6 shadow-md border border-slate-200/60 transition-all hover:shadow-xl relative overflow-hidden';
                    card.innerHTML = `
                        <!-- Live Pulse Badge -->
                        <div class="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-bl-2xl flex items-center gap-1 shadow-sm">
                            <span class="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                            <span>Live</span>
                        </div>
                        
                        <div class="flex items-start justify-between mb-4 pr-12">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20">
                                    ${escapeHtml(busNumber)}
                                </div>
                                <div>
                                    <h3 class="font-extrabold text-slate-800 text-base">Bus ${escapeHtml(busNumber)}</h3>
                                    <p class="text-[10px] text-slate-400 font-bold mt-0.5">Started at ${escapeHtml(startTimeStr)}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Riders</span>
                                <span class="text-2xl font-black text-indigo-600 block mt-0.5">${escapeHtml(headcount)}</span>
                            </div>
                        </div>
                        
                        <div class="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl mb-4">
                            <span class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Active Route</span>
                            <span class="text-sm font-bold text-slate-700 block line-clamp-1" title="${escapeHtml(route)}">${escapeHtml(route)}</span>
                        </div>
                        
                        <div class="space-y-2.5 border-t border-slate-100 pt-3.5">
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2 text-slate-500 font-semibold">
                                    <span class="material-symbols-outlined text-[18px]">badge</span>
                                    <span>Driver:</span>
                                </div>
                                <span class="font-bold text-slate-800">${escapeHtml(driverName)} (${escapeHtml(driverPhone)})</span>
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                <div class="flex items-center gap-2 text-slate-500 font-semibold">
                                    <span class="material-symbols-outlined text-[18px]">assignment_ind</span>
                                    <span>Conductor:</span>
                                </div>
                                <span class="font-bold text-slate-800">${escapeHtml(conductorName)} (${escapeHtml(conductorPhone)})</span>
                            </div>
                            <div class="flex items-center justify-between text-[10px] border-t border-slate-100/60 pt-2.5 mt-2.5 text-slate-400 font-bold">
                                <div class="flex items-center gap-1">
                                    <span class="material-symbols-outlined text-[14px]">person</span>
                                    <span>Logged by:</span>
                                </div>
                                <span class="font-extrabold text-slate-600">${escapeHtml(session.driverEmail || 'N/A')}</span>
                            </div>
                        </div>
                    `;
                    activeRunsContainer.appendChild(card);
                });
            }

            if (kpiActiveRuns) kpiActiveRuns.textContent = activeCount;
            if (kpiTotalHeadcount) kpiTotalHeadcount.textContent = totalOnboard;
        }


        // -------------------------------------------------------------------------
        // C. Shift History Log Logic
        // -------------------------------------------------------------------------
        const historyTableBody = document.getElementById('history-table-body');
        const historyEmptyState = document.getElementById('history-empty-state');
        const searchHistory = document.getElementById('search-history');
        const filterDate = document.getElementById('filter-date');
        const btnClearFilters = document.getElementById('btn-clear-filters');

        let shiftSessions = [];

        // Setup real-time listener for history log (scoped query - only 'Stopped' sessions, limited)
        dbHelper.getDriverSessionsCol()
            .where('status', '==', 'Stopped')
            .orderBy('startTime', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
            shiftSessions = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                shiftSessions.push({ id: doc.id, ...data });
            });

            // Already sorted by Firestore query (startTime desc)

            renderHistoryLogs();
        }, err => {
            console.error("❌ Error loading history sessions:", err);
        });

        function renderHistoryLogs() {
            if (!historyTableBody) return;
            historyTableBody.innerHTML = '';

            const searchVal = searchHistory ? searchHistory.value.toLowerCase().trim() : '';
            const dateVal = filterDate ? filterDate.value : '';

            const filtered = shiftSessions.filter(session => {
                const busNum = (session.busNumber || '').toString().toLowerCase();
                const route = (session.route || '').toLowerCase();
                const driver = (session.driverName || '').toLowerCase();
                const conductor = (session.conductorName || '').toLowerCase();
                const email = (session.driverEmail || '').toLowerCase();

                const matchesSearch = !searchVal ||
                    busNum.includes(searchVal) ||
                    route.includes(searchVal) ||
                    driver.includes(searchVal) ||
                    conductor.includes(searchVal) ||
                    email.includes(searchVal);

                let matchesDate = true;
                if (dateVal && session.startTime) {
                    const sessionDate = session.startTime.toDate();
                    const filterDateObj = new Date(dateVal);
                    matchesDate =
                        sessionDate.getFullYear() === filterDateObj.getFullYear() &&
                        sessionDate.getMonth() === filterDateObj.getMonth() &&
                        sessionDate.getDate() === filterDateObj.getDate();
                }

                return matchesSearch && matchesDate;
            });

            if (filtered.length === 0) {
                if (historyEmptyState) historyEmptyState.classList.remove('hidden');
                historyTableBody.closest('table').classList.add('hidden');
                return;
            }

            if (historyEmptyState) historyEmptyState.classList.add('hidden');
            historyTableBody.closest('table').classList.remove('hidden');

            filtered.forEach(session => {
                const start = session.startTime ? session.startTime.toDate() : null;
                const end = session.endTime ? session.endTime.toDate() : null;

                const startStr = start ? start.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                const endStr = end ? end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';

                let durationStr = '--';
                if (start && end) {
                    const diffMins = Math.round((end - start) / 60000);
                    if (diffMins >= 60) {
                        const hrs = Math.floor(diffMins / 60);
                        const mins = diffMins % 60;
                        durationStr = `${hrs}h ${mins}m`;
                    } else {
                        durationStr = `${diffMins}m`;
                    }
                }

                const driver = session.driverName || 'No Driver';
                const driverPhone = session.driverPhone || 'N/A';
                const conductor = session.conductorName || 'No Conductor';
                const conductorPhone = session.conductorPhone || 'N/A';

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
                row.innerHTML = `
                    <td class="p-5 font-bold text-slate-800">
                        <div class="flex items-center gap-2">
                            <span class="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-700 font-extrabold text-xs">
                                ${escapeHtml(session.busNumber || '--')}
                            </span>
                            <div>
                                <p class="text-sm font-extrabold text-slate-800">Bus ${escapeHtml(session.busNumber || '--')}</p>
                                <p class="text-xs text-slate-400 font-semibold truncate max-w-[240px]" title="${escapeHtml(session.route || '')}">${escapeHtml(session.route || '--')}</p>
                            </div>
                        </div>
                    </td>
                    <td class="p-5">
                        <div class="space-y-1 text-xs">
                            <div class="flex items-center gap-1.5 text-slate-600 font-medium">
                                <span class="material-symbols-outlined text-[16px] text-slate-400">badge</span>
                                <span>Driver:</span>
                                <span class="font-bold text-slate-800">${escapeHtml(driver)} (${escapeHtml(driverPhone)})</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-slate-600 font-medium">
                                <span class="material-symbols-outlined text-[16px] text-slate-400">assignment_ind</span>
                                <span>Conductor:</span>
                                <span class="font-bold text-slate-800">${escapeHtml(conductor)} (${escapeHtml(conductorPhone)})</span>
                            </div>
                        </div>
                    </td>
                    <td class="p-5">
                        <p class="text-xs font-bold text-slate-800">${escapeHtml(startStr)} - ${escapeHtml(endStr)}</p>
                        <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">Duration: ${escapeHtml(durationStr)}</p>
                    </td>
                    <td class="p-5 text-center">
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-extrabold shadow-sm border border-indigo-100/50">
                            <span class="material-symbols-outlined text-[14px]">groups</span>
                            <span>${session.headcount || 0}</span>
                        </span>
                    </td>
                    <td class="p-5">
                        <span class="text-xs text-slate-500 font-bold block">${escapeHtml(session.driverEmail || 'N/A')}</span>
                    </td>
                `;
                historyTableBody.appendChild(row);
            });
        }

        if (searchHistory) searchHistory.addEventListener('input', renderHistoryLogs);
        if (filterDate) filterDate.addEventListener('change', renderHistoryLogs);
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                if (searchHistory) searchHistory.value = '';
                if (filterDate) filterDate.value = '';
                renderHistoryLogs();
            });
        }


        // -------------------------------------------------------------------------
        // D. Shift Configuration Settings (Original Settings Form Logic)
        // -------------------------------------------------------------------------
        const form = document.getElementById('form-shift-settings');
        const checkEnableShift2 = document.getElementById('checkbox-enable-shift-2');
        const shift2Container = document.getElementById('shift-2-fields-container');
        const inputShift1Name = document.getElementById('input-shift-1-name');
        const inputShift1Timing = document.getElementById('input-shift-1-timing');
        const inputShift2Name = document.getElementById('input-shift-2-name');
        const inputShift2Timing = document.getElementById('input-shift-2-timing');

        if (form && checkEnableShift2 && shift2Container) {
            // Toggle required fields and style based on Shift 2 switch state
            checkEnableShift2.addEventListener('change', () => {
                if (checkEnableShift2.checked) {
                    shift2Container.classList.remove('opacity-60', 'pointer-events-none');
                    if (inputShift2Name) inputShift2Name.required = true;
                    if (inputShift2Timing) inputShift2Timing.required = true;
                } else {
                    shift2Container.classList.add('opacity-60', 'pointer-events-none');
                    if (inputShift2Name) inputShift2Name.required = false;
                    if (inputShift2Timing) inputShift2Timing.required = false;
                }
            });

            // Load active configuration from Firestore settings collection
            db.collection('settings').doc('shiftConfig').get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    checkEnableShift2.checked = !!data.enableShift2;
                    if (inputShift1Name) inputShift1Name.value = data.shift1Name || 'Shift 1';
                    if (inputShift1Timing) inputShift1Timing.value = data.shift1Timing || '08:30 AM - 04:30 PM';
                    if (inputShift2Name) inputShift2Name.value = data.shift2Name || 'Shift 2';
                    if (inputShift2Timing) inputShift2Timing.value = data.shift2Timing || '12:00 PM - 05:30 PM';
                } else {
                    // Default settings if configuration does not exist in DB yet
                    checkEnableShift2.checked = false;
                    if (inputShift1Name) inputShift1Name.value = 'Shift 1';
                    if (inputShift1Timing) inputShift1Timing.value = '08:30 AM - 04:30 PM';
                    if (inputShift2Name) inputShift2Name.value = 'Shift 2';
                    if (inputShift2Timing) inputShift2Timing.value = '12:00 PM - 05:30 PM';
                }
                // Trigger visual update
                checkEnableShift2.dispatchEvent(new Event('change'));
            }).catch(err => {
                console.error("❌ Error fetching shift configuration:", err);
            });

            // Save active configurations
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const settings = {
                    enableShift2: checkEnableShift2.checked,
                    shift1Name: inputShift1Name.value.trim(),
                    shift1Timing: inputShift1Timing.value.trim(),
                    shift2Name: checkEnableShift2.checked ? inputShift2Name.value.trim() : 'Shift 2',
                    shift2Timing: checkEnableShift2.checked ? inputShift2Timing.value.trim() : '12:00 PM - 05:30 PM',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    await db.collection('settings').doc('shiftConfig').set(settings, { merge: true });
                    showToast("✅ Shift configurations updated successfully!");
                } catch (error) {
                    console.error("❌ Error updating settings document:", error);
                    alert("❌ Failed to save configuration: " + error.message);
                }
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast-success');
            const toastMsg = document.getElementById('toast-msg');
            if (toast && toastMsg) {
                toastMsg.textContent = message;
                toast.classList.remove('translate-y-20', 'opacity-0');
                setTimeout(() => {
                    toast.classList.add('translate-y-20', 'opacity-0');
                }, 3000);
            }
        }

        // -------------------------------------------------------------------------
        // E. Submitted Boardings Logic
        // -------------------------------------------------------------------------
        const submittedTableBody = document.getElementById('submitted-table-body');
        const submittedEmptyState = document.getElementById('submitted-empty-state');
        const searchSubmitted = document.getElementById('search-submitted');

        let submittedRecords = [];

        db.collection('submitted-boardings')
            .orderBy('submittedAt', 'desc')
            .limit(50)
            .onSnapshot(snapshot => {
            submittedRecords = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                submittedRecords.push({ id: doc.id, ...data });
            });

            // Already sorted by Firestore query (submittedAt desc)

            renderSubmittedBoardings();
        }, err => {
            console.error("❌ Error loading submitted boardings:", err);
        });

        function renderSubmittedBoardings() {
            if (!submittedTableBody) return;
            submittedTableBody.innerHTML = '';

            const searchVal = searchSubmitted ? searchSubmitted.value.toLowerCase().trim() : '';

            const filtered = submittedRecords.filter(rec => {
                const name = (rec.studentName || '').toLowerCase();
                const sId = (rec.studentId || '').toLowerCase();
                const busNum = (rec.busNumber || '').toString().toLowerCase();
                const route = (rec.routeName || '').toLowerCase();
                const driver = (rec.driverEmail || '').toLowerCase();

                return !searchVal || 
                       name.includes(searchVal) ||
                       sId.includes(searchVal) ||
                       busNum.includes(searchVal) ||
                       route.includes(searchVal) ||
                       driver.includes(searchVal);
            });

            if (filtered.length === 0) {
                if (submittedEmptyState) submittedEmptyState.classList.remove('hidden');
                submittedTableBody.closest('table').classList.add('hidden');
                return;
            }

            if (submittedEmptyState) submittedEmptyState.classList.add('hidden');
            submittedTableBody.closest('table').classList.remove('hidden');

            filtered.forEach(rec => {
                const scannedDate = rec.scannedAt ? new Date(rec.scannedAt) : null;
                const scannedStr = scannedDate ? scannedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                
                const subTime = rec.submittedAt ? (rec.submittedAt.toDate ? rec.submittedAt.toDate() : new Date(rec.submittedAt)) : null;
                const subStr = subTime ? subTime.toLocaleDateString() + ' ' + subTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
                row.innerHTML = `
                    <td class="p-5 font-bold text-slate-800">
                        <p class="text-sm font-extrabold text-slate-800">${escapeHtml(rec.studentName || 'Unknown')}</p>
                        <p class="text-xs text-slate-400 font-semibold">ID: ${escapeHtml(rec.studentId || 'N/A')}</p>
                    </td>
                    <td class="p-5">
                        <p class="text-sm font-extrabold text-slate-800">Bus ${escapeHtml(rec.busNumber || 'N/A')}</p>
                        <p class="text-xs text-slate-400 font-semibold truncate max-w-[200px]">${escapeHtml(rec.routeName || 'N/A')}</p>
                    </td>
                    <td class="p-5 text-slate-700 font-medium text-xs">
                        ${escapeHtml(scannedStr)}
                    </td>
                    <td class="p-5 text-slate-700 font-medium text-xs">
                        ${escapeHtml(subStr)}
                    </td>
                    <td class="p-5 text-slate-500 text-xs font-semibold">
                        ${escapeHtml(rec.driverEmail || 'N/A')}
                    </td>
                `;
                submittedTableBody.appendChild(row);
            });
        }

        if (searchSubmitted) searchSubmitted.addEventListener('input', renderSubmittedBoardings);
    }
});
