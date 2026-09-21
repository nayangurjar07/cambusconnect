// gps-settings.js - GPS settings credentials configuration logic
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const authGuard = window.waitForFirebaseAuth || window.waitForFirebase;
        if (typeof authGuard === 'function') {
            await authGuard();
        }
    } catch (err) {
        console.error("❌ Firebase/Auth unavailable on gps-settings panel:", err);
    }
    initGPSSettingsPanel();

    function initGPSSettingsPanel() {
        const auth = firebase.auth();
        const db = firebase.firestore();

        // Display admin name from localStorage
        const adminNameDisplay = document.getElementById('admin-name-display');
        if (adminNameDisplay) {
            const adminName = localStorage.getItem('adminName');
            if (adminName) adminNameDisplay.textContent = adminName;
        }

        // Support Queries Badge (one-time fetch for efficiency)
        const pendingBadge = document.getElementById('pending-badge');
        dbHelper.getSupportQueriesCol().where('status', '==', 'Pending').get().then(snapshot => {
            const pendingCount = snapshot.size;
            if (pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = pendingCount;
                    pendingBadge.classList.remove('hidden');
                } else {
                    pendingBadge.classList.add('hidden');
                }
            }
        }).catch(err => {
            console.error("Error loading pending queries badge:", err);
        });

        // DOM Elements
        const formTrackingSettings = document.getElementById('form-tracking-settings');

        loadTrackingSettings();

        function loadTrackingSettings() {
            db.collection('settings').doc('tracking').get()
                .then(doc => {
                    const apiKeyInput = document.getElementById('input-gps-api-key');
                    const clientSecretInput = document.getElementById('input-gps-client-secret');
                    if (doc.exists) {
                        const data = doc.data();
                        if (data.apiKeyEncrypted && apiKeyInput) {
                            apiKeyInput.placeholder = "Credentials configured (••••••••••••••••)";
                        }
                        if (data.clientSecretEncrypted && clientSecretInput) {
                            clientSecretInput.placeholder = "Credentials configured (••••••••••••••••)";
                        }
                    }
                })
                .catch(err => {
                    console.error("Error loading GPS settings:", err);
                });
        }

        if (formTrackingSettings) {
            formTrackingSettings.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const apiKey = formData.get('apiKey');
                const clientSecret = formData.get('clientSecret');

                const btn = e.target.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.textContent = "Encrypting & Saving...";

                try {
                    const currentUser = auth.currentUser;
                    if (!currentUser) throw new Error("No active administrator session found.");
                    const idToken = await currentUser.getIdToken();

                    const response = await fetch('/api/save-settings', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ apiKey, clientSecret })
                    });

                    const result = await response.json();
                    if (!response.ok) {
                        throw new Error(result.error || "Save settings failed");
                    }

                    alert("✅ GPS credentials saved and encrypted securely on the server!");
                    e.target.reset();
                    loadTrackingSettings();
                } catch (err) {
                    alert("❌ Error saving credentials: " + err.message);
                } finally {
                    btn.disabled = false;
                    btn.textContent = "Save Secure Credentials";
                }
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Logout?')) {
                    auth.signOut().then(() => {
                        localStorage.clear();
                        window.location.href = '../admin-login.html';
                    });
                }
            });
        }
    }
});
