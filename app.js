// app.js
import { activeBranding } from "./firebase-init.js";

function bootstrapSaaSBranding() {
    const root = document.documentElement;
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    let branding = activeBranding;

    // Use common, brand-aligned Indigo theme on landing & login pages when not logged in
    if (!isLoggedIn && (page === 'index.html' || page === 'login.html' || page === '')) {
        branding = {
            colors: {
                primary: "#4f46e5",     // indigo-600
                secondary: "#06b6d4",   // cyan-500
                background: "#f8f9ff",  // light background
                text: "#0f172a"         // dark slate text
            },
            shortName: "Cambus Connect"
        };
    }

    // Bind styling variables to root selectors
    root.style.setProperty('--primary-color', branding.colors.primary);
    root.style.setProperty('--secondary-color', branding.colors.secondary);
    root.style.setProperty('--bg-color', branding.colors.background);
    root.style.setProperty('--text-color', branding.colors.text);

    // Keep global app title as Cambus Connect
    document.title = "Cambus Connect";
    
    // Ensure the default logo and title are always visible and Cambus Connect branding is kept
    const defaultLogo = document.getElementById("default-logo-container");
    if (defaultLogo) {
        defaultLogo.classList.remove('hidden');
    }
    
    const sidebarDefault = document.getElementById("sidebar-default-logo");
    if (sidebarDefault) {
        sidebarDefault.classList.remove('hidden');
    }

    const navName = document.getElementById("college-title");
    if (navName) {
        navName.classList.add('hidden');
    }
    
    const sidebarTitle = document.getElementById("sidebar-college-title");
    if (sidebarTitle) {
        sidebarTitle.classList.add('hidden');
    }
    
    const navLogo = document.getElementById("college-logo");
    if (navLogo) {
        navLogo.classList.add('hidden');
    }

    console.log(`🎨 Injected color scheme branding variables for tenant: ${activeBranding.shortName}`);
}

// Ensure the branding runs immediately if DOM is already loaded, or on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", bootstrapSaaSBranding);
} else {
    bootstrapSaaSBranding();
}
