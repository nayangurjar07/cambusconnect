// Bus Pass page logic - Enhanced digital pass with real QR code and new features

document.addEventListener('DOMContentLoaded', () => {
    
    // ========================================
    // 1. AUTHENTICATION CHECK
    // ========================================
    const student = JSON.parse(localStorage.getItem('student'));
    
    if (!student) {
        console.error("❌ No student data found. Redirecting to login...");
        window.location.href = '../student-login.html';
        return;
    }
    
    console.log("✅ Student data loaded:", student.name);
    
    // ========================================
    // 2. STATE MANAGEMENT
    // ========================================
    const todayIso = new Date().toISOString().slice(0, 10);
    let qrCheckedIn = student.lastCheckInDate === todayIso;
    let qrCodeText = ""; // Holds token for synchronous fallback layout
    const studentId = String(student.collegeId || student.enrollment || student.id || student.email || 'UNKNOWN');
    const studentName = String(student.name || 'Unknown Student');
    const studentRoute = String(student.busRoute || 'Not Assigned');
    const instituteId = String(
        localStorage.getItem('instituteId') ||
        (student.email && student.email.includes('@') ? student.email.split('@')[1].toLowerCase() : '') ||
        'unknown'
    );
    const storageKeySuffix = studentId;
    let scanCount = parseInt(localStorage.getItem(`scanCount_${storageKeySuffix}`)) || 0;
    let lastCheckinTime = localStorage.getItem(`lastCheckin_${storageKeySuffix}`);
    let checkinHistory = JSON.parse(localStorage.getItem(`checkinHistory_${storageKeySuffix}`)) || [];

    // ========================================
    // 3. GENERATE SECURE DETERMINISTIC QR CODE
    // ========================================
    async function initSecurePassQR() {
        const todayIso = new Date().toISOString().slice(0, 10);
        const collegeId = student.collegeId || student.enrollment || studentId || 'NA';
        const assignedBus = student.assignedBusId || 'NA';
        const payload = `CAMBUS:${collegeId}:${assignedBus}:${todayIso}`;
        qrCodeText = payload;
        
        // Display QR code text
        const qrTextElement = document.getElementById('pass-qrcode-text');
        if (qrTextElement) {
            qrTextElement.textContent = qrCodeText;
            qrTextElement.title = qrCodeText;
        }
        
        // Generate real QR code using QRCode.js library
        const qrContainer = document.getElementById('qrcode-container') || document.getElementById('qr-grid');
        if (qrContainer && typeof QRCode !== 'undefined') {
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: qrCodeText,
                width: 180,
                height: 180,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
            console.log("✅ Secure Deterministic QR Code generated:", qrCodeText);
        } else if (qrContainer) {
            console.warn("⚠️ QRCode.js library not loaded, using fallback grid");
            const qrGrid = document.createElement('div');
            qrGrid.className = 'grid grid-cols-10 gap-1 p-2';
            for (let i = 0; i < 100; i++) {
                const div = document.createElement('div');
                const charCode = qrCodeText.charCodeAt(i % qrCodeText.length) || 0;
                const isBlack = ((charCode * (i + 13)) % 7) > 2;
                div.className = `w-4 h-4 ${isBlack ? 'bg-black' : 'bg-white'}`;
                qrGrid.appendChild(div);
            }
            qrContainer.appendChild(qrGrid);
        }
    }
    initSecurePassQR();

    // ========================================
    // 4. GENERATE BARCODE
    // ========================================
    const barcodeContainer = document.getElementById('barcode-container');
    if(barcodeContainer) {
        const barcodeData = studentId;
        barcodeContainer.innerHTML = '';
        
        for(let i = 0; i < 30; i++) {
            const bar = document.createElement('div');
            const digit = parseInt(barcodeData[i % barcodeData.length]) || 0;
            const isWide = digit % 2 === 0;
            const height = 40 + (digit * 5);
            
            bar.className = `barcode-line ${i % 2 === 0 ? 'bg-black' : 'bg-gray-800'}`;
            bar.style.width = isWide ? '4px' : '2px';
            bar.style.height = height + 'px';
            
            barcodeContainer.appendChild(bar);
        }
        
        console.log("✅ Barcode generated");
    }

    // ========================================
    // 5. DISPLAY PASS INFORMATION
    // ========================================
    if(student) {
        const passName = document.getElementById('pass-name');
        const passCollegeId = document.getElementById('pass-college-id');
        const passRoute = document.getElementById('pass-route');
        
        if(passName) passName.textContent = studentName;
        if(passCollegeId) passCollegeId.textContent = studentId;
        if(passRoute) passRoute.textContent = studentRoute;
        
        const validityBadge = document.getElementById('pass-validity-badge');
        if(validityBadge) {
            const validityDate = student.passValidity || '31 Dec 2025';
            validityBadge.querySelector('p:last-child').textContent = validityDate;
        }
        
        const escapeHTML = str => String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag));

        const detailsContainer = document.getElementById('pass-details');
        if(detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">Full Name</p>
                    <p class="font-semibold text-gray-800 break-words-safe">${escapeHTML(studentName)}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">College ID</p>
                    <p class="font-semibold text-gray-800 break-all">${escapeHTML(studentId)}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">Bus Route</p>
                    <p class="font-semibold text-gray-800 break-words-safe">${escapeHTML(studentRoute)}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">Valid Until</p>
                    <p class="font-semibold text-green-600 break-words-safe">${escapeHTML(student.passValidity || '31 Dec 2025')}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">Pass Type</p>
                    <p class="font-semibold text-gray-800 break-words-safe">Yearly Student Pass</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200 min-w-0">
                    <p class="text-xs text-gray-500 mb-1">Pass ID</p>
                    <p class="font-semibold text-gray-800 break-all">${escapeHTML(qrCodeText)}</p>
                </div>
            `;
        }
        
        console.log("✅ Pass information displayed");
    }

    // ========================================
    // 6. UPDATE USAGE STATISTICS
    // ========================================
    const scanCountElement = document.getElementById('scan-count');
    const lastCheckinElement = document.getElementById('last-checkin');
    const lastCheckinTimeElement = document.getElementById('last-checkin-time');
    const daysRemainingElement = document.getElementById('days-remaining');
    
    if(scanCountElement) {
        scanCountElement.textContent = scanCount;
    }
    
    if(lastCheckinElement && lastCheckinTimeElement) {
        if(lastCheckinTime) {
            const date = new Date(lastCheckinTime);
            lastCheckinElement.textContent = date.toLocaleDateString();
            lastCheckinTimeElement.textContent = date.toLocaleTimeString();
        } else {
            lastCheckinElement.textContent = 'Never';
            lastCheckinTimeElement.textContent = 'No check-in recorded';
        }
    }
    
    if(daysRemainingElement) {
        let validityDate = null;
        if (student.passValidity) {
            validityDate = new Date(student.passValidity);
        }
        if (!validityDate || isNaN(validityDate.getTime())) {
            const currentYear = new Date().getFullYear();
            validityDate = new Date(`${currentYear}-12-31`);
        }
        const today = new Date();
        const daysLeft = Math.ceil((validityDate - today) / (1000 * 60 * 60 * 24));
        daysRemainingElement.textContent = daysLeft > 0 ? `Valid for ${daysLeft} days` : 'Pass Expired';
        if (daysLeft <= 0) {
            daysRemainingElement.classList.add('text-rose-500');
        }
    }

    // ========================================
    // 7. CHECK-IN FUNCTIONALITY (REAL DATABASE PERSISTENCE)
    // ========================================
    function updateCheckinStatus() {
        const statusEl = document.getElementById('checkin-status');
        const buttonEl = document.getElementById('checkin-button');
        
        if(statusEl && buttonEl) {
            if(qrCheckedIn) {
                statusEl.textContent = 'Boarding Verified';
                statusEl.className = 'font-semibold px-4 py-2 rounded-full text-sm bg-green-100 text-green-700 flex items-center';
                statusEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><polyline points="20 6 9 17 4 12"/></svg>
                    Boarding Verified
                `;
                
                buttonEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>Pass Verified Today</span>
                `;
                buttonEl.classList.remove('bg-primary', 'hover:bg-primary-container');
                buttonEl.classList.add('bg-emerald-600', 'text-white', 'cursor-default');
            } else {
                statusEl.textContent = 'Not Checked In';
                statusEl.className = 'font-semibold px-4 py-2 rounded-full text-sm bg-gray-200 text-gray-600';
                
                buttonEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>Confirm Digital Boarding</span>
                `;
                buttonEl.classList.add('bg-primary', 'hover:bg-primary-container');
                buttonEl.classList.remove('bg-emerald-600', 'cursor-default');
            }
            
            buttonEl.onclick = () => {
                if(qrCheckedIn) {
                    return; // Once checked in today, maintain verification
                }
                qrCheckedIn = true;
                scanCount++;
                lastCheckinTime = new Date().toISOString();
                const checkInDateIso = lastCheckinTime.slice(0, 10);

                // Persist check-in date to student profile in Firestore
                const currentEmail = localStorage.getItem('userEmail') || student.email;
                if (currentEmail && window.dbHelper) {
                    window.dbHelper.getUsersCol().doc(currentEmail).update({
                        lastCheckInDate: checkInDateIso
                    }).catch(err => console.warn("Could not sync lastCheckInDate to users:", err));
                }
                
                checkinHistory.unshift({
                    timestamp: lastCheckinTime,
                    busId: student.assignedBusId || 'Assigned Bus',
                    route: studentRoute
                });
                
                if(checkinHistory.length > 5) {
                    checkinHistory = checkinHistory.slice(0, 5);
                }
                
                localStorage.setItem(`scanCount_${storageKeySuffix}`, scanCount);
                localStorage.setItem(`lastCheckin_${storageKeySuffix}`, lastCheckinTime);
                localStorage.setItem(`checkinHistory_${storageKeySuffix}`, JSON.stringify(checkinHistory));
                
                if(scanCountElement) scanCountElement.textContent = scanCount;
                if(lastCheckinElement) lastCheckinElement.textContent = new Date(lastCheckinTime).toLocaleDateString();
                if(lastCheckinTimeElement) lastCheckinTimeElement.textContent = new Date(lastCheckinTime).toLocaleTimeString();
                
                updateCheckinHistory();

                // Persist real boarding record to Firestore daily_boardings collection
                if (window.dbHelper && typeof window.dbHelper.getDailyBoardingsCol === 'function') {
                    (async () => {
                        try {
                            const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
                            if (typeof authGuard === 'function') {
                                await authGuard();
                            }
                            const authUser = (window.auth && window.auth.currentUser) ||
                                             (typeof getFirebase === 'function' && getFirebase()?.auth ? getFirebase().auth().currentUser : null);
                            const fbInstance = typeof getFirebase === 'function' ? getFirebase() : (window.firebase || globalThis.firebase);
                            const serverTs = fbInstance?.firestore?.FieldValue?.serverTimestamp ? fbInstance.firestore.FieldValue.serverTimestamp() : new Date();

                            const boardingDoc = {
                                studentId,
                                studentName,
                                studentEmail: (authUser && authUser.email) || student.email || (student.id && String(student.id).includes('@') ? student.id : '') || localStorage.getItem('userEmail') || '',
                                route: studentRoute,
                                busId: student.assignedBusId || 'Assigned Bus',
                                instituteId,
                                timestamp: serverTs,
                                localTimestamp: lastCheckinTime,
                                status: 'Verified'
                            };

                            const ref = await window.dbHelper.getDailyBoardingsCol().add(boardingDoc);
                            console.log("✅ Boarding record successfully saved in Firestore:", ref.id);
                        } catch (err) {
                            console.error("❌ Boarding record write failed:", err);
                            const banner = document.getElementById('pass-offline-alert') || document.getElementById('route-merge-warning-banner');
                            if (banner) {
                                banner.classList.remove('hidden');
                                const textEl = document.getElementById('route-merge-warning-text');
                                if (textEl) textEl.textContent = `⚠️ Boarding Sync Notice: Check-in recorded locally, but cloud sync failed (${err.message || 'Permissions/Network'}).`;
                            } else {
                                alert(`⚠️ Check-in recorded locally, but cloud sync failed: ${err.message || 'Permissions/Network error'}`);
                            }
                        }
                    })();
                }
                
                console.log("✅ Check-in recorded");
                updateCheckinStatus();
            };
        }
    }

    // ========================================
    // 8. CHECK-IN HISTORY DISPLAY
    // ========================================
    function updateCheckinHistory() {
        const historyContainer = document.getElementById('checkin-history');
        
        if(historyContainer) {
            if(checkinHistory.length === 0) {
                historyContainer.innerHTML = `
                    <p class="text-xs text-gray-500 text-center py-2">No recent check-ins</p>
                `;
            } else {
                historyContainer.innerHTML = `
                    <p class="text-xs text-gray-600 font-medium mb-2">Recent Check-ins:</p>
                `;
                
                checkinHistory.forEach((record, index) => {
                    const date = new Date(record.timestamp);
                    const historyItem = `
                        <div class="flex items-center justify-between p-2 bg-white rounded-lg border border-blue-100 text-xs">
                            <div class="flex items-center space-x-2">
                                <div class="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span class="text-blue-600 font-bold text-xs">${index + 1}</span>
                                </div>
                                <div>
                                    <p class="font-medium text-gray-700">${record.route}</p>
                                    <p class="text-gray-500">${date.toLocaleDateString()} • ${date.toLocaleTimeString()}</p>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    `;
                    
                    historyContainer.insertAdjacentHTML('beforeend', historyItem);
                });
            }
        }
    }

    async function loadBoardingHistoryFromFirestore() {
        if (!window.dbHelper || typeof window.dbHelper.getDailyBoardingsCol !== 'function') return;
        try {
            const snap = await window.dbHelper.getDailyBoardingsCol()
                .where('studentId', '==', studentId)
                .limit(10)
                .get();
            if (!snap.empty) {
                const fetched = snap.docs.map(doc => {
                    const data = doc.data();
                    const ts = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : (data.localTimestamp || new Date().toISOString());
                    return {
                        timestamp: ts,
                        busId: data.busId || 'Assigned Bus',
                        route: data.route || studentRoute
                    };
                });
                fetched.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                checkinHistory = fetched;
                scanCount = fetched.length;
                lastCheckinTime = checkinHistory[0]?.timestamp || null;

                if (lastCheckinTime) {
                    const todayStr = new Date().toDateString();
                    if (new Date(lastCheckinTime).toDateString() === todayStr) {
                        qrCheckedIn = true;
                    }
                }
                if (scanCountElement) scanCountElement.textContent = scanCount;
                if (lastCheckinElement && lastCheckinTime) lastCheckinElement.textContent = new Date(lastCheckinTime).toLocaleDateString();
                if (lastCheckinTimeElement && lastCheckinTime) lastCheckinTimeElement.textContent = new Date(lastCheckinTime).toLocaleTimeString();
                updateCheckinStatus();
                updateCheckinHistory();
            }
        } catch (err) {
            console.warn('Could not load daily_boardings from Firestore:', err);
        }
    }

    updateCheckinStatus();
    updateCheckinHistory();
    loadBoardingHistoryFromFirestore();

    // ========================================
    // 9. DOWNLOAD PASS AS PDF
    // ========================================
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    if(downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            console.log("Download PDF clicked");
            alert('PDF download feature:\n\nIn production, this would generate a PDF version of your bus pass that you can print or save.\n\nFeatures:\n• QR code included\n• All pass details\n• Barcode backup\n• Digital signature');
        });
    }

    // ========================================
    // 10. DOWNLOAD PASS AS IMAGE
    // ========================================
    const downloadImageBtn = document.getElementById('download-image-btn');
    if(downloadImageBtn) {
        downloadImageBtn.addEventListener('click', () => {
            console.log("Download Image clicked");
            alert('Image download feature:\n\nIn production, this would save your bus pass as a PNG/JPG image that you can:\n• Set as phone wallpaper\n• Save to photo gallery\n• Share via messaging apps');
        });
    }

    // ========================================
    // 11. SHARE PASS
    // ========================================
    const sharePassBtn = document.getElementById('share-pass-btn');
    if(sharePassBtn) {
        sharePassBtn.addEventListener('click', async () => {
            console.log("Share Pass clicked");
            
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'CAMBUS CONNECT - Digital Bus Pass',
                        text: `My bus pass for route ${studentRoute}. Valid until ${student.passValidity || '31 Dec 2025'}`,
                        url: window.location.href
                    });
                    console.log('✅ Pass shared successfully');
                } catch (err) {
                    console.log('❌ Share cancelled or failed:', err);
                }
            } else {
                alert('Share Pass:\n\nYour pass details:\n• Route: ' + studentRoute + '\n• Valid until: ' + (student.passValidity || '31 Dec 2025') + '\n\nCopy this link to share with others!');
            }
        });
    }

    // ========================================
    // 12. ADD TO WALLET
    // ========================================
    const addToWalletBtn = document.getElementById('add-to-wallet-btn');
    if(addToWalletBtn) {
        addToWalletBtn.addEventListener('click', () => {
            console.log("Add to Wallet clicked");
            alert('Add to Wallet:\n\nIn production, this would:\n• Generate Apple Wallet pass (.pkpass)\n• Create Google Pay pass\n• Add to Samsung Pay\n\nYou could then access your pass from your phone\'s wallet app without opening the browser!');
        });
    }

    // ========================================
    // 13. PRINT PASS
    // ========================================
    const printPassBtn = document.getElementById('print-pass-btn');
    if(printPassBtn) {
        printPassBtn.addEventListener('click', () => {
            console.log("Print Pass clicked");
            window.print();
        });
    }

    // ========================================
    // 14. REPORT ISSUE
    // ========================================
    const reportIssueBtn = document.getElementById('report-issue-btn');
    if(reportIssueBtn) {
        reportIssueBtn.addEventListener('click', () => {
            console.log("Report Issue clicked");
            window.location.href = '../support/support.html?issue=pass';
        });
    }

    // ========================================
    // 15. RENEW PASS
    // ========================================
    const renewPassBtn = document.getElementById('renew-pass-btn');
    if(renewPassBtn) {
        renewPassBtn.addEventListener('click', () => {
            console.log("Renew Pass clicked");
            alert('Renew Pass:\n\nRenewal Options:\n• 1 Month - ₹500\n• 3 Months - ₹1,400 (Save ₹100)\n• 6 Months - ₹2,700 (Save ₹300)\n• 1 Year - ₹5,000 (Save ₹1,000)\n\nContact admin or visit the renewal portal to extend your pass!');
        });
    }

    // ========================================
    // 16. AUTO-BRIGHTNESS FOR QR CODE
    // ========================================
    if('wakeLock' in navigator) {
        let wakeLock = null;
        
        const requestWakeLock = async () => {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('✅ Screen wake lock activated - screen will stay bright');
            } catch (err) {
                console.log('⚠️ Wake lock not available:', err);
            }
        };
        
        requestWakeLock();
        
        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'hidden') {
                await wakeLock.release();
                wakeLock = null;
            }
        });
    }

    // Real-time listener for assigned bus to show optimization banner
    const warningBanner = document.getElementById('route-merge-warning-banner');
    const warningText = document.getElementById('route-merge-warning-text');
    
    if (student && student.assignedBusId) {
        (async () => {
            const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
            if (typeof authGuard === 'function') {
                try {
                    await authGuard();
                } catch (e) {
                    console.warn("Could not initialize Firebase Auth for route merge listener", e);
                    return;
                }
            }
            if (typeof dbHelper !== 'undefined') {
                dbHelper.getBusesCol().doc(student.assignedBusId).onSnapshot(doc => {
                    if (doc.exists) {
                        const bus = doc.data();
                        
                        // Handle route optimization warning
                        if (bus.optimizedAction && bus.optimizedAction !== 'NORMAL') {
                            if (warningBanner) warningBanner.classList.remove('hidden');
                            if (warningText) {
                                warningText.textContent = bus.instruction || `Your scheduled bus (Bus #${bus.number || student.assignedBusId}) is consolidated.`;
                            }
                        } else {
                            if (warningBanner) warningBanner.classList.add('hidden');
                        }

                        // Handle next-day ETA and holiday state
                        const nextDayInfo = document.getElementById('next-day-arrival-info');
                        const nextDayText = document.getElementById('next-day-arrival-text');
                        const nextDayHoliday = document.getElementById('next-day-holiday-text');

                        if (nextDayInfo) {
                            if (bus.nextDayArrivalTime) {
                                nextDayInfo.classList.remove('hidden');
                                if (nextDayText) {
                                    nextDayText.textContent = `Expected Arrival Time Tomorrow: ${bus.nextDayArrivalTime}`;
                                }
                                if (nextDayHoliday) {
                                    nextDayHoliday.textContent = `Tomorrow's Schedule State: ${bus.nextDayState || 'NORMAL_COLLEGE'}`;
                                }
                            } else {
                                nextDayInfo.classList.add('hidden');
                            }
                        }
                    }
                }, err => {
                    console.error("Error listening to bus optimization:", err);
                });
            }
        })();
    }
});
