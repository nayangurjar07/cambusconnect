// Home page logic - Student dashboard with real-time updates
// Enhanced with modern admin panel features

document.addEventListener('DOMContentLoaded', () => {

    // ========================================
    // 1. AUTHENTICATION CHECK
    // ========================================
    const studentData = JSON.parse(localStorage.getItem('student'));

    if (!studentData) {
        console.error("❌ No student data found. Redirecting to login...");
        window.location.href = '../student-login.html';
        return;
    }

    console.log("✅ Student data loaded:", studentData.name);

    // ========================================
    // 2. PERSONALIZED GREETING
    // ========================================
    const hour = new Date().getHours();
    let greeting = 'Welcome Back';

    if (hour < 12) {
        greeting = 'Good Morning';
    } else if (hour < 18) {
        greeting = 'Good Afternoon';
    } else {
        greeting = 'Good Evening';
    }

    const firstName = studentData.name.split(' ')[0];
    const welcomeMsg = document.getElementById('welcome-message');

    if (welcomeMsg) {
        welcomeMsg.textContent = `${greeting}, ${firstName}!`;
        console.log(`Greeting: ${greeting}, ${firstName}`);
    }

    // ========================================
    // 3. DISPLAY PASS VALIDITY
    // ========================================
    const validityDisplay = document.getElementById('home-validity');
    if (validityDisplay) {
        validityDisplay.textContent = studentData.passValidity || "31 Dec 2025";
    }

    // ========================================
    // 4. RENDER QUICK ACCESS SHORTCUTS (ENHANCED DESIGN)
    // ========================================
    const shortcutsContainer = document.getElementById('home-shortcuts');
    if (shortcutsContainer) {
        shortcutsContainer.innerHTML = `
            <!-- Show Bus Pass -->
            <a href="../bus-pass/bus-pass.html" class="glass-effect rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 group card-hover min-w-0 flex flex-col items-start">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                </div>
                <h3 class="font-bold text-gray-800 text-xs sm:text-sm break-words-safe">Show Pass</h3>
                <p class="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate w-full">Digital Bus Pass</p>
            </a>
            
            <!-- Track Bus -->
            <a href="../track/track.html" class="glass-effect rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 group card-hover min-w-0 flex flex-col items-start">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
                        <line x1="8" y1="2" x2="8" y2="18"></line>
                        <line x1="16" y1="6" x2="16" y2="22"></line>
                    </svg>
                </div>
                <h3 class="font-bold text-gray-800 text-xs sm:text-sm break-words-safe">Track Bus</h3>
                <p class="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate w-full">Live Location</p>
            </a>
            
            <!-- My Routes -->
            <a href="../track/track.html" class="glass-effect rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 group card-hover min-w-0 flex flex-col items-start">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="10" r="3"/>
                        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>
                    </svg>
                </div>
                <h3 class="font-bold text-gray-800 text-xs sm:text-sm break-words-safe">My Routes</h3>
                <p class="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate w-full">View All Routes</p>
            </a>
            
            <!-- Trip History -->
            <a href="../search/search.html" class="glass-effect rounded-xl p-4 sm:p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 group card-hover min-w-0 flex flex-col items-start">
                <div class="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 3v18h18"/>
                        <path d="m19 9-5 5-4-4-3 3"/>
                    </svg>
                </div>
                <h3 class="font-bold text-gray-800 text-xs sm:text-sm break-words-safe">Trip History</h3>
                <p class="text-[11px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 truncate w-full">Past Journeys</p>
            </a>
        `;
        console.log("✅ Enhanced shortcuts rendered");
    }

    // ========================================
    // 5. FETCH REAL-TIME BUS STATUS
    // ========================================
    // Firebase is loaded as an ES module (async). We must wait for window.db
    // to be set before making any Firestore calls.
    (async () => {
        try {
            const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
            if (typeof authGuard === 'function') {
                await authGuard();
            }
        } catch (err) {
            console.error('❌ Firebase/Auth unavailable on home page:', err);
            const routeEl = document.getElementById('home-route');
            if (routeEl) routeEl.textContent = 'Offline';
            return;
        }

    const routeDisplay = document.getElementById('home-route');
    const busStatusDisplay = document.getElementById('bus-status');
    const busId = studentData.assignedBusId;

    if (routeDisplay) {
        routeDisplay.textContent = "Loading...";
    }

    if (busId) {
        console.log("Fetching bus data for ID:", busId);

        // Real-time listener for assigned bus
        dbHelper.getBusesCol().doc(busId).onSnapshot(doc => {
            if (doc.exists) {
                const bus = doc.data();
                console.log("✅ Bus data received:", bus);

                if (routeDisplay) {
                    routeDisplay.textContent = `${bus.number} - ${bus.route}`;
                }

                if (typeof updateLiveEta === 'function') {
                    updateLiveEta(bus);
                }
                if (typeof renderDynamicSchedule === 'function') {
                    renderDynamicSchedule(bus);
                }

                // NEW FEATURE: Update bus status with visual indicator
                if (busStatusDisplay) {
                    const statusConfig = {
                        'On Time': {
                            color: 'text-green-400',
                            bgColor: 'bg-green-400',
                            text: 'On Time'
                        },
                        'Delayed': {
                            color: 'text-orange-400',
                            bgColor: 'bg-orange-400',
                            text: 'Delayed'
                        },
                        'Breakdown': {
                            color: 'text-red-400',
                            bgColor: 'bg-red-400',
                            text: 'Issue'
                        }
                    };

                    const config = statusConfig[bus.status] || statusConfig['On Time'];

                    busStatusDisplay.innerHTML = `
                        <span class="w-2 h-2 ${config.bgColor} rounded-full mr-2 animate-pulse"></span>
                        ${config.text}
                    `;
                    busStatusDisplay.className = `font-bold text-lg flex items-center ${config.color}`;
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
            } else {
                // Bus document no longer exists — this student has an orphaned assignedBusId.
                // Clear it from the local session so we stop re-fetching a deleted document.
                console.info("ℹ️ Bus document not found for ID:", busId, "— likely deleted. Clearing stale reference from session.");
                const storedStudent = JSON.parse(localStorage.getItem('student') || '{}');
                delete storedStudent.assignedBusId;
                localStorage.setItem('student', JSON.stringify(storedStudent));

                if (routeDisplay) {
                    routeDisplay.textContent = "Not Assigned";
                    routeDisplay.classList.remove('text-red-400');
                    routeDisplay.classList.add('text-gray-400');
                }
                if (busStatusDisplay) {
                    busStatusDisplay.innerHTML = `
                        <span class="w-2 h-2 bg-gray-300 rounded-full mr-2"></span>
                        N/A
                    `;
                    busStatusDisplay.className = 'font-bold text-lg flex items-center text-gray-400';
                }
                // Render fallback schedule so the widget isn't stuck on "Loading..."
                if (typeof renderDynamicSchedule === 'function') {
                    renderDynamicSchedule(null);
                }
            }
        }, err => {
            console.error("❌ Error fetching bus:", err);
            if (routeDisplay) {
                routeDisplay.textContent = "Error loading route";
                routeDisplay.classList.add('text-red-400');
            }
        });
    } else {
        console.warn("⚠️ No bus assigned to student");
        if (routeDisplay) {
            routeDisplay.textContent = "Not Assigned";
            routeDisplay.classList.add('text-gray-400');
        }
        if (busStatusDisplay) {
            busStatusDisplay.innerHTML = `
                <span class="w-2 h-2 bg-gray-400 rounded-full mr-2"></span>
                N/A
            `;
        }
    }

    // ========================================
    // 6. FETCH RECENT NOTIFICATIONS (REAL-TIME)
    // ========================================
    const notificationsContainer = document.getElementById('home-notifications');

    if (notificationsContainer) {
        // Show loading state with modern design
        notificationsContainer.innerHTML = `
            <div class="text-center py-6">
                <div class="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p class="text-xs text-gray-400 mt-3">Loading updates...</p>
            </div>
        `;

        console.log("Fetching notifications...");

        // Real-time listener for latest notifications
        dbHelper.getNotificationsCol()
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                console.log(`✅ Received ${snapshot.docs.length} notifications`);

                const rawNotifs = snapshot.docs.map(doc => doc.data());
                
                // Client-side route matching filter
                const studentRoute = studentData.busRoute || "";
                const notifs = rawNotifs.filter(n => {
                    return !n.targetRouteId || n.targetRouteId === 'all' || n.targetRouteId === studentRoute;
                });

                // Display a banner alert if there is a route merge/consolidation alert for their route
                const mergeAlert = notifs.find(n => n.type === 'alert' && n.targetRouteId === studentRoute);
                const warningBanner = document.getElementById('route-merge-warning-banner');
                const warningText = document.getElementById('route-merge-warning-text');

                if (mergeAlert && warningBanner && warningText) {
                    warningText.textContent = mergeAlert.message;
                    warningBanner.classList.remove('hidden');
                } else if (warningBanner) {
                    warningBanner.classList.add('hidden');
                }

                // Slice down to top 3 matching
                const displayNotifs = notifs.slice(0, 3);
                notificationsContainer.innerHTML = '';

                if (displayNotifs.length === 0) {
                    notificationsContainer.innerHTML = `
                      <div class="text-center py-6">
                          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mx-auto text-gray-300 mb-2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          <p class="text-sm text-gray-500">No recent updates.</p>
                      </div>
                  `;
                    return;
                }

                displayNotifs.forEach(n => {
                    // Format timestamp
                    let time = 'Just now';
                    if (n.createdAt) {
                        const date = n.createdAt.toDate();
                        time = date.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }

                    // Enhanced notification styling based on type
                    const notifStyles = {
                        'alert': {
                            bg: 'bg-red-50',
                            border: 'border-red-200',
                            icon: 'bg-red-500',
                            iconSvg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
                        },
                        'delay': {
                            bg: 'bg-orange-50',
                            border: 'border-orange-200',
                            icon: 'bg-orange-500',
                            iconSvg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
                        },
                        'info': {
                            bg: 'bg-blue-50',
                            border: 'border-blue-200',
                            icon: 'bg-blue-500',
                            iconSvg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
                        },
                        'crowd': {
                            bg: 'bg-green-50',
                            border: 'border-green-200',
                            icon: 'bg-green-500',
                            iconSvg: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
                        }
                    };

                    const style = notifStyles[n.type] || notifStyles['info'];

                    const notificationCard = `
                      <div class="flex items-start space-x-3 p-4 ${style.bg} rounded-xl border ${style.border} hover:shadow-md transition-all card-hover min-w-0">
                          <div class="w-8 h-8 ${style.icon} rounded-lg flex items-center justify-center shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  ${style.iconSvg}
                              </svg>
                          </div>
                          <div class="flex-1 min-w-0">
                              <p class="text-sm text-gray-800 font-medium leading-relaxed break-words-safe">${n.message}</p>
                              <p class="text-xs text-gray-500 mt-1.5 flex items-center shrink-0">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  ${time}
                              </p>
                          </div>
                      </div>
                  `;

                    notificationsContainer.insertAdjacentHTML('beforeend', notificationCard);
                });

            }, err => {
                console.error("❌ Error fetching notifications:", err);
                notificationsContainer.innerHTML = `
                  <div class="p-4 bg-red-50 rounded-xl border border-red-200">
                      <p class="text-sm text-red-600 font-medium">Failed to load notifications</p>
                      <p class="text-xs text-red-400 mt-1">${err.message}</p>
                  </div>
              `;
            });
    }

    // ========================================
    // 7. STATISTICS DASHBOARD
    // ========================================

    const statTrips = document.getElementById('stat-trips');
    const statCarbon = document.getElementById('stat-carbon');

    if (statTrips) {
        dbHelper.getTripsCol()
            .where('studentId', '==', studentData.id)
            .where('timestamp', '>=', new Date(new Date().setDate(1))) // This month
            .get()
            .then(snapshot => {
                statTrips.textContent = snapshot.size;
                console.log(`✅ Trips this month: ${snapshot.size}`);
            })
            .catch(err => {
                console.error("❌ Error fetching trip stats:", err);
                statTrips.textContent = '--';
            });
    }

    if (statCarbon && statTrips) {
        setTimeout(() => {
            const trips = parseInt(statTrips.textContent) || 0;
            const carbonSaved = Math.round(trips * 2.3);
            statCarbon.textContent = `${carbonSaved} kg`;
        }, 1000);
    }
    })();


    // ========================================
    // 8. TODAY'S SCHEDULE WIDGET (DYNAMIC & BUS-AWARE)
    // ========================================
    const scheduleWidget = document.getElementById('schedule-widget');

    function renderDynamicSchedule(busData) {
        if (!scheduleWidget) return;
        scheduleWidget.innerHTML = '';

        let scheduleItems = [];
        if (busData && Array.isArray(busData.stops) && busData.stops.length > 0) {
            scheduleItems = busData.stops.map((stop, idx) => ({
                time: stop.time || `${7 + Math.floor(idx / 2)}:${(idx % 2) * 30 || '00'} AM`,
                event: stop.name || `Stop ${idx + 1}`,
                location: stop.landmark || busData.route || 'Route Stop',
                status: idx === 0 ? 'next' : 'scheduled'
            }));
        } else {
            const studentRoute = (busData && busData.route) || studentData.busRoute || 'Assigned Campus Route';
            scheduleItems = [
                { time: '07:30 AM', event: 'Morning Boarding Pickup', location: studentRoute, status: 'next' },
                { time: '08:45 AM', event: 'Campus Arrival', location: 'College Main Gate', status: 'scheduled' },
                { time: '04:30 PM', event: 'Evening Return Departure', location: 'Campus Bus Bay', status: 'scheduled' }
            ];
        }

        scheduleItems.forEach((item, index) => {
            const isFirst = index === 0;
            const statusColor = isFirst ? 'bg-green-500' : 'bg-gray-300';

            const scheduleItem = `
                <div class="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div class="flex flex-col items-center">
                        <div class="w-3 h-3 ${statusColor} rounded-full"></div>
                        ${index < scheduleItems.length - 1 ? '<div class="w-0.5 h-8 bg-gray-200 mt-1"></div>' : ''}
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center justify-between">
                            <p class="font-medium text-gray-800 text-sm">${escapeHTML(item.event)}</p>
                            <span class="text-xs font-medium ${isFirst ? 'text-green-600 bg-green-50' : 'text-gray-500 bg-gray-50'} px-2 py-1 rounded-full">
                                ${isFirst ? 'Next' : 'Scheduled'}
                            </span>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">${escapeHTML(item.time)} • ${escapeHTML(item.location)}</p>
                    </div>
                </div>
            `;
            scheduleWidget.insertAdjacentHTML('beforeend', scheduleItem);
        });
        console.log("✅ Dynamic schedule rendered for:", busData?.number || "Route");
    }

    renderDynamicSchedule(null);

    // ========================================
    // 9. QUICK ACTIONS PANEL TOGGLE
    // ========================================
    const quickActionsBtn = document.getElementById('quick-actions-btn');
    const quickActionsPanel = document.getElementById('quick-actions-panel');

    if (quickActionsBtn && quickActionsPanel) {
        console.log("✅ Quick Actions button found, setting up event listener");

        let panelOpen = false;

        quickActionsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            panelOpen = !panelOpen;

            if (panelOpen) {
                quickActionsPanel.classList.remove('hidden');
                console.log("✅ Quick Actions panel opened");
            } else {
                quickActionsPanel.classList.add('hidden');
                console.log("✅ Quick Actions panel closed");
            }
        });

        document.addEventListener('click', (e) => {
            if (panelOpen &&
                !quickActionsPanel.contains(e.target) &&
                !quickActionsBtn.contains(e.target)) {
                quickActionsPanel.classList.add('hidden');
                panelOpen = false;
                console.log("❌ Quick Actions panel closed (clicked outside)");
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && panelOpen) {
                quickActionsPanel.classList.add('hidden');
                panelOpen = false;
                console.log("❌ Quick Actions panel closed (ESC key)");
            }
        });

        const reportIssueBtn = document.getElementById('report-issue-btn');
        const emergencyBtn = document.getElementById('emergency-btn');
        const downloadPassBtn = document.getElementById('download-pass-btn');

        if (reportIssueBtn) {
            reportIssueBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("📝 Report Issue clicked");
                quickActionsPanel.classList.add('hidden');
                panelOpen = false;
                window.location.href = '../support/support.html';
            });
        }

        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentContact = student?.parentPhone ? `Parent/Guardian: ${student.parentPhone}` : 'Parent/Guardian: Not set in profile';
                alert(`Emergency Assistance:\n\n${parentContact}\nCampus Transport Desk: Contact your campus control room or transit coordinator.\n\nIn case of immediate transit emergency, please notify campus security directly.`);
            });
        }

        if (downloadPassBtn) {
            downloadPassBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log("💾 Download Pass clicked");
                quickActionsPanel.classList.add('hidden');
                panelOpen = false;
                window.location.href = '../bus-pass/bus-pass.html';
            });
        }

        console.log("✅ Quick Actions functionality initialized");
    }

    const etaMinutes = document.getElementById('eta-minutes');

    function updateLiveEta(busData) {
        if (!etaMinutes) return;
        if (!busData) {
            etaMinutes.textContent = '--';
            return;
        }

        // Check if explicit ETA or telemetry exists on bus
        if (busData.eta || busData.currentEta) {
            const val = parseInt(busData.eta || busData.currentEta, 10);
            etaMinutes.textContent = isNaN(val) ? busData.eta : val;
            if (val <= 3) {
                etaMinutes.className = 'text-red-400 font-extrabold animate-pulse';
            } else {
                etaMinutes.className = 'text-green-400 font-extrabold';
            }
            return;
        }

        // Calculate dynamic ETA from status or telemetry
        if (busData.status === 'Breakdown') {
            etaMinutes.textContent = 'Alert';
            etaMinutes.className = 'text-rose-500 font-extrabold text-sm';
        } else if (busData.status === 'Delayed') {
            etaMinutes.textContent = '25+';
            etaMinutes.className = 'text-amber-400 font-extrabold';
        } else if (busData.location && busData.location.lat && busData.location.lng) {
            const dLat = (busData.location.lat - 22.7196) * 111;
            const dLng = (busData.location.lng - 75.8577) * 102;
            const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
            const speedKmH = Math.max(15, busData.speed || 25);
            const estMin = Math.max(2, Math.round((distKm / speedKmH) * 60));
            etaMinutes.textContent = estMin;
            etaMinutes.className = estMin <= 5 ? 'text-amber-400 font-extrabold animate-pulse' : 'text-green-400 font-extrabold';
        } else {
            etaMinutes.textContent = '--';
            etaMinutes.className = 'text-gray-400 font-extrabold';
        }
    }

    updateLiveEta(null);

    // ========================================
    // 11. DAILY TIP ROTATION
    // ========================================
    const dailyTipElement = document.getElementById('daily-tip');

    if (dailyTipElement) {
        const tips = [
            "Arrive 5 minutes early at your stop to ensure you don't miss your bus. Track it live for real-time updates!",
            "Enable notifications to get alerts about bus delays, route changes, and important announcements.",
            "Check the weather widget before leaving to be prepared for your commute.",
            "Use the Lost & Found feature if you forget something on the bus - most items are recovered within 24 hours!",
            "Save your favorite routes for quick access to tracking and schedules.",
            "Report any issues immediately using Quick Actions - it helps improve service for everyone!",
            "Your carbon footprint matters! Every bus trip saves approximately 2.3 kg of CO₂ compared to driving."
        ];

        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const todayTip = tips[dayOfYear % tips.length];

        dailyTipElement.textContent = todayTip;
        console.log("✅ Daily tip displayed");
    }

    const cards = document.querySelectorAll('.animate-slideIn');
    cards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
});

// Note: Service worker intentionally not registered.
// sw.js does not exist in this project and this app does not currently
// require offline/PWA capabilities. Registering a non-existent sw.js
// produces a 404 console error on every page load.
