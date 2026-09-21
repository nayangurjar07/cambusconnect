document.addEventListener('DOMContentLoaded', async () => {
    const student = JSON.parse(localStorage.getItem('student'));
    
    if (!student) {
        window.location.href = '../student-login.html';
        return;
    }

    let authUser = null;
    const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
    if (typeof authGuard === 'function') {
        try {
            authUser = await authGuard();
        } catch (e) {
            console.error('Firebase Auth readiness failed in lost-found.js:', e);
        }
    }

    const currentAuthUser = authUser ||
                             (window.auth && window.auth.currentUser) ||
                             (typeof getFirebase === 'function' && getFirebase()?.auth ? getFirebase().auth().currentUser : null);
    const currentUserEmail = (currentAuthUser && currentAuthUser.email) ||
                             student.email ||
                             (student.id && String(student.id).includes('@') ? student.id : '') ||
                             localStorage.getItem('userEmail') ||
                             '';
    const currentUserId = student.collegeId || student.enrollment || student.id || currentUserEmail || '';
    const currentUserName = student.name || 'Student';

    if (!student.email && currentUserEmail) {
        student.email = currentUserEmail;
        localStorage.setItem('student', JSON.stringify(student));
    }

    const listContainer = document.getElementById('lost-items-list');
    const form = document.getElementById('lost-item-form');
    const submitButton = document.getElementById('submit-report-button');
    const loader = document.getElementById('list-loader');
    const searchInput = document.getElementById('lost-search-input');
    const statusFilterChips = document.querySelectorAll('.lost-filter-chip');
    const countDisplay = document.getElementById('lost-items-count');

    let allLoadedItems = [];
    let currentSearchTerm = '';
    let currentStatusFilter = 'all';

    if (!listContainer || !form || !submitButton) {
        console.error('Lost & Found UI elements missing.');
        return;
    }

    function getItemDate(item) {
        if (!item || !item.createdAt) return null;
        if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate();
        const parsed = new Date(item.createdAt);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function isOwnedByCurrentUser(item) {
        return (currentUserId && item.userId === currentUserId) || (currentUserEmail && item.userEmail === currentUserEmail);
    }

    function filterAndRender() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let filtered = allLoadedItems.filter(item => {
            if (item.isDeleted === true) return false;
            const createdDate = getItemDate(item);
            // If date is pending (serverTimestamp) or within 30 days, keep it
            if (createdDate && createdDate < thirtyDaysAgo) return false;

            // Status filter
            if (currentStatusFilter !== 'all') {
                const itemStatus = (item.status || 'Lost').toLowerCase();
                if (itemStatus !== currentStatusFilter.toLowerCase()) return false;
            }

            // Search filter
            if (currentSearchTerm) {
                const term = currentSearchTerm.toLowerCase();
                const itemName = (item.item || item.itemName || '').toLowerCase();
                const desc = (item.description || '').toLowerCase();
                const route = (item.route || '').toLowerCase();
                const reporter = (item.userName || '').toLowerCase();
                if (!itemName.includes(term) && !desc.includes(term) && !route.includes(term) && !reporter.includes(term)) {
                    return false;
                }
            }

            return true;
        });

        if (countDisplay) {
            countDisplay.textContent = `Showing ${filtered.length} of ${allLoadedItems.length} items`;
        }

        renderList(filtered);
    }

    // Search input listener
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearchTerm = e.target.value.trim();
            filterAndRender();
        });
    }

    // Status filter chips
    statusFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            statusFilterChips.forEach(c => {
                c.classList.remove('bg-primary', 'text-white', 'shadow-sm');
                c.classList.add('bg-slate-100', 'text-slate-600');
            });
            chip.classList.add('bg-primary', 'text-white', 'shadow-sm');
            chip.classList.remove('bg-slate-100', 'text-slate-600');
            currentStatusFilter = chip.dataset.status;
            filterAndRender();
        });
    });

    // Location Type Toggle
    const locTypeBus = document.getElementById('loc-type-bus');
    const locTypeCampus = document.getElementById('loc-type-campus');
    const busContainer = document.getElementById('bus-location-container');
    const campusContainer = document.getElementById('campus-location-container');

    function updateLocationVisibility() {
        if (locTypeCampus && locTypeCampus.checked) {
            busContainer?.classList.add('hidden');
            campusContainer?.classList.remove('hidden');
        } else {
            busContainer?.classList.remove('hidden');
            campusContainer?.classList.add('hidden');
        }
    }
    if (locTypeBus) locTypeBus.addEventListener('change', updateLocationVisibility);
    if (locTypeCampus) locTypeCampus.addEventListener('change', updateLocationVisibility);

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <svg class="animate-spin h-5 w-5 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
        
        const formData = new FormData(e.target);
        const itemName = (formData.get('item') || '').trim();
        const description = (formData.get('description') || '').trim();
        const isCampus = locTypeCampus && locTypeCampus.checked;
        
        let locationString = '';
        if (isCampus) {
            const campusLoc = document.getElementById('campus-location-select')?.value || 'Campus Area';
            const campusDetail = (document.getElementById('campus-location-detail')?.value || '').trim();
            locationString = campusDetail ? `${campusLoc} (${campusDetail})` : campusLoc;
        } else {
            const selectedRoute = (formData.get('route') || '').trim();
            locationString = selectedRoute || 'General Campus Bus';
        }

        const activeAuth = (window.auth && window.auth.currentUser) ||
                           (typeof getFirebase === 'function' && getFirebase()?.auth ? getFirebase().auth().currentUser : null);
        const submitEmail = (activeAuth && activeAuth.email) ||
                            currentUserEmail ||
                            student.email ||
                            (student.id && String(student.id).includes('@') ? student.id : '') ||
                            localStorage.getItem('userEmail') ||
                            '';

        const fbInstance = typeof getFirebase === 'function' ? getFirebase() : (window.firebase || globalThis.firebase);
        const serverTs = fbInstance?.firestore?.FieldValue?.serverTimestamp ? fbInstance.firestore.FieldValue.serverTimestamp() : new Date();

        const newItem = {
            itemName: itemName,
            item: itemName, // Canonical + backwards compatibility
            description: description,
            locationType: isCampus ? 'CAMPUS' : 'BUS',
            location: locationString,
            route: locationString, // Canonical + backwards compatibility
            status: 'Lost',
            createdAt: serverTs,
            userId: currentUserId,
            userName: currentUserName,
            reportedBy: currentUserName, // Backwards compatibility for Admin
            userEmail: submitEmail,
            userPhone: student.phone || 'Not Available',
            parentPhone: student.parentPhone || 'Not Available'
        };

        try {
            await dbHelper.getLostItemsCol().add(newItem);
            
            submitButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="inline mr-2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                Report Submitted!
            `;
            
            setTimeout(() => {
                submitButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" x2="12" y1="3" y2="15"/>
                    </svg>
                    Submit Report
                `;
            }, 2000);
            
            e.target.reset();
            updateLocationVisibility();
        } catch (error) {
            console.error("Error adding document:", error);
            alert("Could not submit report: " + error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    // Fetch lost items with limit (prevents unbounded reads at scale)
    dbHelper.getLostItemsCol()
        .orderBy('createdAt', 'desc')
        .limit(30)
        .onSnapshot(snapshot => {
            if(loader) loader.remove();
            
            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });
            
            allLoadedItems = items;
            filterAndRender();
        }, error => {
            console.error("Error listening to collection:", error);
            if(loader) loader.remove();
            listContainer.innerHTML = `
                <div class="glass-card rounded-3xl p-12 text-center border-2 border-red-200">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-red-600">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" x2="12" y1="8" y2="12"/>
                            <line x1="12" x2="12.01" y2="16"/>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Items</h3>
                    <p class="text-red-600">Please try refreshing the page</p>
                </div>
            `;
        });

    function renderList(items) {
        listContainer.innerHTML = '';

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="glass-card rounded-3xl p-16 text-center border-2 border-dashed border-gray-300">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 8v8"/>
                            <path d="m8 12 4 4 4-4"/>
                        </svg>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-2">No Items Reported Yet</h3>
                    <p class="text-gray-500 text-lg">Be the first to report a lost item</p>
                </div>
            `;
            return;
        }

        items.forEach((item, index) => {
            const itemDate = getItemDate(item);
            const reportedDate = itemDate ? itemDate.toLocaleDateString() : 'Unknown';
            const isOwner = isOwnedByCurrentUser(item);
            
            const statusConfig = item.status === 'Lost' 
                ? { color: 'red', icon: '🔍', gradient: 'from-red-500 to-pink-500' }
                : { color: 'green', icon: '✅', gradient: 'from-green-500 to-emerald-500' };

            const deleteButton = isOwner ? 
                `<button data-id="${item.id}" class="delete-item-button px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                    Delete
                </button>` 
                : '';

            const isCampus = item.locationType === 'CAMPUS';
            const locIcon = isCampus ? 'apartment' : 'directions_bus';
            const locLabel = isCampus ? 'Campus Area' : 'Transit Route';
            const locValue = item.location || item.route || (isCampus ? 'General Campus' : 'Campus Transit');
            const displayName = item.itemName || item.item || 'Unnamed Item';

            const itemHtml = `
                <div class="item-card glass-card rounded-3xl p-6 border-l-4 border-${statusConfig.color}-400 animate-slideIn" style="animation-delay: ${index * 0.1}s">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 bg-gradient-to-r ${statusConfig.gradient} rounded-2xl flex items-center justify-center text-2xl shadow-lg">
                                ${statusConfig.icon}
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-900 text-xl">${displayName}</h4>
                                <span class="inline-block mt-1 px-3 py-1 bg-gradient-to-r ${statusConfig.gradient} text-white text-xs font-bold uppercase tracking-wide rounded-lg shadow-sm">
                                    ${item.status || 'Lost'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <p class="text-gray-700 font-medium mb-6 leading-relaxed bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-2xl border border-gray-200">
                        ${item.description || 'No description provided.'}
                    </p>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                        <div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-3 border border-purple-100">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="material-symbols-outlined text-[18px] text-purple-600">person</span>
                                <p class="text-xs font-bold text-purple-700 uppercase tracking-wide">Reporter</p>
                            </div>
                            <p class="text-sm font-bold text-gray-900">${item.userName || item.reportedBy || 'Anonymous'}</p>
                        </div>
                        
                        <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-3 border border-blue-100">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="material-symbols-outlined text-[18px] text-blue-600">calendar_today</span>
                                <p class="text-xs font-bold text-blue-700 uppercase tracking-wide">Date</p>
                            </div>
                            <p class="text-sm font-bold text-gray-900">${reportedDate}</p>
                        </div>
                        
                        <div class="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-3 border border-indigo-100">
                            <div class="flex items-center gap-2 mb-1">
                                <span class="material-symbols-outlined text-[18px] text-indigo-600">${locIcon}</span>
                                <p class="text-xs font-bold text-indigo-700 uppercase tracking-wide">${locLabel}</p>
                            </div>
                            <p class="text-sm font-bold text-gray-900 truncate">${locValue}</p>
                        </div>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row gap-3 pt-6 border-t-2 border-gray-100">
                        <button class="contact-button flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer" data-id="${item.id}">
                            <span class="material-symbols-outlined text-[18px]">contact_phone</span>
                            Contact Reporter
                        </button>
                        ${deleteButton}
                    </div>
                </div>
            `;
            listContainer.insertAdjacentHTML('beforeend', itemHtml);
        });

        document.querySelectorAll('.delete-item-button').forEach(button => {
            button.addEventListener('click', handleDeleteItem);
        });
        
        attachContactListeners();
    }

    async function handleDeleteItem(e) {
        const itemId = e.currentTarget.dataset.id;
        if (!confirm("Are you sure you want to delete this report?")) return;

        try {
            await dbHelper.getLostItemsCol().doc(itemId).delete();

            const card = e.currentTarget.closest('.item-card');
            if (card) card.remove();
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item: " + error.message);
        }
    }

    function showContactInfo(itemData) {
        const modal = document.getElementById('modal-contact-info');
        const content = document.getElementById('contact-info-content');
        
        if (!modal || !content) return;
        
        content.innerHTML = `
            <div class="space-y-4">
                <div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-4 border-2 border-purple-200">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            ${itemData.userName ? itemData.userName.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                            <p class="text-xs font-bold text-purple-700 uppercase tracking-wide">Reported By</p>
                            <p class="font-bold text-gray-900 text-lg">${itemData.userName || 'Anonymous'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="space-y-3">
                    <div class="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-purple-300 transition-all min-w-0">
                        <div class="flex items-center gap-2 mb-2 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-purple-600">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Email Address</p>
                        </div>
                        <p class="text-gray-900 font-semibold break-all text-xs sm:text-sm">${itemData.userEmail || 'Not Available'}</p>
                        ${itemData.userEmail && itemData.userEmail !== 'Not Available' ? `
                            <a href="mailto:${itemData.userEmail}" class="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-lg transition-all">
                                Send Email →
                            </a>
                        ` : ''}
                    </div>
                    
                    <div class="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-blue-300 transition-all min-w-0">
                        <div class="flex items-center gap-2 mb-2 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Student Phone</p>
                        </div>
                        <p class="text-gray-900 font-semibold break-words-safe text-xs sm:text-sm">${itemData.userPhone || 'Not Available'}</p>
                        ${itemData.userPhone && itemData.userPhone !== 'Not Available' ? `
                            <a href="tel:${itemData.userPhone}" class="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-lg transition-all">
                                Call Now →
                            </a>
                        ` : ''}
                    </div>
                    
                    <div class="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-indigo-300 transition-all min-w-0">
                        <div class="flex items-center gap-2 mb-2 shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-600">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            <p class="text-xs font-bold text-gray-500 uppercase tracking-wide">Parent/Guardian Phone</p>
                        </div>
                        <p class="text-gray-900 font-semibold break-words-safe text-xs sm:text-sm">${itemData.parentPhone || 'Not Available'}</p>
                        ${itemData.parentPhone && itemData.parentPhone !== 'Not Available' ? `
                            <a href="tel:${itemData.parentPhone}" class="inline-block mt-3 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:shadow-lg transition-all">
                                Call Parent →
                            </a>
                        ` : ''}
                    </div>
                </div>
                
                <div class="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl p-4">
                    <div class="flex gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-600 flex-shrink-0 mt-0.5">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <div>
                            <p class="text-sm font-bold text-yellow-800 mb-1">Privacy Notice</p>
                            <p class="text-xs text-yellow-700 leading-relaxed">Please use this contact information responsibly. This information is provided to help reunite lost items with their owners.</p>
                        </div>
                    </div>
                </div>
                
                <button onclick="closeContactModal()" class="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-700 py-4 rounded-2xl font-bold transition-all shadow-sm">
                    Close
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function closeContactModal() {
        const modal = document.getElementById('modal-contact-info');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    function attachContactListeners() {
        document.querySelectorAll('.contact-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const itemId = button.dataset.id;
                const itemData = allLoadedItems.find(it => it.id === itemId);
                if (itemData) {
                    showContactInfo(itemData);
                } else {
                    console.warn("Item not found in loaded items:", itemId);
                }
            });
        });
    }

    const closeContactBtn = document.getElementById('close-contact-modal');
    if(closeContactBtn) {
        closeContactBtn.addEventListener('click', closeContactModal);
    }

    const contactModal = document.getElementById('modal-contact-info');
    if(contactModal) {
        contactModal.addEventListener('click', (e) => {
            if(e.target.id === 'modal-contact-info') {
                closeContactModal();
            }
        });
    }

    window.closeContactModal = closeContactModal;

    console.log("✅ Student authenticated:", student.name);
    
    const routeSelect = document.getElementById('route-select');
    
    if (routeSelect) {
        routeSelect.innerHTML = '<option value="">Loading routes...</option>';
        
        dbHelper.getBusesCol().orderBy('number', 'asc').onSnapshot(
            snapshot => {
                if (snapshot.empty) {
                    routeSelect.innerHTML = '<option value="General Transit">General Transit (No registered buses)</option>';
                    console.warn("⚠️ No buses found in database");
                    return;
                }
                
                const currentValue = routeSelect.value;
                routeSelect.innerHTML = '<option value="">Select a route (optional)...</option>';
                
                snapshot.forEach(doc => {
                    const bus = doc.data();
                    const option = document.createElement('option');
                    option.value = `Bus ${bus.number} - ${bus.route}`;
                    option.textContent = `Bus ${bus.number} - ${bus.route}`;
                    routeSelect.appendChild(option);
                });
                
                if (currentValue) {
                    routeSelect.value = currentValue;
                }
                
                console.log(`@ Loaded ${snapshot.size} bus routes (real-time)`);
            },
            error => {
                console.error("❌ Error fetching buses:", error);
                routeSelect.innerHTML = '<option value="Campus Transit">Campus Transit (Routes offline)</option>';
            }
        );
    }
});
