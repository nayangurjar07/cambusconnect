// Track page logic - Enhanced live bus tracking with selectable bus support

// ========================================
// 1. GLOBAL VARIABLES
// ========================================
let map;
let markers = {};
let infoWindows = {};
let studentData;
let busesData = [];
let currentMapType = 'roadmap';
let selectedTrackBusId = null;
let isTrackSelectorBound = false;
let trackingInterval = null;
let lastFetchedLocation = null;

function getTrackedBusId() {
    return selectedTrackBusId || studentData?.assignedBusId || null;
}

function getSourceLabel(sourceType) {
    switch(sourceType) {
        case 'driver_phone': return 'Driver Phone';
        case 'conductor_phone': return 'Conductor Phone';
        case 'tracking_device': return 'Tracking Device';
        case 'mapmyindia': return 'MapmyIndia GPS';
        case 'simulated_telematics': return 'Simulated GPS';
        default: return 'Live Tracking';
    }
}

// Global API Poller function for tracked bus
async function refreshLocation() {
    const trackedBusId = getTrackedBusId();
    if (!trackedBusId) return;

    try {
        const authObj = window.auth || (typeof getFirebase === 'function' && getFirebase()?.auth ? getFirebase().auth() : null);
        const currentUser = authObj ? authObj.currentUser : null;
        if (!currentUser) {
            console.log("Auth not ready yet for live location fetch.");
            return;
        }

        const idToken = await currentUser.getIdToken();
        const response = await fetch(`/api/bus-location?busId=${encodeURIComponent(trackedBusId)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("📡 Fresh bus location data received:", data);

        // Store fetched location globally to prevent snapshot overwriting it
        lastFetchedLocation = {
            busId: trackedBusId,
            location: { lat: data.lat, lng: data.lng },
            locationSource: data.source || 'mapmyindia',
            timestamp: data.timestamp
        };

        // Find and update the tracked bus in busesData
        const busIdx = busesData.findIndex(b => b.id === trackedBusId);
        if (busIdx !== -1) {
            busesData[busIdx].location = lastFetchedLocation.location;
            busesData[busIdx].locationSource = lastFetchedLocation.locationSource;
            
            // MapmyIndia source means the bus is active/live
            if (data.source === 'mapmyindia' || data.source === 'simulated_telematics') {
                busesData[busIdx].status = 'On Time'; // Force status to On Time if active telematics
            }

            // Update marker
            updateBusMarker(busesData[busIdx]);
            
            // Trigger UI updates
            renderBusList([...busesData]);
            updateTrackedBusDisplay();
            calculateETA();
            checkTrackedBusStatus();
        }
    } catch (error) {
        console.error("❌ Failed to fetch bus location from API:", error);
    }
}

// ========================================
// 2. INITIALIZE MAP
// ========================================

/**
 * Waits for window.db (set by firebase-init.js ESM module) to be available.
 * Firebase is loaded as an ES module (async), while Google Maps fires initMap
 * via a non-module callback — creating a race condition.
 * This resolves the race by polling with a 50ms interval and a 5s timeout.
 */
function waitForFirebase(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        if (window.db) {
            resolve();
            return;
        }
        const start = Date.now();
        const interval = setInterval(() => {
            if (window.db) {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error('Firebase did not initialize within ' + timeoutMs + 'ms'));
            }
        }, 50);
    });
}

window.initMap = async function() {
    const defaultCenter = { lat: 22.7196, lng: 75.8577 };

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: defaultCenter,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            },
            {
                featureType: 'transit',
                elementType: 'labels',
                stylers: [{ visibility: 'simplified' }]
            }
        ]
    });

    // Map is rendered immediately. Now wait for Firebase & Auth before subscribing.
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
        console.log('✅ Firebase and Auth ready — starting bus tracking.');
        startBusTracking();
    } catch (err) {
        console.error('❌ Firebase failed to initialize before map callback:', err);
        const mapEl = document.getElementById('map');
        if (mapEl) {
            mapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:14px;">Unable to connect to live data. Please refresh.</div>';
        }
    }

    setupMapControls();
};

// ========================================
// 3. START BUS TRACKING
// ========================================
function startBusTracking() {
    studentData = JSON.parse(localStorage.getItem('student'));

    if (!studentData) {
        window.location.href = '../student-login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const paramBus = urlParams.get('bus') || urlParams.get('busId');
    const userKey = studentData.email || localStorage.getItem('userEmail') || 'student';

    if (paramBus) {
        selectedTrackBusId = paramBus;
    } else {
        const savedTrackBusId = localStorage.getItem(`defaultTrackedBusId:${userKey}`) || localStorage.getItem(`trackBusOverride:${userKey}`);
        selectedTrackBusId = savedTrackBusId || studentData.assignedBusId || null;
    }

    setupTrackBusSelector();

    dbHelper.getBusesCol().onSnapshot(snapshot => {
        busesData = [];
        let activeBuses = 0;

        snapshot.forEach(doc => {
            const bus = { id: doc.id, ...doc.data() };

            if (lastFetchedLocation && lastFetchedLocation.busId === bus.id) {
                bus.location = lastFetchedLocation.location;
                bus.locationSource = lastFetchedLocation.locationSource;
                if (lastFetchedLocation.locationSource === 'mapmyindia' || lastFetchedLocation.locationSource === 'simulated_telematics') {
                    bus.status = 'On Time';
                }
            }

            busesData.push(bus);

            if (bus.status === 'On Time' || bus.status === 'Delayed') {
                activeBuses++;
            }

            updateBusMarker(bus);
        });

        // Clean up any residual demo simulation intervals
        if (window.demoInterval) {
            clearInterval(window.demoInterval);
            window.demoInterval = null;
        }

        if (busesData.length === 0) {
            console.log("ℹ️ No active fleet records currently broadcasting from Firestore.");
        }

        const activeBusesEl = document.getElementById('active-buses-count');
        const lastUpdateEl = document.getElementById('last-update-time');

        if (activeBusesEl) activeBusesEl.textContent = activeBuses;
        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        renderTrackBusOptions();
        updateTrackedBusDisplay();
        calculateETA();
        renderBusList([...busesData]);
        checkTrackedBusStatus();

        if (paramBus) {
            focusMyBus();
        }
    }, () => {
        const busListEl = document.getElementById('bus-list');
        if (busListEl) {
            busListEl.innerHTML = `
                <div class="glass-effect rounded-xl p-8 text-center border-2 border-red-200">
                    <p class="text-red-700 font-semibold mb-1">Error loading buses</p>
                    <p class="text-red-600 text-sm">Please refresh the page</p>
                </div>
            `;
        }
    });

    if (trackingInterval) {
        clearInterval(trackingInterval);
    }
    
    const authHandler = window.auth || (typeof getFirebase === 'function' && getFirebase()?.auth ? getFirebase().auth() : null);
    if (authHandler && typeof authHandler.onAuthStateChanged === 'function') {
        authHandler.onAuthStateChanged(user => {
            if (user) {
                refreshLocation();
            }
        });
    }
    trackingInterval = setInterval(refreshLocation, 10000);
}

// ========================================
// 4. UPDATE/CREATE BUS MARKERS
// ========================================
function updateBusMarker(bus) {
    if (!bus.location || !bus.location.lat || !bus.location.lng) {
        return;
    }

    const position = {
        lat: bus.location.lat,
        lng: bus.location.lng
    };

    if (markers[bus.id]) {
        markers[bus.id].setPosition(position);
        
        const isTrackedBus = getTrackedBusId() === bus.id;
        const icon = {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: isTrackedBus ? '#4f46e5' : getStatusColor(bus.status),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: isTrackedBus ? 2 : 1.5,
            anchor: new google.maps.Point(12, 22)
        };
        markers[bus.id].setIcon(icon);
        markers[bus.id].setZIndex(isTrackedBus ? 1000 : 1);

        const content = createInfoWindowContent(bus);
        infoWindows[bus.id].setContent(content);
    } else {
        const isTrackedBus = getTrackedBusId() === bus.id;

        const icon = {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: isTrackedBus ? '#4f46e5' : getStatusColor(bus.status),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            scale: isTrackedBus ? 2 : 1.5,
            anchor: new google.maps.Point(12, 22)
        };

        const marker = new google.maps.Marker({
            position,
            map,
            icon,
            title: `Bus ${bus.number}`,
            animation: google.maps.Animation.DROP,
            zIndex: isTrackedBus ? 1000 : 1
        });

        const content = createInfoWindowContent(bus);
        const infoWindow = new google.maps.InfoWindow({
            content,
            maxWidth: 300
        });

        marker.addListener('click', () => {
            Object.values(infoWindows).forEach(iw => iw.close());
            infoWindow.open(map, marker);
        });

        markers[bus.id] = marker;
        infoWindows[bus.id] = infoWindow;

        if (isTrackedBus) {
            setTimeout(() => {
                infoWindow.open(map, marker);
                map.setCenter(position);
                map.setZoom(15);
            }, 500);
        }
    }
}

// ========================================
// 5. CREATE INFO WINDOW CONTENT
// ========================================
function createInfoWindowContent(bus) {
    const statusClass = getStatusClass(bus.status);
    const lastUpdate = bus.lastUpdate || 'Just now';
    const isTrackedBus = getTrackedBusId() === bus.id;
    const sourceLabel = getSourceLabel(bus.locationSource || bus.tracking?.sourceType);

    return `
        <div class="bus-info-window">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <h3 style="margin: 0;">Bus ${bus.number}</h3>
                ${isTrackedBus ? '<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700;">TRACKING</span>' : ''}
            </div>
            <p><strong>Route:</strong> ${bus.route}</p>
            <p><strong>Driver:</strong> ${bus.driver || 'N/A'}</p>
            <p><strong>Conductor:</strong> ${bus.conductor || 'N/A'}</p>
            <p><strong>Contact:</strong> ${bus.phone || 'N/A'}</p>
            <p><strong>Source:</strong> ${sourceLabel}</p>
            <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${bus.status}</span></p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 4px;"><strong>Updated:</strong> ${lastUpdate}</p>
        </div>
    `;
}

// ========================================
// 6. TRACKED BUS ALERT
// ========================================
function showMyBusAlert(bus) {
    const alertEl = document.getElementById('my-bus-alert');
    const alertTextEl = document.getElementById('my-bus-alert-text');

    if (!alertEl || !alertTextEl) return;

    let message = '';

    if (bus.status === 'On Time') {
        message = `Tracking Bus #${bus.number}. It is running on schedule.`;
    } else if (bus.status === 'Delayed') {
        message = `Tracking Bus #${bus.number}. It is delayed. Please check the live map.`;
    } else if (bus.status === 'Breakdown') {
        message = `Tracking Bus #${bus.number} is experiencing issues.`;
    } else {
        message = `Tracking Bus #${bus.number} status: ${bus.status}`;
    }

    alertTextEl.textContent = message;
    alertEl.classList.remove('hidden');
}

// ========================================
// 7. CALCULATE ETA
// ========================================
function calculateETA() {
    const trackedBusId = getTrackedBusId();
    const etaEl = document.getElementById('eta-display');

    if (!etaEl) return;
    if (!trackedBusId) {
        etaEl.textContent = 'ETA unavailable';
        return;
    }

    const trackedBus = busesData.find(b => b.id === trackedBusId);
    if (trackedBus && (trackedBus.etaMinutes || trackedBus.eta)) {
        const val = parseInt(trackedBus.etaMinutes || trackedBus.eta, 10);
        etaEl.textContent = isNaN(val) ? (trackedBus.etaMinutes || trackedBus.eta) : `${val}m`;
    } else if (trackedBus && trackedBus.location && (trackedBus.location.lat || trackedBus.location.latitude)) {
        const lat = trackedBus.location.lat || trackedBus.location.latitude;
        const lng = trackedBus.location.lng || trackedBus.location.longitude;
        // Campus reference coords (22.7196, 75.8577)
        const dLat = (lat - 22.7196) * 111;
        const dLng = (lng - 75.8577) * 102;
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        const speed = trackedBus.speed || (trackedBus.telemetry && trackedBus.telemetry.speed);
        if (speed && speed > 5) {
            const min = Math.max(1, Math.round((distKm / speed) * 60));
            etaEl.textContent = `${min}m`;
        } else {
            etaEl.textContent = 'ETA unavailable';
        }
    } else {
        etaEl.textContent = 'ETA unavailable';
    }
}

// ========================================
// 8. RENDER BUS LIST
// ========================================
function renderBusList(buses) {
    const listContainer = document.getElementById('bus-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (buses.length === 0) {
        const isSearch = document.getElementById('search-input')?.value?.trim();
        const emptyTitle = isSearch ? "No Matching Transit Vehicles" : "No Active Buses on Route";
        const emptyDesc = isSearch 
            ? "No active campus shuttles match your search criteria. Check your spelling or view all operating routes."
            : "There are currently no active buses broadcasting telemetry for your route. Please verify your assigned bus with campus transit administration.";

        listContainer.innerHTML = `
            <div class="bg-white rounded-2xl p-6 sm:p-8 text-center border border-gray-200 shadow-sm space-y-3" id="empty-fleet-state">
                <div class="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center mx-auto">
                    <span class="material-symbols-outlined text-3xl">${isSearch ? 'search_off' : 'directions_bus'}</span>
                </div>
                <h4 class="font-bold text-slate-800 text-sm sm:text-base">${emptyTitle}</h4>
                <p class="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">${emptyDesc}</p>
                ${isSearch ? `
                <button id="clear-search-btn" class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition-all shadow-sm active:scale-95">
                    <span class="material-symbols-outlined text-sm">refresh</span> Show All Active Buses
                </button>
                ` : ''}
            </div>
        `;
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.value = '';
                renderBusList([...busesData]);
            });
        }
        return;
    }

    const trackedBusId = getTrackedBusId();

    buses.sort((a, b) => {
        if (a.id === trackedBusId) return -1;
        if (b.id === trackedBusId) return 1;
        return a.number.localeCompare(b.number);
    });

    buses.forEach(bus => {
        const isTrackedBus = trackedBusId === bus.id;
        const statusColor = getStatusColor(bus.status);
        const hasLocation = bus.location && bus.location.lat && bus.location.lng;
        const sourceLabel = getSourceLabel(bus.locationSource || bus.tracking?.sourceType);

        const card = document.createElement('div');
        card.className = `bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all border ${
            isTrackedBus ? 'border-primary ring-2 ring-blue-100' : 'border-gray-200'
        }`;

        card.innerHTML = `
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-start space-x-3 flex-1 min-w-0">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-white shadow-sm shrink-0" style="background: linear-gradient(135deg, ${statusColor}, ${adjustColor(statusColor, -20)})">
                        <span class="text-base font-mono">${bus.number}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                            <h4 class="font-bold text-slate-800 text-sm truncate">Shuttle ${bus.number}</h4>
                            ${isTrackedBus ? '<span class="bg-blue-100 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">FOLLOWING</span>' : ''}
                        </div>
                        <p class="text-xs text-gray-600 truncate mb-1 font-medium">${bus.route}</p>
                        <div class="flex items-center gap-3 text-[11px] text-gray-400">
                            <span>Driver: <strong class="text-gray-600">${bus.driver || 'Assigned'}</strong></span>
                            <span>•</span>
                            <span class="text-emerald-700">${sourceLabel}</span>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-end shrink-0 gap-2">
                    <span class="inline-block px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wide uppercase" style="background-color: ${statusColor}18; color: ${statusColor}">
                        ${bus.status}
                    </span>
                    ${hasLocation ? `
                        <button onclick="focusBus('${bus.id}')" class="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95">
                            <span class="material-symbols-outlined text-sm">my_location</span>
                            <span>Follow</span>
                        </button>
                    ` : '<span class="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-lg font-medium">Offline</span>'}
                </div>
            </div>
        `;

        listContainer.appendChild(card);
    });
}

