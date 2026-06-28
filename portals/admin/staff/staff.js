// staff.js - Staff Management Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', () => {
    // Check if firebase is available (loaded as modular import/global)
    const initInterval = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(initInterval);
            initStaffPanel();
        }
    }, 100);

    function initStaffPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Display admin name from localStorage
        const adminNameDisplay = document.getElementById('admin-name-display');
        if (adminNameDisplay) {
            const adminName = localStorage.getItem('adminName');
            if (adminName) adminNameDisplay.textContent = adminName;
        }

        // Support Queries Badge
        const pendingBadge = document.getElementById('pending-badge');
        dbHelper.getSupportQueriesCol().where('status', '==', 'Pending').onSnapshot(snapshot => {
            const pendingCount = snapshot.size;
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.classList.remove('hidden');
                } else {
                    pendingBadge.classList.add('hidden');
                }
            }
        }, err => {
            console.error("Error loading pending queries badge:", err);
        });

        // DOM Elements
        const addStaffBtn = document.getElementById('add-staff-btn');
        const modalAddStaff = document.getElementById('modal-add-staff');
        const closeStaffModalBtn = document.getElementById('close-staff-modal-btn');
        const cancelStaffModalBtn = document.getElementById('cancel-staff-modal-btn');
        const formAddStaff = document.getElementById('form-add-staff');
        const staffTableBody = document.getElementById('staff-table-body');
        const staffBusSelect = document.getElementById('input-assign-staff-bus');

        let buses = [];
        let staffList = [];

        // Real-time snapshot listener on the buses collection (for route mapping and dropdown options)
        dbHelper.getBusesCol().onSnapshot(snapshot => {
            buses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateBusOptions();
            renderStaffTable();
        }, err => {
            console.error("Error fetching buses:", err);
        });

        function updateBusOptions() {
            if (staffBusSelect) {
                staffBusSelect.innerHTML = '<option value="">Select a bus...</option>';
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.id;
                    option.textContent = `Bus ${bus.number} - ${bus.route}`;
                    staffBusSelect.appendChild(option);
                });
            }
        }

        // Staff Directory Listener
        dbHelper.getUsersCol().where('role', 'in', ['driver', 'conductor']).onSnapshot(snapshot => {
            staffList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderStaffTable();
        }, err => {
            console.error("Error loading staff:", err);
            if (staffTableBody) {
                staffTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-red-600 font-bold">Error loading staff.</td></tr>';
            }
        });

        function renderStaffTable() {
            if (!staffTableBody) return;
            staffTableBody.innerHTML = '';

            if (staffList.length === 0) {
                staffTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500">No staff members registered yet</td></tr>';
                return;
            }

            staffList.forEach(staff => {
                const bus = buses.find(b => b.id === staff.assignedBusId);
                const busInfo = bus ? `Bus ${bus.number} - ${bus.route}` : 'Not Assigned';
                
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                row.innerHTML = `
                    <td class="px-6 py-4">
                       <div class="flex items-center gap-3">
                           <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                               ${staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                           </div>
                           <div>
                               <p class="font-bold text-slate-800">${staff.name || 'Unknown'}</p>
                           </div>
                       </div>
                    </td>
                    <td class="px-6 py-4 text-slate-700 font-medium">${staff.email || 'N/A'}</td>
                    <td class="px-6 py-4 text-slate-700 font-medium">${staff.phone || 'N/A'}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs font-bold rounded-lg ${staff.role === 'driver' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}">
                            ${staff.role ? staff.role.toUpperCase() : 'N/A'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-slate-700 text-sm font-semibold">${busInfo}</td>
                    <td class="px-6 py-4 text-right">
                        <button class="btn-delete-staff px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors" data-id="${staff.id}">
                            Delete
                        </button>
                    </td>
                `;
                staffTableBody.appendChild(row);
            });

            // Bind delete events
            document.querySelectorAll('.btn-delete-staff').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (id) deleteStaff(id);
                });
            });
        }

        async function deleteStaff(staffId) {
            if (confirm('Are you sure you want to delete this staff member?')) {
                try {
                    const staffDoc = await dbHelper.getUsersCol().doc(staffId).get();
                    if (staffDoc.exists) {
                        const staffData = staffDoc.data();
                        
                        // Clean up from the assigned bus array
                        if (staffData.assignedBusId) {
                            const busRef = dbHelper.getBusesCol().doc(staffData.assignedBusId);
                            if (staffData.role === 'driver') {
                                await busRef.update({
                                    driverEmails: firebase.firestore.FieldValue.arrayRemove(staffData.email)
                                });
                            } else if (staffData.role === 'conductor') {
                                await busRef.update({
                                    conductorEmails: firebase.firestore.FieldValue.arrayRemove(staffData.email)
                                });
                            }
                        }
                    }
                    
                    await dbHelper.getUsersCol().doc(staffId).delete();
                    alert('✅ Staff member deleted successfully!');
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            }
        }

        // Add modal handlers
        if (addStaffBtn && modalAddStaff) {
            addStaffBtn.addEventListener('click', () => {
                modalAddStaff.classList.remove('hidden');
                modalAddStaff.classList.add('flex');
            });
        }

        function closeStaffModal() {
            if (modalAddStaff) {
                modalAddStaff.classList.add('hidden');
                modalAddStaff.classList.remove('flex');
            }
        }
        if (closeStaffModalBtn) closeStaffModalBtn.addEventListener('click', closeStaffModal);
        if (cancelStaffModalBtn) cancelStaffModalBtn.addEventListener('click', closeStaffModal);

        if (formAddStaff) {
            formAddStaff.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                
                const name = formData.get('name');
                const role = formData.get('role');
                const email = formData.get('email');
                const phone = formData.get('phone');
                const password = formData.get('password');
                const assignedBusId = formData.get('assignedBusId');
                
                try {
                    const userId = await window.createSecondaryAuthUser(email, password);
                    
                    await dbHelper.getUsersCol().doc(email).set({
                        name: name,
                        email: email,
                        phone: phone,
                        role: role,
                        assignedBusId: assignedBusId,
                        uid: userId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (assignedBusId) {
                        const updateData = {};
                        const busRef = dbHelper.getBusesCol().doc(assignedBusId);
                        const busDoc = await busRef.get();
                        
                        if (role === 'driver') {
                            updateData.driverEmails = firebase.firestore.FieldValue.arrayUnion(email);
                            if (busDoc.exists) {
                                const busData = busDoc.data();
                                if (!busData.driver || busData.driver === 'No Driver') {
                                    updateData.driver = name;
                                    updateData.phone = phone;
                                }
                            }
                        } else if (role === 'conductor') {
                            updateData.conductorEmails = firebase.firestore.FieldValue.arrayUnion(email);
                            if (busDoc.exists) {
                                const busData = busDoc.data();
                                if (!busData.conductor || busData.conductor === '') {
                                    updateData.conductor = name;
                                    updateData.conductorPhone = phone;
                                }
                            }
                        }
                        await busRef.update(updateData);
                    }
                    
                    alert('✅ Staff member registered successfully!');
                    e.target.reset();
                    closeStaffModal();
                } catch (error) {
                    alert('❌ Registration failed: ' + error.message);
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
