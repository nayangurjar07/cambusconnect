// =============================================================================
// ADMIN LOGIN.JS - Cambus Connect Admin Authentication
// =============================================================================
// Only allows admins to log in. Students/Drivers/Owners are rejected.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🔐 Admin Login page loaded");

    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        const role = localStorage.getItem('userRole');
        if (role === 'admin') window.location.href = 'admin.html';
        else if (role === 'student') window.location.href = '../student/home/home.html';
        else if (role === 'driver') window.location.href = '../driver/driverhome.html';
        else if (role === 'owner') window.location.href = '../owner/owner.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('btn-login');
    const errorMessageDiv = document.getElementById('login-error-message');
    const errorText = document.getElementById('error-text');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!loginForm || !loginButton || !emailInput || !passwordInput) return;

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
        if (firstKey) return { tenantKey: firstKey, domain: configs[firstKey].emailDomains ? configs[firstKey].emailDomains[0] : '' };
        return { tenantKey: 'iist', domain: 'indoreinstitute.com' };
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const inputVal = emailInput.value.trim();
        const password = passwordInput.value;
        if (!inputVal || !password) { showError("Please enter both email and password"); return; }

        setLoadingState(true);
        hideError();

        let email = inputVal.includes('@') ? inputVal.toLowerCase() : inputVal;
        if (!inputVal.includes('@')) {
            setLoadingState(false);
            showError("Please enter your full admin email address.");
            return;
        }

        let tenantInfo = getTenantInfoFromEmail(email);
        if (!tenantInfo) tenantInfo = getFallbackTenantInfo();

        try {
            const activeKey = localStorage.getItem('activeTenantKey');
            if (activeKey !== tenantInfo.tenantKey) {
                await window.reinitializeFirebase(tenantInfo.tenantKey);
            }

            await window.auth.signInWithEmailAndPassword(email, password);

            localStorage.setItem('instituteId', tenantInfo.domain);
            localStorage.setItem('activeTenantKey', tenantInfo.tenantKey);

            const docSnap = await window.db.collection('users').doc(email).get();
            if (!docSnap.exists) throw new Error("Profile not found in database. Contact support.");

            const userData = docSnap.data();

            // ROLE CHECK: Only allow admins
            if (userData.role !== 'admin') {
                showError(`❌ This portal is for administrators only. Your role is "${userData.role}". Please use the correct login page.`);
                setLoadingState(false);
                return;
            }

            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('adminName', userData.name || 'Admin');

            loginButton.textContent = "Admin Login Successful!";
            loginButton.classList.remove('bg-indigo-600');
            loginButton.classList.add('bg-green-600');

            setTimeout(() => { window.location.href = 'admin.html'; }, 500);

        } catch (error) {
            console.error("❌ Admin LOGIN ERROR:", error.code, error.message);
            let msg = "Login failed. Please try again.";
            switch (error.code) {
                case 'auth/user-not-found': msg = "❌ No admin account found."; break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential': msg = "❌ Incorrect password."; break;
                case 'auth/invalid-email': msg = "❌ Invalid email format."; break;
                case 'auth/too-many-requests': msg = "❌ Too many attempts. Try after 5 minutes."; break;
                case 'auth/network-request-failed': msg = "❌ Network error."; break;
                default:
                    if (error.message.includes("Profile not found")) msg = "❌ Profile not found. Contact support.";
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
            loginButton.textContent = loading ? "Verifying..." : "Sign In as Admin";
            if (loading) loginButton.classList.add('opacity-75', 'cursor-not-allowed');
            else loginButton.classList.remove('opacity-75', 'cursor-not-allowed');
        }
        if (emailInput) emailInput.disabled = loading;
        if (passwordInput) passwordInput.disabled = loading;
    }

    loginForm.addEventListener('submit', handleLogin);
    [emailInput, passwordInput].forEach(input => { if (input) input.addEventListener('input', hideError); });

    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            const icon = togglePassword.querySelector('.material-symbols-outlined');
            if (icon) icon.textContent = type === 'password' ? 'visibility' : 'visibility_off';
        });
    }
});