// ========================================
// 9. BUS FOCUS ACTIONS
// ========================================
window.focusBus = function(busId) {
    const marker = markers[busId];
    const infoWindow = infoWindows[busId];

    if (marker && infoWindow) {
        selectedTrackBusId = busId;
        const userKey = studentData.email || localStorage.getItem('userEmail') || 'student';
        localStorage.setItem(`defaultTrackedBusId:${userKey}`, busId);
        localStorage.setItem(`trackBusOverride:${userKey}`, busId);

        renderTrackBusOptions();
        updateTrackedBusDisplay();
        calculateETA();
        checkTrackedBusStatus();

        Object.values(infoWindows).forEach(iw => iw.close());
        map.setCenter(marker.getPosition());
        map.setZoom(16);
        infoWindow.open(map, marker);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

window.focusMyBus = function() {
    const trackedBusId = getTrackedBusId();
    if (trackedBusId) {
        focusBus(trackedBusId);
    }
};

// ========================================
// 10. MAP CONTROLS + TRACK SELECTOR
// ========================================
function setupMapControls() {
    const centerBtn = document.getElementById('center-map-btn');
    if (centerBtn) {
        centerBtn.addEventListener('click', () => {
            const trackedBusId = getTrackedBusId();
            if (trackedBusId && markers[trackedBusId]) {
                const marker = markers[trackedBusId];
                map.setCenter(marker.getPosition());
                map.setZoom(15);
                infoWindows[trackedBusId].open(map, marker);
            } else if (Object.keys(markers).length > 0) {
                const bounds = new google.maps.LatLngBounds();
                Object.values(markers).forEach(marker => bounds.extend(marker.getPosition()));
                map.fitBounds(bounds);
            }
        });
    }

    const viewModeBtn = document.getElementById('view-mode-btn');
    if (viewModeBtn) {
        viewModeBtn.addEventListener('click', () => {
            if (currentMapType === 'roadmap') {
                map.setMapTypeId('satellite');
                currentMapType = 'satellite';
                viewModeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span>Roadmap</span>
                `;
            } else {
                map.setMapTypeId('roadmap');
                currentMapType = 'roadmap';
                viewModeBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <span>Satellite</span>
                `;
            }
        });
    }

    // Mobile Drawer Toggle
    const menuBtn = document.getElementById('menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-button-icon');

    if (menuBtn && mobileMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = mobileMenu.classList.contains('hidden');
            if (isHidden) {
                mobileMenu.classList.remove('hidden');
                menuBtn.setAttribute('aria-expanded', 'true');
                if (menuIcon) menuIcon.textContent = 'close';
            } else {
                mobileMenu.classList.add('hidden');
                menuBtn.setAttribute('aria-expanded', 'false');
                if (menuIcon) menuIcon.textContent = 'menu';
            }
        });

        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !mobileMenu.contains(e.target)) {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    menuBtn.setAttribute('aria-expanded', 'false');
                    if (menuIcon) menuIcon.textContent = 'menu';
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                menuBtn.setAttribute('aria-expanded', 'false');
                if (menuIcon) menuIcon.textContent = 'menu';
            }
        });
    }
}

