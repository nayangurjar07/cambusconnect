// toast.js - Lightweight, accessible toast notification system for Cambus Connect
(function() {
    'use strict';

    // Inject Toast Container and Styles if not already present
    function initToastContainer() {
        if (document.getElementById('cambus-toast-container')) return;

        const style = document.createElement('style');
        style.id = 'cambus-toast-styles';
        style.textContent = `
            #cambus-toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 420px;
                width: calc(100vw - 40px);
                pointer-events: none;
            }
            .cambus-toast {
                pointer-events: auto;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                border-radius: 12px;
                background: #ffffff;
                color: #0f172a;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                border: 1px solid rgba(0, 0, 0, 0.08);
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                transform: translateX(120%);
                opacity: 0;
                transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
                position: relative;
                overflow: hidden;
            }
            .cambus-toast.show {
                transform: translateX(0);
                opacity: 1;
            }
            .cambus-toast.hide {
                transform: translateX(120%);
                opacity: 0;
            }
            .cambus-toast-success {
                border-left: 4px solid #16a34a;
            }
            .cambus-toast-error {
                border-left: 4px solid #dc2626;
            }
            .cambus-toast-info {
                border-left: 4px solid #0284c7;
            }
            .cambus-toast-warning {
                border-left: 4px solid #d97706;
            }
            .cambus-toast-icon {
                font-size: 22px;
                line-height: 1;
                flex-shrink: 0;
                margin-top: 1px;
            }
            .cambus-toast-success .cambus-toast-icon { color: #16a34a; }
            .cambus-toast-error .cambus-toast-icon { color: #dc2626; }
            .cambus-toast-info .cambus-toast-icon { color: #0284c7; }
            .cambus-toast-warning .cambus-toast-icon { color: #d97706; }
            .cambus-toast-body {
                flex: 1;
                min-width: 0;
            }
            .cambus-toast-title {
                font-weight: 700;
                font-size: 14px;
                line-height: 1.3;
                margin-bottom: 2px;
            }
            .cambus-toast-message {
                font-size: 13px;
                color: #475569;
                line-height: 1.4;
                word-break: break-word;
            }
            .cambus-toast-close {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 2px;
                line-height: 1;
                border-radius: 6px;
                transition: color 0.15s, background 0.15s;
                flex-shrink: 0;
            }
            .cambus-toast-close:hover {
                color: #1e293b;
                background: #f1f5f9;
            }
            .cambus-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                width: 100%;
                opacity: 0.8;
                transform-origin: left;
                animation: toast-progress linear forwards;
            }
            .cambus-toast-success .cambus-toast-progress { background: #16a34a; }
            .cambus-toast-error .cambus-toast-progress { background: #dc2626; }
            .cambus-toast-info .cambus-toast-progress { background: #0284c7; }
            .cambus-toast-warning .cambus-toast-progress { background: #d97706; }
            @keyframes toast-progress {
                from { transform: scaleX(1); }
                to { transform: scaleX(0); }
            }
            @media (max-width: 640px) {
                #cambus-toast-container {
                    top: 12px;
                    right: 12px;
                    left: 12px;
                    width: calc(100vw - 24px);
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'cambus-toast-container';
        document.body.appendChild(container);
    }

    const ICONS = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
        warning: 'warning'
    };

    function showToast(options) {
        initToastContainer();
        const container = document.getElementById('cambus-toast-container');
        if (!container) return;

        const type = options.type || 'info';
        const title = options.title || (type.charAt(0).toUpperCase() + type.slice(1));
        const message = options.message || '';
        const duration = options.duration !== undefined ? options.duration : 4500;

        const toast = document.createElement('div');
        toast.className = `cambus-toast cambus-toast-${type}`;

        toast.innerHTML = `
            <span class="material-symbols-outlined cambus-toast-icon">${ICONS[type] || 'notifications'}</span>
            <div class="cambus-toast-body">
                <div class="cambus-toast-title">${title}</div>
                <div class="cambus-toast-message">${message}</div>
            </div>
            <button class="cambus-toast-close" aria-label="Close notification">
                <span class="material-symbols-outlined" style="font-size: 18px;">close</span>
            </button>
            ${duration > 0 ? `<div class="cambus-toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
        `;

        const closeBtn = toast.querySelector('.cambus-toast-close');
        let dismissTimeout = null;

        function dismiss() {
            if (dismissTimeout) clearTimeout(dismissTimeout);
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 320);
        }

        closeBtn.addEventListener('click', dismiss);

        if (duration > 0) {
            dismissTimeout = setTimeout(dismiss, duration);
            // Pause auto-dismiss on hover
            toast.addEventListener('mouseenter', () => {
                if (dismissTimeout) clearTimeout(dismissTimeout);
                const bar = toast.querySelector('.cambus-toast-progress');
                if (bar) bar.style.animationPlayState = 'paused';
            });
            toast.addEventListener('mouseleave', () => {
                dismissTimeout = setTimeout(dismiss, 1500);
                const bar = toast.querySelector('.cambus-toast-progress');
                if (bar) bar.style.animationPlayState = 'running';
            });
        }

        container.appendChild(toast);
        // Trigger entrance animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        return { dismiss };
    }

    // Export global Toast API
    window.CambusToast = {
        show: showToast,
        success: (message, title = 'Success') => showToast({ type: 'success', title, message }),
        error: (message, title = 'Error') => showToast({ type: 'error', title, message }),
        info: (message, title = 'Notice') => showToast({ type: 'info', title, message }),
        warning: (message, title = 'Warning') => showToast({ type: 'warning', title, message })
    };

    // Alias for convenience
    window.showToast = showToast;

    // Auto initialize once DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToastContainer);
    } else {
        initToastContainer();
    }
})();
