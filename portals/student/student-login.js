// =============================================================================
// STUDENT LOGIN.JS - Cambus Connect Student Authentication
// =============================================================================
// Only allows students to log in. Admins/Drivers/Owners are rejected.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🎓 Student Login page loaded");

    // Session check
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        const role = localStorage.getItem('userRole');
        if (role === 'student') {
            window.location.href = 'home/home.html';
        } else if (role === 'admin') {
            window.location.href = '../admin/admin.html';
        } else if (role === 'driver') {
            window.location.href = '../driver/driverhome.html';
        } else if (role === 'owner') {
            window.location.href = '../owner/owner.html';
        }
        return;
    }

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('btn-login');
    const errorMessageDiv = document.getElementById('login-error-message');
    const errorText = document.getElementById('error-text');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!loginForm || !loginButton || !emailInput || !passwordInput) {
        console.error("❌ Critical: Login form elements not found!");
        return;
    }

    // Tenant resolution helpers (same logic as owner/login.js)
    const getTenantInfoFromEmail = (email) => {
        const domain = email.toLowerCase().split('@')[1];
        if (!domain) return null;
        const configs = window.tenantConfigs || {};
        
        // Priority 1: Check by email domain
        for (const [key, config] of Object.entries(configs)) {
            if (config.emailDomains && config.emailDomains.includes(domain)) {
                return { tenantKey: key, domain: domain };
            }
        }
        
        // Priority 2: Use subdomain from URL
        if (window.getSubdomain) {
            const sub = window.getSubdomain();
            if (configs[sub]) {
                return { tenantKey: sub, domain: domain };
            }
        }
        return null;
    };

    const getFallbackTenantInfo = () => {
        const configs = window.tenantConfigs || {};
        if (window.getSubdomain) {
            const sub = window.getSubdomain();
            if (configs[sub]) return { tenantKey: sub, domain: configs[sub].emailDomains ? configs[sub].emailDomains[0] : '' };
        }
        const savedKey = localStorage.getItem('activeTenantKey');
        if (savedKey && configs[savedKey]) return { tenantKey: savedKey, domain: configs[savedKey].emailDomains ? configs[savedKey].emailDomains[0] : '' };
        const firstKey = Object.keys(configs)[0];
        if (firstKey && configs[firstKey]) return { tenantKey: firstKey, domain: configs[firstKey].emailDomains ? configs[firstKey].emailDomains[0] : '' };
        return { tenantKey: 'iist', domain: 'indoreinstitute.com' };
    };

    // Login handler
    const handleLogin = async (e) => {
        e.preventDefault();
        const inputVal = emailInput.value.trim();
        const password = passwordInput.value;

        if (!inputVal || !password) { showError("Please enter both ID and password"); return; }

        setLoadingState(true);
        hideError();

        // Smart email detection
        let email = inputVal;
        let domain = "";
        if (inputVal.includes('@')) {
            email = inputVal.toLowerCase();
            domain = email.split('@')[1];
        } else {
            if (window.getSubdomain) {
                const sub = window.getSubdomain();
                if (sub) {
                    domain = `${sub}.com`;
                    email = `${inputVal.toLowerCase()}@${domain}`;
                } else {
                    setLoadingState(false);
                    showError("Please enter your full university email (e.g. student@medicaps.com)");
                    return;
                }
            } else {
                setLoadingState(false);
                showError("Please enter your full university email (e.g. student@medicaps.com)");
                return;
            }
        }

        let tenantInfo = getTenantInfoFromEmail(email);
        if (!tenantInfo) tenantInfo = getFallbackTenantInfo();

        try {
            const activeKey = localStorage.getItem('activeTenantKey');
            if (activeKey !== tenantInfo.tenantKey) {
                await window.reinitializeFirebase(tenantInfo.tenantKey);
            }

            const userCredential = await window.auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            localStorage.setItem('instituteId', tenantInfo.domain);
            localStorage.setItem('activeTenantKey', tenantInfo.tenantKey);

            // Fetch profile from Firestore
            const docRef = window.db.collection('users').doc(email);
            let docSnap = await docRef.get();

            if (!docSnap.exists) {
                throw new Error("Profile not found in database. Please contact admin.");
            }

            const userData = docSnap.data();

            // ROLE CHECK: Only allow students
            if (userData.role !== 'student') {
                showError(`❌ This portal is for students only. Your role is "${userData.role}". Please use the correct login page.`);
                setLoadingState(false);
                return;
            }

            // Check pass validity
            if (userData.passValidity) {
                const passDate = new Date(userData.passValidity);
                if (passDate < new Date()) {
                    throw new Error(`Your bus pass expired on ${passDate.toLocaleDateString()}. Please contact admin to renew.`);
                }
            }

            // Save session
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userRole', 'student');
            localStorage.setItem('student', JSON.stringify({ id: email, ...userData }));

            loginButton.textContent = "Login Successful!";
            loginButton.classList.remove('bg-blue-600');
            loginButton.classList.add('bg-green-600');

            setTimeout(() => { window.location.href = 'home/home.html'; }, 500);

        } catch (error) {
            console.error("❌ Student LOGIN ERROR:", error.code, error.message);
            let msg = "Login failed. Please try again.";
            switch (error.code) {
                case 'auth/user-not-found': msg = "❌ No account found with this ID."; break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential': msg = "❌ Incorrect password."; break;
                case 'auth/invalid-email': msg = "❌ Invalid email format."; break;
                case 'auth/too-many-requests': msg = "❌ Too many failed attempts. Try again after 5 minutes."; break;
                case 'auth/network-request-failed': msg = "❌ Network error. Check your connection."; break;
                default:
                    if (error.message.includes("Profile not found")) msg = "❌ Account exists but profile is incomplete. Contact admin.";
                    else msg = `❌ ${error.message}`;
            }
            showError(msg);
            setLoadingState(false);
        }
    };

    function showError(message) {
        if (errorText) errorText.textContent = message;
        if (errorMessageDiv) errorMessageDiv.classList.remove('hidden');
    }
    function hideError() { if (errorMessageDiv) errorMessageDiv.classList.add('hidden'); }
    function setLoadingState(loading) {
        if (loginButton) {
            loginButton.disabled = loading;
            loginButton.textContent = loading ? "Verifying..." : "Sign In as Student";
            if (loading) loginButton.classList.add('opacity-75', 'cursor-not-allowed');
            else loginButton.classList.remove('opacity-75', 'cursor-not-allowed');
        }
        if (emailInput) emailInput.disabled = loading;
        if (passwordInput) passwordInput.disabled = loading;
    }

    loginForm.addEventListener('submit', handleLogin);

    [emailInput, passwordInput].forEach(input => {
        if (input) input.addEventListener('input', hideError);
    });

    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePassword.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
        });
    }
});
