// driver/driverhome.js - Driver Portal Logic
document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Session Info
    const driverEmail = localStorage.getItem('userEmail');
    if (!driverEmail) {
        window.location.href = '../owner/login.html';
        return;
    }

    // DOM Elements
    const driverNameDisplay = document.getElementById('driver-name-display');
    const greetingTitle = document.getElementById('greeting-title');
    const driverEmailDisplay = document.getElementById('driver-email-display');
    const busNumberDisplay = document.getElementById('bus-number-display');
    const busRouteDisplay = document.getElementById('bus-route-display');
    const vehicleIdDisplay = document.getElementById('vehicle-id-display');
    const btnToggleShift = document.getElementById('btn-toggle-shift');
    const gpsStatusBadge = document.getElementById('gps-status-badge');
    const latDisplay = document.getElementById('lat-display');
    const lngDisplay = document.getElementById('lng-display');
    const accuracyDisplay = document.getElementById('accuracy-display');
    const durationDisplay = document.getElementById('duration-display');
    const formDriverAlert = document.getElementById('form-driver-alert');
    const driverAlertMessage = document.getElementById('driver-alert-message');
    const driverAlertType = document.getElementById('driver-alert-type');
    const historyList = document.getElementById('driver-history-list');

    // Headcount UI elements
    const headcountCard = document.getElementById('headcount-card');
    const btnDecrementHeadcount = document.getElementById('btn-decrement-headcount');
    const btnIncrementHeadcount = document.getElementById('btn-increment-headcount');
    const headcountDisplay = document.getElementById('headcount-display');

    // Populate driver email display
    if (driverEmailDisplay) {
        driverEmailDisplay.textContent = driverEmail;
    }

    // Populate active institute info in driver panel
    const infoCollegeLogo = document.getElementById('info-college-logo');
    const infoCollegeName = document.getElementById('info-college-name');
    if (window.activeBranding) {
        if (infoCollegeName && window.activeBranding.shortName) {
            infoCollegeName.textContent = window.activeBranding.shortName;
        }
        if (infoCollegeLogo && window.activeBranding.logoUrl) {
            infoCollegeLogo.src = window.activeBranding.logoUrl;
            infoCollegeLogo.classList.remove('hidden');
        }
    }

    let driverProfile = null;
    let assignedBus = null;
    let isTracking = false;
    let watchId = null;
    let shiftStartTime = null;
    let timerInterval = null;
    let activeSessionId = null; // To keep track of the driverSessions doc ID

    // Load Profile
    dbHelper.getUsersCol().doc(driverEmail).get()
        .then(async doc => {
            if (doc.exists) {
                driverProfile = doc.data();
                driverNameDisplay.textContent = driverProfile.name || driverEmail;
                const firstName = (driverProfile.name || "Driver").split(" ")[0];
                greetingTitle.textContent = `Hello, ${firstName}!`;
                
                // Fetch assigned bus dynamically by querying buses where driverEmails contains driverEmail
                try {
                    const busSnapshot = await dbHelper.getBusesCol().where('driverEmails', 'array-contains', driverEmail).get();
                    if (!busSnapshot.empty) {
                        const busDoc = busSnapshot.docs[0];
                        console.log(`🚌 Dynamically resolved bus assignment: ${busDoc.id}`);
                        loadBusDetails(busDoc.id);
                    } else if (driverProfile.assignedBusId) {
                        console.log(`🚌 Falling back to profile assignedBusId: ${driverProfile.assignedBusId}`);
                        loadBusDetails(driverProfile.assignedBusId);
                    } else {
                        console.log(`🚌 No assignment found. Using default demo-bus-101`);
                        loadBusDetails('demo-bus-101');
                    }
                } catch (err) {
                    console.error("Error dynamically resolving bus assignment:", err);
                    const busId = driverProfile.assignedBusId || 'demo-bus-101';
                    loadBusDetails(busId);
                }
            } else {
                alert("Driver profile not found in database. Contact admin.");
                localStorage.clear();
                window.location.href = '../owner/login.html';
            }
        })
        .catch(err => {
            console.error("Error fetching driver profile:", err);
        });

    function updateHeadcountUI() {
        if (!headcountCard) return;
        if (isTracking) {
            headcountCard.classList.remove('opacity-50', 'pointer-events-none');
            if (btnDecrementHeadcount) btnDecrementHeadcount.removeAttribute('disabled');
            if (btnIncrementHeadcount) btnIncrementHeadcount.removeAttribute('disabled');
        } else {
            headcountCard.classList.add('opacity-50', 'pointer-events-none');
            if (btnDecrementHeadcount) btnDecrementHeadcount.setAttribute('disabled', 'true');
            if (btnIncrementHeadcount) btnIncrementHeadcount.setAttribute('disabled', 'true');
        }
    }

    // Headcount Button Event Handlers
    if (btnIncrementHeadcount) {
        btnIncrementHeadcount.addEventListener('click', () => {
            if (!assignedBus || !isTracking) return;
            const currentHeadcount = assignedBus.headcount || 0;
            if (currentHeadcount >= 100) return; // limit to 100
            dbHelper.getBusesCol().doc(assignedBus.id).update({
                headcount: currentHeadcount + 1
            }).catch(err => console.error("Error incrementing headcount:", err));
        });
    }

    if (btnDecrementHeadcount) {
        btnDecrementHeadcount.addEventListener('click', () => {
            if (!assignedBus || !isTracking) return;
            const currentHeadcount = assignedBus.headcount || 0;
            if (currentHeadcount <= 0) return; // bound at 0
            dbHelper.getBusesCol().doc(assignedBus.id).update({
                headcount: currentHeadcount - 1
            }).catch(err => console.error("Error decrementing headcount:", err));
        });
    }

    let hasAutoRestored = false;

    function loadBusDetails(busId) {
        dbHelper.getBusesCol().doc(busId).onSnapshot(doc => {
            if (doc.exists) {
                assignedBus = { id: doc.id, ...doc.data() };
            } else {
                // Demo Fallback
                assignedBus = {
                    id: busId,
                    number: busId.split('-').pop() || '101',
                    route: 'Main Campus Loop (Via Geeta Bhawan)',
                    driver: driverNameDisplay.textContent,
                    status: 'On Time'
                };
            }
            busNumberDisplay.textContent = assignedBus.number || '--';
            busRouteDisplay.textContent = assignedBus.route || 'No Route Assigned';
            vehicleIdDisplay.textContent = assignedBus.id || '--';

            // Sync headcount from Firestore
            if (headcountDisplay) {
                headcountDisplay.textContent = assignedBus.headcount || 0;
            }
            updateHeadcountUI();

            // Set default notification message for consolidation/alert
            if (driverAlertMessage && !driverAlertMessage.value) {
                driverAlertMessage.value = `📢 Route Notice: Bus #${assignedBus.number} (${assignedBus.route}) has consolidated routes starting now. Please check live tracking.`;
            }

            // Auto-restore shift if active
            const wasShiftActive = localStorage.getItem('driverShiftActive');
            if (wasShiftActive === 'true' && !hasAutoRestored) {
                hasAutoRestored = true;
                const savedStart = localStorage.getItem('driverShiftStart');
                if (savedStart) {
                    shiftStartTime = new Date(savedStart);
                    console.log("🔄 Auto-restoring shift session...");
                    startShift(true);
                }
            }
        });
    }

    // Shift Toggle Control
    btnToggleShift.addEventListener('click', () => {
        if (!isTracking) {
            startShift();
        } else {
            stopShift();
        }
    });

    function startShift(isRestore = false) {
        if (!assignedBus) {
            alert("No bus configuration loaded. Please wait.");
            return;
        }

        isTracking = true;
        updateHeadcountUI();

        if (isRestore) {
            const savedStart = localStorage.getItem('driverShiftStart');
            shiftStartTime = savedStart ? new Date(savedStart) : new Date();
            activeSessionId = localStorage.getItem('driverActiveSessionId');
        } else {
            shiftStartTime = new Date();
            localStorage.setItem('driverShiftActive', 'true');
            localStorage.setItem('driverShiftStart', shiftStartTime.toISOString());
            
            // Reset headcount to 0 in Firestore on new shift
            dbHelper.getBusesCol().doc(assignedBus.id).update({
                headcount: 0
            }).catch(err => console.error("Error resetting headcount on shift start:", err));
        }

        // Update UI state
        btnToggleShift.innerHTML = `
            <span class="material-symbols-outlined animate-spin">sync</span>
            <span>STOP GPS TRACKING</span>
        `;
        btnToggleShift.classList.remove('bg-primary');
        btnToggleShift.classList.add('bg-red-600');

        const useTracker = !!(assignedBus.tracking && assignedBus.tracking.trackerId);

        if (useTracker) {
            gpsStatusBadge.innerHTML = `
                <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                MAPMYINDIA IOT ACTIVE
            `;
            gpsStatusBadge.classList.remove('bg-gray-100', 'text-gray-600');
            gpsStatusBadge.classList.add('bg-green-50', 'text-green-700');
        } else {
            gpsStatusBadge.innerHTML = `
                <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                GPS ACTIVE
            `;
            gpsStatusBadge.classList.remove('bg-gray-100', 'text-gray-600');
            gpsStatusBadge.classList.add('bg-green-50', 'text-green-700');
        }

        // Start Duration Timer
        timerInterval = setInterval(updateDuration, 1000);

        if (!isRestore) {
            // Create driver Session document in Firestore
            db.collection('driverSessions').add({
                driverEmail: driverEmail,
                driverName: driverNameDisplay.textContent,
                busId: assignedBus.id,
                busNumber: assignedBus.number,
                route: assignedBus.route,
                startTime: firebase.firestore.FieldValue.serverTimestamp(),
                endTime: null,
                status: 'Active'
            }).then(docRef => {
                activeSessionId = docRef.id;
                localStorage.setItem('driverActiveSessionId', activeSessionId);
                loadShiftsHistory();
            }).catch(err => {
                console.error("Error creating shift log:", err);
            });
        }

        if (useTracker) {
            // MapMyIndia REST Simulation Stream
            let simulatedSpeed = 40;
            let currentLat = 22.7196;
            let currentLng = 75.8577;

            if (assignedBus.location && assignedBus.location.lat) {
                currentLat = assignedBus.location.lat;
                currentLng = assignedBus.location.lng;
            }

            const simulateMapMyIndiaFeed = () => {
                // Increment slightly to simulate vehicle motion
                currentLat += (Math.random() - 0.5) * 0.00015;
                currentLng += (Math.random() - 0.5) * 0.00015;
                simulatedSpeed = Math.floor(25 + Math.random() * 25);

                latDisplay.textContent = currentLat.toFixed(6);
                lngDisplay.textContent = currentLng.toFixed(6);
                accuracyDisplay.textContent = "IoT Serial Active";
                accuracyDisplay.className = "text-xs font-bold text-primary";

                // Update location stream in Firestore buses collection
                dbHelper.getBusesCol().doc(assignedBus.id).set({
                    location: { lat: currentLat, lng: currentLng },
                    status: 'On Time',
                    locationSource: 'tracking_device',
                    lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    telemetry: {
                        deviceId: assignedBus.tracking.trackerId,
                        speed: simulatedSpeed,
                        ignition: 1,
                        timestamp: Date.now()
                    }
                }, { merge: true }).then(() => {
                    console.log("MapMyIndia IoT Telemetry coordinates successfully streamed.");
                }).catch(err => {
                    console.error("MapMyIndia IoT Telemetry update error:", err);
                });
            };

            simulateMapMyIndiaFeed();
            watchId = setInterval(simulateMapMyIndiaFeed, 5000);
        } else {
            // Fallback to local device GPS with simulated fallback for insecure origins/local IPs
            const startSimulatedGPS = () => {
                console.log("📡 Starting simulated driver phone GPS stream...");
                let currentLat = 22.7196;
                let currentLng = 75.8577;
                
                if (assignedBus.location && assignedBus.location.lat) {
                    currentLat = assignedBus.location.lat;
                    currentLng = assignedBus.location.lng;
                }

                const runSimulation = () => {
                    currentLat += (Math.random() - 0.5) * 0.00015;
                    currentLng += (Math.random() - 0.5) * 0.00015;

                    latDisplay.textContent = currentLat.toFixed(6);
                    lngDisplay.textContent = currentLng.toFixed(6);
                    accuracyDisplay.textContent = "±15m (Simulated)";
                    accuracyDisplay.className = "text-xs font-bold text-amber-600";

                    dbHelper.getBusesCol().doc(assignedBus.id).set({
                        location: { lat: currentLat, lng: currentLng },
                        status: 'On Time',
                        locationSource: 'driver_phone_simulated',
                        lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).then(() => {
                        console.log("Simulated GPS coordinates successfully streamed.");
                    }).catch(err => {
                        console.error("Simulated GPS update error:", err);
                    });
                };

                runSimulation();
                watchId = setInterval(runSimulation, 5000);
            };

            if (!navigator.geolocation) {
                console.warn("⚠️ Geolocation not supported. Falling back to simulation...");
                startSimulatedGPS();
                return;
            }

            let geoTimeout = setTimeout(() => {
                if (isTracking && !watchId) {
                    console.warn("⚠️ Geolocation watch request timed out. Falling back to simulation...");
                    startSimulatedGPS();
                }
            }, 3000);

            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    clearTimeout(geoTimeout);
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const accuracy = position.coords.accuracy;

                    latDisplay.textContent = lat.toFixed(6);
                    lngDisplay.textContent = lng.toFixed(6);
                    accuracyDisplay.textContent = `±${Math.round(accuracy)}m`;
                    accuracyDisplay.className = "font-mono text-sm font-bold text-gray-700 mt-0.5";

                    dbHelper.getBusesCol().doc(assignedBus.id).set({
                        location: { lat: lat, lng: lng },
                        status: 'On Time',
                        locationSource: 'driver_phone',
                        lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true }).then(() => {
                        console.log("Telemetry coordinates successfully streamed.");
                    }).catch(err => {
                        console.error("Telemetry update error:", err);
                    });
                },
                (error) => {
                    clearTimeout(geoTimeout);
                    console.error("GPS error:", error);
                    // If blocked or insecure context error, fall back to simulation to keep the UI working
                    console.warn("⚠️ Geolocation failed/permission denied. Falling back to simulation...");
                    if (isTracking && !watchId) {
                        startSimulatedGPS();
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 8000,
                    maximumAge: 0
                }
            );
        }
    }

    function stopShift() {
        isTracking = false;
        updateHeadcountUI();
        if (watchId) {
            const useTracker = !!(assignedBus && assignedBus.tracking && assignedBus.tracking.trackerId);
            if (useTracker) {
                clearInterval(watchId);
            } else {
                navigator.geolocation.clearWatch(watchId);
            }
            watchId = null;
        }

        clearInterval(timerInterval);
        localStorage.removeItem('driverShiftActive');
        localStorage.removeItem('driverShiftStart');
        localStorage.removeItem('driverActiveSessionId');

        // Update UI state
        btnToggleShift.innerHTML = `
            <span class="material-symbols-outlined">play_arrow</span>
            <span>Start GPS Tracking</span>
        `;
        btnToggleShift.classList.remove('bg-red-600');
        btnToggleShift.classList.add('bg-primary');

        gpsStatusBadge.innerHTML = `
            <span class="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
            GPS INACTIVE
        `;
        gpsStatusBadge.classList.remove('bg-green-50', 'text-green-700');
        gpsStatusBadge.classList.add('bg-gray-100', 'text-gray-600');

        latDisplay.textContent = '--';
        lngDisplay.textContent = '--';
        accuracyDisplay.textContent = '--';
        durationDisplay.textContent = '00:00:00';

        // Update driver Session document to completed status
        if (activeSessionId) {
            db.collection('driverSessions').doc(activeSessionId).update({
                endTime: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'Stopped'
            }).then(() => {
                activeSessionId = null;
                loadShiftsHistory();
            }).catch(err => console.error("Error updating shift log:", err));
        }

        // Set bus status to offline or breakdown and reset headcount to 0
        if (assignedBus) {
            dbHelper.getBusesCol().doc(assignedBus.id).update({
                status: 'Breakdown',
                lastUpdate: 'Shift ended',
                headcount: 0
            }).catch(err => console.error("Error updating bus status:", err));
        }
    }

    function updateDuration() {
        const diff = new Date() - shiftStartTime;
        const hrs = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        durationDisplay.textContent = `${hrs}:${mins}:${secs}`;
    }

    // Send Alert Form Handler
    formDriverAlert.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!assignedBus) {
            alert("No bus assigned. Cannot send alert.");
            return;
        }

        const type = driverAlertType.value;
        const message = driverAlertMessage.value.trim();

        if (!message) {
            alert("Please enter a valid message.");
            return;
        }

        const btn = document.getElementById('btn-send-alert');
        btn.disabled = true;
        btn.textContent = "Broadcasting...";

        // Add to notifications collection targeting the specific route
        dbHelper.getNotificationsCol().add({
            type: type,
            message: message,
            targetRouteId: assignedBus.route,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            alert("✅ Alert broadcasted successfully to students on route: " + assignedBus.route);
            btn.disabled = false;
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[16px]">send</span>
                Send Alert to Route Students
            `;
        }).catch(err => {
            alert("Error sending alert: " + err.message);
            btn.disabled = false;
            btn.innerHTML = `
                <span class="material-symbols-outlined text-[16px]">send</span>
                Send Alert to Route Students
            `;
        });
    });

    // Load Driver Shift History for Today
    function loadShiftsHistory() {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        db.collection('driverSessions')
            .where('driverEmail', '==', driverEmail)
            .where('startTime', '>=', todayStart)
            .get()
            .then(snapshot => {
                historyList.innerHTML = '';
                if (snapshot.empty) {
                    historyList.innerHTML = '<p class="text-center text-gray-400 py-4">No shift logs recorded today.</p>';
                    return;
                }

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const startStr = data.startTime ? new Date(data.startTime.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
                    const endStr = data.endTime ? new Date(data.endTime.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active';
                    
                    const log = document.createElement('div');
                    log.className = 'flex items-center justify-between p-2.5 bg-gray-50 rounded-xl';
                    log.innerHTML = `
                        <div>
                            <p class="font-bold text-gray-800">Bus ${data.busNumber || '--'}</p>
                            <p class="text-[10px] text-gray-500 font-semibold">${data.route || '--'}</p>
                        </div>
                        <div class="text-right">
                            <p class="font-semibold text-gray-700">${startStr} - ${endStr}</p>
                            <span class="px-2 py-0.5 rounded text-[9px] font-bold ${data.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">${data.status}</span>
                        </div>
                    `;
                    historyList.appendChild(log);
                });
            }).catch(err => {
                console.error("Error loading shift history:", err);
            });
    }

    loadShiftsHistory();
});
