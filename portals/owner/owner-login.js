// =============================================================================
// OWNER LOGIN.JS - Cambus Connect Owner/Super-Admin Authentication
// =============================================================================
// Only allows owners to log in. Uses the "owner" tenant config.
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("👑 Owner Login page loaded");

    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn === 'true') {
        const role = localStorage.getItem('userRole');
        if (role === 'owner') window.location.href = 'owner.html';
        else if (role === 'admin') window.location.href = '../admin/admin.html';
        else if (role === 'student') window.location.href = '../student/home/home.html';
        else if (role === 'driver') window.location.href = '../driver/driverhome.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const loginButton = document.getElementById('btn-login');
    const errorMessageDiv = document.getElementById('login-error-message');
    const errorText = document.getElementById('error-text');
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!loginForm || !loginButton || !emailInput || !passwordInput) return;

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
            showError("Please enter your full owner email address.");
            return;
        }

        try {
            // Owner always uses the "owner" tenant config
            const configs = window.tenantConfigs || {};
            if (configs['owner']) {
                const activeKey = localStorage.getItem('activeTenantKey');
                if (activeKey !== 'owner') {
                    console.log("📡 Switching to Owner Firebase project...");
                    await window.reinitializeFirebase('owner');
                }
            }

            await window.auth.signInWithEmailAndPassword(email, password);

            localStorage.setItem('activeTenantKey', 'owner');
            const ownerConfig = configs['owner'];
            if (ownerConfig && ownerConfig.emailDomains) {
                localStorage.setItem('instituteId', ownerConfig.emailDomains[0]);
            }

            const docSnap = await window.db.collection('users').doc(email).get();
            if (!docSnap.exists) throw new Error("Owner profile not found in database.");

            const userData = docSnap.data();

            // ROLE CHECK: Only allow owners
            if (userData.role !== 'owner') {
                showError(`❌ This portal is for platform owners only. Your role is "${userData.role}".`);
                setLoadingState(false);
                return;
            }

            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userRole', 'owner');
            localStorage.setItem('ownerName', userData.name || 'Owner');

            loginButton.textContent = "Owner Login Successful!";
            loginButton.classList.remove('bg-purple-600');
            loginButton.classList.add('bg-green-600');

            setTimeout(() => { window.location.href = 'owner.html'; }, 500);

        } catch (error) {
            console.error("❌ Owner LOGIN ERROR:", error.code, error.message);
            let msg = "Login failed. Please try again.";
            switch (error.code) {
                case 'auth/user-not-found': msg = "❌ No owner account found."; break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential': msg = "❌ Incorrect password."; break;
                case 'auth/invalid-email': msg = "❌ Invalid email format."; break;
                case 'auth/too-many-requests': msg = "❌ Too many attempts. Try after 5 minutes."; break;
                case 'auth/network-request-failed': msg = "❌ Network error."; break;
                default:
                    if (error.message.includes("profile not found")) msg = "❌ Owner profile not found in database.";
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
            loginButton.textContent = loading ? "Verifying..." : "Sign In as Owner";
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
