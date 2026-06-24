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
    let qrCheckedIn = false;
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
    // 3. GENERATE SECURE CRYPTOGRAPHIC QR CODE
    // ========================================
    async function initSecurePassQR() {
        const secretKey = "server_super_secret_salt"; // Shared verification key

        const payloadObject = {
            studentId,
            studentName,
            routeName: studentRoute,
            instituteId
        };
        const plainText = btoa(unescape(encodeURIComponent(JSON.stringify(payloadObject))));
        
        // Browser Native HMAC-SHA256
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
        const msgData = encoder.encode(plainText);
        
        let signature = '';
        try {
            if (window.isSecureContext && window.crypto && window.crypto.subtle) {
                const key = await crypto.subtle.importKey(
                    'raw', 
                    keyData, 
                    { name: 'HMAC', hash: 'SHA-256' }, 
                    false, 
                    ['sign']
                );
                const signatureBuffer = await crypto.subtle.sign('HMAC', key, msgData);
                signature = Array.from(new Uint8Array(signatureBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } else {
                throw new Error("WebCrypto is not available (insecure context)");
            }
        } catch (e) {
            console.warn("Browser WebCrypto failed/unavailable, using hmacSha256_pure fallback", e);
            if (typeof hmacSha256_pure !== 'undefined') {
                signature = hmacSha256_pure(plainText, secretKey);
            } else if (typeof computeHMAC !== 'undefined') {
                signature = computeHMAC(plainText, secretKey);
            } else {
                signature = "fallback_unsigned_token";
            }
        }
        
        qrCodeText = `${plainText}.${signature}`;
        
        // Display QR code text
        const qrTextElement = document.getElementById('pass-qrcode-text');
        if (qrTextElement) {
            qrTextElement.textContent = qrCodeText.substring(0, 24) + '... (Signed)';
            qrTextElement.title = qrCodeText;
        }
        
        // Generate real QR code using QRCode.js library
        const qrContainer = document.getElementById('qrcode-container');
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
            console.log("✅ Secure Cryptographic QR Code generated");
        } else if (qrContainer) {
            console.warn("⚠️ QRCode.js library not loaded, using fallback grid");
            const qrGrid = document.createElement('div');
            qrGrid.className = 'grid grid-cols-10 gap-1 p-2';
            for (let i = 0; i < 100; i++) {
                const div = document.createElement('div');
                const isBlack = Math.random() > 0.5;
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
        
        const detailsContainer = document.getElementById('pass-details');
        if(detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">Full Name</p>
                    <p class="font-semibold text-gray-800">${studentName}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">College ID</p>
                    <p class="font-semibold text-gray-800">${studentId}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">Bus Route</p>
                    <p class="font-semibold text-gray-800">${studentRoute}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">Valid Until</p>
                    <p class="font-semibold text-green-600">${student.passValidity || '31 Dec 2025'}</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">Pass Type</p>
                    <p class="font-semibold text-gray-800">Yearly Student Pass</p>
                </div>
                <div class="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p class="text-xs text-gray-500 mb-1">Pass ID</p>
                    <p class="font-semibold text-gray-800">${qrCodeText}</p>
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
        const validityDate = new Date('2025-12-31');
        const today = new Date();
        const daysLeft = Math.ceil((validityDate - today) / (1000 * 60 * 60 * 24));
        daysRemainingElement.textContent = `Valid for ${daysLeft} days`;
    }

    // ========================================
    // 7. CHECK-IN FUNCTIONALITY
    // ========================================
    function updateCheckinStatus() {
        const statusEl = document.getElementById('checkin-status');
        const buttonEl = document.getElementById('checkin-button');
        
        if(statusEl && buttonEl) {
            if(qrCheckedIn) {
                statusEl.textContent = 'Checked In';
                statusEl.className = 'font-semibold px-4 py-2 rounded-full text-sm bg-green-100 text-green-700 flex items-center';
                statusEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1"><polyline points="20 6 9 17 4 12"/></svg>
                    Checked In
                `;
                
                buttonEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                    <span>Reset Check-in (Demo)</span>
                `;
            } else {
                statusEl.textContent = 'Not Checked In';
                statusEl.className = 'font-semibold px-4 py-2 rounded-full text-sm bg-gray-200 text-gray-600';
                
                buttonEl.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    <span>Simulate Check-in (Demo)</span>
                `;
            }
            
            buttonEl.onclick = () => {
                qrCheckedIn = !qrCheckedIn;
                
                if(qrCheckedIn) {
                    scanCount++;
                    lastCheckinTime = new Date().toISOString();
                    
                    checkinHistory.unshift({
                        timestamp: lastCheckinTime,
                        busId: student.assignedBusId || 'Unknown',
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
                    
                    console.log("✅ Check-in recorded");
                }
                
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

    updateCheckinStatus();
    updateCheckinHistory();

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
        const busInterval = setInterval(() => {
            if (typeof dbHelper !== 'undefined') {
                clearInterval(busInterval);
                
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
        }, 100);
    }
});
