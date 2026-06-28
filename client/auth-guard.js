// Authentication Guard - Protects pages from unauthorized access
// This script must be loaded on EVERY page to enforce authentication

document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------------------
    // A. Cross-Subdomain Session Transfer Receiver (Removed for security)
    // -------------------------------------------------------------------------

    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');
    const instituteId = localStorage.getItem('instituteId');

    // Get current path and page
    const path = window.location.pathname.toLowerCase();
    const page = path.split('/').pop() || 'index.html';

    // Determine prefix back to root folder dynamically
    let prefix = '';
    if (path.includes('/portals/')) {
        const portalPart = path.split('/portals/')[1];
        const slashCount = (portalPart.match(/\//g) || []).length;
        prefix = '../'.repeat(slashCount + 1);
    } else if (path.includes('/owner/') || path.includes('/admin/') || path.includes('/student/') || path.includes('/driver/')) {
        prefix = '../';
    }

    let loginPath = prefix + 'portals/owner/index.html';
    if (path.includes('/student/')) {
        loginPath = prefix + 'portals/student/student-login.html';
    } else if (path.includes('/admin/')) {
        loginPath = prefix + 'portals/admin/admin-login.html';
    } else if (path.includes('/driver/')) {
        loginPath = prefix + 'portals/driver/driver-login.html';
    } else if (path.includes('/owner/')) {
        loginPath = prefix + 'portals/owner/owner-login.html';
    }

    const adminHomePath = prefix + 'portals/admin/admin.html';
    const studentHomePath = prefix + 'portals/student/home/home.html';
    const driverHomePath = prefix + 'portals/driver/driverhome.html';
    const ownerHomePath = prefix + 'portals/owner/owner.html';

    console.log(`Auth Guard checking page: ${page}, Path: ${path}, Prefix: ${prefix}, Logged in: ${isLoggedIn}, Role: ${userRole}, Tenant: ${instituteId}`);

    // Define page sets by directory context
    const isPublicPage = 
        path.includes('/portals/owner/index.html') || 
        path.includes('/owner/index.html') || 
        path.endsWith('/') || 
        page === 'index.html' || 
        page.includes('login.html');

    const isOwnerPage = path.includes('/owner/') && !page.includes('login.html') && !page.includes('index.html');
    const isAdminPage = path.includes('/admin/') && !page.includes('login.html');
    const isDriverPage = path.includes('/driver/') && !page.includes('login.html');
    const isStudentPage = path.includes('/student/') && !page.includes('login.html');

    // -------------------------------------------------------------------------
    // B. Subdomain Enforcement Check (Removed per user request)
    // -------------------------------------------------------------------------

    // RULE 1: If NOT logged in (or missing tenant ID) and trying to access protected page -> Redirect to login
    if ((isLoggedIn !== 'true' || !instituteId) && !isPublicPage) {
        console.log('Not authenticated or missing tenant ID. Redirecting to login...');
        localStorage.clear();
        window.location.href = loginPath;
        return;
    }

    // RULE 2: If logged in and on landing/login page -> Redirect to appropriate dashboard
    if (isLoggedIn === 'true' && isPublicPage) {
        console.log('Already logged in. Redirecting to dashboard...');
        if (userRole === 'owner') {
            window.location.href = ownerHomePath;
        } else if (userRole === 'admin') {
            window.location.href = adminHomePath;
        } else if (userRole === 'driver') {
            window.location.href = driverHomePath;
        } else {
            window.location.href = studentHomePath;
        }
        return;
    }

    // RULE 3: If student trying to access admin, driver, or owner pages -> Deny access
    if (isLoggedIn === 'true' && userRole === 'student' && (isAdminPage || isDriverPage || isOwnerPage)) {
        alert('Access Denied!\n\nThis page is for administrators or drivers only.\nYou will be redirected to the student dashboard.');
        window.location.href = studentHomePath;
        return;
    }

    // RULE 4: If admin trying to access student, driver, or owner pages -> Redirect to admin panel
    if (isLoggedIn === 'true' && userRole === 'admin' && (isStudentPage || isDriverPage || isOwnerPage)) {
        window.location.href = adminHomePath;
        return;
    }

    // RULE 5: If driver trying to access student, admin, or owner pages -> Redirect to driver home
    if (isLoggedIn === 'true' && userRole === 'driver' && (isStudentPage || isAdminPage || isOwnerPage)) {
        window.location.href = driverHomePath;
        return;
    }

    // RULE 6: If owner trying to access student, admin, or driver pages -> Redirect to owner panel
    if (isLoggedIn === 'true' && userRole === 'owner' && (isStudentPage || isAdminPage || isDriverPage)) {
        window.location.href = ownerHomePath;
        return;
    }

    // RULE 7: Restricted check for owner pages from non-owner accounts
    if (isLoggedIn === 'true' && userRole !== 'owner' && isOwnerPage) {
        alert('Access Denied!\n\nThis page is restricted to platform owners.');
        if (userRole === 'admin') {
            window.location.href = adminHomePath;
        } else if (userRole === 'driver') {
            window.location.href = driverHomePath;
        } else {
            window.location.href = studentHomePath;
        }
        return;
    }

    console.log(`Auth guard passed for ${page}`);
});
