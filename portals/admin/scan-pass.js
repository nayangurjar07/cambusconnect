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

    const inputLateCutoff = document.getElementById('input-late-cutoff');
    const toggleLateOverride = document.getElementById('toggle-late-override');
    const toggleFastMode = document.getElementById('checkbox-fast-headcount'); // Fast Headcount Mode Checkbox

    // =========================================================================
    // 3. Load Fleet & Manage Bus Selection
    // =========================================================================
    function loadFleetBuses() {
        if (!window.dbHelper) return;
        
        dbHelper.getBusesCol().get().then(snapshot => {
            if (selectActiveBus) {
                selectActiveBus.innerHTML = '<option value="">Select fleet bus run...</option>';
                
                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const opt = document.createElement('option');
                    opt.value = doc.id;
                    opt.textContent = `Bus ${data.number || '--'} - ${data.route || 'No Route'}`;
                    selectActiveBus.appendChild(opt);
                    count++;
                });

                // Inject demo fallback if database collection is empty
                if (count === 0) {
                    console.log("Injecting demo fleet buses in dropdown...");
                    const demoBuses = [
                        { id: 'demo-bus-101', number: '101', route: 'Main Campus Loop' },
                        { id: 'demo-bus-202', number: '202', route: 'Rajwada Express' },
                        { id: 'demo-bus-303', number: '303', route: 'Bhawarkua Shuttle' }
                    ];
                    demoBuses.forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b.id;
                        opt.textContent = `Bus ${b.number} - ${b.route}`;
                        selectActiveBus.appendChild(opt);
                    });
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
            stopCameraScanner();
            return;
        }

        // 1. Subscribe to selected Bus metadata
        busListenerUnsubscribe = dbHelper.getBusesCol().doc(newBusId).onSnapshot(doc => {
            if (doc.exists) {
                selectedBusData = { id: doc.id, ...doc.data() };
            } else {
                // Mock fallback details if it's a simulated demo bus id
                const num = newBusId.split('-').pop() || '101';
                selectedBusData = {
                    id: newBusId,
                    number: num,
                    route: newBusId === 'demo-bus-202' ? 'Rajwada Express' : 'Main Campus Loop',
                    driver: 'Rajesh Sharma',
                    conductor: 'Amit Kumar',
                    headcount: 0
                };
            }

            // Sync UI Telemetry Fields
            telemetryDriver.textContent = selectedBusData.driver || 'No Driver';
            telemetryConductor.textContent = selectedBusData.conductor || 'No Conductor';
            
            if (headcountDisplay) {
                headcountDisplay.value = selectedBusData.headcount || 0;
            }
            
            console.log(`Synced headcount for Bus ${selectedBusData.number}: ${selectedBusData.headcount}`);
        }, err => {
            console.error("Error listening to bus headcount:", err);
        });

        // 2. Subscribe to selected Bus boardings (last 4 hours)
        subscribeToBoardingsUpdates(newBusId);
    }

    function subscribeToBoardingsUpdates(busId) {
        if (!boardingsList) return;
        
        boardingsListenerUnsubscribe = (window.db || firebase.firestore()).collection(`buses/${busId}/boardings`)
            .onSnapshot(snapshot => {
                console.log(`📡 Boardings snapshot received. Count: ${snapshot.size || 0}`);
                boardingsList.innerHTML = '';
                const items = [];
                const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
                
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    let bTime = null;
                    try {
                        if (data.timestamp) {
                            bTime = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                        } else if (data.scannedAt) {
                            bTime = new Date(data.scannedAt);
                        } else {
                            bTime = new Date();
                        }
                    } catch (e) {
                        console.error("Error parsing boarding timestamp:", e);
                        bTime = new Date();
                    }
                    
                    if (bTime >= fourHoursAgo) {
                        items.push({ id: docSnap.id, ...data, bTime });
                    }
                });
                
                // Sort descending (most recent first)
                items.sort((a, b) => b.bTime - a.bTime);
                
                if (headerHeadcountBadge) {
                    headerHeadcountBadge.textContent = items.length;
                }

                if (items.length === 0) {
                    boardingsList.innerHTML = '<p class="text-center py-12 text-slate-400 text-xs font-semibold" id="log-empty-state"><span class="material-symbols-outlined text-2xl text-slate-300 block mb-1">history_toggle_off</span><span>No passengers boarded in the last 4 hours.</span></p>';
                    return;
                }
                
                items.forEach(data => {
                    const timeStr = data.bTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const div = document.createElement('div');
                    div.className = "flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-xl hover:shadow-sm transition-all";
                    div.innerHTML = `
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-800 truncate">${data.studentName}</p>
                            <p class="text-[9px] text-slate-400 font-semibold truncate mt-0.5">ID: ${data.studentId} | Route: ${data.routeName}</p>
                        </div>
                        <div class="text-right flex-shrink-0 flex items-center gap-2 pl-2">
                            <span class="text-[9px] font-bold text-slate-400">${timeStr}</span>
                            <button class="remove-btn w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-colors" data-id="${data.id}" data-studentid="${data.studentId}">
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    `;
                    boardingsList.appendChild(div);
                });
            }, err => console.error("Error loading boardings:", err));
    }

    loadFleetBuses();

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
                        .then(() => {
                            if (studentId) {
                                delete dbReferenceLogs[studentId];
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

        // Update button UI to scanning state (Red for stop)
        if (btnToggleCamera) btnToggleCamera.style.background = '#ef4444';
        if (cameraBtnText) cameraBtnText.textContent = "Stop Camera Scanner";
        if (cameraBtnIcon) cameraBtnIcon.textContent = "videocam_off";

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
                handlePassScanInput(decodedText, true);
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
        
        // Update button UI to idle state (indigo/blue)
        if (btnToggleCamera) btnToggleCamera.style.background = '';
        if (cameraBtnText) cameraBtnText.textContent = "Start Camera Scanner";
        if (cameraBtnIcon) cameraBtnIcon.textContent = "videocam";

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
                        handlePassScanInput(code.data, true);
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

    function handlePassScanInput(rawText, isCameraScan = false) {
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

        // 0. Human-readable signed text format check (forgery-proof and readable)
        if (rawText.startsWith("Cambus Pass - Verified Student:")) {
            const parts = rawText.split('.');
            if (parts.length < 2) {
                playBeep(220, 300);
                const reason = "Security verification failed: Missing signature.";
                if (scannerStatus) {
                    scannerStatus.textContent = reason;
                    scannerStatus.style.color = "#ef4444";
                }
                showToast(false, "Verification Denied", reason);
                return;
            }

            const signature = parts[parts.length - 1];
            const plainText = parts.slice(0, parts.length - 1).join('.');

            // Verify signature using SHA-256 HMAC
            const calculatedSignature = computeHMAC(plainText, SECRET_KEY);
            if (signature !== calculatedSignature) {
                playBeep(220, 300);
                const reason = "Security verification failed: Forged or tampered QR pass.";
                if (scannerStatus) {
                    scannerStatus.textContent = reason;
                    scannerStatus.style.color = "#ef4444";
                }
                showToast(false, "Verification Denied", reason);
                return;
            }

            const nameMatch = plainText.match(/Verified Student:\s*([^|]+)/);
            const routeMatch = plainText.match(/Route:\s*([^|]+)/);
            const idMatch = plainText.match(/ID:\s*([^|]+)/);
            const instMatch = plainText.match(/Institute:\s*(.+)$/);
            
            const studentName = nameMatch ? nameMatch[1].trim() : "Unknown";
            const routeName = routeMatch ? routeMatch[1].trim() : "Not Assigned";
            const studentId = idMatch ? idMatch[1].trim() : "Unknown";
            const instituteId = instMatch ? instMatch[1].trim() : "";
            
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

            // Check 4-Hour Anti-Loop Lock for Plaintext Signed Passes
            const now = Date.now();
            const lastScanTime = dbReferenceLogs[studentId];
            if (lastScanTime !== undefined) {
                const diffMs = now - lastScanTime;
                const fourHoursMs = 4 * 60 * 60 * 1000;
                if (diffMs < fourHoursMs) {
                    const remainingSecs = Math.ceil((fourHoursMs - diffMs) / 1000);
                    const reason = `4-Hour Anti-Loop Lock active to prevent pass sharing. Cooldown: ${remainingSecs}s`;
                    playBeep(220, 300);
                    if (scannerStatus) {
                        scannerStatus.textContent = reason;
                        scannerStatus.style.color = "#ef4444";
                    }
                    showToast(false, "Verification Denied", reason);
                    return;
                }
            }

            const matchedStudent = {
                id: studentId,
                name: studentName,
                collegeId: studentId.substring(0, 8),
                busRoute: routeName,
                passValidity: '31 Dec 2026'
            };

            if (isFastMode) {
                incrementBusHeadcount(matchedStudent, "Verified QR Signed");
            } else {
                showConfirmationModal(matchedStudent, true, rawText);
            }
            
            if (scannerStatus) {
                scannerStatus.textContent = `Verified: ${studentName}`;
                scannerStatus.style.color = "#16a34a";
            }
            return;
        }

        // 1. Cryptographic check
        if (rawText.includes('.')) {
            const adminConfigs = {
                lateCutOffTime: inputLateCutoff ? inputLateCutoff.value.trim() : "08:45 AM",
                lateBoardingOverride: toggleLateOverride ? toggleLateOverride.checked : false
            };
            const result = verificationSystem.processScanInput(rawText, busNum, adminConfigs, dbReferenceLogs, SECRET_KEY, allowedDomains);
            
            if (!result.verified) {
                playBeep(220, 300);
                const failReason = result.reason + (result.cooldownSeconds ? ` (Cooldown: ${result.cooldownSeconds}s)` : '');
                if (scannerStatus) {
                    scannerStatus.textContent = `Denied: ${failReason}`;
                    scannerStatus.style.color = "#ef4444";
                }
                
                if (isFastMode) {
                    showToast(false, "Verification Denied", failReason);
                } else {
                    showConfirmationModal(null, false, rawText, failReason);
                }
                return;
            }

            // Cryptographic verified successfully
            const parts = rawText.split('.');
            const cleanPreview = parts[1].substring(0, 8);
            const matchedStudent = {
                id: parts[1],
                name: result.payload.name,
                collegeId: cleanPreview,
                busRoute: result.payload.routeName,
                passValidity: '31 Dec 2026'
            };

            if (isFastMode) {
                incrementBusHeadcount(matchedStudent, "Verified Pass");
            } else {
                showConfirmationModal(matchedStudent, true, rawText);
            }
            return;
        }

        // 2. Database lookups (Simulator or search)
        const queryText = rawText.trim().toLowerCase();
        const cleanCode = queryText.replace('cambus-', '');

        dbHelper.getUsersCol()
            .where('role', '==', 'student')
            .get()
            .then(snapshot => {
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
                        showToast(false, "Pass Expired", reason);
                    } else {
                        showConfirmationModal(matchedStudent, false, rawText, "Pass Expired");
                    }
                    return;
                }

                // Check 4-Hour Anti-Loop Lock for Database Search check-ins
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

                // Success
                if (isFastMode) {
                    incrementBusHeadcount(matchedStudent, "Verified DB Search");
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

    function incrementBusHeadcount(student, type) {
        if (!selectedBusId || !selectedBusData) return;
        const current = selectedBusData.headcount || 0;
        
        dbHelper.getBusesCol().doc(selectedBusId).set({
            headcount: current + 1
        }, { merge: true }).then(() => {
            const sId = student.id || student.collegeId || 'Unknown';
            dbReferenceLogs[sId] = Date.now(); // Set the anti-loop scan lock in cache!
            (window.db || firebase.firestore()).collection(`buses/${selectedBusId}/boardings`).doc(`${sId}_${Date.now()}`).set({
                studentId: sId,
                studentName: student.name || 'Unknown',
                routeName: student.busRoute || student.routeName || 'Not Assigned',
                busNumber: selectedBusData.number || selectedBusId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                scannedAt: new Date().toISOString()
            }).then(() => {
                playBeep(880, 150);
                showToast(true, "Checked In", `${student.name} checked in successfully.`);
                
                if (scannerStatus) {
                    scannerStatus.textContent = `Success: Checked in ${student.name}`;
                    scannerStatus.style.color = "#16a34a";
                }
            }).catch(err => {
                console.error("Error saving boarding record:", err);
                playBeep(880, 150);
                showToast(true, "Checked In", `${student.name} checked in successfully.`);
            });
        }).catch(err => {
            console.error("Headcount update error:", err);
            showToast(false, "Update Failed", err.message);
        });
    }

    // =========================================================================
    // 8. Confirmation Modal Logic
    // =========================================================================
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
        } else {
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
                                ACTIVE VALID PASS
                            </p>
                        </div>
                    </div>
                    <div class="space-y-2 text-xs">
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">College ID:</span>
                            <span class="font-bold">${student.collegeId || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">Email:</span>
                            <span class="font-bold truncate max-w-[220px]">${student.email || student.id || 'N/A'}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-slate-400 font-medium">Assigned Route:</span>
                            <span class="font-bold truncate max-w-[220px] text-right">${student.busRoute || student.routeName || 'Default Route'}</span>
                        </div>
                    </div>
                </div>
            `;
            if (btnActionConfirm) {
                btnActionConfirm.style.display = 'block';
                btnActionConfirm.textContent = 'Confirm & Add (+1)';
                btnActionConfirm.className = 'flex-grow-[2] py-3 bg-primary hover:bg-blue-800 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-500/10';
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
        
        // Return/resume scanning by making sure we start the scanner again
        if (selectedBusId) {
            startCameraScanner();
        }
    }

    if (btnCloseConfirm) btnCloseConfirm.addEventListener('click', closeConfirmModal);
    if (btnCancelConfirm) btnCancelConfirm.addEventListener('click', closeConfirmModal);
    if (btnActionConfirm) {
        btnActionConfirm.addEventListener('click', () => {
            if (pendingCheckinStudent) {
                incrementBusHeadcount(pendingCheckinStudent, "Modal Boarding");
            }
            closeConfirmModal();
        });
    }

    // =========================================================================
    // 9. Simulator & Search Events
    // =========================================================================
    const btnSimScan = document.getElementById('btn-sim-scan');
    const simCollegeId = document.getElementById('sim-college-id');
    const btnQuickDemoScan = document.getElementById('btn-quick-demo-scan');
    const btnVerifyStudent = document.getElementById('btn-verify-student');
    const inputVerifyStudent = document.getElementById('input-verify-student');

    if (btnSimScan && simCollegeId) {
        btnSimScan.addEventListener('click', () => {
            const val = simCollegeId.value.trim();
            if (!val) {
                showToast(false, "Input Required", "Please enter a simulated QR string or College ID.");
                playBeep(220, 300);
                return;
            }
            handlePassScanInput(val, false);
        });
        simCollegeId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnSimScan.click();
            }
        });
    }

    if (btnQuickDemoScan) {
        btnQuickDemoScan.addEventListener('click', () => {
            if (!window.dbHelper) return;
            
            dbHelper.getUsersCol()
                .where('role', '==', 'student')
                .get()
                .then(snapshot => {
                    const studentIds = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.collegeId) {
                            studentIds.push(data.collegeId);
                        } else if (data.enrollment) {
                            studentIds.push(data.enrollment);
                        }
                    });

                    if (studentIds.length === 0) {
                        showToast(false, "Error", "No students registered in database.");
                        playBeep(220, 300);
                        return;
                    }

                    const rand = studentIds[Math.floor(Math.random() * studentIds.length)];
                    if (simCollegeId) {
                        simCollegeId.value = rand;
                    }
                    handlePassScanInput(rand.toString(), false);
                }).catch(err => {
                    console.error("Demo fetch error:", err);
                    showToast(false, "DB Error", err.message);
                });
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
            handlePassScanInput(val, false);
        });
        inputVerifyStudent.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                btnVerifyStudent.click();
            }
        });
    }

    // =========================================================================
    // 10. Archive Checkins / Submit passenger boardings list
    // =========================================================================
    const btnSubmitBoardings = document.getElementById('btn-submit-boardings');
    if (btnSubmitBoardings) {
        btnSubmitBoardings.addEventListener('click', () => {
            if (!selectedBusId) {
                showToast(false, "Submit Failed", "No active bus configuration selected.");
                return;
            }
            if (!confirm("Are you sure you want to submit the passenger boarding list to admin? This will clear the current list and headcount.")) {
                return;
            }

            btnSubmitBoardings.disabled = true;
            btnSubmitBoardings.textContent = "Submitting...";

            const dbRef = window.db || firebase.firestore();

            dbRef.collection(`buses/${selectedBusId}/boardings`).get()
                .then(async (snapshot) => {
                    if (snapshot.empty) {
                        showToast(false, "Submit Failed", "No active passengers in the list to submit.");
                        btnSubmitBoardings.disabled = false;
                        btnSubmitBoardings.textContent = "Submit List to Admin";
                        return;
                    }

                    const batch = dbRef.batch();
                    const submittedCol = dbRef.collection('submitted-boardings');

                    snapshot.forEach(docSnap => {
                        const data = docSnap.data();
                        const newDocRef = submittedCol.doc();
                        batch.set(newDocRef, {
                            studentId: data.studentId || 'Unknown',
                            studentName: data.studentName || 'Unknown',
                            routeName: data.routeName || 'Not Assigned',
                            busNumber: data.busNumber || selectedBusData.number || selectedBusId,
                            busId: selectedBusId,
                            sessionId: 'admin-scan-session',
                            driverEmail: adminEmail,
                            scannedAt: data.scannedAt || new Date().toISOString(),
                            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        // Delete original
                        const originalDocRef = dbRef.collection(`buses/${selectedBusId}/boardings`).doc(docSnap.id);
                        batch.delete(originalDocRef);
                    });

                    // Reset headcount to 0
                    const busDocRef = dbRef.collection('buses').doc(selectedBusId);
                    batch.update(busDocRef, { headcount: 0 });

                    await batch.commit();

                    // Purge local anti-loop scan cache
                    for (const prop in dbReferenceLogs) {
                        if (dbReferenceLogs.hasOwnProperty(prop)) {
                            delete dbReferenceLogs[prop];
                        }
                    }

                    showToast(true, "List Submitted", "Passenger list successfully archived to the admin database.");
                    btnSubmitBoardings.disabled = false;
                    btnSubmitBoardings.textContent = "Submit List to Admin";
                })
                .catch(err => {
                    console.error("Submission error:", err);
                    showToast(false, "Submission Failed", err.message);
                    btnSubmitBoardings.disabled = false;
                    btnSubmitBoardings.textContent = "Submit List to Admin";
                });
        });
    }

    // =========================================================================
    // 11. Toast & Audio Beep Helpers
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
});
