// Authentication Guard - Protects pages from unauthorized access
// This script must be loaded on EVERY page to enforce authentication

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const userRole = localStorage.getItem('userRole');
    const instituteId = localStorage.getItem('instituteId');

    // Get current path and page
    const path = window.location.pathname.toLowerCase();
    const page = path.split('/').pop() || 'index.html';

    // Determine prefix back to root folder dynamically
    let prefix = '';
    if (path.includes('/owner/') || path.includes('/admin/') || path.includes('/student/') || path.includes('/driver/')) {
        prefix = '../';
    }

    const loginPath = prefix + 'owner/login.html';
    const adminHomePath = prefix + 'admin/admin.html';
    const studentHomePath = prefix + 'student/home.html';
    const driverHomePath = prefix + 'driver/driverhome.html';
    const ownerHomePath = prefix + 'owner/owner.html';

    console.log(`Auth Guard checking page: ${page}, Path: ${path}, Prefix: ${prefix}, Logged in: ${isLoggedIn}, Role: ${userRole}, Tenant: ${instituteId}`);

    // Define page sets by directory context
    const isPublicPage = path.includes('/owner/index.html') || path.includes('/owner/login.html') || path.endsWith('/') || page === 'index.html';
    const isOwnerPage = path.includes('/owner/owner.html');
    const isAdminPage = path.includes('/admin/');
    const isDriverPage = path.includes('/driver/');
    const isStudentPage = path.includes('/student/');

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
