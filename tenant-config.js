// tenant-config.js
export const tenantConfigs = {
    // -------------------------------------------------------------------------
    // INDORE INSTITUTE OF SCIENCE AND TECHNOLOGY (IIST)
    // -------------------------------------------------------------------------
    "localhost": {
        firebaseConfig: {
            apiKey: "AIzaSyD4sdDsx19EDGV5VrBP3bDwyOnmUogfRUw",
            authDomain: "cambus-iist.firebaseapp.com",
            projectId: "cambus-iist",
            storageBucket: "cambus-iist.firebasestorage.app",
            messagingSenderId: "560938631277",
            appId: "1:560938631277:web:69308fe046c5d613213f64",
            measurementId: "G-9JD5KC1F7Q",
            databaseURL: "https://cambus-iist-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Indore Institute of Science and Technology",
            shortName: "IIST",
            logoUrl: "https://via.placeholder.com/150/003366/ffffff?text=IIST+Logo",
            colors: {
                primary: "#003366",       // Deep Blue
                secondary: "#ffffff",     // White
                background: "#f4f6f9",    // Light Gray
                text: "#333333"           // Dark Charcoal
            }
        }
    },
    "iist.cambusconnect.in": {
        // Inherits default production settings matching local target parameters
        firebaseConfig: {
            apiKey: "AIzaSyD4sdDsx19EDGV5VrBP3bDwyOnmUogfRUw",
            authDomain: "cambus-iist.firebaseapp.com",
            projectId: "cambus-iist",
            storageBucket: "cambus-iist.firebasestorage.app",
            messagingSenderId: "560938631277",
            appId: "1:560938631277:web:69308fe046c5d613213f64",
            measurementId: "G-9JD5KC1F7Q",
            databaseURL: "https://cambus-iist-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Indore Institute of Science and Technology",
            shortName: "IIST",
            logoUrl: "https://via.placeholder.com/150/003366/ffffff?text=IIST+Logo",
            colors: { primary: "#003366", secondary: "#ffffff", background: "#f4f6f9", text: "#333333" }
        }
    },

    // -------------------------------------------------------------------------
    // MEDI-CAPS UNIVERSITY
    // -------------------------------------------------------------------------
    "127.0.0.1": {
        firebaseConfig: {
            apiKey: "AIzaSyCr7eid8VwqAD4OharNBSD8NME-kyC2FE4",
            authDomain: "cambus-medicap.firebaseapp.com",
            projectId: "cambus-medicap",
            storageBucket: "cambus-medicap.firebasestorage.app",
            messagingSenderId: "398140728981",
            appId: "1:398140728981:web:a2c4ed5d6296ad63185d9c",
            measurementId: "G-ERLRXBMHPB",
            databaseURL: "https://cambus-medicap-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Medi-Caps University",
            shortName: "Medi-Caps",
            logoUrl: "https://via.placeholder.com/150/800000/ffffff?text=Medi-Caps+Logo",
            colors: {
                primary: "#800000",       // Maroon
                secondary: "#ffffff",     // White
                background: "#fafafa",    // Off-white
                text: "#111111"           // Soft Black
            }
        }
    },
    "medicaps.cambusconnect.in": {
        firebaseConfig: {
            apiKey: "AIzaSyCr7eid8VwqAD4OharNBSD8NME-kyC2FE4",
            authDomain: "cambus-medicap.firebaseapp.com",
            projectId: "cambus-medicap",
            storageBucket: "cambus-medicap.firebasestorage.app",
            messagingSenderId: "398140728981",
            appId: "1:398140728981:web:a2c4ed5d6296ad63185d9c",
            measurementId: "G-ERLRXBMHPB",
            databaseURL: "https://cambus-medicap-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Medi-Caps University",
            shortName: "Medi-Caps",
            logoUrl: "https://via.placeholder.com/150/800000/ffffff?text=Medi-Caps+Logo",
            colors: { primary: "#800000", secondary: "#ffffff", background: "#fafafa", text: "#111111" }
        }
    },

    // -------------------------------------------------------------------------
    // MASTER SYSTEM OWNER / SUPER ADMIN
    // -------------------------------------------------------------------------
    "owner": {
        firebaseConfig: {
            apiKey: "AIzaSyDiclh4Sf8TOCuPNQGLlnQTw2tUNPQoaJM",
            authDomain: "cambus-owner.firebaseapp.com",
            projectId: "cambus-owner",
            storageBucket: "cambus-owner.firebasestorage.app",
            messagingSenderId: "955992628921",
            appId: "1:955992628921:web:516a3aab81894e9b248568",
            measurementId: "G-09SJ4VC3CQ",
            databaseURL: "https://cambus-owner-default-rtdb.firebaseio.com"
        },
        branding: {
            name: "Cambus Connect Owner Portal",
            shortName: "Owner",
            logoUrl: "https://via.placeholder.com/150/4f46e5/ffffff?text=Owner+Logo",
            colors: {
                primary: "#4f46e5",       // Indigo
                secondary: "#ffffff",
                background: "#f8f9ff",
                text: "#0b1c30"
            }
        }
    }
};
