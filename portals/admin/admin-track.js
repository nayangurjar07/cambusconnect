// Global variables
let map;
let markers = {};
let infoWindows = {};
let busesData = [];
let currentFilter = 'all';
let selectedBusId = null;
let trackerGoogleConnection = {
    connected: false,
    email: ''
};

function getSourceLabel(sourceType) {
    switch (sourceType) {
        case 'driver_phone': return 'Driver Phone';
        case 'conductor_phone': return 'Conductor Phone';
        case 'tracking_device': return 'Tracking Device';
        default: return 'Manual';
    }
}

function updateGoogleStatusField() {
    const statusEl = document.getElementById('modal-google-status');
    if (!statusEl) return;
    statusEl.value = trackerGoogleConnection.connected
        ? trackerGoogleConnection.email
        : 'Not connected';
}

// Initialize map
window.initMap = function() {
    console.log("Google Maps API loaded for Admin");
    
    // Default center (College location - change this to your college coordinates)
    const collegeLocation = { lat: 22.7196, lng: 75.8577 }; // Indore, India
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: collegeLocation,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        mapTypeId: 'roadmap',
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });
    
    // Add college marker
    new google.maps.Marker({
        position: collegeLocation,
        map: map,
        icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3" fill="white"/>
                </svg>
            `),
            scaledSize: new google.maps.Size(40, 40)
        },
        title: "College Campus"
    });
    
    console.log("Admin map initialized");
    startBusTracking();
};

// Start tracking all buses
async function startBusTracking() {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable in admin tracking:", err);
        return;
    }

    dbHelper.getBusesCol().onSnapshot(snapshot => {
        busesData = [];
        let activeBuses = 0;
        
        snapshot.forEach(doc => {
            const bus = { id: doc.id, ...doc.data() };
            busesData.push(bus);
            
            if (bus.status === 'On Time' || bus.status === 'Delayed') {
                activeBuses++;
            }
            
            updateBusMarker(bus);
        });

        // Clear any markers for buses that were removed
        const currentBusIds = new Set(busesData.map(b => b.id));
        Object.keys(markers).forEach(id => {
            if (!currentBusIds.has(id)) {
                markers[id].setMap(null);
                delete markers[id];
                if (infoWindows[id]) delete infoWindows[id];
            }
        });
        
        // Update header stats (desktop and mobile)
        document.getElementById('header-active-count').textContent = activeBuses;
        document.getElementById('header-total-count').textContent = busesData.length;
        
        // Update mobile stats
        const mobileActiveCount = document.getElementById('header-active-count-mobile');
        const mobileTotalCount = document.getElementById('header-total-count-mobile');
        if (mobileActiveCount) mobileActiveCount.textContent = activeBuses;
        if (mobileTotalCount) mobileTotalCount.textContent = busesData.length;
        
        // Render filtered list
        renderBusList();
        
    }, error => {
        console.error("Error fetching buses:", error);
    });
}


function evaluateBusHealth(bus, staleThresholdSeconds = 60) {
    const hasCoords = Boolean(bus && bus.location && typeof bus.location.lat === 'number' && typeof bus.location.lng === 'number');
    let lastHeartbeatMs = 0;
    if (bus && bus.activeBroadcaster && bus.activeBroadcaster.lastHeartbeat) {
        if (typeof bus.activeBroadcaster.lastHeartbeat.toMillis === 'function') {
            lastHeartbeatMs = bus.activeBroadcaster.lastHeartbeat.toMillis();
        } else {
            lastHeartbeatMs = new Date(bus.activeBroadcaster.lastHeartbeat).getTime();
        }
    } else if (bus && bus.lastUpdated) {
        if (typeof bus.lastUpdated.toMillis === 'function') {
            lastHeartbeatMs = bus.lastUpdated.toMillis();
        } else {
            lastHeartbeatMs = new Date(bus.lastUpdated).getTime();
        }
    }
    const now = Date.now();
    const diffSec = lastHeartbeatMs > 0 ? Math.max(0, Math.floor((now - lastHeartbeatMs) / 1000)) : 999999;
    
    if (!hasCoords || diffSec > 180 || bus.isTracking === false) {
        return {
            isLive: false,
            status: 'OFFLINE',
            badgeColor: '#ef4444',
            label: 'Location Unavailable',
            detail: diffSec > 180 && lastHeartbeatMs > 0 ? `Offline (${Math.floor(diffSec/60)}m ago)` : 'Never started',
            diffSec
        };
    }
    if (diffSec > staleThresholdSeconds) {
        return {
            isLive: false,
            status: 'STALE',
            badgeColor: '#f59e0b',
            label: 'Telemetry Stale',
            detail: `Stale (${diffSec}s ago)`,
            diffSec
        };
    }
    return {
        isLive: true,
        status: 'LIVE',
        badgeColor: '#10b981',
        label: 'Live',
        detail: `Broadcasting (${diffSec}s ago)`,
        diffSec
    };
}

// Update or create bus marker
function updateBusMarker(bus) {
    const rawLat = bus.location?.lat;
    const rawLng = bus.location?.lng;
    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(rawLat);
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(rawLng);
    const hasCoords = typeof lat === 'number' && !isNaN(lat) && lat !== 0 && typeof lng === 'number' && !isNaN(lng) && lng !== 0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    if (!hasCoords) {
        // If no valid numeric location coordinates, remove marker if exists
        if (markers[bus.id]) {
            markers[bus.id].setMap(null);
            delete markers[bus.id];
            if (infoWindows[bus.id]) {
                infoWindows[bus.id].close();
                delete infoWindows[bus.id];
            }
        }
        return;
    }
    
    const position = { lat, lng };
    
    if (markers[bus.id]) {
        // Update existing marker
        markers[bus.id].setPosition(position);
        
        // Update icon color based on status
        const icon = createBusIcon(bus);
        markers[bus.id].setIcon(icon);
        
        // Update info window
        const content = createInfoWindowContent(bus);
        if (infoWindows[bus.id] && content && content.trim() !== '') {
            infoWindows[bus.id].setContent(content);
        }
    } else {
        // Create new marker
        const icon = createBusIcon(bus);
        
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: icon,
            title: `Bus ${bus.number}`,
            animation: google.maps.Animation.DROP
        });
        
        // Create info window
        const content = createInfoWindowContent(bus);
        const infoWindow = new google.maps.InfoWindow({
            content: content || '<div>Loading vehicle details...</div>',
            maxWidth: 250
        });
        
        // Click listener
        marker.addListener('click', () => {
            Object.values(infoWindows).forEach(iw => iw.close());
            if (content && content.trim() !== '') {
                infoWindow.open(map, marker);
            }
        });
        
        markers[bus.id] = marker;
        infoWindows[bus.id] = infoWindow;
    }
}

// Create custom bus icon
function createBusIcon(busOrStatus) {
    let color = '#10b981';
    if (typeof busOrStatus === 'object') {
        const health = evaluateBusHealth(busOrStatus);
        color = health.badgeColor;
    } else {
        color = getStatusColor(busOrStatus);
    }
    
    return {
        path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
        fillColor: color,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        scale: 1.5,
        anchor: new google.maps.Point(12, 22)
    };
}

// Create info window HTML
function createInfoWindowContent(bus) {
    const health = evaluateBusHealth(bus);
    const statusClass = getStatusClass(bus.status);
    const lastUpdate = health.detail || bus.lastUpdate || 'Just now';
    const sourceType = bus.locationSource || bus.tracking?.sourceType;
    const sourceLabel = getSourceLabel(sourceType);
    const trackerId = bus.tracking?.trackerId || '-';
    const broadcaster = bus.activeBroadcaster?.userName ? `${bus.activeBroadcaster.userName} (${bus.activeBroadcaster.role || 'Active'})` : (bus.driver || 'N/A');
    
    return `
        <div class="bus-info-window" style="font-family: inherit; font-size: 13px; line-height: 1.4; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b;">Bus ${bus.number}</h3>
                <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: white; background: ${health.badgeColor};">
                    ${health.label}
                </span>
            </div>
            <p style="margin: 3px 0;"><strong>Route:</strong> ${bus.route || 'Campus Route'}</p>
            <p style="margin: 3px 0;"><strong>Broadcaster:</strong> <span style="color: #2563eb; font-weight: 600;">${broadcaster}</span></p>
            <p style="margin: 3px 0;"><strong>Schedule:</strong> <span class="status-badge ${statusClass}">${bus.status}</span></p>
            <p style="margin: 3px 0;"><strong>Occupancy:</strong> <span style="font-weight: bold; color: #4f46e5;">${bus.headcount || 0} / ${bus.capacity || 45} seats</span></p>
            <p style="margin: 3px 0;"><strong>Heartbeat:</strong> ${lastUpdate}</p>
            <button onclick="openUpdateModal('${bus.id}')" style="margin-top: 6px; width: 100%; padding: 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; font-size: 11px; cursor: pointer;">Update Telemetry Override</button>
        </div>
    `;
}

// Render bus list in sidebar
function renderBusList() {
    const listContainer = document.getElementById('bus-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    
    // Evaluate health across all fleet buses
    let liveCount = 0;
    let offlineCount = 0;
    const offlineBuses = [];

    busesData.forEach(bus => {
        const health = evaluateBusHealth(bus);
        if (health.isLive) {
            liveCount++;
        } else {
            offlineCount++;
            offlineBuses.push(bus);
        }
    });

    // Update count labels in UI
    const filterAllEl = document.getElementById('filter-all-count');
    const filterLiveEl = document.getElementById('filter-live-count');
    const filterOfflineEl = document.getElementById('filter-offline-count');
    const headerActiveEl = document.getElementById('header-active-count');
    const headerTotalEl = document.getElementById('header-total-count');

    if (filterAllEl) filterAllEl.textContent = busesData.length;
    if (filterLiveEl) filterLiveEl.textContent = liveCount;
    if (filterOfflineEl) filterOfflineEl.textContent = offlineCount;
    if (headerActiveEl) headerActiveEl.textContent = liveCount;
    if (headerTotalEl) headerTotalEl.textContent = busesData.length;

    // Control Alert Banner visibility
    const alertBanner = document.getElementById('fleet-alert-banner');
    const alertMessage = document.getElementById('fleet-alert-message');
    if (alertBanner && alertMessage) {
        if (offlineCount > 0) {
            alertBanner.classList.remove('hidden');
            const busNames = offlineBuses.slice(0, 3).map(b => `Bus ${b.number}`).join(', ');
            const extra = offlineBuses.length > 3 ? ` +${offlineBuses.length - 3} more` : '';
            alertMessage.textContent = `Tracking Alert: ${offlineCount} registered vehicle${offlineCount > 1 ? 's' : ''} have unavailable live locations (${busNames}${extra}).`;
        } else {
            alertBanner.classList.add('hidden');
        }
    }
    
    // Filter buses based on active selection
    let filtered = busesData;
    if (currentFilter === 'live') {
        filtered = busesData.filter(b => evaluateBusHealth(b).isLive);
    } else if (currentFilter === 'offline') {
        filtered = busesData.filter(b => !evaluateBusHealth(b).isLive);
    } else if (currentFilter === 'on-time') {
        filtered = busesData.filter(b => b.status === 'On Time');
    } else if (currentFilter === 'delayed') {
        filtered = busesData.filter(b => b.status === 'Delayed');
    } else if (currentFilter === 'issues') {
        filtered = busesData.filter(b => b.status === 'Breakdown' || b.status === 'Delayed');
    }
    
    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-8 bg-white border border-gray-100 rounded-xl p-4">
                <span class="material-symbols-outlined text-3xl text-gray-300">directions_bus</span>
                <p class="text-gray-500 text-xs font-semibold mt-2">No buses match the filter '${currentFilter}'</p>
            </div>
        `;
        return;
    }
    
    filtered.forEach(bus => {
        const health = evaluateBusHealth(bus);
        const hasLocation = Boolean(bus.location && typeof bus.location.lat === 'number' && typeof bus.location.lng === 'number');
        const broadcasterLabel = bus.activeBroadcaster?.userName 
            ? `${bus.activeBroadcaster.userName} (${bus.activeBroadcaster.role || 'Staff'})` 
            : (bus.driver || 'Assigned Driver');
        
        const card = document.createElement('div');
        card.className = `bg-white rounded-xl p-3.5 border-2 transition cursor-pointer ${
            health.isLive ? 'border-gray-100 hover:border-emerald-300' : 'border-amber-100/80 hover:border-amber-300 bg-amber-50/20'
        } hover:shadow-md`;
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-2">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm" style="background-color: ${health.badgeColor}">
                        ${bus.number}
                    </div>
                    <div>
                        <div class="flex items-center gap-1.5">
                            <h4 class="font-bold text-gray-800 text-sm">Bus ${bus.number}</h4>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background-color: ${health.badgeColor}20; color: ${health.badgeColor}">
                                ${health.label}
                            </span>
                        </div>
                        <p class="text-xs text-gray-500">${bus.route || 'Campus Route'}</p>
                        <p class="text-[11px] text-blue-600 font-medium">Broadcast: ${broadcasterLabel}</p>
                    </div>
                </div>
            </div>
            <div class="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                <span class="flex items-center gap-1.5 font-medium">
                    <span class="text-slate-500">${health.detail}</span>
                    <span class="text-slate-300">|</span>
                    <span class="material-symbols-outlined text-[15px] text-blue-600" style="font-variation-settings: 'FILL' 1;">groups</span>
                    <span class="font-bold text-blue-600">${bus.headcount || 0} Riders</span>
                </span>
                ${hasLocation ? 
                    `<button onclick="event.stopPropagation(); focusBus('${bus.id}')" class="text-blue-600 hover:text-blue-700 font-semibold px-2 py-0.5 rounded hover:bg-blue-50">Locate</button>` : 
                    '<span class="text-rose-500 font-semibold">No GPS</span>'
                }
            </div>
        `;
        
        card.onclick = () => {
            if (hasLocation) {
                focusBus(bus.id);
            }
        };
        
        listContainer.appendChild(card);
    });
}

// Global filter switcher for alert button
window.filterOfflineBuses = function() {
    currentFilter = 'offline';
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        if (btn.dataset.filter === 'offline') {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-gray-100', 'text-gray-700');
        }
    });
    renderBusList();
};

// Focus on specific bus
window.focusBus = function(busId) {
    const marker = markers[busId];
    const infoWindow = infoWindows[busId];
    
    if (marker && infoWindow) {
        Object.values(infoWindows).forEach(iw => iw.close());
        map.setCenter(marker.getPosition());
        map.setZoom(16);
        infoWindow.open(map, marker);
    } else {
        alert('This bus has no GPS location data.');
    }
};

// Get color based on status
function getStatusColor(status) {
    switch(status) {
        case 'On Time': return '#10b981';
        case 'Delayed': return '#f59e0b';
        case 'Breakdown': return '#ef4444';
        default: return '#6b7280';
    }
}

// Get CSS class for status
function getStatusClass(status) {
    switch(status) {
        case 'On Time': return 'status-ontime';
        case 'Delayed': return 'status-delayed';
        case 'Breakdown': return 'status-breakdown';
        default: return '';
    }
}

// Open update location modal
window.openUpdateModal = function(busId) {
    selectedBusId = busId;
    const bus = busesData.find(b => b.id === busId);
    
    if (!bus) return;
    
    document.getElementById('modal-bus-number').value = `Bus ${bus.number}`;
    
    // Pre-fill with current location if exists
    if (bus.location && bus.location.lat && bus.location.lng) {
        document.getElementById('modal-lat').value = bus.location.lat;
        document.getElementById('modal-lng').value = bus.location.lng;
    } else {
        document.getElementById('modal-lat').value = '';
        document.getElementById('modal-lng').value = '';
    }

    const sourceTypeEl = document.getElementById('modal-source-type');
    const trackerIdEl = document.getElementById('modal-tracker-id');
    if (sourceTypeEl) {
        sourceTypeEl.value = bus.locationSource || bus.tracking?.sourceType || 'driver_phone';
    }
    if (trackerIdEl) {
        trackerIdEl.value = bus.tracking?.trackerId || '';
    }

    trackerGoogleConnection = {
        connected: !!bus.tracking?.googleAccount?.connected,
        email: bus.tracking?.googleAccount?.email || ''
    };
    updateGoogleStatusField();
    
    const modal = document.getElementById('update-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
};

// Close modal
window.closeUpdateModal = function() {
    const modal = document.getElementById('update-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    selectedBusId = null;
    trackerGoogleConnection = {
        connected: false,
        email: ''
    };
    updateGoogleStatusField();
};

// Get current location (admin's location for demo)
window.getCurrentLocation = function() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('modal-lat').value = position.coords.latitude;
                document.getElementById('modal-lng').value = position.coords.longitude;
            },
            (error) => {
                alert('Could not get your location: ' + error.message);
            }
        );
    } else {
        alert('Geolocation is not supported by your browser');
    }
};

// Update bus location in Firebase
window.updateBusLocation = function() {
    if (!selectedBusId) return;
    
    const lat = parseFloat(document.getElementById('modal-lat').value);
    const lng = parseFloat(document.getElementById('modal-lng').value);
    const sourceType = document.getElementById('modal-source-type')?.value || 'driver_phone';
    const trackerId = (document.getElementById('modal-tracker-id')?.value || '').trim();
    
    if (isNaN(lat) || isNaN(lng)) {
        alert('Please enter valid coordinates');
        return;
    }
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    dbHelper.getBusesCol().doc(selectedBusId).update({
        location: {
            lat: lat,
            lng: lng
        },
        lastUpdate: timeString,
        locationSource: sourceType,
        tracking: {
            sourceType: sourceType,
            trackerId: trackerId,
            googleAccount: {
                connected: trackerGoogleConnection.connected,
                email: trackerGoogleConnection.email
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: localStorage.getItem('userEmail') || 'admin'
        }
    }).then(() => {
        alert('Bus location updated successfully!');
        closeUpdateModal();
    }).catch(error => {
        alert('Error updating location: ' + error.message);
    });
};

window.connectTrackingGoogle = async function() {
    const auth = firebase.auth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert('Please login as admin first.');
        return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
        if (currentUser.providerData.some(p => p.providerId === 'google.com')) {
            const linked = currentUser.providerData.find(p => p.providerId === 'google.com');
            trackerGoogleConnection = {
                connected: true,
                email: linked?.email || currentUser.email || ''
            };
            updateGoogleStatusField();
            alert('Google account already connected.');
            return;
        }

        const result = await currentUser.linkWithPopup(provider);
        trackerGoogleConnection = {
            connected: true,
            email: result.user?.email || ''
        };
        updateGoogleStatusField();
        alert('Google account connected successfully.');
    } catch (error) {
        console.error('Google connect error:', error);
        alert('Could not connect Google account: ' + (error.message || 'Unknown error'));
    }
};

// Sidebar toggle
document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggle-sidebar');
    const connectGoogleBtn = document.getElementById('connect-google-btn');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('hidden');
    });

    if (connectGoogleBtn) {
        connectGoogleBtn.addEventListener('click', () => {
            connectTrackingGoogle();
        });
    }
    
    // Filter buttons
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active button
            filterBtns.forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-gray-100', 'text-gray-700');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
            
            // Update filter
            currentFilter = btn.dataset.filter;
            renderBusList();
        });
    });
});