function renderTrackBusOptions() {
    const selectEl = document.getElementById('track-bus-select');
    if (!selectEl) return;

    const current = getTrackedBusId();
    const sorted = [...busesData].sort((a, b) => a.number.localeCompare(b.number));

    selectEl.innerHTML = '';

    if (sorted.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No buses available';
        selectEl.appendChild(opt);
        return;
    }

    sorted.forEach(bus => {
        const option = document.createElement('option');
        option.value = bus.id;
        option.textContent = `Bus ${bus.number} - ${bus.route}`;
        selectEl.appendChild(option);
    });

    const matchingBus = current ? sorted.find(b => b.id === current || String(b.number) === String(current)) : null;
    if (matchingBus) {
        selectedTrackBusId = matchingBus.id;
        selectEl.value = matchingBus.id;
    } else if (sorted.length > 0) {
        selectedTrackBusId = sorted[0].id;
        selectEl.value = sorted[0].id;
    }
}

function updateTrackedBusDisplay() {
    const trackedBusId = getTrackedBusId();
    if (!trackedBusId) return;

    const trackedBus = busesData.find(b => b.id === trackedBusId);
    if (!trackedBus) return;

    const myBusNum = document.getElementById('my-bus-number');
    const myBusStatus = document.getElementById('my-bus-status');

    if (myBusNum) myBusNum.textContent = `#${trackedBus.number}`;
    if (myBusStatus) {
        myBusStatus.textContent = trackedBus.status;
        myBusStatus.className = `text-xs font-medium mt-2 ${getStatusTextColor(trackedBus.status)}`;
    }

    showMyBusAlert(trackedBus);

    busesData.forEach(bus => {
        updateBusMarker(bus);
    });
}

