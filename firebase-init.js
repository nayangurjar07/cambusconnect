// firebase-init.js
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { tenantConfigs } from "./tenant-config.js";

// Import modules for compatibility bridge
import { 
    collection, 
    doc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot,
    serverTimestamp
} from "firebase/firestore";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut as fbSignOut, 
    onAuthStateChanged, 
    GoogleAuthProvider,
    linkWithPopup as fbLinkWithPopup,
    signInWithCredential
} from "firebase/auth";

function resolveActiveTenant() {
    const savedKey = localStorage.getItem('activeTenantKey');
    if (savedKey && tenantConfigs[savedKey]) {
        return tenantConfigs[savedKey];
    }
    const host = window.location.hostname.toLowerCase();
    // Direct configuration match or default fallback
    return tenantConfigs[host] || tenantConfigs["localhost"];
}

let currentTenant = resolveActiveTenant();
export let app = initializeApp(currentTenant.firebaseConfig);

export let auth = getAuth(app);
export let db = getFirestore(app);
export let activeBranding = currentTenant.branding;

// =============================================================================
// COMPATIBILITY LAYER FOR LEGACY SCRIPTS
// =============================================================================

function wrapUser(user) {
    if (!user) return null;
    return new Proxy(user, {
        get(target, prop, receiver) {
            if (prop === 'linkWithPopup') {
                return function(provider) {
                    const rawProvider = provider.provider || provider;
                    return fbLinkWithPopup(target, rawProvider).then(result => {
                        return {
                            user: wrapUser(result.user)
                        };
                    });
                };
            }
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        }
    });
}

class CompatDocRef {
    constructor(dbInstance, path, docId) {
        this.db = dbInstance;
        this.path = path;
        this.id = docId;
        this.ref = doc(dbInstance, path, docId);
    }
    get() {
        return getDoc(this.ref).then(snap => new CompatDocSnap(snap));
    }
    update(data) {
        return updateDoc(this.ref, data);
    }
    set(data) {
        return setDoc(this.ref, data);
    }
    delete() {
        return deleteDoc(this.ref);
    }
    onSnapshot(onNext, onError) {
        return onSnapshot(this.ref, snap => onNext(new CompatDocSnap(snap)), onError);
    }
}

class CompatDocSnap {
    constructor(snap) {
        this._snap = snap;
        this.id = snap.id;
        this.exists = snap.exists();
    }
    data() {
        return this._snap.data();
    }
}

class CompatQuery {
    constructor(dbInstance, path, constraints = []) {
        this.db = dbInstance;
        this.path = path;
        this.constraints = constraints;
    }
    where(field, op, value) {
        return new CompatQuery(this.db, this.path, [...this.constraints, where(field, op, value)]);
    }
    orderBy(field, direction = 'asc') {
        return new CompatQuery(this.db, this.path, [...this.constraints, orderBy(field, direction)]);
    }
    limit(n) {
        return new CompatQuery(this.db, this.path, [...this.constraints, limit(n)]);
    }
    get() {
        const q = query(collection(this.db, this.path), ...this.constraints);
        return getDocs(q).then(snap => new CompatQuerySnap(snap));
    }
    onSnapshot(onNext, onError) {
        const q = query(collection(this.db, this.path), ...this.constraints);
        return onSnapshot(q, snap => onNext(new CompatQuerySnap(snap)), onError);
    }
}

class CompatCollection extends CompatQuery {
    constructor(dbInstance, path) {
        super(dbInstance, path);
    }
    doc(id) {
        return new CompatDocRef(this.db, this.path, id);
    }
    add(data) {
        return addDoc(collection(this.db, this.path), data).then(ref => new CompatDocRef(this.db, this.path, ref.id));
    }
}

class CompatQuerySnap {
    constructor(snap) {
        this._snap = snap;
        this.docs = snap.docs.map(docSnap => new CompatDocSnap(docSnap));
        this.empty = snap.empty;
        this.size = snap.size;
    }
    forEach(callback) {
        this.docs.forEach(docSnap => callback(docSnap));
    }
}

class CompatFirestore {
    constructor(dbInstance) {
        this._db = dbInstance;
    }
    collection(path) {
        return new CompatCollection(this._db, path);
    }
}

class CompatAuth {
    constructor(authInstance) {
        this._auth = authInstance;
    }
    signInWithEmailAndPassword(email, password) {
        return signInWithEmailAndPassword(this._auth, email, password);
    }
    createUserWithEmailAndPassword(email, password) {
        return createUserWithEmailAndPassword(this._auth, email, password);
    }
    signOut() {
        return fbSignOut(this._auth);
    }
    onAuthStateChanged(callback) {
        return onAuthStateChanged(this._auth, (user) => {
            callback(wrapUser(user));
        });
    }
    signInWithCredential(credential) {
        return signInWithCredential(this._auth, credential);
    }
    get currentUser() {
        return wrapUser(this._auth.currentUser);
    }
}

// Attach compatibility classes to window for global scripts
window.auth = new CompatAuth(auth);
window.db = new CompatFirestore(db);

window.firebase = {
    apps: [app],
    app: () => app,
    auth: Object.assign(() => window.auth, {
        GoogleAuthProvider: GoogleAuthProvider
    }),
    firestore: Object.assign(() => window.db, {
        FieldValue: {
            serverTimestamp: () => serverTimestamp()
        }
    })
};

export function reinitializeFirebase(tenantKey) {
    if (!tenantConfigs[tenantKey]) return Promise.reject("Invalid tenant key: " + tenantKey);
    
    localStorage.setItem('activeTenantKey', tenantKey);
    currentTenant = tenantConfigs[tenantKey];
    activeBranding = currentTenant.branding;
    
    return deleteApp(app).then(() => {
        app = initializeApp(currentTenant.firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        
        window.auth = new CompatAuth(auth);
        window.db = new CompatFirestore(db);
        
        window.firebase.apps = [app];
        window.firebase.app = () => app;
        
        console.log(`📡 Re-initialized Firebase dynamically for tenant: ${currentTenant.branding.shortName}`);
        return true;
    });
}

export function createSecondaryAuthUser(email, password) {
    const config = currentTenant.firebaseConfig;
    const tempAppName = "TempRegApp_" + Date.now();
    const tempApp = initializeApp(config, tempAppName);
    const tempAuth = getAuth(tempApp);
    return createUserWithEmailAndPassword(tempAuth, email, password)
        .then((userCredential) => {
            return deleteApp(tempApp).then(() => userCredential.user.uid);
        })
        .catch((error) => {
            return deleteApp(tempApp).then(() => {
                throw error;
            });
        });
}

window.reinitializeFirebase = reinitializeFirebase;
window.createSecondaryAuthUser = createSecondaryAuthUser;

console.log(`📡 Dynamically initialized Firebase compat layer for tenant: ${currentTenant.branding.shortName}`);
