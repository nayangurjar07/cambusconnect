// =============================================================================
// DRIVER LOGIN.JS - Cambus Connect Driver/Conductor Authentication
// =============================================================================
// Only allows drivers and conductors to log in.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚛 Driver Login page loaded");

    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        const role = localStorage.getItem('userRole');
        if (role === 'driver') window.location.href = 'driverhome.html';
        else if (role === 'student') window.location.href = '../student/home/home.html';
        else if (role === 'admin') window.location.href = '../admin/admin.html';
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
        const host = window.location.hostname.toLowerCase();
        for (const [key, config] of Object.entries(configs)) {
            if (config.emailDomains && config.emailDomains.includes(domain)) {
                const isLocalHost = host === 'localhost' || host === '127.0.0.1';
                const isConfigLocal = key === 'localhost' || key === '127.0.0.1';
                if (isLocalHost === isConfigLocal) return { tenantKey: key, domain };
            }
        }
        for (const [key, config] of Object.entries(configs)) {
            if (config.emailDomains && config.emailDomains.includes(domain)) return { tenantKey: key, domain };
        }
        return null;
    };

    const getFallbackTenantInfo = () => {
        const host = window.location.hostname.toLowerCase();
        const configs = window.tenantConfigs || {};
        if (configs[host]) return { tenantKey: host, domain: configs[host].emailDomains ? configs[host].emailDomains[0] : '' };
        const savedKey = localStorage.getItem('activeTenantKey');
        if (savedKey && configs[savedKey]) return { tenantKey: savedKey, domain: configs[savedKey].emailDomains ? configs[savedKey].emailDomains[0] : '' };
        const firstKey = Object.keys(configs)[0];
        if (firstKey) return { tenantKey: firstKey, domain: configs[firstKey].emailDomains ? configs[firstKey].emailDomains[0] : '' };
        return { tenantKey: 'localhost', domain: 'indoreinstitute.com' };
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
            showError("Please enter your full email address.");
            return;
        }

        let tenantInfo = getTenantInfoFromEmail(email);
        let tenantsToTry = [];
        if (tenantInfo) {
            tenantsToTry.push(tenantInfo);
        } else {
            const configs = window.tenantConfigs || {};
            const fallback = getFallbackTenantInfo();
            tenantsToTry.push(fallback);
            for (const [key, config] of Object.entries(configs)) {
                if (key === 'owner') continue;
                if (key === fallback.tenantKey) continue;
                tenantsToTry.push({
                    tenantKey: key,
                    domain: config.emailDomains ? config.emailDomains[0] : ''
                });
            }
        }

        let loggedIn = false;
        let lastError = null;
        let successfulTenant = null;

        try {
            for (const tenant of tenantsToTry) {
                try {
                    const activeKey = localStorage.getItem('activeTenantKey');
                    if (activeKey !== tenant.tenantKey) {
                        await window.reinitializeFirebase(tenant.tenantKey);
                    }
                    await window.auth.signInWithEmailAndPassword(email, password);
                    loggedIn = true;
                    successfulTenant = tenant;
                    break;
                } catch (err) {
                    console.warn(`⚠️ Auth failed on tenant ${tenant.tenantKey}:`, err.code, err.message);
                    lastError = err;
                    if (err.code === 'auth/wrong-password') {
                        break;
                    }
                    if (err.code !== 'auth/user-not-found' && err.code !== 'auth/invalid-credential') {
                        break;
                    }
                }
            }

            if (!loggedIn) {
                throw lastError || new Error("Authentication failed.");
            }

            tenantInfo = successfulTenant;

            localStorage.setItem('instituteId', tenantInfo.domain);
            localStorage.setItem('activeTenantKey', tenantInfo.tenantKey);

            const docSnap = await window.db.collection('users').doc(email).get();
            if (!docSnap.exists) throw new Error("Profile not found in database. Contact admin to register your account.");

            const userData = docSnap.data();

            // ROLE CHECK: Only allow driver or conductor
            if (userData.role !== 'driver' && userData.role !== 'conductor') {
                showError(`❌ This portal is for drivers/conductors only. Your role is "${userData.role}". Please use the correct login page.`);
                setLoadingState(false);
                return;
            }

            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userRole', 'driver');
            localStorage.setItem('driverName', userData.name || 'Driver');

            loginButton.textContent = "Driver Login Successful!";
            loginButton.classList.remove('bg-orange-600');
            loginButton.classList.add('bg-green-600');

            setTimeout(() => { window.location.href = 'driverhome.html'; }, 500);

        } catch (error) {
            console.error("❌ Driver LOGIN ERROR:", error.code, error.message);
            let msg = "Login failed. Please try again.";
            switch (error.code) {
                case 'auth/user-not-found': msg = "❌ No driver account found. Ask admin to register you first."; break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential': msg = "❌ Incorrect password."; break;
                case 'auth/invalid-email': msg = "❌ Invalid email format."; break;
                case 'auth/too-many-requests': msg = "❌ Too many attempts. Try after 5 minutes."; break;
                case 'auth/network-request-failed': msg = "❌ Network error."; break;
                default:
                    if (error.message && error.message.includes("Profile not found")) msg = "❌ Account exists in Auth but profile not found in database. Contact admin.";
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
            loginButton.textContent = loading ? "Verifying..." : "Sign In as Driver";
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