function checkTrackedBusStatus() {
    const trackedBusId = getTrackedBusId();
    const offlineAlert = document.getElementById('offline-bus-alert');
    const offlineAlertText = document.getElementById('offline-bus-alert-text');
    const searchInput = document.getElementById('search-input');

    if (!trackedBusId) return;

    const bus = busesData.find(b => b.id === trackedBusId);
    const isStale = !bus || bus.status === 'Breakdown' || bus.status === 'Offline';

    if (isStale && offlineAlert && offlineAlertText) {
        const busNum = bus ? `Bus #${bus.number}` : `assigned Bus`;
        offlineAlertText.textContent = `Your default tracked ${busNum} is currently offline. Showing active routes.`;
        offlineAlert.classList.remove('hidden');

        if (searchInput) {
            searchInput.focus();
            searchInput.classList.add('ring-2', 'ring-amber-500', 'border-transparent');
            setTimeout(() => {
                searchInput.classList.remove('ring-2', 'ring-amber-500', 'border-transparent');
            }, 3000);
        }
    } else if (offlineAlert) {
        offlineAlert.classList.add('hidden');
    }
}

function setupTrackBusSelector() {
    if (isTrackSelectorBound) return;

    const selectEl = document.getElementById('track-bus-select');
    const resetBtn = document.getElementById('track-assigned-btn');
    const searchInput = document.getElementById('search-input');

    if (!selectEl || !resetBtn) return;

    selectEl.addEventListener('change', () => {
        selectedTrackBusId = selectEl.value || studentData.assignedBusId || null;
        const userKey = studentData.email || localStorage.getItem('userEmail') || 'student';
        localStorage.setItem(`defaultTrackedBusId:${userKey}`, selectedTrackBusId || '');
        localStorage.setItem(`trackBusOverride:${userKey}`, selectedTrackBusId || '');

        refreshLocation();

        updateTrackedBusDisplay();
        calculateETA();
        focusMyBus();
        renderBusList([...busesData]);
        checkTrackedBusStatus();
    });

    resetBtn.addEventListener('click', () => {
        selectedTrackBusId = studentData.assignedBusId || null;
        const userKey = studentData.email || localStorage.getItem('userEmail') || 'student';
        localStorage.removeItem(`defaultTrackedBusId:${userKey}`);
        localStorage.removeItem(`trackBusOverride:${userKey}`);

        refreshLocation();

        renderTrackBusOptions();
        updateTrackedBusDisplay();
        calculateETA();
        focusMyBus();
        renderBusList([...busesData]);
        checkTrackedBusStatus();
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (query === '') {
                renderBusList([...busesData]);
            } else {
                const filtered = busesData.filter(bus => 
                    (bus.number && bus.number.toLowerCase().includes(query)) ||
                    (bus.route && bus.route.toLowerCase().includes(query))
                );
                renderBusList(filtered);
            }
        });
    }

    isTrackSelectorBound = true;
}

// ========================================
// 11. UTILITY FUNCTIONS
// ========================================
function getStatusColor(status) {
    switch(status) {
        case 'On Time': return '#10b981';
        case 'Delayed': return '#f59e0b';
        case 'Breakdown': return '#ef4444';
        default: return '#6b7280';
    }
}

function getStatusTextColor(status) {
    switch(status) {
        case 'On Time': return 'text-green-600';
        case 'Delayed': return 'text-orange-600';
        case 'Breakdown': return 'text-red-600';
        default: return 'text-gray-600';
    }
}

function getStatusClass(status) {
    switch(status) {
        case 'On Time': return 'status-ontime';
        case 'Delayed': return 'status-delayed';
        case 'Breakdown': return 'status-breakdown';
        default: return '';
    }
}

function adjustColor(color, amount) {
    const clamp = (num) => Math.min(Math.max(num, 0), 255);
    const num = parseInt(color.replace('#', ''), 16);
    const r = clamp((num >> 16) + amount);
    const g = clamp(((num >> 8) & 0x00FF) + amount);
    const b = clamp((num & 0x0000FF) + amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
