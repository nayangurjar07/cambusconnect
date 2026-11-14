// buses.js - Bus Fleet Management Logic for Cambus Connect

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
        console.error("❌ Firebase/Auth unavailable on buses panel:", err);
    }
    initBusesPanel();

    function initBusesPanel() {
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
        const busesGrid = document.getElementById('admin-buses-grid');
        const addBusBtn = document.getElementById('add-bus-btn');
        const modalAddBus = document.getElementById('modal-add-bus');
        const closeBusModalBtn = document.getElementById('close-bus-modal-btn');
        const cancelBusModalBtn = document.getElementById('cancel-bus-modal-btn');
        const formAddBus = document.getElementById('form-add-bus');

        const modalEditBus = document.getElementById('modal-edit-bus');
        const closeEditBusModalBtn = document.getElementById('close-edit-bus-modal-btn');
        const cancelEditBusModalBtn = document.getElementById('cancel-edit-bus-modal-btn');
        const formEditBus = document.getElementById('form-edit-bus');

        let buses = [];

        // Real-time snapshot listener on the buses collection
        dbHelper.getBusesCol().onSnapshot(snapshot => {
            buses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBuses();
        }, err => {
            console.error("Error fetching buses:", err);
            if (busesGrid) {
                busesGrid.innerHTML = `<div class="col-span-full text-center p-8 bg-red-50 rounded-2xl border-2 border-red-200">
                    <p class="text-red-700 font-bold">Error loading buses</p>
                </div>`;
            }
        });

        function renderBuses() {
            if (!busesGrid) return;
            busesGrid.innerHTML = '';

            if (buses.length === 0) {
                busesGrid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500">No buses found</div>`;
                return;
            }

            buses.forEach(bus => {
                const card = document.createElement('div');
                card.className = 'card-hover bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-slate-200/60 cursor-pointer transition-all hover:-translate-y-1';
                
                card.addEventListener('click', (e) => {
                    // Check if we clicked a button or link
                    if (e.target.closest('button') || e.target.closest('a')) return;
                    openBusDetailsModal(bus.id);
                });
                
                const sourceType = bus.locationSource || bus.tracking?.sourceType;
                const sourceLabel = sourceType === 'driver_phone'
                    ? 'Driver Phone'
                    : sourceType === 'conductor_phone'
                        ? 'Conductor Phone'
                        : sourceType === 'tracking_device'
                            ? 'Tracking Device'
                            : 'Manual';

                const statusColors = {
                    'On Time': 'bg-emerald-500 text-white',
                    'Delayed': 'bg-amber-500 text-white',
                    'Breakdown': 'bg-rose-500 text-white'
                };

                const currentStatus = statusColors[bus.status] || 'bg-slate-300 text-slate-700';

                let driversDisplay = bus.driver || 'No Driver';
                if (bus.driverEmails && bus.driverEmails.length > 0) {
                    driversDisplay = bus.driverEmails.join(', ');
                }
                let conductorsDisplay = bus.conductor || '';
                if (bus.conductorEmails && bus.conductorEmails.length > 0) {
                    conductorsDisplay = bus.conductorEmails.join(', ');
                }
                const staffLabelText = conductorsDisplay ? `${driversDisplay} | ${conductorsDisplay}` : driversDisplay;

                card.innerHTML = `
                    <div class="flex items-start justify-between mb-6 gap-2">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/30 shrink-0">
                                ${escapeHtml(bus.number)}
                            </div>
                            <div class="min-w-0 flex-1">
                                <h3 class="font-black text-slate-800 text-lg truncate">Bus ${escapeHtml(bus.number)}</h3>
                                <p class="text-sm text-slate-500 font-semibold break-words-safe truncate" title="${escapeHtml(staffLabelText)}">${escapeHtml(staffLabelText)}</p>
                            </div>
                        </div>
                        <span class="status-badge px-3 py-1 ${currentStatus} rounded-full text-xs font-bold shadow-md shrink-0">
                            ${escapeHtml(bus.status)}
                        </span>
                    </div>
                    
                    <div class="mb-6 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-bold text-slate-500 mb-1">ROUTE</p>
                            <p class="text-sm font-bold text-slate-800 break-words-safe">${escapeHtml(bus.route)}</p>
                            <p class="text-xs text-slate-500 mt-2">Source: ${escapeHtml(sourceLabel)}</p>
                        </div>
                        <div class="text-center bg-white border border-slate-100 shadow-sm p-2.5 rounded-xl flex flex-col items-center justify-center min-w-14 shrink-0">
                            <span class="material-symbols-outlined text-primary text-base">groups</span>
                            <span class="text-xs font-extrabold text-slate-800 mt-0.5">${bus.headcount || 0}</span>
                            <span class="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Riders</span>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-3 gap-2">
                        <button class="btn-status px-2 sm:px-3 py-2 rounded-lg text-xs font-bold transition-all ${bus.status === 'On Time' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100'}" 
                            data-id="${bus.id}" data-status="On Time">
                            On Time
                        </button>
                        <button class="btn-status px-2 sm:px-3 py-2 rounded-lg text-xs font-bold transition-all ${bus.status === 'Delayed' ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-amber-100'}" 
                            data-id="${bus.id}" data-status="Delayed">
                            Delayed
                        </button>
                        <button class="btn-status px-2 sm:px-3 py-2 rounded-lg text-xs font-bold transition-all ${bus.status === 'Breakdown' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-rose-100'}" 
                            data-id="${bus.id}" data-status="Breakdown">
                            Issue
                        </button>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-3">
                        <a href="../admin-track.html" class="text-center px-2 py-2 rounded-lg text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all flex items-center justify-center">
                            Map View
                        </a>
                        <button class="btn-edit-bus px-2 py-2 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all flex items-center justify-center" data-id="${bus.id}">
                            Edit GPS
                        </button>
                        <button class="btn-delete-bus px-2 py-2 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-all flex items-center justify-center" data-id="${bus.id}" data-number="${bus.number || ''}">
                            Delete
                        </button>
                    </div>
                `;

                busesGrid.appendChild(card);
            });

            // Bind bus status listeners
            document.querySelectorAll('.btn-status').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const button = e.target.closest('button');
                    if (button) updateBusStatus(button.dataset.id, button.dataset.status);
                });
            });

            // Bind edit bus modal listeners
            document.querySelectorAll('.btn-edit-bus').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const button = e.target.closest('button');
                    if (button) editBus(button.dataset.id);
                });
            });

            // Bind delete bus listeners
            document.querySelectorAll('.btn-delete-bus').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const button = e.target.closest('button');
                    if (button) deleteBus(button.dataset.id, button.dataset.number);
                });
            });
        }

        async function deleteBus(busId, busNumber) {
            const confirmMsg = `Are you sure you want to delete Bus ${busNumber || busId}? This will permanently remove it from the fleet roster and mark assigned students as Not Assigned.`;
            if (!confirm(confirmMsg)) return;

            try {
                const firestoreDb = window.db || (firebase && firebase.firestore());
                const batch = firestoreDb.batch();
                batch.delete(dbHelper.getBusesCol().doc(busId));

                // Clear assignedBusId and busRoute for affected students in users collection
                const affected = await dbHelper.getUsersCol().where('assignedBusId', '==', busId).get();
                affected.forEach(docSnap => {
                    batch.update(docSnap.ref, { assignedBusId: '', busRoute: 'Not Assigned' });
                });

                await batch.commit();
                console.log(`✅ Bus ${busId} and assigned students updated successfully`);
                if (typeof showToast === 'function') {
                    showToast(`Bus ${busNumber || ''} removed from fleet`, 'success');
                } else {
                    alert(`Bus ${busNumber || ''} removed from fleet.`);
                }
            } catch (err) {
                console.error("❌ Error deleting bus:", err);
                alert("Failed to delete bus: " + err.message);
            }
        }

        function updateBusStatus(busId, status) {
            dbHelper.getBusesCol().doc(busId).update({
                status: status,
                lastUpdate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }).then(() => {
                console.log('Bus status updated');
                // If active details modal is open for this bus, refresh its badge
                const activeDetailsId = document.getElementById('modal-bus-details').dataset.activeBusId;
                if (activeDetailsId === busId) {
                    openBusDetailsModal(busId);
                }
            }).catch(err => {
                alert("Update failed: " + err.message);
            });
        }

        // =========================================================================
        // BUS DETAILS POPUP MODAL (WITH LIVE GPS MINIMAP & OPERATIONS)
        // =========================================================================
        let detailsMap = null;
        let detailsMarker = null;

        function openBusDetailsModal(busId) {
            const bus = buses.find(b => b.id === busId);
            if (!bus) return;

            const modal = document.getElementById('modal-bus-details');
            modal.dataset.activeBusId = busId;
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Set Title & Route
            document.getElementById('details-bus-title').textContent = `Bus ${bus.number} Control Dashboard`;
            document.getElementById('details-bus-route').textContent = `Route: ${bus.route || 'Not Assigned'}`;
            
            // Headcount & Coords & Updates
            document.getElementById('details-headcount').textContent = bus.headcount || 0;
            
            const hasGPS = bus.location && bus.location.lat && bus.location.lng;
            const gpsBadge = document.getElementById('details-gps-status');
            const coordsText = document.getElementById('details-lat-lng');
            
            if (hasGPS) {
                coordsText.textContent = `Coords: ${bus.location.lat.toFixed(6)}, ${bus.location.lng.toFixed(6)}`;
                gpsBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1";
                gpsBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active`;
            } else {
                coordsText.textContent = "Coords: No GPS Data Available";
                gpsBadge.className = "text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1";
                gpsBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Offline`;
            }
            
            document.getElementById('details-last-update').textContent = `Updated: ${bus.lastUpdate || 'Just now'}`;

            // Status Badge
            const statusColors = {
                'On Time': 'bg-emerald-500 text-white',
                'Delayed': 'bg-amber-500 text-white',
                'Breakdown': 'bg-rose-500 text-white'
            };
            const statusBadge = document.getElementById('details-status-badge');
            statusBadge.textContent = bus.status;
            statusBadge.className = `px-2.5 py-0.5 text-xs font-bold rounded-full ${statusColors[bus.status] || 'bg-slate-500 text-white'}`;

            // Staff & Device
            document.getElementById('details-driver-name').textContent = bus.driver || 'No Driver Assigned';
            document.getElementById('details-driver-phone').textContent = bus.phone || 'Phone: N/A';
            document.getElementById('details-conductor-name').textContent = bus.conductor || 'No Conductor Assigned';
            document.getElementById('details-conductor-phone').textContent = bus.conductorPhone || 'Phone: N/A';
            
            const sourceType = bus.locationSource || bus.tracking?.sourceType || 'manual';
            const sourceLabel = sourceType === 'driver_phone' ? 'Driver Phone' : sourceType === 'conductor_phone' ? 'Conductor Phone' : 'GPS Tracker Device';
            document.getElementById('details-tracker-id').textContent = `${bus.tracking?.trackerId || bus.trackerId || 'No device linked'} (${sourceLabel})`;

            // Status Operation Active Styles
            const otBtn = document.getElementById('details-status-ontime');
            const dlBtn = document.getElementById('details-status-delayed');
            const bdBtn = document.getElementById('details-status-breakdown');

            const resetBtnClasses = (btn) => {
                btn.className = "py-2 rounded-xl text-[11px] font-extrabold transition-all border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white";
            };
            resetBtnClasses(otBtn);
            resetBtnClasses(dlBtn);
            resetBtnClasses(bdBtn);

            if (bus.status === 'On Time') {
                otBtn.className = "py-2 rounded-xl text-[11px] font-extrabold transition-all bg-emerald-500 text-white shadow-sm border border-emerald-500";
            } else if (bus.status === 'Delayed') {
                dlBtn.className = "py-2 rounded-xl text-[11px] font-extrabold transition-all bg-amber-500 text-white shadow-sm border border-amber-500";
            } else if (bus.status === 'Breakdown') {
                bdBtn.className = "py-2 rounded-xl text-[11px] font-extrabold transition-all bg-rose-500 text-white shadow-sm border border-rose-500";
            }

            // Edit and Track button setup
            const editBtn = document.getElementById('details-btn-edit');
            editBtn.onclick = () => {
                closeDetailsModal();
                editBus(busId);
            };

            // Headcount update setup
            const changeHeadcount = async (changeVal) => {
                const updatedCount = Math.max(0, (bus.headcount || 0) + changeVal);
                try {
                    await dbHelper.getBusesCol().doc(busId).update({ headcount: updatedCount });
                    // Snapshot listener will trigger re-render and automatically refresh our UI!
                } catch(e) {
                    console.error("Headcount change failed:", e);
                }
            };
            document.getElementById('details-inc-headcount').onclick = () => changeHeadcount(1);
            document.getElementById('details-dec-headcount').onclick = () => changeHeadcount(-1);
            document.getElementById('details-reset-headcount').onclick = () => changeHeadcount(-(bus.headcount || 0));

            // Status operation buttons setup
            otBtn.onclick = () => updateBusStatus(busId, 'On Time');
            dlBtn.onclick = () => updateBusStatus(busId, 'Delayed');
            bdBtn.onclick = () => updateBusStatus(busId, 'Breakdown');

            // Render Google Map
            setTimeout(() => {
                const mapContainer = document.getElementById('mini-map');
                const centerLoc = hasGPS ? { lat: bus.location.lat, lng: bus.location.lng } : { lat: 22.7196, lng: 75.8577 }; // default Indores coordinates
                
                if (typeof google !== 'undefined') {
                    detailsMap = new google.maps.Map(mapContainer, {
                        zoom: 15,
                        center: centerLoc,
                        disableDefaultUI: true,
                        zoomControl: true,
                        mapTypeId: 'roadmap'
                    });

                    if (hasGPS) {
                        detailsMarker = new google.maps.Marker({
                            position: centerLoc,
                            map: detailsMap,
                            title: `Bus ${bus.number} location`
                        });
                    } else {
                        detailsMarker = new google.maps.Marker({
                            position: centerLoc,
                            map: detailsMap,
                            title: `College Center`,
                            icon: {
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="#2563eb" stroke="white" stroke-width="1.5">
                                        <circle cx="12" cy="12" r="10"/>
                                    </svg>
                                `),
                                scaledSize: new google.maps.Size(30, 30)
                            }
                        });
                    }
                } else {
                    mapContainer.innerHTML = `
                        <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 p-4 text-center">
                            <span class="material-symbols-outlined text-slate-400 text-3xl mb-1">map</span>
                            <p class="text-xs font-bold text-slate-700">Map Unavailable</p>
                            <p class="text-[10px] text-slate-400 mt-1">
                                Latitude: ${centerLoc.lat.toFixed(4)}, Longitude: ${centerLoc.lng.toFixed(4)}
                            </p>
                        </div>
                    `;
                }
            }, 100);
        }

        function closeDetailsModal() {
            const modal = document.getElementById('modal-bus-details');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                modal.dataset.activeBusId = "";
            }
        }

        const closeDetailsModalBtn = document.getElementById('close-details-modal-btn');
        if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', closeDetailsModal);

        // Add Bus modal open
        if (addBusBtn && modalAddBus) {
            addBusBtn.addEventListener('click', () => {
                modalAddBus.classList.remove('hidden');
                modalAddBus.classList.add('flex');
            });
        }

        function closeAddBusModal() {
            if (modalAddBus) {
                modalAddBus.classList.add('hidden');
                modalAddBus.classList.remove('flex');
            }
        }
        if (closeBusModalBtn) closeBusModalBtn.addEventListener('click', closeAddBusModal);
        if (cancelBusModalBtn) cancelBusModalBtn.addEventListener('click', closeAddBusModal);

        if (formAddBus) {
            formAddBus.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);

                try {
                    await dbHelper.getBusesCol().add({
                        number: formData.get('number'),
                        route: formData.get('route'),
                        driver: formData.get('driver'),
                        phone: formData.get('phone') || '',
                        conductor: formData.get('conductor') || '',
                        conductorPhone: formData.get('conductorPhone') || '',
                        status: 'On Time',
                        tracking: {
                            sourceType: 'driver_phone',
                            trackerId: formData.get('trackerId') || '',
                            googleAccount: {
                                connected: false,
                                email: ''
                            }
                        },
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Bus added successfully!');
                    e.target.reset();
                    closeAddBusModal();
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            });
        }

        // Edit Bus modal logic
        function editBus(busId) {
            const bus = buses.find(b => b.id === busId);
            if (!bus) return;

            if (modalEditBus) {
                modalEditBus.querySelector('[name="busId"]').value = busId;
                modalEditBus.querySelector('[name="number"]').value = bus.number || '';
                modalEditBus.querySelector('[name="route"]').value = bus.route || '';
                modalEditBus.querySelector('[name="driver"]').value = bus.driver || '';
                modalEditBus.querySelector('[name="phone"]').value = bus.phone || '';
                modalEditBus.querySelector('[name="conductor"]').value = bus.conductor || '';
                modalEditBus.querySelector('[name="conductorPhone"]').value = bus.conductorPhone || '';
                modalEditBus.querySelector('[name="trackerId"]').value = (bus.tracking && bus.tracking.trackerId) || bus.trackerId || '';

                modalEditBus.classList.remove('hidden');
                modalEditBus.classList.add('flex');
            }
        }

        function closeEditBusModal() {
            if (modalEditBus) {
                modalEditBus.classList.add('hidden');
                modalEditBus.classList.remove('flex');
            }
        }

        if (closeEditBusModalBtn) closeEditBusModalBtn.addEventListener('click', closeEditBusModal);
        if (cancelEditBusModalBtn) cancelEditBusModalBtn.addEventListener('click', closeEditBusModal);

        if (formEditBus) {
            formEditBus.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const busId = formData.get('busId');

                try {
                    await dbHelper.getBusesCol().doc(busId).update({
                        number: formData.get('number'),
                        route: formData.get('route'),
                        driver: formData.get('driver'),
                        phone: formData.get('phone') || '',
                        conductor: formData.get('conductor') || '',
                        conductorPhone: formData.get('conductorPhone') || '',
                        "tracking.trackerId": formData.get('trackerId') || '',
                        trackerId: formData.get('trackerId') || '',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Bus updated successfully!');
                    closeEditBusModal();
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
