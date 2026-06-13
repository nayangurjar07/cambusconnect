// =============================================================================
// INDEX.JS - CAMBUS CONNECT Landing Page Logic
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Header scroll animation
    const header = document.getElementById('main-header');
    
    const handleScroll = () => {
        if (window.scrollY > 20) {
            header.classList.add('shadow-md', 'border-gray-200/50');
            header.classList.remove('border-gray-100');
        } else {
            header.classList.remove('shadow-md', 'border-gray-200/50');
            header.classList.add('border-gray-100');
        }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    // 2. Stats Counter Animation
    const counterElements = document.querySelectorAll('.count-up');
    
    const startCountAnimation = (element) => {
        const target = parseInt(element.getAttribute('data-target'), 10);
        const duration = 1500; // 1.5s duration
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
        }, { threshold: 0.5 });

        counterElements.forEach(el => observer.observe(el));
    } else {
        // Fallback for browsers without IntersectionObserver
        counterElements.forEach(el => startCountAnimation(el));
    }
});
