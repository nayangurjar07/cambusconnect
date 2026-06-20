// tenant-config.js
export const tenantConfigs = {
    // -------------------------------------------------------------------------
    // INDORE INSTITUTE OF SCIENCE AND TECHNOLOGY (IIST)
    // -------------------------------------------------------------------------
    "localhost": {
        firebaseConfig: {
            apiKey: "AIzaSyBliJ5tYf1pHxeUYF6Xm_H9I47wkSLk8Vg",
            authDomain: "cambus2-9bbb1.firebaseapp.com",
            projectId: "cambus2-9bbb1",
            storageBucket: "cambus2-9bbb1.firebasestorage.app",
            messagingSenderId: "803501850082",
            appId: "1:803501850082:web:b6a36b6d993745872b4dbb",
            measurementId: "G-Z9W8VBLN5T",
            databaseURL: "https://cambus2-9bbb1-default-rtdb.firebaseio.com"
        },
        emailDomains: ["indoreinstitute.com", "iist.in", "iist.cambusconnect.in"],
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
            apiKey: "AIzaSyBliJ5tYf1pHxeUYF6Xm_H9I47wkSLk8Vg",
            authDomain: "cambus2-9bbb1.firebaseapp.com",
            projectId: "cambus2-9bbb1",
            storageBucket: "cambus2-9bbb1.firebasestorage.app",
            messagingSenderId: "803501850082",
            appId: "1:803501850082:web:b6a36b6d993745872b4dbb",
            measurementId: "G-Z9W8VBLN5T",
            databaseURL: "https://cambus2-9bbb1-default-rtdb.firebaseio.com"
        },
        emailDomains: ["indoreinstitute.com", "iist.in", "iist.cambusconnect.in"],
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
        emailDomains: ["medicaps.com", "medicaps.ac.in", "medicaps.cambusconnect.in"],
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
        emailDomains: ["medicaps.com", "medicaps.ac.in", "medicaps.cambusconnect.in"],
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
        emailDomains: ["cambusconnect.in", "owner.cambusconnect.in"],
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
