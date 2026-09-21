// portals/admin/scan-pass.js - Admin Pass Scanning Console Logic

document.addEventListener('DOMContentLoaded', () => {
    // 1. Session & Auth Security
    const adminEmail = localStorage.getItem('userEmail');
    if (!adminEmail) {
        window.location.href = 'admin-login.html';
        return;
    }

    // Populate admin profile metadata
    const adminNameDisplay = document.getElementById('admin-name-display');
    if (adminNameDisplay) {
        const adminName = localStorage.getItem('adminName') || 'Administrator';
        adminNameDisplay.textContent = adminName;
    }

    // Load active branding
    if (window.activeBranding) {
        const shortName = window.activeBranding.shortName;
        const sidebarTitle = document.getElementById('sidebar-college-title');
        if (sidebarTitle && shortName) {
            sidebarTitle.textContent = `| ${shortName}`;
            sidebarTitle.classList.remove('hidden');
        }
    }

    // Logout Action
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'admin-login.html';
        });
    }

    // Mobile Navigation Drawer Controls
    const btnToggleMenu = document.getElementById('btn-toggle-menu');
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    const mobileSidebar = document.getElementById('mobile-sidebar');

    if (btnToggleMenu && mobileSidebar) {
        btnToggleMenu.addEventListener('click', () => {
            mobileSidebar.classList.remove('hidden-sidebar');
        });
    }
    if (btnCloseSidebar && mobileSidebar) {
        btnCloseSidebar.addEventListener('click', () => {
            mobileSidebar.classList.add('hidden-sidebar');
        });
    }

    // =========================================================================
    // 2. Initialize Pass Verification System
    // =========================================================================
    const verificationSystem = new CambusPassVerificationSystem();
    const SECRET_KEY = "server_super_secret_salt";
    const dbReferenceLogs = {}; // Anti-loop scan cache
    const SHARED_LOCK_DURATION_MS = 4 * 60 * 60 * 1000;

    let selectedBusId = null;
    let selectedBusData = null;
    let busListenerUnsubscribe = null;
    let boardingsListenerUnsubscribe = null;

    // DOM Elements
    const selectActiveBus = document.getElementById('select-active-bus');
    const telemetryDriver = document.getElementById('telemetry-driver');
    const telemetryConductor = document.getElementById('telemetry-conductor');
    const headcountCard = document.getElementById('headcount-card');
    const btnDecrementHeadcount = document.getElementById('btn-decrement-headcount');
    const btnIncrementHeadcount = document.getElementById('btn-increment-headcount');
    const btnResetHeadcount = document.getElementById('btn-reset-headcount');
    const headcountDisplay = document.getElementById('headcount-display');
    const headerHeadcountBadge = document.getElementById('header-headcount-badge');
    const boardingsList = document.getElementById('boardings-list');
    const scanLockSummary = document.getElementById('scan-lock-summary');

    const inputLateCutoff = document.getElementById('input-late-cutoff');
    const toggleLateOverride = document.getElementById('toggle-late-override');
    const toggleFastMode = document.getElementById('checkbox-fast-headcount'); // Fast Headcount Mode Checkbox
    const toggleScanLock = document.getElementById('toggle-scan-lock');
    const inputScanLockMinutes = document.getElementById('input-scan-lock-minutes');
    const btnSaveScanLock = document.getElementById('btn-save-scan-lock');

    function getFirestoreDb() {
        return window.db || firebase.firestore();
    }

    function getSharedLockKey(student) {
        const rawKey = student ? (student.id || student.collegeId || student.enrollment || student.email || student.studentId || '') : '';
        return String(rawKey).trim().toLowerCase();
    }

    function getSelectedBusLockConfig() {
        const enabled = toggleScanLock ? toggleScanLock.checked : true;
        let minutes = parseInt(inputScanLockMinutes ? inputScanLockMinutes.value : '', 10);
        if (!Number.isFinite(minutes) || minutes < 1) minutes = 240;
        if (minutes > 1440) minutes = 1440;
        return { enabled, minutes };
    }

    function syncScanLockControlsFromBus() {
        if (!selectedBusData) return;
        if (toggleScanLock) {
            toggleScanLock.checked = selectedBusData.scanLockEnabled !== false;
        }
        if (inputScanLockMinutes) {
            const minutes = parseInt(selectedBusData.scanLockMinutes, 10);
            inputScanLockMinutes.value = Number.isFinite(minutes) && minutes > 0 ? minutes : 240;
        }
        refreshScanLockUI();
    }

    function refreshScanLockUI() {
        if (!btnSaveScanLock) return;
        const { enabled, minutes } = getSelectedBusLockConfig();
        btnSaveScanLock.textContent = selectedBusId ? 'Save' : 'Select Bus';
        btnSaveScanLock.disabled = !selectedBusId;
        btnSaveScanLock.classList.toggle('opacity-50', !selectedBusId);
        btnSaveScanLock.classList.toggle('cursor-not-allowed', !selectedBusId);
        if (toggleScanLock) toggleScanLock.disabled = !selectedBusId;
        if (inputScanLockMinutes) inputScanLockMinutes.disabled = !selectedBusId || !enabled;
        if (scanLockSummary) {
            scanLockSummary.classList.toggle('opacity-50', !selectedBusId);
            const title = scanLockSummary.querySelector('p.font-bold');
            const timer = scanLockSummary.querySelector('p.font-black.text-indigo-700');
            if (title) title.textContent = enabled ? 'Enabled for same bus pass scans' : 'Disabled for same bus pass scans';
            if (timer) timer.textContent = `${minutes} min`;
        }
    }

    async function saveScanLockSettings() {
        if (!selectedBusId) {
            showToast(false, "Select Bus", "Choose a fleet bus before saving scan lock settings.");
            return;
        }
        const { enabled, minutes } = getSelectedBusLockConfig();
        try {
            const payload = {
                scanLockEnabled: enabled,
                scanLockMinutes: minutes
            };
            if (!enabled) {
                payload.scanLocks = {};
            }
            await dbHelper.getBusesCol().doc(selectedBusId).set(payload, { merge: true });
            if (selectedBusData) {
                selectedBusData.scanLockEnabled = enabled;
                selectedBusData.scanLockMinutes = minutes;
                if (!enabled) selectedBusData.scanLocks = {};
            }
            refreshScanLockUI();
            showToast(true, "Scan Lock Saved", enabled ? `Lock enabled for ${minutes} minutes.` : "Scan lock disabled for this bus.");
        } catch (err) {
            console.error("Scan lock save error:", err);
            showToast(false, "Save Failed", err.message);
        }
    }

    function getActiveBusLockDocRef() {
        if (!selectedBusId) return null;
        return getFirestoreDb().collection('buses').doc(selectedBusId);
    }

    async function writeSharedScanLock(lockKey, student, busId, busNumber, portalName) {
        if (!lockKey) return;
        const lockConfig = getSelectedBusLockConfig();
        if (!lockConfig.enabled) return;
        const nowIso = new Date().toISOString();
        const lockedUntil = new Date(Date.now() + (lockConfig.minutes * 60 * 1000)).toISOString();
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
                    lockMinutes: lockConfig.minutes,
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

    async function ensureSharedLockClear(student, contextLabel = 'scan') {
        const lockKey = getSharedLockKey(student);
        if (!lockKey) return { allowed: true };
        const lockConfig = getSelectedBusLockConfig();
        if (!lockConfig.enabled) return { allowed: true, lockKey };

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
            scannerStatus.style.color = "#ef4444";
        }
        showToast(false, "Access Denied", reason);
        return { allowed: false, reason, lockKey };
    }

    // =========================================================================
    // 3. Load Fleet & Manage Bus Selection
    // =========================================================================
    async function loadFleetBuses() {
        try {
            const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
            if (typeof authGuard === 'function') {
                await authGuard();
            }
        } catch (err) {
            console.error("❌ Firebase/Auth unavailable in scan pass:", err);
            return;
        }

        if (!window.dbHelper) return;
        
        dbHelper.getBusesCol().get().then(snapshot => {
            if (selectActiveBus) {
                selectActiveBus.innerHTML = '<option value="">Select fleet bus run...</option>';
                
                let count = 0;
                let firstBusId = null;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `Bus ${data.number || '--'} - ${data.route || 'No Route'}`;
                    selectActiveBus.appendChild(opt);
                    if (!firstBusId) firstBusId = doc.id;
                    count++;
                });

                // If no buses exist in fleet
                if (count === 0) {
                    const opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = 'No registered fleet buses';
                    selectActiveBus.appendChild(opt);
                } else if (!selectedBusId && firstBusId) {
                    selectActiveBus.value = firstBusId;
                    switchActiveBus(firstBusId);
                }
            }
        }).catch(err => {
            console.error("Error loading buses:", err);
        });
    }

    if (selectActiveBus) {
        selectActiveBus.addEventListener('change', (e) => {
            const busId = e.target.value;
            switchActiveBus(busId);
        });
    }

    function switchActiveBus(newBusId) {
        if (busListenerUnsubscribe) {
            busListenerUnsubscribe();
            busListenerUnsubscribe = null;
        }
        if (boardingsListenerUnsubscribe) {
            boardingsListenerUnsubscribe();
            boardingsListenerUnsubscribe = null;
        }

        selectedBusId = newBusId;
        updateHeadcountUI();

        if (!newBusId) {
            telemetryDriver.textContent = '--';
            telemetryConductor.textContent = '--';
            if (headcountDisplay) headcountDisplay.value = 0;
            if (headerHeadcountBadge) headerHeadcountBadge.textContent = '0';
            if (boardingsList) boardingsList.innerHTML = '<p class="text-center py-12 text-slate-400 text-xs font-semibold" id="log-empty-state"><span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">history_toggle_off</span><span>No passengers boarded yet.</span></p>';
            selectedBusData = null;
            refreshScanLockUI();
            stopCameraScanner();
            return;
        }

        // 1. Subscribe to selected Bus metadata
        busListenerUnsubscribe = dbHelper.getBusesCol().doc(newBusId).onSnapshot(doc => {
            if (doc.exists) {
                selectedBusData = { id: doc.id, ...doc.data() };
            } else {
                selectedBusData = null;
                telemetryDriver.textContent = '--';
                telemetryConductor.textContent = '--';
                return;
            }

            // Sync UI Telemetry Fields
            telemetryDriver.textContent = selectedBusData.driver || 'No Driver';
            telemetryConductor.textContent = selectedBusData.conductor || 'No Conductor';
            
            if (headcountDisplay) {
                headcountDisplay.value = selectedBusData.headcount || 0;
            }
            
            syncScanLockControlsFromBus();
            console.log(`Synced headcount for Bus ${selectedBusData.number}: ${selectedBusData.headcount}`);
        }, err => {
            console.error("Error listening to bus headcount:", err);
        });

        // 2. Subscribe to selected Bus boardings (last 4 hours)
        subscribeToBoardingsUpdates(newBusId);
    }

    function subscribeToBoardingsUpdates(busId) {
        if (!boardingsList) return;
        const dateStr = new Date().toISOString().split('T')[0];
        boardingsListenerUnsubscribe = (window.db || firebase.firestore()).collection(`buses/${busId}/boardings`)
            .onSnapshot(snapshot => {
                console.log(`📡 Boardings snapshot received. Count: ${snapshot.size || 0}`);
                boardingsList.innerHTML = '';
                const items = [];
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    // Only show today's boardings for this bus
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

                // Sort descending (newest first)
                items.sort((a, b) => b.time - a.time);

                if (items.length === 0) {
                    boardingsList.innerHTML = '<p class="text-center py-10 text-slate-400 text-xs font-semibold" id="log-empty-state"><span class="material-symbols-outlined text-3xl text-slate-300 block mb-2">history_toggle_off</span><span>No passengers today.</span></p>';
                    return;
                }

                items.forEach(item => {
                    const studentId = item.id;
                    const studentName = item.data.studentName || item.data.name || 'Unknown Student';
                    const routeName = item.data.routeName || item.data.busRoute || 'Not Assigned';
                    const timeStr = item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    
                    const isCheckedOut = !!item.data.checkOutTime;
                    const statusColor = isCheckedOut ? 'text-rose-500 bg-rose-50 border-rose-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100';
                    const statusIcon = isCheckedOut ? 'logout' : 'login';
                    const statusText = isCheckedOut ? 'Checked Out' : 'Checked In';

                    const itemHtml = `
                        <div class="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center">
                                    <span class="material-symbols-outlined text-slate-400 text-[20px]">person</span>
                                </div>
                                <div>
                                    <h4 class="text-sm font-extrabold text-slate-800 tracking-wide">${studentName}</h4>
                                    <p class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">${studentId} • ${routeName}</p>
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${statusColor}">
                                    <span class="material-symbols-outlined text-[12px] font-bold">${statusIcon}</span>
                                    <span class="text-[9px] font-black uppercase tracking-wider">${statusText}</span>
                                </div>
                                <span class="text-[10px] font-bold text-slate-400 tracking-wider">${timeStr}</span>
                            </div>
                        </div>
                    `;
                    boardingsList.insertAdjacentHTML('beforeend', itemHtml);
                });
            }, err => {
                console.warn("Boardings list unavailable:", err);
                boardingsList.innerHTML = '<p class="text-center py-12 text-slate-400 text-xs font-semibold"><span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">history_toggle_off</span><span>Recent boardings are unavailable right now.</span></p>';
            });
    }

    // =========================================================================
    // 4. Headcount UI Controls
    // =========================================================================
    function updateHeadcountUI() {
        if (!headcountCard) return;
        if (selectedBusId) {
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
            if (!selectedBusId || !selectedBusData) return;
            const cur = selectedBusData.headcount || 0;
            if (cur >= 100) return;
            dbHelper.getBusesCol().doc(selectedBusId).set({ headcount: cur + 1 }, { merge: true })
                .catch(err => console.error('Increment error:', err));
        });
    }

    if (btnDecrementHeadcount) {
        btnDecrementHeadcount.addEventListener('click', () => {
            if (!selectedBusId || !selectedBusData) return;
            const cur = selectedBusData.headcount || 0;
            if (cur <= 0) return;
            dbHelper.getBusesCol().doc(selectedBusId).set({ headcount: cur - 1 }, { merge: true })
                .catch(err => console.error('Decrement error:', err));
        });
    }

    if (btnResetHeadcount) {
        btnResetHeadcount.addEventListener('click', () => {
            if (!selectedBusId || !selectedBusData) return;
            dbHelper.getBusesCol().doc(selectedBusId).set({ headcount: 0 }, { merge: true })
                .catch(err => console.error('Reset error:', err));
        });
    }

    if (headcountDisplay) {
        headcountDisplay.addEventListener('change', (e) => {
            if (!selectedBusId || !selectedBusData) return;
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            if (val > 100) val = 100;
            dbHelper.getBusesCol().doc(selectedBusId).set({ headcount: val }, { merge: true })
                .catch(err => console.error('Manual change error:', err));
        });
    }

    if (toggleScanLock) {
        toggleScanLock.addEventListener('change', () => {
            refreshScanLockUI();
            saveScanLockSettings();
        });
    }

    if (inputScanLockMinutes) {
        inputScanLockMinutes.addEventListener('change', () => {
            refreshScanLockUI();
            saveScanLockSettings();
        });
    }

    if (btnSaveScanLock) {
        btnSaveScanLock.addEventListener('click', saveScanLockSettings);
    }

    // Deletion event delegation for boardings list
    if (boardingsList) {
        boardingsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-btn');
            if (btn) {
                const docId = btn.getAttribute('data-id');
                const studentId = btn.getAttribute('data-studentid');
                if (selectedBusId && confirm("Are you sure you want to remove this passenger from the list?")) {
                    const dbRef = window.db || firebase.firestore();
                    dbRef.collection(`buses/${selectedBusId}/boardings`).doc(docId).delete()
                        .then(() => {
                            const cur = selectedBusData ? (selectedBusData.headcount || 0) : 0;
                            const newVal = Math.max(0, cur - 1);
                            return dbHelper.getBusesCol().doc(selectedBusId).set({ headcount: newVal }, { merge: true });
                        })
                        .then(async () => {
                            if (studentId) {
                                delete dbReferenceLogs[studentId];
                                await clearSharedScanLock(studentId);
                            }
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

    // =========================================================================
    // 5. HTML5 QRCode camera scanning lifecycle
    // =========================================================================
    const btnToggleCamera = document.getElementById('btn-toggle-camera');
    const qrReaderPlaceholder = document.getElementById('qr-reader-placeholder');
    const cameraBtnText = document.getElementById('camera-btn-text');
    const cameraBtnIcon = document.getElementById('camera-btn-icon');
    const scannerStatus = document.getElementById('scanner-status');
    let html5QrScanner = null;

    if (btnToggleCamera) {
        btnToggleCamera.addEventListener('click', () => {
            if (html5QrScanner && html5QrScanner.isScanning) {
                stopCameraScanner();
            } else {
                startCameraScanner();
            }
        });
    }

    function startCameraScanner() {
        if (!selectedBusId) {
            showToast(false, "Selection Required", "Please select a fleet bus run before activating the camera scanner.");
            playBeep(220, 300);
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

        // Update button UI to scanning state (Blue matching reference)
        if (btnToggleCamera) btnToggleCamera.style.background = '#2563eb';
        if (cameraBtnText) cameraBtnText.textContent = "Stop Scanner Camera";
        const laserLine = document.querySelector('.scan-line');
        if (laserLine) laserLine.style.display = 'block';

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
                console.log(`Admin Scanned QR: ${decodedText}`);
                        handlePassScanInput(decodedText, true).catch(err => console.error("Scan error:", err));
            },
            (err) => {
                // Ignore verbose QR scanner logs
            }
        ).catch(err => {
            console.error("Failed to start camera feed:", err);
            if (scannerStatus) {
                scannerStatus.textContent = "Camera access failed/blocked by permissions.";
                scannerStatus.style.color = "#ef4444";
            }
            stopCameraScanner();
        });
    }

    function stopCameraScanner() {
        if (qrReaderPlaceholder) qrReaderPlaceholder.style.display = 'flex';
        
        // Update button UI to idle state (Matching reference)
        if (btnToggleCamera) btnToggleCamera.style.background = '#2563eb';
        if (cameraBtnText) cameraBtnText.textContent = "Start Scanner Camera";
        const laserLine = document.querySelector('.scan-line');
        if (laserLine) laserLine.style.display = 'none';

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

    // =========================================================================
    // 6. jsQR File Uploader Scanner
    // =========================================================================
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
                scannerStatus.style.color = "#2563eb";
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
                        console.log(`Admin Scanned file QR via jsQR: ${code.data}`);
                        handlePassScanInput(code.data, true).catch(err => console.error("Scan error:", err));
                        qrFileInput.value = "";
                    } else {
                        console.error("jsQR failed to decode QR code.");
                        playBeep(220, 300);
                        if (scannerStatus) {
                            scannerStatus.textContent = "Failed to find QR code in image.";
                            scannerStatus.style.color = "#ef4444";
                        }
                        showToast(false, "Scanning Failed", "No valid QR code was detected in the selected image. Make sure the screenshot is clear.");
                        qrFileInput.value = "";
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // =========================================================================
    // 7. Pass Scanning Verification & Business Rules Logic
    // =========================================================================
    let pendingCheckinStudent = null;

    async function handlePassScanInput(rawText, isCameraScan = false) {
        if (!selectedBusId) {
            showToast(false, "Selection Required", "Please select a fleet bus first.");
            playBeep(220, 300);
            return;
        }

        const activeTenantKey = localStorage.getItem('activeTenantKey') || 'localhost';
        const allowedDomains = (window.tenantConfigs && window.tenantConfigs[activeTenantKey]) 
            ? window.tenantConfigs[activeTenantKey].emailDomains 
            : [];

        const isFastMode = toggleFastMode ? toggleFastMode.checked : true;
        const busNum = selectedBusData ? (selectedBusData.number || selectedBusData.id) : 'Unknown';

        // Pause scanner if Fast Mode is off to avoid double-modals
        if (isCameraScan && !isFastMode) {
            stopCameraScanner();
        }

        if (scannerStatus) {
            scannerStatus.textContent = "Verifying pass...";
            scannerStatus.style.color = "#2563eb";
        }

        // 0. Base64 JSON format check
        let payloadObject = null;
        if (rawText.length > 20 && !rawText.includes(' ')) {
            try {
                const parts = rawText.split('.');
                payloadObject = JSON.parse(decodeURIComponent(escape(atob(parts[0]))));
            } catch (e) {
                // Not JSON, fallback to DB search
                payloadObject = null;
            }
        }

        if (payloadObject && (payloadObject.studentId || payloadObject.collegeId)) {
            const studentId = payloadObject.studentId || payloadObject.collegeId;
            const studentName = payloadObject.name || payloadObject.studentName || 'Unknown';
            const routeName = payloadObject.routeName || payloadObject.busRoute || 'Not Assigned';
            const instituteId = payloadObject.instituteId || '';

            // Enforce Multi-Tenant Domain isolation
            let passDomain = instituteId.toLowerCase().trim();
            if (!passDomain && studentId.includes('@')) {
                passDomain = studentId.toLowerCase().split('@')[1];
            }
            if (allowedDomains && allowedDomains.length > 0) {
                if (!passDomain || !allowedDomains.includes(passDomain)) {
                    playBeep(220, 300);
                    const reason = `Scan rejected. Pass domain (${passDomain || 'unknown'}) is not authorized for this institute.`;
                    if (scannerStatus) {
                        scannerStatus.textContent = reason;
                        scannerStatus.style.color = "#ef4444";
                    }
                    showToast(false, "Verification Denied", reason);
                    return;
                }
            }

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
                        scannerStatus.style.color = "#ef4444";
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
                passValidity: '31 Dec 2026',
                parentPhone: payloadObject.parentPhone || ''
            };

            try {
                // const sharedLock = await ensureSharedLockClear(matchedStudent, 'admin');
                // if (!sharedLock.allowed) return;

                if (isFastMode) {
                    showToast(true, "Pass Verified", `${studentName} | Valid till ${matchedStudent.passValidity}`);
                    processBoardingScan(matchedStudent, "Verified QR JSON");
                } else {
                    showConfirmationModal(matchedStudent, true, rawText);
                }
                
                if (scannerStatus) {
                    scannerStatus.textContent = `Verified: ${studentName} | Valid till ${matchedStudent.passValidity}`;
                    scannerStatus.style.color = "#16a34a";
                }
            } catch (err) {
                console.error("Verification error:", err);
                showToast(false, "Verification Error", err.message);
                if (scannerStatus) {
                    scannerStatus.textContent = "Error: " + err.message;
                    scannerStatus.style.color = "#ef4444";
                }
            }
            return;
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
                        scannerStatus.style.color = "#ef4444";
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
                            scannerStatus.style.color = "#ef4444";
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
                        scannerStatus.style.color = "#ef4444";
                    }
                    if (isFastMode) {
                        showToast(false, "Pass Expired", `${matchedStudent.name || 'Student'} | Expired on ${validityDate.toLocaleDateString()}`);
                    } else {
                        showConfirmationModal(matchedStudent, false, rawText, "Pass Expired");
                    }
                    if (scannerStatus) {
                        scannerStatus.textContent = `Expired: ${matchedStudent.name || 'Student'} | ${validityDate.toLocaleDateString()}`;
                        scannerStatus.style.color = "#ef4444";
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
                            scannerStatus.style.color = "#ef4444";
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
                // const sharedLock = await ensureSharedLockClear(matchedStudent, 'admin');
                // if (!sharedLock.allowed) return;
                if (isFastMode) {
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
        if (!selectedBusId || !selectedBusData) return;
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
        const busNumber = selectedBusData.number || selectedBusId;
        const dateStr = new Date().toISOString().split('T')[0];
        const logRef = (window.db || firebase.firestore()).collection(`buses/${selectedBusId}/boardings`).doc(`${sId}_${dateStr}`);
        
        try {
            const snap = await logRef.get();
            const data = snap.exists ? snap.data() : null;
            const busRef = dbHelper.getBusesCol().doc(selectedBusId);

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
                    checkInBus: selectedBusId,
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
                    checkOutBus: selectedBusId
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

    // =========================================================================
    // 8. Confirmation Modal Logic
    // =========================================================================
    const modalConfirmCheckin = document.getElementById('modal-confirm-checkin');
    const confirmStudentDetails = document.getElementById('confirm-student-details');
    const btnActionConfirm = document.getElementById('btn-action-confirm');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
    const btnCloseConfirm = document.getElementById('btn-close-confirm');
    const btnMoreInfo = document.getElementById('btn-more-info');
    const modalStudentMoreInfo = document.getElementById('modal-student-more-info');
    const studentMoreInfoBody = document.getElementById('student-more-info-body');
    const btnCloseMoreInfo = document.getElementById('btn-close-more-info');

    function showConfirmationModal(student, isValid, rawText = '', errorDetails = '') {
        pendingCheckinStudent = student;
        if (!modalConfirmCheckin || !confirmStudentDetails) return;

        if (!student) {
            confirmStudentDetails.innerHTML = `
                <div class="text-center p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600">
                    <span class="material-symbols-outlined text-5xl">warning</span>
                    <h4 class="font-extrabold text-base mt-2">UNREGISTERED PASS</h4>
                    <p class="text-xs mt-1">No student profile corresponds to this scan.</p>
                    <p class="font-mono text-xs mt-2 bg-red-100/50 p-2 rounded-lg break-all select-all">${rawText}</p>
                    ${errorDetails ? `<p class="text-[10px] font-extrabold uppercase mt-2">${errorDetails}</p>` : ''}
                </div>
            `;
            if (btnActionConfirm) btnActionConfirm.style.display = 'none';
        } else if (!isValid) {
            confirmStudentDetails.innerHTML = `
                <div class="text-center p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-600">
                    <span class="material-symbols-outlined text-5xl">report_problem</span>
                    <h4 class="font-extrabold text-base mt-2">INVALID PASS</h4>
                    <p class="text-xs mt-1">Reason: ${errorDetails}</p>
                    <div class="text-left mt-3 text-xs border-t border-orange-200/50 pt-2 space-y-1">
                        <p><strong>Name:</strong> ${student.name || 'N/A'}</p>
                        <p><strong>ID:</strong> ${student.collegeId || 'N/A'}</p>
                        <p><strong>Route:</strong> ${student.busRoute || student.routeName || 'N/A'}</p>
                    </div>
                </div>
            `;
            if (btnActionConfirm) {
                btnActionConfirm.style.display = 'block';
                btnActionConfirm.textContent = 'Override & Add (+1)';
                btnActionConfirm.className = 'flex-grow-[2] py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-md';
            }
            if (btnMoreInfo) btnMoreInfo.style.display = 'none';
        } else {
            const validityText = student.passValidity || '31 Dec 2026';
            confirmStudentDetails.innerHTML = `
                <div class="space-y-4 text-slate-800">
                    <div class="flex items-center gap-3.5 p-3.5 bg-green-50 border border-green-100 rounded-2xl">
                        <div class="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center font-bold text-lg">
                            ${(student.name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h4 class="font-extrabold text-green-700 text-sm">${student.name || 'N/A'}</h4>
                            <p class="text-[10px] text-green-600 font-bold flex items-center gap-0.5 mt-0.5">
                                <span class="material-symbols-outlined text-[12px]">verified</span>
                                VERIFIED | Valid till ${validityText}
                            </p>
                        </div>
                    </div>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">College ID:</span>
                            <span class="font-bold">${student.collegeId || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">Route:</span>
                            <span class="font-bold truncate max-w-[220px] text-right">${student.busRoute || student.routeName || 'Default Route'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">Parent Phone:</span>
                            <span class="font-bold text-right">${student.parentPhone || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">Pass Valid Till:</span>
                            <span class="font-bold text-right">${validityText}</span>
                        </div>
                    </div>
                </div>
            `;
            if (btnActionConfirm) {
                btnActionConfirm.style.display = 'block';
                btnActionConfirm.textContent = 'Confirm & Add (+1)';
                btnActionConfirm.className = 'flex-grow-[2] py-3 bg-primary hover:bg-blue-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-500/10';
            }
            if (btnMoreInfo) btnMoreInfo.style.display = 'block';
        }

        if (modalConfirmCheckin) {
            modalConfirmCheckin.classList.add('flex');
            modalConfirmCheckin.classList.remove('hidden');
        }
    }

    function openMoreInfoModal(student) {
        if (!modalStudentMoreInfo || !studentMoreInfoBody) return;

        const rows = [
            ['Name', student.name || 'N/A'],
            ['College ID', student.collegeId || 'N/A'],
            ['Enrollment', student.enrollment || 'N/A'],
            ['Email', student.email || 'N/A'],
            ['Route', student.busRoute || student.routeName || 'N/A'],
            ['Bus ID', student.assignedBusId || 'N/A'],
            ['Shift', student.shift || 'N/A'],
            ['Department', student.department || 'N/A'],
            ['Year', student.year || 'N/A'],
            ['Phone', student.phone || 'N/A'],
            ['Parent Phone', student.parentPhone || 'N/A'],
            ['Sub-Institute', student.subInstitute || 'N/A'],
            ['Pass Validity', student.passValidity || 'N/A'],
            ['Address', student.address || 'N/A'],
        ];

        studentMoreInfoBody.innerHTML = rows.map(([label, value]) => `
            <div class="p-3 rounded-2xl border border-slate-200 bg-slate-50">
                <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">${label}</p>
                <p class="mt-1 text-sm font-bold text-slate-800 break-words">${value}</p>
            </div>
        `).join('');

        modalStudentMoreInfo.classList.add('flex');
        modalStudentMoreInfo.classList.remove('hidden');
    }

    function closeMoreInfoModal() {
        if (modalStudentMoreInfo) {
            modalStudentMoreInfo.classList.remove('flex');
            modalStudentMoreInfo.classList.add('hidden');
        }
    }

    function closeConfirmModal() {
        if (modalConfirmCheckin) {
            modalConfirmCheckin.classList.remove('flex');
            modalConfirmCheckin.classList.add('hidden');
        }
        closeMoreInfoModal();
        pendingCheckinStudent = null;
        
        // Return/resume scanning by making sure we start the scanner again
        if (selectedBusId) {
            startCameraScanner();
        }
    }

    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirmModal);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirmModal);
    if (btnMoreInfo) btnMoreInfo.addEventListener('click', () => openMoreInfoModal(pendingCheckinStudent));
    if (btnCloseMoreInfo) btnCloseMoreInfo.addEventListener('click', closeMoreInfoModal);
    if (modalStudentMoreInfo) {
        modalStudentMoreInfo.addEventListener('click', (e) => {
            if (e.target === modalStudentMoreInfo) closeMoreInfoModal();
        });
    }
    if (btnActionConfirm) {
        btnActionConfirm.addEventListener('click', () => {
            if (pendingCheckinStudent) {
                processBoardingScan(pendingCheckinStudent, "Modal Boarding");
            }
            closeConfirmModal();
        });
    }

    // =========================================================================
    // 9. Simulator & Search Events
    // =========================================================================
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

    // =========================================================================
    // 10. Toast & Audio Beep Helpers
    // =========================================================================
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

    // =========================================================================
    // 9. Export CSV Logic
    // =========================================================================
    const exportBtn = document.createElement('button');
    exportBtn.className = "text-[10px] bg-slate-800 text-white font-bold py-1 px-3 rounded-lg uppercase tracking-wider shadow-sm hover:bg-slate-700 ml-auto";
    exportBtn.innerHTML = '<span class="material-symbols-outlined text-[14px] align-middle mr-1">download</span> Export CSV';
    exportBtn.onclick = async () => {
        const dateStr = new Date().toISOString().split('T')[0];
        try {
            const snap = await getFirestoreDb().collectionGroup('boardings').where('date', '==', dateStr).get();
            let csv = "Student ID,Name,Check-In Bus,Check-In Time,Check-Out Bus,Check-Out Time\n";
            snap.forEach(doc => {
                const d = doc.data();
                const ciTime = d.checkInTime && d.checkInTime.toDate ? d.checkInTime.toDate().toLocaleString() : '';
                const coTime = d.checkOutTime && d.checkOutTime.toDate ? d.checkOutTime.toDate().toLocaleString() : '';
                csv += `"${d.studentId || doc.id.split('_')[0]}","${d.studentName || ''}","${d.checkInBus || ''}","${ciTime}","${d.checkOutBus || ''}","${coTime}"\n`;
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
    
    // Append the export button to the header once the DOM is loaded
    setTimeout(() => {
        const boardingsHeader = document.querySelector('#boardings-list').previousElementSibling;
        if (boardingsHeader) {
            boardingsHeader.style.display = 'flex';
            boardingsHeader.style.alignItems = 'center';
            boardingsHeader.appendChild(exportBtn);
        }
    }, 500);

    loadFleetBuses();
});    
