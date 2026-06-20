// =============================================================================
// OWNER.JS - CAMBUS CONNECT Super Admin Control Script
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Display Owner name
    const ownerNameDisplay = document.getElementById('owner-name-display');
    if (ownerNameDisplay) {
        const ownerName = localStorage.getItem('ownerName');
        if (ownerName) ownerNameDisplay.textContent = ownerName;
    }

    // DOM Elements - Modals & Forms
    const addTenantBtn = document.getElementById('add-tenant-btn');
    const modalAddTenant = document.getElementById('modal-add-tenant');
    const closeTenantModalBtn = document.getElementById('close-tenant-modal-btn');
    const cancelTenantModalBtn = document.getElementById('cancel-tenant-modal-btn');
    const formAddTenant = document.getElementById('form-add-tenant');
    const tenantsTableBody = document.getElementById('tenants-table-body');
    const tableRecordCount = document.getElementById('table-record-count');

    // Details Modal Elements
    const modalTenantDetail = document.getElementById('modal-tenant-detail');
    const closeDetailModalBtn = document.getElementById('close-detail-modal-btn');
    const detailTenantName = document.getElementById('detail-tenant-name');
    const detailTenantDomain = document.getElementById('detail-tenant-domain');
    const detailAdminEmail = document.getElementById('detail-admin-email');
    const detailRegDate = document.getElementById('detail-reg-date');
    const detailSubEnd = document.getElementById('detail-sub-end');

    // Metrics Stats Cards
    const statTotalTenants = document.getElementById('stat-total-tenants');
    const statActiveTenants = document.getElementById('stat-active-tenants');
    const statSuspendedTenants = document.getElementById('stat-suspended-tenants');

    let allTenants = [];

    // =============================================================================
    // 1. POPULATE TENANTS DIRECTORY
    // =============================================================================
    db.collection('tenants').orderBy('name', 'asc').onSnapshot(snapshot => {
        allTenants = [];
        let activeCount = 0;
        let suspendedCount = 0;

        tenantsTableBody.innerHTML = '';

        if (snapshot.empty) {
            tenantsTableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-12 text-center text-slate-400 font-semibold">No tenants registered yet. Click "Register College" to add one.</td></tr>`;
            if (statTotalTenants) statTotalTenants.textContent = '0';
            if (statActiveTenants) statActiveTenants.textContent = '0';
            if (statSuspendedTenants) statSuspendedTenants.textContent = '0';
            if (tableRecordCount) tableRecordCount.textContent = 'Showing 0 tenants';
            return;
        }

        snapshot.forEach(doc => {
            const tenant = { id: doc.id, ...doc.data() };
            allTenants.push(tenant);

            if (tenant.status === 'active') activeCount++;
            else suspendedCount++;

            renderTenantRow(tenant);
        });

        if (statTotalTenants) statTotalTenants.textContent = allTenants.length;
        if (statActiveTenants) statActiveTenants.textContent = activeCount;
        if (statSuspendedTenants) statSuspendedTenants.textContent = suspendedCount;
        if (tableRecordCount) tableRecordCount.textContent = `Showing ${allTenants.length} tenants`;

    }, err => {
        console.error("Error loading tenants database:", err);
        tenantsTableBody.innerHTML = `<tr><td colspan="6" class="px-8 py-12 text-center text-red-500 font-bold bg-red-50">Error fetching tenant list: ${err.message}</td></tr>`;
    });

    function renderTenantRow(tenant) {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 transition-colors';

        const statusBadge = tenant.status === 'active'
            ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200">
                   <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>Active
               </span>`
            : `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                   <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>Suspended
               </span>`;

        const subDate = tenant.subscriptionEnd ? new Date(tenant.subscriptionEnd).toLocaleDateString([], { dateStyle: 'medium' }) : 'Lifetime';
        
        // Truncate config display
        const projectId = tenant.firebaseConfig?.projectId || 'N/A';

        row.innerHTML = `
            <td class="px-8 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        ${tenant.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 text-sm">${tenant.name}</p>
                        <p class="text-xs text-slate-400">Created: ${tenant.createdAt ? tenant.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 font-semibold text-slate-700 text-sm">${tenant.domain}</td>
            <td class="px-6 py-4">
                <code class="text-xs bg-slate-100 text-indigo-700 px-2.5 py-1 rounded-lg border border-slate-200/60 font-semibold">${projectId}</code>
            </td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-slate-700 text-sm font-semibold">${subDate}</td>
            <td class="px-8 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button class="btn-view-stats px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-lg transition-all flex items-center gap-1 border border-indigo-200/30" data-id="${tenant.id}">
                        <span class="material-symbols-outlined text-[14px]">query_stats</span>
                        <span>Stats</span>
                    </button>
                    <button class="btn-toggle-status px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg transition-all border border-slate-200" data-id="${tenant.id}" data-status="${tenant.status}">
                        ${tenant.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                </div>
            </td>
        `;

        // Bind events
        row.querySelector('.btn-view-stats').addEventListener('click', () => openTenantDetails(tenant));
        row.querySelector('.btn-toggle-status').addEventListener('click', (e) => toggleTenantStatus(e));

        tenantsTableBody.appendChild(row);
    }

    // =============================================================================
    // 2. TOGGLE TENANT STATUS
    // =============================================================================
    async function toggleTenantStatus(e) {
        const id = e.currentTarget.getAttribute('data-id');
        const currentStatus = e.currentTarget.getAttribute('data-status');
        const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
        
        if (confirm(`Are you sure you want to change this tenant's status to "${nextStatus.toUpperCase()}"?`)) {
            try {
                await db.collection('tenants').doc(id).update({
                    status: nextStatus
                });
                console.log(`Updated status of tenant: ${id} to ${nextStatus}`);
            } catch (err) {
                alert("❌ Failed to update status: " + err.message);
            }
        }
    }

    // =============================================================================
    // 3. REGISTER NEW TENANT
    // =============================================================================
    if (addTenantBtn) {
        addTenantBtn.addEventListener('click', () => {
            modalAddTenant.classList.remove('hidden');
            modalAddTenant.classList.add('flex');
        });
    }

    const closeAddModal = () => {
        modalAddTenant.classList.remove('flex');
        modalAddTenant.classList.add('hidden');
        formAddTenant.reset();
    };

    if (closeTenantModalBtn) closeTenantModalBtn.addEventListener('click', closeAddModal);
    if (cancelTenantModalBtn) cancelTenantModalBtn.addEventListener('click', closeAddModal);

    if (formAddTenant) {
        formAddTenant.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            const btnSubmit = e.target.querySelector('button[type="submit"]');
            btnSubmit.disabled = true;
            btnSubmit.textContent = "Registering Tenant...";

            const tenantData = {
                name: formData.get('name').trim(),
                domain: formData.get('domain').toLowerCase().trim(),
                adminEmail: formData.get('adminEmail').trim(),
                subscriptionEnd: formData.get('subscriptionEnd'),
                status: "active",
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                firebaseConfig: {
                    apiKey: formData.get('apiKey').trim(),
                    authDomain: formData.get('authDomain').trim(),
                    projectId: formData.get('projectId').trim(),
                    databaseURL: formData.get('databaseURL').trim(),
                    storageBucket: formData.get('storageBucket').trim(),
                    messagingSenderId: formData.get('messagingSenderId').trim(),
                    appId: formData.get('appId').trim(),
                    measurementId: formData.get('measurementId').trim() || ""
                }
            };

            try {
                // Save to Owner database tenants list
                await db.collection('tenants').doc(tenantData.domain).set(tenantData);
                alert("✅ College tenant registered successfully on master list!");
                closeAddModal();
            } catch (err) {
                alert("❌ Error registering tenant: " + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = "Register Tenant";
            }
        });
    }

    // =============================================================================
    // 4. CROSS-TENANT REAL-TIME DATABASE MONITORING (Dynamic Init)
    // =============================================================================
    function openTenantDetails(tenant) {
        modalTenantDetail.classList.remove('hidden');
        modalTenantDetail.classList.add('flex');

        detailTenantName.textContent = tenant.name;
        detailTenantDomain.textContent = tenant.domain;
        detailAdminEmail.textContent = tenant.adminEmail || 'N/A';
        detailRegDate.textContent = tenant.createdAt ? tenant.createdAt.toDate().toLocaleDateString() : 'N/A';
        detailSubEnd.textContent = tenant.subscriptionEnd ? new Date(tenant.subscriptionEnd).toLocaleDateString([], { dateStyle: 'medium' }) : 'Lifetime';

        loadTenantRealtimeStats(tenant);
    }

    const closeDetailModal = () => {
        modalTenantDetail.classList.remove('flex');
        modalTenantDetail.classList.add('hidden');
    };

    if (closeDetailModalBtn) closeDetailModalBtn.addEventListener('click', closeDetailModal);

    async function loadTenantRealtimeStats(tenant) {
        const statsContainer = document.getElementById('detail-stats-container');
        statsContainer.innerHTML = `
            <div class="col-span-full py-8 text-center text-slate-400 font-semibold flex flex-col items-center justify-center gap-2">
                <span class="material-symbols-outlined text-indigo-600 text-3xl animate-spin">sync</span>
                <span>Querying target college database in background...</span>
            </div>
        `;

        const config = tenant.firebaseConfig;
        if (!config || !config.apiKey || !config.projectId) {
            statsContainer.innerHTML = `
                <div class="col-span-full py-4 text-center text-red-600 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold">
                    ❌ Invalid Firebase database configuration details.
                </div>
            `;
            return;
        }

        const tempAppName = `TempApp_${tenant.projectId}_${Date.now()}`;

        // Dynamically import standard Firebase modular functions to prevent conflict with compat layers
        const { initializeApp, deleteApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
        const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");

        let tempApp;
        try {
            tempApp = initializeApp(config, tempAppName);
            const tempDb = getFirestore(tempApp);

            // Fetch directories size
            const usersSnap = await getDocs(collection(tempDb, "users"));
            const busesSnap = await getDocs(collection(tempDb, "buses"));

            let studentsCount = 0;
            let driversCount = 0;
            let conductorsCount = 0;

            usersSnap.forEach(docSnap => {
                const uData = docSnap.data();
                if (uData.role === 'student') studentsCount++;
                else if (uData.role === 'driver') driversCount++;
                else if (uData.role === 'conductor') conductorsCount++;
            });

            const totalBuses = busesSnap.size;

            statsContainer.innerHTML = `
                <div class="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold text-indigo-500 uppercase">Registered Students</p>
                    <p class="text-3xl font-black text-indigo-950 mt-1">${studentsCount}</p>
                </div>
                <div class="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-center">
                    <p class="text-xs font-bold text-violet-500 uppercase">Drivers & Conductors</p>
                    <p class="text-3xl font-black text-violet-950 mt-1">${driversCount + conductorsCount}</p>
                </div>
                <div class="bg-sky-50 border border-sky-100 rounded-2xl p-4 text-center col-span-full">
                    <p class="text-xs font-bold text-sky-500 uppercase">Assigned Transit Buses</p>
                    <p class="text-3xl font-black text-sky-950 mt-1">${totalBuses}</p>
                </div>
            `;
        } catch (err) {
            console.error("Error fetching stats:", err);
            statsContainer.innerHTML = `
                <div class="col-span-full py-4 text-center text-red-600 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold">
                    ❌ Failed to connect to tenant database: ${err.message}
                </div>
            `;
        } finally {
            if (tempApp) {
                // Safely clean up dynamic background apps
                setTimeout(() => deleteApp(tempApp).catch(console.error), 3000);
            }
        }
    }

    // =============================================================================
    // 5. LOGOUT
    // =============================================================================
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to sign out?')) {
                auth.signOut().then(() => {
                    localStorage.clear();
                    window.location.href = 'owner-login.html';
                });
            }
        });
    }
});
