// =============================================================================
// INDEX.JS - CAMBUS CONNECT Landing Page Logic
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Header scroll shadow animation
    const header = document.getElementById('main-header');
    
    const handleScroll = () => {
        if (!header) return;
        if (window.scrollY > 20) {
            header.classList.add('shadow-md', 'border-gray-200/60');
            header.classList.remove('border-gray-100');
        } else {
            header.classList.remove('shadow-md', 'border-gray-200/60');
            header.classList.add('border-gray-100');
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    // 2. Mobile Menu Drawer Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenuDrawer = document.getElementById('mobile-menu-drawer');
    const mobileMenuIcon = document.getElementById('mobile-menu-icon');

    if (mobileMenuBtn && mobileMenuDrawer) {
        const toggleMobileMenu = (forceClose = false) => {
            const shouldOpen = forceClose ? false : !mobileMenuDrawer.classList.contains('open');
            if (shouldOpen) {
                mobileMenuDrawer.classList.add('open');
                mobileMenuBtn.setAttribute('aria-expanded', 'true');
                if (mobileMenuIcon) mobileMenuIcon.textContent = 'close';
            } else {
                mobileMenuDrawer.classList.remove('open');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                if (mobileMenuIcon) mobileMenuIcon.textContent = 'menu';
            }
        };

        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileMenu();
        });

        // Close when clicking any nav link inside the mobile drawer
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => toggleMobileMenu(true));
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!mobileMenuBtn.contains(e.target) && !mobileMenuDrawer.contains(e.target)) {
                toggleMobileMenu(true);
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') toggleMobileMenu(true);
        });
    }

    // 3. Desktop Login Dropdown Toggle
    const loginBtn = document.getElementById('header-login-btn');
    const loginDropdown = document.getElementById('header-login-dropdown');
    const loginArrow = document.getElementById('header-login-arrow');

    if (loginBtn && loginDropdown) {
        loginBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = loginDropdown.classList.contains('open');
            loginDropdown.classList.toggle('open');
            loginBtn.setAttribute('aria-expanded', !isOpen);
            if (loginArrow) {
                loginArrow.style.transform = isOpen ? '' : 'rotate(180deg)';
            }
        });

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!loginBtn.contains(e.target) && !loginDropdown.contains(e.target)) {
                loginDropdown.classList.remove('open');
                loginBtn.setAttribute('aria-expanded', 'false');
                if (loginArrow) loginArrow.style.transform = '';
            }
        });
    }

    // 3b. Hero Portal Select Button Handler
    const heroPortalBtn = document.getElementById('hero-portal-select-btn');
    if (heroPortalBtn) {
        heroPortalBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth < 768 && mobileMenuDrawer && mobileMenuBtn) {
                mobileMenuDrawer.classList.add('open');
                mobileMenuBtn.setAttribute('aria-expanded', 'true');
                if (mobileMenuIcon) mobileMenuIcon.textContent = 'close';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (loginBtn && loginDropdown) {
                loginDropdown.classList.add('open');
                loginBtn.setAttribute('aria-expanded', 'true');
                if (loginArrow) loginArrow.style.transform = 'rotate(180deg)';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    // 4. Stats Counter Animation
    const counterElements = document.querySelectorAll('.count-up');
    
    const startCountAnimation = (element) => {
        const target = parseInt(element.getAttribute('data-target'), 10);
        if (isNaN(target)) return;
        const duration = 1400; // 1.4s duration
        const stepTime = Math.max(Math.floor(duration / target), 15);
        let current = 0;
        
        const timer = setInterval(() => {
            current += 1;
            element.textContent = current + '%';
            if (current >= target) {
                element.textContent = target + '%';
                clearInterval(timer);
            }
        }, stepTime);
    };

    // Intersection Observer to trigger counter animation on scroll
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    if (!el.classList.contains('counted')) {
                        el.classList.add('counted');
                        startCountAnimation(el);
                    }
                }
            });
        }, { threshold: 0.4 });

        counterElements.forEach(el => observer.observe(el));
    } else {
        counterElements.forEach(el => startCountAnimation(el));
    }

    // 5. System Notification (Toast) Demo Triggers
    const testSuccessBtn = document.getElementById('test-success-btn');
    const testErrorBtn = document.getElementById('test-error-btn');
    const testInfoBtn = document.getElementById('test-info-btn');

    if (testSuccessBtn && window.CambusToast) {
        testSuccessBtn.addEventListener('click', () => {
            CambusToast.success(
                'Digital transit pass verified and renewed for Spring Semester.',
                'Verification Success'
            );
        });
    }

    if (testErrorBtn && window.CambusToast) {
        testErrorBtn.addEventListener('click', () => {
            CambusToast.error(
                'Unable to contact telemetry gateway for Shuttle #104. Re-establishing connection...',
                'GPS Telemetry Alert'
            );
        });
    }

    if (testInfoBtn && window.CambusToast) {
        testInfoBtn.addEventListener('click', () => {
            CambusToast.info(
                'Central Campus route detour active from 2:00 PM due to commencement ceremony.',
                'Campus Dispatch Notice'
            );
        });
    }
});
