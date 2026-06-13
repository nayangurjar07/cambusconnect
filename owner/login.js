// =============================================================================
// LOGIN.JS - CAMBUS CONNECT Authentication System
// =============================================================================
// This file handles all login logic for both students and administrators
// Features:
// - Smart email detection (auto-converts enrollment IDs)
// - Firebase Authentication integration
// - Role-based redirects (Admin → admin.html, Student → home.html)
// - Comprehensive error handling
// - Session management with localStorage
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {

    console.log("🚀 Login page script loaded");

    // =============================================================================
    // 1. SESSION CHECK - Prevent logged-in users from seeing login page again
    // =============================================================================
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (isLoggedIn === 'true') {
        const role = localStorage.getItem('userRole');
        console.log("✅ User already logged in with role:", role);

        // Redirect immediately based on role
        if (role === 'owner') {
            console.log("→ Redirecting to owner panel...");
            window.location.href = 'owner.html';
        } else if (role === 'admin') {
            console.log("→ Redirecting to admin panel...");
            window.location.href = '../admin/admin.html';
        } else if (role === 'driver') {
            console.log("→ Redirecting to driver dashboard...");
            window.location.href = '../driver/driverhome.html';
        } else {
            console.log("→ Redirecting to student home...");
            window.location.href = '../student/home.html';
        }
        return; // Stop execution to prevent form from loading
    }

    // =============================================================================
    // 2. GET DOM ELEMENTS
    // =============================================================================
    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('btn-login');
    const errorMessageDiv = document.getElementById('login-error-message');
    const errorText = document.getElementById('error-text');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    // Check if all required elements exist
    if (!loginForm || !loginButton || !emailInput || !passwordInput) {
        console.error("❌ Critical error: Login form elements not found!");
        return;
    }

    console.log("✅ All form elements found");

    const getTenantInfoFromEmail = (email) => {
        const domain = email.toLowerCase().split('@')[1];
        if (!domain) return null;
        
        if (domain === 'cambusconnect.in' || domain === 'owner.cambusconnect.in') {
            return { tenantKey: 'owner', domain: 'cambusconnect.in' };
        }
        if (domain === 'indoreinstitute.com' || domain === 'iist.in' || domain === 'iist.cambusconnect.in') {
            return { tenantKey: 'localhost', domain: 'indoreinstitute.com' };
        }
        if (domain === 'medicaps.com' || domain === 'medicaps.ac.in' || domain === 'medicaps.cambusconnect.in') {
            return { tenantKey: '127.0.0.1', domain: 'medicaps.com' };
        }
        return null;
    };

    const getFallbackTenantInfo = () => {
        const savedKey = localStorage.getItem('activeTenantKey');
        if (savedKey === 'owner') {
            return { tenantKey: 'owner', domain: 'cambusconnect.in' };
        }
        if (savedKey === '127.0.0.1' || savedKey === 'medicaps.cambusconnect.in') {
            return { tenantKey: '127.0.0.1', domain: 'medicaps.com' };
        }
        if (savedKey === 'localhost' || savedKey === 'iist.cambusconnect.in') {
            return { tenantKey: 'localhost', domain: 'indoreinstitute.com' };
        }
        const host = window.location.hostname.toLowerCase();
        if (host.includes('medicaps') || host.includes('127.0.0.1')) {
            return { tenantKey: '127.0.0.1', domain: 'medicaps.com' };
        }
        return { tenantKey: 'localhost', domain: 'indoreinstitute.com' };
    };

    // =============================================================================
    // 3. MAIN LOGIN HANDLER
    // =============================================================================
    const handleLogin = async (e) => {
        e.preventDefault(); // Prevent default form submission

        console.log("\n=== LOGIN ATTEMPT STARTED ===");

        // Get input values
        const inputVal = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!inputVal || !password) {
            console.warn("⚠️ Empty fields detected");
            showError("Please enter both ID and password");
            return;
        }

        // Show loading state
        setLoadingState(true);
        hideError();

        // =============================================================================
        // SMART EMAIL DETECTION LOGIC
        // =============================================================================
        // SMART EMAIL DETECTION LOGIC (Multi-Tenant SaaS)
        // =============================================================================
        let email = inputVal;
        let domain = "";

        if (inputVal.includes('@')) {
            email = inputVal.toLowerCase();
            domain = email.split('@')[1];
            console.log(`📧 Email login detected. Domain: ${domain}`);
        } else {
            // No @ symbol. Try to get domain from subdomain or fallback.
            const hostParts = window.location.hostname.split('.');
            const subdomain = hostParts[0].toLowerCase();
            
            if (hostParts.length >= 3 && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== 'vercel' && !subdomain.startsWith('127')) {
                domain = `${subdomain}.com`;
                email = `${inputVal.toLowerCase()}@${domain}`;
                console.log(`🎓 Subdomain student login detected. Email: ${email}`);
            } else {
                // Fallback: if no subdomain and no @ sign, we cannot determine the domain!
                setLoadingState(false);
                showError("Please enter your full university email (e.g. student@medicaps.com)");
                return;
            }
        }

        let tenantInfo = getTenantInfoFromEmail(email);
        if (!tenantInfo) {
            // Fall back to active hostname tenant for generic emails (drivers/staff)
            tenantInfo = getFallbackTenantInfo();
            console.log(`📡 Generic domain parsed: ${email}. Dynamic fallback to tenant: ${tenantInfo.tenantKey}`);
        }

        try {
            // Reinitialize Firebase dynamically if the target project changes
            const activeKey = localStorage.getItem('activeTenantKey');
            if (activeKey !== tenantInfo.tenantKey) {
                console.log(`📡 Switching Firebase database connection to: ${tenantInfo.tenantKey}`);
                await window.reinitializeFirebase(tenantInfo.tenantKey);
            }

            // =============================================================================
            // STEP A: FIREBASE AUTHENTICATION
            // =============================================================================
            console.log("📡 Authenticating with Firebase Auth...");

            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log("✅ Firebase Auth Success!");
            console.log("   UID:", user.uid);
            console.log("   Email:", user.email);

            // Save active tenant ID to localStorage
            localStorage.setItem('instituteId', tenantInfo.domain);
            localStorage.setItem('activeTenantKey', tenantInfo.tenantKey);

            // =============================================================================
            // STEP B: FETCH USER PROFILE FROM FIRESTORE (Flat collection)
            // =============================================================================
            console.log(`📡 Fetching user profile from Firestore users collection...`);

            const docRef = window.db.collection('users').doc(email);
            let docSnap = await docRef.get();

            if (!docSnap.exists) {
                // Support dynamic failsafe auto-creation for test driver account
                if (email === 'driver@indoreinstitute.com') {
                    console.log("Creating default database document for driver@indoreinstitute.com...");
                    const defaultDriverProfile = {
                        name: "Indore Institute Driver",
                        role: "driver",
                        email: email,
                        assignedBusId: "demo-bus-101",
                        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
                    };
                    await docRef.set(defaultDriverProfile);
                    docSnap = await docRef.get();
                } else {
                    console.error("❌ Profile not found in Firestore");
                    localStorage.removeItem('instituteId');
                    localStorage.removeItem('activeTenantKey');
                    throw new Error("Profile not found in database. Please contact admin.");
                }
            }

            const userData = docSnap.data();
            console.log("✅ User profile loaded:");

            // Check if pass is expired (for students only)
            if (userData.role === 'student') {
                const passValidity = userData.passValidity;
                if (passValidity) {
                    const passDate = new Date(passValidity);
                    const today = new Date();

                    if (passDate < today) {
                        console.error("❌ Bus pass expired");
                        throw new Error(`Your bus pass expired on ${passDate.toLocaleDateString()}. Please contact admin to renew.`);
                    } else {
                        console.log("✅ Bus pass valid until:", passDate.toLocaleDateString());
                    }
                }
            }
            // =============================================================================
            // STEP C: SAVE SESSION DATA
            // =============================================================================
            console.log("💾 Saving session data to localStorage...");

            // Common session data
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);

            // =============================================================================
            // STEP D: ROLE-BASED REDIRECT
            // =============================================================================
            if (userData.role === 'owner') {
                // ========== OWNER LOGIN ==========
                console.log("\n👑 OWNER LOGIN SUCCESSFUL");
                localStorage.setItem('userRole', 'owner');
                localStorage.setItem('ownerName', userData.name || 'Owner');

                if (loginButton) {
                    loginButton.textContent = "Owner Login Successful!";
                    loginButton.classList.remove('bg-blue-600');
                    loginButton.classList.add('bg-green-600');
                }

                console.log("→ Redirecting to owner panel in 0.5s...");
                setTimeout(() => {
                    window.location.href = 'owner.html';
                }, 500);

            } else if (userData.role === 'admin') {
                // ========== ADMIN LOGIN ==========
                console.log("\n🔐 ADMIN LOGIN SUCCESSFUL");
                localStorage.setItem('userRole', 'admin');
                localStorage.setItem('adminName', userData.name || 'Admin');

                // Update button to show success
                if (loginButton) {
                    loginButton.textContent = "Admin Login Successful!";
                    loginButton.classList.remove('bg-blue-600');
                    loginButton.classList.add('bg-green-600');
                }

                console.log("→ Redirecting to admin panel in 0.5s...");
                setTimeout(() => {
                    window.location.href = '../admin/admin.html';
                }, 500);

            } else if (userData.role === 'driver') {
                // ========== DRIVER LOGIN ==========
                console.log("\n🚛 DRIVER LOGIN SUCCESSFUL");
                localStorage.setItem('userRole', 'driver');
                localStorage.setItem('driverName', userData.name || 'Driver');

                if (loginButton) {
                    loginButton.textContent = "Driver Login Successful!";
                    loginButton.classList.remove('bg-blue-600');
                    loginButton.classList.add('bg-green-600');
                }

                console.log("→ Redirecting to driver panel in 0.5s...");
                setTimeout(() => {
                    window.location.href = '../driver/driverhome.html';
                }, 500);

            } else {
                // ========== STUDENT LOGIN ==========
                console.log("\n🎓 STUDENT LOGIN SUCCESSFUL");
                localStorage.setItem('userRole', 'student');
                // Include the doc ID (email) in the student object so other pages can reference it
                localStorage.setItem('student', JSON.stringify({ id: email, ...userData }));

                // Update button to show success
                if (loginButton) {
                    loginButton.textContent = "Login Successful!";
                    loginButton.classList.remove('bg-blue-600');
                    loginButton.classList.add('bg-green-600');
                }

                console.log("→ Redirecting to student home in 0.5s...");
                setTimeout(() => {
                    window.location.href = '../student/home.html';
                }, 500);
            }

            console.log("=== LOGIN COMPLETE ===\n");

        } catch (error) {
            // =============================================================================
            // ERROR HANDLING
            // =============================================================================
            console.error("\n❌ LOGIN ERROR:");
            console.error("   Code:", error.code);
            console.error("   Message:", error.message);

            let userMessage = "Login failed. Please try again.";

            // Map Firebase error codes to user-friendly messages
            switch (error.code) {
                case 'auth/user-not-found':
                    userMessage = "❌ No account found with this ID.\n\nPlease check your enrollment number or contact admin.";
                    console.error("   → User not found in Firebase Auth");
                    break;

                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    userMessage = "❌ Incorrect password.\n\nPlease try again or contact admin to reset your password.";
                    console.error("   → Wrong password provided");
                    break;

                case 'auth/invalid-email':
                    userMessage = "❌ Invalid email format.";
                    console.error("   → Email format is invalid");
                    break;

                case 'auth/too-many-requests':
                    userMessage = "❌ Too many failed attempts.\n\nPlease try again after 5 minutes.";
                    console.error("   → Account temporarily locked due to multiple failed attempts");
                    break;

                case 'auth/network-request-failed':
                    userMessage = "❌ Network error.\n\nPlease check your internet connection and try again.";
                    console.error("   → Network connection issue");
                    break;

                case 'auth/user-disabled':
                    userMessage = "❌ This account has been disabled.\n\nPlease contact admin.";
                    console.error("   → User account is disabled");
                    break;

                default:
                    if (error.message.includes("Profile not found")) {
                        userMessage = "❌ Account exists but profile is incomplete.\n\nPlease contact admin.";
                        console.error("   → Firestore profile missing");
                    } else {
                        userMessage = `❌ Login failed: ${error.message}`;
                        console.error("   → Unknown error");
                    }
            }

            console.error("=== LOGIN FAILED ===\n");

            // Show error to user
            showError(userMessage);
            setLoadingState(false);
        }
    };

    // =============================================================================
    // 4. HELPER FUNCTIONS
    // =============================================================================

    /**
     * Shows error message to user
     */
    function showError(message) {
        if (errorText) {
            errorText.textContent = message;
        }
        if (errorMessageDiv) {
            errorMessageDiv.classList.remove('hidden');
        }
        console.log("⚠️ Error shown to user:", message);
    }

    /**
     * Hides error message
     */
    function hideError() {
        if (errorMessageDiv) {
            errorMessageDiv.classList.add('hidden');
        }
    }

    /**
     * Sets loading state on/off
     */
    function setLoadingState(loading) {
        if (loginButton) {
            loginButton.disabled = loading;
            loginButton.textContent = loading ? "Verifying..." : "Login";

            if (loading) {
                loginButton.classList.add('opacity-75', 'cursor-not-allowed');
            } else {
                loginButton.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }

        // Disable inputs during loading
        if (emailInput) emailInput.disabled = loading;
        if (passwordInput) passwordInput.disabled = loading;
    }



    // =============================================================================
    // 5. ATTACH EVENT LISTENERS
    // =============================================================================

    // Main form submission
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("✅ Login form submit listener attached");
    } else {
        console.error("❌ Login form not found!");
    }



    // Clear error when user starts typing
    [emailInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                hideError();
            });
        }
    });

    // Enter key support (already handled by form submit, but explicit for clarity)
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginForm.dispatchEvent(new Event('submit'));
            }
        });
    }

    // =============================================================================
    // 6. OPTIONAL: PASSWORD VISIBILITY TOGGLE
    // =============================================================================
    // If you want to add a "show/hide password" button, use this code:

    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.textContent = type === 'password' ? '👁' : '⌣';
        });
    }



    console.log("✅ Login page fully initialized\n");
});

// =============================================================================
// END OF LOGIN.JS
// =============================================================================
