// students.js - Student Management Logic for Cambus Connect
document.addEventListener('DOMContentLoaded', () => {
    // Check if firebase is available (loaded as modular import/global)
    const initInterval = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(initInterval);
            initStudentsPanel();
        }
    }, 100);

    function initStudentsPanel() {
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

        // DOM Elements - Content Areas
        const studentTableBody = document.getElementById('student-table-body');
        const studentCount = document.getElementById('student-count');
        const searchStudent = document.getElementById('search-student');
        const busSelect = document.getElementById('input-assign-bus');

        let buses = [];
        let students = [];
        let isShift2Enabled = false;
        let shift1Name = 'Shift 1';
        let shift2Name = 'Shift 2';
        let subInstitutes = [];

        // === FIREBASE LISTENERS ===

        // Listen to Buses (Routes)
        dbHelper.getBusesCol().onSnapshot(snapshot => {
            buses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateBusOptions();
            renderStudentsTable();
        }, err => {
            console.error("Error fetching buses:", err);
        });

        // Listen to Students
        dbHelper.getUsersCol().where('role', '==', 'student').onSnapshot(snapshot => {
            students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderStudentsTable();
        });

        // Listen to Shift Settings
        db.collection('settings').doc('shiftConfig').onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                isShift2Enabled = !!data.enableShift2;
                shift1Name = data.shift1Name || 'Shift 1';
                shift2Name = data.shift2Name || 'Shift 2';

                const shiftStripEl = document.getElementById('shift-switcher-strip');
                const studentShiftContainer = document.getElementById('student-shift-container');
                const studentEditShiftContainer = document.getElementById('student-edit-shift-container');

                if (shiftStripEl) {
                    if (isShift2Enabled) shiftStripEl.classList.remove('hidden');
                    else shiftStripEl.classList.add('hidden');
                }
                if (studentShiftContainer) {
                    if (isShift2Enabled) studentShiftContainer.classList.remove('hidden');
                    else studentShiftContainer.classList.add('hidden');
                }
                if (studentEditShiftContainer) {
                    if (isShift2Enabled) studentEditShiftContainer.classList.remove('hidden');
                    else studentEditShiftContainer.classList.add('hidden');
                }

                // Update panel labels with custom names + timing
                const labelShift1 = document.getElementById('label-shift-1-panel');
                const labelShift2 = document.getElementById('label-shift-2-panel');
                if (labelShift1) labelShift1.textContent = `${shift1Name} Students (${data.shift1Timing || ''})`;
                if (labelShift2) labelShift2.textContent = `${shift2Name} Students (${data.shift2Timing || ''})`;

                // Update strip chip labels
                const strip1 = document.getElementById('strip-chip-shift1');
                const strip2 = document.getElementById('strip-chip-shift2');
                if (strip1) strip1.childNodes[strip1.childNodes.length - 1].textContent = ` ${shift1Name}`;
                if (strip2) strip2.childNodes[strip2.childNodes.length - 1].textContent = ` ${shift2Name}`;
            } else {
                isShift2Enabled = false;
            }

            if (!isShift2Enabled) {
                const _hiddenShift = document.getElementById('filter-student-shift');
                if (_hiddenShift) _hiddenShift.value = 'all';
                const _strips = document.querySelectorAll('.shift-strip-chip');
                _strips.forEach(c => {
                    c.classList.toggle('text-white', c.getAttribute('data-val') === 'all');
                    c.classList.toggle('text-slate-500', c.getAttribute('data-val') !== 'all');
                });
                const _slider = document.getElementById('shift-strip-slider');
                if (_slider) {
                    _slider.style.left = '6px';
                    _slider.style.background = 'linear-gradient(to right, #2563eb, #4f46e5)';
                }
            }

            renderStudentsTable();
        });

        // Listen to Sub-Institutes
        db.collection('sub-institutes').orderBy('name').onSnapshot(snapshot => {
            subInstitutes = snapshot.docs.map(doc => doc.data().name);
            updateSubInstituteDropdowns();
            renderStudentsTable();
        });

        function updateBusOptions() {
            if (busSelect) {
                busSelect.innerHTML = '<option value="">Select a route...</option>';
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.id;
                    option.textContent = `Bus ${bus.number} - ${bus.route}`;
                    busSelect.appendChild(option);
                });
            }

            const editModal = document.getElementById('modal-edit-student');
            if (editModal) {
                const editBusSelect = editModal.querySelector('[name="assignedBusId"]');
                if (editBusSelect) {
                    const currentSelected = editBusSelect.value;
                    editBusSelect.innerHTML = '<option value="">Select a route...</option>';
                    buses.forEach(bus => {
                        const option = document.createElement('option');
                        option.value = bus.id;
                        option.textContent = `Bus ${bus.number} - ${bus.route}`;
                        if (bus.id === currentSelected) option.selected = true;
                        editBusSelect.appendChild(option);
                    });
                }
            }
        }

        function updateSubInstituteDropdowns() {
            // Update filter dropdown
            const submenu = document.getElementById('sub-inst-submenu');
            if (submenu) {
                const allBtn = submenu.querySelector('[data-inst="all"]');
                submenu.innerHTML = '';
                if (allBtn) submenu.appendChild(allBtn);
                subInstitutes.forEach(name => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.setAttribute('data-inst', name);
                    btn.className = 'inst-filter-opt w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors';
                    btn.textContent = name;
                    submenu.appendChild(btn);
                });
            }

            // Update modal selectors
            const registerSubDropdown = document.querySelector('#form-add-student select[name="subInstitute"]');
            const editSubDropdown = document.querySelector('#form-edit-student select[name="subInstitute"]');
            [registerSubDropdown, editSubDropdown].forEach(dropdown => {
                if (!dropdown) return;
                const currentSelected = dropdown.value;
                dropdown.innerHTML = '<option value="">None</option>';
                subInstitutes.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    if (name === currentSelected) opt.selected = true;
                    dropdown.appendChild(opt);
                });
            });
        }

        // Add Sub-Institute Trigger
        const btnAddSubInst = document.getElementById('btn-add-sub-institute');
        const inputNewSubInst = document.getElementById('input-new-sub-institute');
        if (btnAddSubInst && inputNewSubInst) {
            btnAddSubInst.addEventListener('click', async () => {
                const val = inputNewSubInst.value.trim();
                if (!val) {
                    alert("Please enter a sub-institute name.");
                    return;
                }
                if (subInstitutes.map(s => s.toLowerCase()).includes(val.toLowerCase())) {
                    alert("This sub-institute already exists.");
                    return;
                }
                try {
                    await db.collection('sub-institutes').add({
                        name: val,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    inputNewSubInst.value = '';
                } catch (err) {
                    alert("Error adding sub-institute: " + err.message);
                }
            });
        }

        // ====== SHIFT SWITCHER STRIP HANDLER ======
        const shiftStripChips = document.querySelectorAll('.shift-strip-chip');
        const hiddenShiftInput = document.getElementById('filter-student-shift');
        const shiftSlider = document.getElementById('shift-strip-slider');

        function updateStripSlider(val) {
            if (!shiftSlider) return;
            const positions = { 'all': 0, 'Shift 1': 1, 'Shift 2': 2 };
            const idx = positions[val] ?? 0;
            const pct = (idx * 33.33);
            shiftSlider.style.left = `calc(${pct}% + 6px)`;
            shiftSlider.style.width = 'calc(33.33% - 8px)';
            if (val === 'Shift 2') {
                shiftSlider.className = shiftSlider.className
                    .replace('from-blue-600 to-indigo-600 shadow-blue-500/30', 'from-purple-600 to-fuchsia-600 shadow-purple-500/30');
                shiftSlider.style.background = 'linear-gradient(to right, #9333ea, #c026d3)';
            } else {
                shiftSlider.style.background = 'linear-gradient(to right, #2563eb, #4f46e5)';
            }
        }

        shiftStripChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                const btn = e.currentTarget;
                const selectedVal = btn.getAttribute('data-val');
                if (hiddenShiftInput) hiddenShiftInput.value = selectedVal;

                shiftStripChips.forEach(c => {
                    c.classList.remove('text-white');
                    c.classList.add('text-slate-500');
                });
                btn.classList.remove('text-slate-500');
                btn.classList.add('text-white');

                updateStripSlider(selectedVal);
                renderStudentsTable();
            });
        });

        // Reset Filters Handler
        const btnClearFilters = document.getElementById('btn-clear-student-filters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                if (searchStudent) searchStudent.value = '';

                const filterYear = document.getElementById('filter-student-year');
                if (filterYear) filterYear.value = 'all';
                const yearLabel = document.getElementById('filter-year-label');
                if (yearLabel) yearLabel.textContent = 'All';

                const filterSubInst = document.getElementById('filter-student-sub-institute');
                if (filterSubInst) filterSubInst.value = 'all';
                const instLabel = document.getElementById('filter-inst-label');
                if (instLabel) instLabel.textContent = 'All';

                if (hiddenShiftInput) hiddenShiftInput.value = 'all';
                shiftStripChips.forEach(c => {
                    const isAll = c.getAttribute('data-val') === 'all';
                    c.classList.toggle('text-white', isAll);
                    c.classList.toggle('text-slate-500', !isAll);
                });
                updateStripSlider('all');

                const badge = document.getElementById('filter-active-badge');
                if (badge) badge.classList.add('hidden');

                renderStudentsTable();
            });
        }

        // ====== FILTER DROPDOWN LOGIC ======
        const filterDropdownBtn = document.getElementById('filter-dropdown-btn');
        const filterDropdownPanel = document.getElementById('filter-dropdown-panel');
        const filterChevron = document.getElementById('filter-chevron');
        const filterActiveBadge = document.getElementById('filter-active-badge');

        function updateFilterActiveBadge() {
            const y = document.getElementById('filter-student-year')?.value || 'all';
            const i = document.getElementById('filter-student-sub-institute')?.value || 'all';
            const s = document.getElementById('filter-student-shift')?.value || 'all';
            const isActive = y !== 'all' || i !== 'all' || s !== 'all';
            if (filterActiveBadge) filterActiveBadge.classList.toggle('hidden', !isActive);
        }

        if (filterDropdownBtn && filterDropdownPanel) {
            filterDropdownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !filterDropdownPanel.classList.contains('hidden');
                filterDropdownPanel.classList.toggle('hidden', isOpen);
                if (filterChevron) {
                    filterChevron.style.transform = isOpen ? '' : 'rotate(180deg)';
                }
            });
        }

        document.addEventListener('click', (e) => {
            const wrapper = document.getElementById('filter-dropdown-wrapper');
            if (wrapper && !wrapper.contains(e.target)) {
                if (filterDropdownPanel) filterDropdownPanel.classList.add('hidden');
                if (filterChevron) filterChevron.style.transform = '';
            }
        });

        // Academic Year Accordion
        const yearAccordionBtn = document.getElementById('year-accordion-btn');
        const yearAccordionPanel = document.getElementById('year-accordion-panel');
        const yearChevron = document.getElementById('year-chevron');
        if (yearAccordionBtn && yearAccordionPanel) {
            yearAccordionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !yearAccordionPanel.classList.contains('hidden');
                yearAccordionPanel.classList.toggle('hidden', isOpen);
                if (yearChevron) yearChevron.style.transform = isOpen ? '' : 'rotate(180deg)';
                if (!isOpen) {
                    document.getElementById('inst-accordion-panel')?.classList.add('hidden');
                    const ic = document.getElementById('inst-chevron');
                    if (ic) ic.style.transform = '';
                }
            });
        }

        // Sub-Institute Accordion
        const instAccordionBtn = document.getElementById('inst-accordion-btn');
        const instAccordionPanel = document.getElementById('inst-accordion-panel');
        const instChevron = document.getElementById('inst-chevron');
        if (instAccordionBtn && instAccordionPanel) {
            instAccordionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !instAccordionPanel.classList.contains('hidden');
                instAccordionPanel.classList.toggle('hidden', isOpen);
                if (instChevron) instChevron.style.transform = isOpen ? '' : 'rotate(180deg)';
                if (!isOpen) {
                    document.getElementById('year-accordion-panel')?.classList.add('hidden');
                    const yc = document.getElementById('year-chevron');
                    if (yc) yc.style.transform = '';
                }
            });
        }

        // Year options click
        document.querySelectorAll('.year-filter-opt').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.getAttribute('data-year');
                const hidden = document.getElementById('filter-student-year');
                if (hidden) hidden.value = val;
                const label = document.getElementById('filter-year-label');
                if (label) label.textContent = val === 'all' ? 'All' : val;
                updateFilterActiveBadge();
                renderStudentsTable();
            });
        });

        // Sub-Institute options click
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.inst-filter-opt');
            if (!btn) return;
            const val = btn.getAttribute('data-inst');
            const hidden = document.getElementById('filter-student-sub-institute');
            if (hidden) hidden.value = val;
            const label = document.getElementById('filter-inst-label');
            if (label) label.textContent = val === 'all' ? 'All' : val;
            updateFilterActiveBadge();
            renderStudentsTable();
        });

        function createStudentRow(student) {
            const bus = buses.find(b => b.id === student.assignedBusId);
            const busInfo = bus ? `Bus ${bus.number} - ${bus.route}` : 'Not Assigned';

            const passDate = student.passValidity ? new Date(student.passValidity) : null;
            const isExpired = passDate && passDate < new Date();
            const passStatus = isExpired ?
                '<span class="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-full flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse"></span>Expired</span>' :
                '<span class="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1 w-max"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>Valid</span>';

            const departmentInfo = student.department || 'N/A';
            const yearInfo = student.year || 'N/A';
            
            let subInstBadge = '';
            if (student.subInstitute) {
                const colors = {
                    'IIST': 'bg-blue-50 text-blue-700 border-blue-200',
                    'IIP': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    'IMR': 'bg-purple-50 text-purple-700 border-purple-200'
                };
                const badgeClass = colors[student.subInstitute.toUpperCase()] || 'bg-slate-50 text-slate-700 border-slate-200';
                subInstBadge = `<span class="px-2.5 py-0.5 border ${badgeClass} text-[10px] font-black rounded-full uppercase tracking-wider shrink-0">${student.subInstitute}</span>`;
            }

            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                            ${student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                            <p class="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                ${student.name || 'Unknown'}
                                ${subInstBadge}
                            </p>
                            <p class="text-xs text-slate-500 font-medium">${departmentInfo} - ${yearInfo}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-slate-700 font-medium">${student.email || 'N/A'}</td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-black rounded-lg">
                        ${student.enrollment || 'N/A'}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-700 text-sm font-semibold">${busInfo}</td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-1">
                        <span class="text-sm text-slate-700 font-semibold">${student.passValidity || 'Not Set'}</span>
                        ${passStatus}
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                        <button class="btn-view-student px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm" data-id="${student.id}">
                            View Details
                        </button>
                        <button class="btn-edit-student px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm" data-id="${student.id}">
                            Edit
                        </button>
                    </div>
                </td>
            `;
            return row;
        }

        function renderStudentsTable() {
            const totalCountEl = document.getElementById('student-total-count');
            if (totalCountEl) totalCountEl.textContent = students.length;

            let filteredStudents = students;

            if (searchStudent && searchStudent.value) {
                const searchTerm = searchStudent.value.toLowerCase();
                filteredStudents = filteredStudents.filter(s =>
                    s.name?.toLowerCase().includes(searchTerm) ||
                    s.enrollment?.toLowerCase().includes(searchTerm)
                );
            }

            const filterYear = document.getElementById('filter-student-year');
            if (filterYear && filterYear.value !== 'all') {
                filteredStudents = filteredStudents.filter(s => s.year === filterYear.value);
            }

            const filterSubInst = document.getElementById('filter-student-sub-institute');
            if (filterSubInst && filterSubInst.value !== 'all') {
                filteredStudents = filteredStudents.filter(s => s.subInstitute === filterSubInst.value);
            }

            const filterShift = document.getElementById('filter-student-shift');
            const currentShiftFilter = filterShift ? filterShift.value : 'all';

            if (studentCount) {
                studentCount.textContent = filteredStudents.length;
            }

            const singlePanel = document.getElementById('student-single-panel');
            const splitPanels = document.getElementById('student-split-panels');
            const panelShift1 = document.getElementById('panel-shift1');
            const panelShift2 = document.getElementById('panel-shift2');
            const badge1 = document.getElementById('shift1-count-badge');
            const badge2 = document.getElementById('shift2-count-badge');

            if (isShift2Enabled) {
                if (singlePanel) singlePanel.classList.add('hidden');
                if (splitPanels) splitPanels.classList.remove('hidden');

                const tbodyShift1 = document.getElementById('student-table-body-shift1');
                const tbodyShift2 = document.getElementById('student-table-body-shift2');

                if (tbodyShift1) tbodyShift1.innerHTML = '';
                if (tbodyShift2) tbodyShift2.innerHTML = '';

                const shift1Students = filteredStudents.filter(s => (s.shift || 'Shift 1') === 'Shift 1');
                const shift2Students = filteredStudents.filter(s => s.shift === 'Shift 2');

                if (badge1) badge1.textContent = shift1Students.length;
                if (badge2) badge2.textContent = shift2Students.length;

                const showShift1 = (currentShiftFilter === 'all' || currentShiftFilter === 'Shift 1');
                const showShift2 = (currentShiftFilter === 'all' || currentShiftFilter === 'Shift 2');
                if (panelShift1) panelShift1.classList.toggle('hidden', !showShift1);
                if (panelShift2) panelShift2.classList.toggle('hidden', !showShift2);

                if (tbodyShift1 && showShift1) {
                    if (shift1Students.length === 0) {
                        tbodyShift1.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500">No Shift 1 students found.</td></tr>';
                    } else {
                        shift1Students.forEach(student => tbodyShift1.appendChild(createStudentRow(student)));
                    }
                }

                if (tbodyShift2 && showShift2) {
                    if (shift2Students.length === 0) {
                        tbodyShift2.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500">No Shift 2 students found.</td></tr>';
                    } else {
                        shift2Students.forEach(student => tbodyShift2.appendChild(createStudentRow(student)));
                    }
                }
            } else {
                if (singlePanel) singlePanel.classList.remove('hidden');
                if (splitPanels) splitPanels.classList.add('hidden');

                if (!studentTableBody) return;
                studentTableBody.innerHTML = '';

                if (filteredStudents.length === 0) {
                    studentTableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500">No students found matching filters.</td></tr>';
                } else {
                    filteredStudents.forEach(student => studentTableBody.appendChild(createStudentRow(student)));
                }
            }

            // Re-bind actions on dynamically created rows
            document.querySelectorAll('.btn-view-student').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (id) viewStudentDetails(id);
                });
            });
            document.querySelectorAll('.btn-edit-student').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (id) editStudent(id);
                });
            });
        }

        if (searchStudent) {
            searchStudent.addEventListener('input', renderStudentsTable);
        }

        // === VIEW STUDENT DETAILS ===
        function viewStudentDetails(studentId) {
            const student = students.find(s => s.id === studentId);
            if (!student) return;

            const modal = document.getElementById('modal-student-detail');
            const content = document.getElementById('student-detail-content');

            if (!modal || !content) return;

            const bus = buses.find(b => b.id === student.assignedBusId);
            const busInfo = bus ? `Bus ${bus.number} - ${bus.route}` : 'Not Assigned';

            const subInstDisplay = student.subInstitute || 'None';
            const shiftDisplay = student.shift || 'Shift 1';

            content.innerHTML = `
                <div class="space-y-6">
                    <div class="flex items-center gap-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl">
                        <div class="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg">
                            ${student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                            <h3 class="text-2xl font-black text-slate-800">${student.name || 'Unknown'}</h3>
                            <p class="text-slate-600">${student.enrollment || 'No Enrollment ID'}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Email</p>
                            <p class="text-sm font-semibold text-slate-800">${student.email || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Phone</p>
                            <p class="text-sm font-semibold text-slate-800">${student.phone || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Parent Phone</p>
                            <p class="text-sm font-semibold text-slate-800">${student.parentPhone || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Department</p>
                            <p class="text-sm font-semibold text-slate-800">${student.department || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Year</p>
                            <p class="text-sm font-semibold text-slate-800">${student.year || 'N/A'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Pass Validity</p>
                            <p class="text-sm font-semibold text-slate-800">${student.passValidity || 'Not Set'}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Sub-Institute</p>
                            <p class="text-sm font-semibold text-slate-800">${subInstDisplay}</p>
                        </div>
                        <div class="p-4 bg-white rounded-xl border-2 border-slate-200">
                            <p class="text-xs font-bold text-slate-500 mb-1">Assigned Shift</p>
                            <p class="text-sm font-semibold text-slate-800">${shiftDisplay}</p>
                        </div>
                    </div>
                    
                    <div class="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                        <p class="text-xs font-bold text-blue-700 mb-1">Address</p>
                        <p class="text-sm text-slate-800">${student.address || 'Not provided'}</p>
                    </div>
                    
                    <div class="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                        <p class="text-xs font-bold text-green-700 mb-1">Assigned Bus Route</p>
                        <p class="text-sm font-semibold text-slate-800">${busInfo}</p>
                    </div>
                    
                    <div class="flex gap-3">
                        <button class="btn-action-edit flex-1 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all">
                            ✏️ Edit Student
                        </button>
                        <button class="btn-action-delete flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all">
                            Delete Student
                        </button>
                    </div>
                </div>
            `;

            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Modal inner actions
            content.querySelector('.btn-action-edit').onclick = () => editStudent(studentId);
            content.querySelector('.btn-action-delete').onclick = () => deleteStudent(studentId);
        }

        const closeStudentDetailBtn = document.getElementById('close-student-detail-btn');
        if (closeStudentDetailBtn) {
            closeStudentDetailBtn.addEventListener('click', () => {
                const modal = document.getElementById('modal-student-detail');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }

        async function deleteStudent(studentId) {
            if (confirm('Are you sure you want to delete this student? This will also delete their account.')) {
                try {
                    await dbHelper.getUsersCol().doc(studentId).delete();
                    alert('✅ Student deleted successfully!');

                    const modal = document.getElementById('modal-student-detail');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.classList.remove('flex');
                    }
                } catch (error) {
                    alert('❌ Error deleting student: ' + error.message);
                }
            }
        }

        // === EDIT STUDENT ===
        let editingStudentId = null;

        function editStudent(studentId) {
            const student = students.find(s => s.id === studentId);
            if (!student) return;

            editingStudentId = studentId;

            // Close details modal
            const detailModal = document.getElementById('modal-student-detail');
            if (detailModal) {
                detailModal.classList.add('hidden');
                detailModal.classList.remove('flex');
            }

            const modal = document.getElementById('modal-edit-student');
            if (!modal) return;

            modal.querySelector('[name="name"]').value = student.name || '';
            modal.querySelector('[name="enrollment"]').value = student.enrollment || '';
            modal.querySelector('[name="address"]').value = student.address || '';
            modal.querySelector('[name="phone"]').value = student.phone || '';
            modal.querySelector('[name="parentPhone"]').value = student.parentPhone || '';
            modal.querySelector('[name="department"]').value = student.department || '';
            modal.querySelector('[name="passValidity"]').value = student.passValidity || '';

            const yearSelect = modal.querySelector('[name="year"]');
            if (yearSelect) yearSelect.value = student.year || '1st Year';

            const subInstSelect = modal.querySelector('[name="subInstitute"]');
            if (subInstSelect) subInstSelect.value = student.subInstitute || '';

            const shiftSelect = modal.querySelector('#student-edit-shift-container select');
            if (shiftSelect) shiftSelect.value = student.shift || 'Shift 1';

            // Populate bus routes
            const editBusSelect = modal.querySelector('[name="assignedBusId"]');
            if (editBusSelect) {
                editBusSelect.innerHTML = '<option value="">Select a route...</option>';
                buses.forEach(bus => {
                    const option = document.createElement('option');
                    option.value = bus.id;
                    option.textContent = `Bus ${bus.number} - ${bus.route}`;
                    if (bus.id === student.assignedBusId) option.selected = true;
                    editBusSelect.appendChild(option);
                });
            }

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }

        const closeEditStudentBtn = document.getElementById('close-edit-student-btn');
        const cancelEditStudentBtn = document.getElementById('cancel-edit-student-btn');

        function closeEditStudentModal() {
            const modal = document.getElementById('modal-edit-student');
            if (modal) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
            editingStudentId = null;
        }

        if (closeEditStudentBtn) closeEditStudentBtn.addEventListener('click', closeEditStudentModal);
        if (cancelEditStudentBtn) cancelEditStudentBtn.addEventListener('click', closeEditStudentModal);

        const formEditStudent = document.getElementById('form-edit-student');
        if (formEditStudent) {
            formEditStudent.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!editingStudentId) return;

                const formData = new FormData(e.target);
                try {
                    await dbHelper.getUsersCol().doc(editingStudentId).update({
                        name: formData.get('name'),
                        enrollment: formData.get('enrollment'),
                        address: formData.get('address') || '',
                        phone: formData.get('phone') || '',
                        parentPhone: formData.get('parentPhone') || '',
                        department: formData.get('department') || '',
                        year: formData.get('year') || '1st Year',
                        assignedBusId: formData.get('assignedBusId'),
                        passValidity: formData.get('passValidity'),
                        subInstitute: formData.get('subInstitute') || '',
                        shift: isShift2Enabled ? (formData.get('shift') || 'Shift 1') : 'Shift 1',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Student updated successfully!');
                    closeEditStudentModal();
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            });
        }

        // === REGISTER STUDENT MODAL ===
        const addStudentBtn = document.getElementById('add-student-btn');
        const modalAddStudent = document.getElementById('modal-add-student');
        const closeStudentModalBtn = document.getElementById('close-student-modal-btn');
        const cancelStudentModalBtn = document.getElementById('cancel-student-modal-btn');
        const formAddStudent = document.getElementById('form-add-student');
        const togglePassword = document.getElementById('toggle-password');
        const passwordInput = document.getElementById('password-input');

        if (addStudentBtn && modalAddStudent) {
            addStudentBtn.addEventListener('click', () => {
                modalAddStudent.classList.remove('hidden');
                modalAddStudent.classList.add('flex');
            });
        }

        function closeAddStudentModal() {
            if (modalAddStudent) {
                modalAddStudent.classList.add('hidden');
                modalAddStudent.classList.remove('flex');
            }
        }
        if (closeStudentModalBtn) closeStudentModalBtn.addEventListener('click', closeAddStudentModal);
        if (cancelStudentModalBtn) cancelStudentModalBtn.addEventListener('click', closeAddStudentModal);

        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', () => {
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    togglePassword.textContent = '🙈';
                } else {
                    passwordInput.type = 'password';
                    togglePassword.textContent = '👁️';
                }
            });
        }

        if (formAddStudent) {
            formAddStudent.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);

                const email = formData.get('email');
                const password = formData.get('password');

                try {
                    const userId = await window.createSecondaryAuthUser(email, password);

                    await dbHelper.getUsersCol().doc(email).set({
                        name: formData.get('name'),
                        email: email,
                        enrollment: formData.get('enrollment'),
                        address: formData.get('address') || '',
                        phone: formData.get('phone') || '',
                        parentPhone: formData.get('parentPhone') || '',
                        department: formData.get('department') || '',
                        year: formData.get('year') || '1st Year',
                        assignedBusId: formData.get('assignedBusId'),
                        passValidity: formData.get('passValidity'),
                        subInstitute: formData.get('subInstitute') || '',
                        shift: isShift2Enabled ? (formData.get('shift') || 'Shift 1') : 'Shift 1',
                        role: 'student',
                        uid: userId,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    alert('✅ Student registered successfully!');
                    e.target.reset();
                    closeAddStudentModal();
                } catch (error) {
                    alert('❌ Error: ' + error.message);
                }
            });
        }

        // === IMPORT STUDENTS FROM CSV/EXCEL ===
        const importStudentsBtn = document.getElementById('import-students-btn');
        const modalImportStudents = document.getElementById('modal-import-students');
        const closeImportModalBtn = document.getElementById('close-import-modal-btn');
        const cancelImportModalBtn = document.getElementById('cancel-import-modal-btn');
        const csvFileInput = document.getElementById('csv-file-input');
        const csvDropZone = document.getElementById('csv-drop-zone');
        const downloadCsvTemplate = document.getElementById('download-csv-template');
        const startImportBtn = document.getElementById('start-import-btn');
        const importPreviewContainer = document.getElementById('import-preview-container');
        const importPreviewCount = document.getElementById('import-preview-count');
        const previewValidationBadge = document.getElementById('preview-validation-badge');
        const importPreviewTbody = document.getElementById('import-preview-tbody');
        const importProgressContainer = document.getElementById('import-progress-container');
        const importProgressStatus = document.getElementById('import-progress-status');
        const importProgressPct = document.getElementById('import-progress-pct');
        const importProgressBar = document.getElementById('import-progress-bar');
        const importLogBox = document.getElementById('import-log-box');

        let parsedStudents = [];

        if (importStudentsBtn && modalImportStudents) {
            importStudentsBtn.addEventListener('click', () => {
                modalImportStudents.classList.remove('hidden');
                modalImportStudents.classList.add('flex');
                resetImportState();
            });
        }

        function closeImportModal() {
            if (modalImportStudents) {
                modalImportStudents.classList.add('hidden');
                modalImportStudents.classList.remove('flex');
            }
            resetImportState();
        }
        if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);
        if (cancelImportModalBtn) cancelImportModalBtn.addEventListener('click', closeImportModal);

        function resetImportState() {
            if (csvFileInput) csvFileInput.value = '';
            parsedStudents = [];
            if (startImportBtn) {
                startImportBtn.disabled = true;
                startImportBtn.textContent = 'Start Import';
            }
            if (importPreviewContainer) importPreviewContainer.classList.add('hidden');
            if (importProgressContainer) importProgressContainer.classList.add('hidden');
            if (importPreviewTbody) importPreviewTbody.innerHTML = '';
            if (importLogBox) importLogBox.innerHTML = '<p class="text-slate-500">> Ready to import.</p>';
            if (importProgressBar) importProgressBar.style.width = '0%';
            if (importProgressPct) importProgressPct.textContent = '0%';
            if (importProgressStatus) importProgressStatus.textContent = 'Importing records...';
        }

        if (csvDropZone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                csvDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    csvDropZone.classList.add('border-primary', 'bg-blue-50/50');
                }, false);
            });
            ['dragleave', 'drop'].forEach(eventName => {
                csvDropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    csvDropZone.classList.remove('border-primary', 'bg-blue-50/50');
                }, false);
            });
            csvDropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files.length > 0) {
                    if (csvFileInput) {
                        csvFileInput.files = files;
                        handleFileSelect(files[0]);
                    }
                }
            });
        }

        if (csvFileInput) {
            csvFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handleFileSelect(e.target.files[0]);
                }
            });
        }

        if (downloadCsvTemplate) {
            downloadCsvTemplate.addEventListener('click', () => {
                const headers = ['Name', 'Email', 'Password', 'Enrollment', 'BusRoute', 'PassValidity', 'Address', 'Phone', 'ParentPhone', 'Department', 'Year'];
                const sample = [
                    ['John Doe', 'john.doe@indoreinstitute.com', 'password123', '0818CS221001', '101', '2026-12-31', 'Indore City', '9876543210', '9876543211', 'CSE', '3rd Year'],
                    ['Jane Smith', 'jane.smith@indoreinstitute.com', 'pass456', '0818CS221002', 'Main Campus Loop', '2026-12-31', 'Annapurna Road', '9876543220', '9876543221', 'IT', '2nd Year']
                ];
                
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += headers.join(",") + "\n";
                sample.forEach(row => {
                    csvContent += row.map(val => `"${val}"`).join(",") + "\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "student_import_template.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        function handleFileSelect(file) {
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (rows.length < 2) {
                        alert("❌ Error: The file must contain a header row and at least one student record.");
                        return;
                    }

                    const headers = rows[0].map(h => (h || '').toString().trim().toLowerCase());
                    
                    const nameIdx = headers.indexOf('name');
                    const emailIdx = headers.indexOf('email');
                    const passwordIdx = headers.indexOf('password');
                    const enrollIdx = headers.indexOf('enrollment');
                    const routeIdx = headers.indexOf('busroute');
                    const validityIdx = headers.indexOf('passvalidity');
                    
                    const addressIdx = headers.indexOf('address');
                    const phoneIdx = headers.indexOf('phone');
                    const parentPhoneIdx = headers.indexOf('parentphone');
                    const deptIdx = headers.indexOf('department');
                    const yearIdx = headers.indexOf('year');

                    if (nameIdx === -1 || emailIdx === -1 || enrollIdx === -1 || routeIdx === -1 || validityIdx === -1) {
                        alert("❌ Error: File is missing required columns. Ensure it has Name, Email, Enrollment, BusRoute, and PassValidity.");
                        return;
                    }

                    parsedStudents = [];
                    let hasValidationError = false;
                    importPreviewTbody.innerHTML = '';

                    for (let r = 1; r < rows.length; r++) {
                        const row = rows[r];
                        if (!row || row.length === 0 || row.every(val => val === undefined || val === null || val === '')) continue;

                        const studentObj = {
                            name: (row[nameIdx] || '').toString().trim(),
                            email: (row[emailIdx] || '').toString().trim().toLowerCase(),
                            password: passwordIdx !== -1 && row[passwordIdx] ? row[passwordIdx].toString() : 'student12345',
                            enrollment: (row[enrollIdx] || '').toString().trim(),
                            busRouteVal: (row[routeIdx] || '').toString().trim(),
                            passValidity: (row[validityIdx] || '').toString().trim(),
                            address: addressIdx !== -1 && row[addressIdx] ? row[addressIdx].toString().trim() : '',
                            phone: phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].toString().trim() : '',
                            parentPhone: parentPhoneIdx !== -1 && row[parentPhoneIdx] ? row[parentPhoneIdx].toString().trim() : '',
                            department: deptIdx !== -1 && row[deptIdx] ? row[deptIdx].toString().trim() : '',
                            year: yearIdx !== -1 && row[yearIdx] ? row[yearIdx].toString().trim() : '1st Year'
                        };

                        let rowValid = true;
                        let validationMsg = '';

                        if (!studentObj.name) { rowValid = false; validationMsg += 'Name is required. '; }
                        if (!studentObj.email || !studentObj.email.includes('@')) { rowValid = false; validationMsg += 'Invalid email. '; }
                        if (!studentObj.enrollment) { rowValid = false; validationMsg += 'Enrollment ID required. '; }
                        if (!studentObj.busRouteVal) { rowValid = false; validationMsg += 'Bus Route required. '; }
                        if (!studentObj.passValidity) { rowValid = false; validationMsg += 'Pass Validity required. '; }

                        let matchBus = buses.find(b => 
                            b.number === studentObj.busRouteVal || 
                            b.id === studentObj.busRouteVal || 
                            b.route.toLowerCase().includes(studentObj.busRouteVal.toLowerCase())
                        );
                        
                        if (matchBus) {
                            studentObj.assignedBusId = matchBus.id;
                        } else {
                            rowValid = false; 
                            validationMsg += `No bus matches route "${studentObj.busRouteVal}". `;
                        }

                        if (!rowValid) hasValidationError = true;

                        parsedStudents.push({ data: studentObj, valid: rowValid, errorMsg: validationMsg });

                        const tr = document.createElement('tr');
                        tr.className = rowValid ? 'border-b border-gray-100 hover:bg-slate-50' : 'border-b border-red-50 bg-red-50/40 text-red-700';
                        tr.innerHTML = `
                            <td class="p-2 font-semibold">${studentObj.name || '<span class="text-red-500 font-bold">MISSING</span>'}</td>
                            <td class="p-2 font-mono">${studentObj.email || '<span class="text-red-500 font-bold">MISSING</span>'}</td>
                            <td class="p-2 font-mono">${studentObj.password ? '••••••' : 'student12345'}</td>
                            <td class="p-2 font-mono">${studentObj.enrollment || '<span class="text-red-500 font-bold">MISSING</span>'}</td>
                            <td class="p-2">${studentObj.busRouteVal} ${matchBus ? `<span class="text-[10px] bg-blue-100 text-blue-800 rounded px-1.5 py-0.5 ml-1">ID: ${matchBus.number}</span>` : `<span class="text-[10px] bg-red-100 text-red-800 rounded px-1.5 py-0.5 ml-1 font-bold">404</span>`}</td>
                            <td class="p-2 font-mono">${studentObj.passValidity || '<span class="text-red-500 font-bold">MISSING</span>'}</td>
                        `;
                        
                        if (!rowValid) tr.setAttribute('title', validationMsg);
                        importPreviewTbody.appendChild(tr);
                    }

                    importPreviewCount.textContent = parsedStudents.length;
                    importPreviewContainer.classList.remove('hidden');

                    if (hasValidationError) {
                        previewValidationBadge.className = 'px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold text-[10px]';
                        previewValidationBadge.textContent = 'CONTAINS ERRORS';
                        startImportBtn.disabled = true;
                        alert("⚠️ Warning: Your file contains records with validation errors. Please check the preview highlighted in red, correct the sheet, and try again.");
                    } else {
                        previewValidationBadge.className = 'px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold text-[10px]';
                        previewValidationBadge.textContent = 'ALL VALID';
                        startImportBtn.disabled = false;
                    }
                } catch (err) {
                    console.error(err);
                    alert("❌ Error: Failed to parse spreadsheet file. Ensure it is a valid Excel (.xlsx/.xls) or CSV file.");
                }
            };
            reader.readAsArrayBuffer(file);
        }

        if (startImportBtn) {
            startImportBtn.addEventListener('click', async () => {
                if (parsedStudents.length === 0) return;

                startImportBtn.disabled = true;
                cancelImportModalBtn.disabled = true;
                closeImportModalBtn.disabled = true;
                if (csvFileInput) csvFileInput.disabled = true;

                importProgressContainer.classList.remove('hidden');
                importLogBox.innerHTML = '';

                function addLog(msg, type = 'info') {
                    const p = document.createElement('p');
                    if (type === 'error') p.className = 'text-red-400 font-bold';
                    else if (type === 'success') p.className = 'text-emerald-400 font-semibold';
                    else p.className = 'text-green-400';
                    p.textContent = `> [${new Date().toLocaleTimeString()}] ${msg}`;
                    importLogBox.appendChild(p);
                    importLogBox.scrollTop = importLogBox.scrollHeight;
                }

                addLog(`Initializing batch import of ${parsedStudents.length} records...`);

                let successCount = 0;
                let errorCount = 0;

                for (let i = 0; i < parsedStudents.length; i++) {
                    const student = parsedStudents[i];
                    const pct = Math.round(((i) / parsedStudents.length) * 100);
                    importProgressBar.style.width = `${pct}%`;
                    importProgressPct.textContent = `${pct}%`;
                    importProgressStatus.textContent = `Importing ${i + 1} of ${parsedStudents.length}...`;

                    if (!student.valid) {
                        addLog(`Skipping ${student.data.email || 'record'}: ${student.errorMsg}`, 'error');
                        errorCount++;
                        continue;
                    }

                    const sData = student.data;
                    addLog(`[${i+1}/${parsedStudents.length}] Registering Auth Account for: ${sData.email}...`);

                    try {
                        const userId = await window.createSecondaryAuthUser(sData.email, sData.password);
                        addLog(`Auth User registered with UID: ${userId.substring(0, 8)}...`, 'success');

                        addLog(`Creating Firestore Profile document...`);
                        await dbHelper.getUsersCol().doc(sData.email).set({
                            name: sData.name,
                            email: sData.email,
                            enrollment: sData.enrollment,
                            address: sData.address,
                            phone: sData.phone,
                            parentPhone: sData.parentPhone,
                            department: sData.department,
                            year: sData.year,
                            assignedBusId: sData.assignedBusId,
                            passValidity: sData.passValidity,
                            role: 'student',
                            uid: userId,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });

                        addLog(`Firestore Profile created successfully.`, 'success');
                        successCount++;
                    } catch (authErr) {
                        console.error(authErr);
                        addLog(`[ERROR] Failed to import ${sData.email}: ${authErr.message}`, 'error');
                        errorCount++;
                    }
                }

                importProgressBar.style.width = '100%';
                importProgressPct.textContent = '100%';
                importProgressStatus.textContent = 'Import Complete!';

                addLog(`Batch Process Completed! Success: ${successCount}, Failed/Skipped: ${errorCount}`, successCount > 0 ? 'success' : 'error');
                alert(`Batch Import Completed!\n\nSuccessfully Imported: ${successCount}\nFailed / Errors: ${errorCount}`);

                cancelImportModalBtn.disabled = false;
                closeImportModalBtn.disabled = false;
                if (csvFileInput) csvFileInput.disabled = false;
                startImportBtn.textContent = 'Import Again';
                startImportBtn.disabled = false;
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
