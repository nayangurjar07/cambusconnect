// staff.js - Staff Management Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on staff panel:", err);
    }
    initStaffPanel();

    function initStaffPanel() {
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

        const modalEditStaff = document.getElementById('modal-edit-staff');
        const closeEditStaffModalBtn = document.getElementById('close-edit-staff-modal-btn');
        const cancelEditStaffModalBtn = document.getElementById('cancel-edit-staff-modal-btn');
        const formEditStaff = document.getElementById('form-edit-staff');
        const editStaffBusSelect = document.getElementById('edit-staff-bus-select');

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
            if (editStaffBusSelect) {
                editStaffBusSelect.innerHTML = '<option value="">No Bus Assigned</option>';
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.id;
                    option.textContent = `Bus ${bus.number} - ${bus.route}`;
                    editStaffBusSelect.appendChild(option);
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
                
                const tierLabel = staff.roleTier === 'secondary' ? 'Secondary' : 'Primary';
                const roleBadge = staff.role === 'driver'
                    ? (staff.roleTier === 'secondary' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700')
                    : (staff.roleTier === 'secondary' ? 'bg-teal-100 text-teal-700' : 'bg-emerald-100 text-emerald-700');
                const roleText = staff.role === 'driver'
                    ? `${tierLabel} Driver`
                    : `${tierLabel} Conductor`;

                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                row.innerHTML = `
                    <td class="px-6 py-4 min-w-0">
                       <div class="flex items-center gap-3 min-w-0">
                           <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                               ${staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
                           </div>
                           <div class="min-w-0">
                               <p class="font-bold text-slate-800 break-words-safe">${escapeHtml(staff.name || 'Unknown')}</p>
                           </div>
                       </div>
                    </td>
                    <td class="px-6 py-4 text-slate-700 font-medium break-email max-w-[200px]">${escapeHtml(staff.email || 'N/A')}</td>
                    <td class="px-6 py-4 text-slate-700 font-medium break-words-safe">${escapeHtml(staff.phone || 'N/A')}</td>
                    <td class="px-6 py-4">
                        <span class="px-2 py-1 text-xs font-bold rounded-lg ${roleBadge}">
                            ${escapeHtml(roleText)}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-slate-700 text-sm font-semibold break-words-safe max-w-[180px]">${escapeHtml(busInfo)}</td>
                    <td class="px-6 py-4 text-right shrink-0">
                        <div class="flex items-center justify-end gap-2">
                            <button class="btn-edit-staff px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap" data-id="${staff.id}">
                                Edit
                            </button>
                            <button class="btn-delete-staff px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap" data-id="${staff.id}">
                                Delete
                            </button>
                        </div>
                    </td>
                `;
                staffTableBody.appendChild(row);
            });

            // Bind edit events
            document.querySelectorAll('.btn-edit-staff').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (id) openEditModal(id);
                });
            });

            // Bind delete events
            document.querySelectorAll('.btn-delete-staff').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (id) deleteStaff(id);
                });
            });
        }

        function checkStaffConflict(busId, role, roleTier, excludeDocId = null) {
            if (!busId || !role) return null;
            const targetTier = roleTier || 'primary';
            return staffList.find(s => {
                if (excludeDocId && (s.id === excludeDocId || s.email === excludeDocId)) return false;
                if (s.assignedBusId !== busId) return false;
                if (s.role !== role) return false;
                const sTier = s.roleTier || 'primary';
                return sTier === targetTier;
            });
        }

        function openEditModal(staffId) {
            const staff = staffList.find(s => s.id === staffId);
            if (!staff || !modalEditStaff) return;

            document.getElementById('edit-staff-doc-id').value = staff.id;
            document.getElementById('edit-staff-original-email').value = staff.email || '';
            document.getElementById('edit-staff-original-bus-id').value = staff.assignedBusId || '';
            document.getElementById('edit-staff-original-role').value = staff.role || 'driver';
            document.getElementById('edit-staff-name').value = staff.name || '';
            document.getElementById('edit-staff-role').value = staff.role || 'driver';
            const tierEl = document.getElementById('edit-staff-role-tier');
            if (tierEl) tierEl.value = staff.roleTier || 'primary';
            document.getElementById('edit-staff-email').value = staff.email || '';
            document.getElementById('edit-staff-phone').value = staff.phone || '';
            if (editStaffBusSelect) {
                editStaffBusSelect.value = staff.assignedBusId || '';
            }

            modalEditStaff.classList.remove('hidden');
            modalEditStaff.classList.add('flex');
        }

        function closeEditModal() {
            if (modalEditStaff) {
                modalEditStaff.classList.add('hidden');
                modalEditStaff.classList.remove('flex');
            }
        }
        if (closeEditStaffModalBtn) closeEditStaffModalBtn.addEventListener('click', closeEditModal);
        if (cancelEditStaffModalBtn) cancelEditStaffModalBtn.addEventListener('click', closeEditModal);

        if (formEditStaff) {
            formEditStaff.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const docId = formData.get('staffDocId');
                const origEmail = formData.get('originalEmail');
                const origBusId = formData.get('originalBusId');
                const origRole = formData.get('originalRole');
                const newName = formData.get('name').trim();
                const newRole = formData.get('role');
                const newRoleTier = formData.get('roleTier') || 'primary';
                const newPhone = formData.get('phone').trim();
                const newBusId = formData.get('assignedBusId') || '';

                // Role conflict check
                if (newBusId) {
                    const conflict = checkStaffConflict(newBusId, newRole, newRoleTier, docId);
                    if (conflict) {
                        alert(`⚠️ Role Conflict: Selected bus already has a ${newRoleTier === 'primary' ? 'Primary' : 'Secondary'} ${newRole === 'driver' ? 'Driver' : 'Conductor'} (${conflict.name || conflict.email}). Please choose another tier or bus.`);
                        return;
                    }
                }

                try {
                    // Update user doc
                    await dbHelper.getUsersCol().doc(docId).update({
                        name: newName,
                        role: newRole,
                        roleTier: newRoleTier,
                        phone: newPhone,
                        assignedBusId: newBusId,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    // Sync old bus if unassigned or changed
                    if (origBusId && (origBusId !== newBusId || origRole !== newRole)) {
                        const oldBusRef = dbHelper.getBusesCol().doc(origBusId);
                        if (origRole === 'driver') {
                            await oldBusRef.update({
                                driverEmails: firebase.firestore.FieldValue.arrayRemove(origEmail)
                            }).catch(() => {});
                        } else {
                            await oldBusRef.update({
                                conductorEmails: firebase.firestore.FieldValue.arrayRemove(origEmail)
                            }).catch(() => {});
                        }
                    }

                    // Sync new bus if assigned
                    if (newBusId) {
                        const newBusRef = dbHelper.getBusesCol().doc(newBusId);
                        const busUpdate = {};
                        if (newRole === 'driver') {
                            busUpdate.driverEmails = firebase.firestore.FieldValue.arrayUnion(origEmail);
                            if (newRoleTier === 'primary') {
                                busUpdate.driver = newName;
                                busUpdate.phone = newPhone;
                                busUpdate.primaryDriver = { name: newName, email: origEmail, phone: newPhone };
                            } else {
                                busUpdate.secondaryDriver = { name: newName, email: origEmail, phone: newPhone };
                            }
                        } else {
                            busUpdate.conductorEmails = firebase.firestore.FieldValue.arrayUnion(origEmail);
                            if (newRoleTier === 'primary') {
                                busUpdate.conductor = newName;
                                busUpdate.conductorPhone = newPhone;
                                busUpdate.primaryConductor = { name: newName, email: origEmail, phone: newPhone };
                            } else {
                                busUpdate.secondaryConductor = { name: newName, email: origEmail, phone: newPhone };
                            }
                        }
                        await newBusRef.update(busUpdate).catch(() => {});
                    }

                    alert('✅ Staff member updated successfully!');
                    closeEditModal();
                } catch (err) {
                    console.error("Error updating staff:", err);
                    alert("❌ Update failed: " + err.message);
                }
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
                
                const name = formData.get('name').trim();
                const role = formData.get('role');
                const roleTier = formData.get('roleTier') || 'primary';
                const email = formData.get('email').trim().toLowerCase();
                const phone = formData.get('phone').trim();
                const password = formData.get('password');
                const assignedBusId = formData.get('assignedBusId');

                // Role conflict check
                if (assignedBusId) {
                    const conflict = checkStaffConflict(assignedBusId, role, roleTier);
                    if (conflict) {
                        alert(`⚠️ Role Conflict: Selected bus already has a ${roleTier === 'primary' ? 'Primary' : 'Secondary'} ${role === 'driver' ? 'Driver' : 'Conductor'} (${conflict.name || conflict.email}). Please choose another tier or bus.`);
                        return;
                    }
                }
                
                try {
                    const userId = await window.createSecondaryAuthUser(email, password);
                    
                    await dbHelper.getUsersCol().doc(email).set({
                        name: name,
                        email: email,
                        phone: phone,
                        role: role,
                        roleTier: roleTier,
                        assignedBusId: assignedBusId,
                        uid: userId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    if (assignedBusId) {
                        const busRef = dbHelper.getBusesCol().doc(assignedBusId);
                        const busUpdate = {};
                        if (role === 'driver') {
                            busUpdate.driverEmails = firebase.firestore.FieldValue.arrayUnion(email);
                            if (roleTier === 'primary') {
                                busUpdate.driver = name;
                                busUpdate.phone = phone;
                                busUpdate.primaryDriver = { name, email, phone };
                            } else {
                                busUpdate.secondaryDriver = { name, email, phone };
                            }
                        } else if (role === 'conductor') {
                            busUpdate.conductorEmails = firebase.firestore.FieldValue.arrayUnion(email);
                            if (roleTier === 'primary') {
                                busUpdate.conductor = name;
                                busUpdate.conductorPhone = phone;
                                busUpdate.primaryConductor = { name, email, phone };
                            } else {
                                busUpdate.secondaryConductor = { name, email, phone };
                            }
                        }
                        await busRef.update(busUpdate).catch(() => {});
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
