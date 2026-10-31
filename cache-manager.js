// =============================================================================
// CAMBUS CONNECT — HIGH-CONCURRENCY CACHE MANAGER (SWR ENGINE)
// =============================================================================
// Designed for 2,000+ simultaneous peak users.
// Provides 5-minute (300,000 ms) Stale-While-Revalidate caching backed by
// sessionStorage (fastest tab isolation) with localStorage persistence fallback.
// =============================================================================

const PREFIX = 'cambus_swr_';
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

class CacheManager {
    constructor() {
        this._memoryCache = new Map();
    }

    _getStorage() {
        try {
            if (typeof window !== 'undefined' && window.sessionStorage) {
                return window.sessionStorage;
            }
        } catch (e) {}
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage;
            }
        } catch (e) {}
        return null;
    }

    set(key, data) {
        if (!key) return;
        const record = {
            timestamp: Date.now(),
            data: data
        };

        // 1. In-memory hot cache
        this._memoryCache.set(key, record);

        // 2. Browser Storage
        const storage = this._getStorage();
        if (storage) {
            try {
                storage.setItem(PREFIX + key, JSON.stringify(record));
            } catch (e) {
                console.warn('[CambusCache] Storage quota exceeded or disabled:', e);
            }
        }
    }

    get(key, maxAgeMs = DEFAULT_MAX_AGE_MS) {
        if (!key) return null;

        // 1. Check in-memory
        if (this._memoryCache.has(key)) {
            const entry = this._memoryCache.get(key);
            if (Date.now() - entry.timestamp < maxAgeMs) {
                return entry.data;
            }
        }

        // 2. Check storage
        const storage = this._getStorage();
        if (storage) {
            try {
                const raw = storage.getItem(PREFIX + key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.timestamp && (Date.now() - parsed.timestamp < maxAgeMs)) {
                        this._memoryCache.set(key, parsed);
                        return parsed.data;
                    }
                }
            } catch (e) {
                console.warn('[CambusCache] Failed to read from storage:', e);
            }
        }

        return null;
    }

    /**
     * Stale-While-Revalidate helper:
     * Returns { data, isStale, exists }
     */
    getSWR(key, maxAgeMs = DEFAULT_MAX_AGE_MS) {
        if (!key) return { data: null, isStale: true, exists: false };

        let record = this._memoryCache.get(key);
        if (!record) {
            const storage = this._getStorage();
            if (storage) {
                try {
                    const raw = storage.getItem(PREFIX + key);
                    if (raw) record = JSON.parse(raw);
                } catch (e) {}
            }
        }

        if (!record || !record.timestamp) {
            return { data: null, isStale: true, exists: false };
        }

        const isFresh = (Date.now() - record.timestamp) < maxAgeMs;
        return {
            data: record.data,
            isStale: !isFresh,
            exists: true,
            ageMs: Date.now() - record.timestamp
        };
    }

    remove(key) {
        if (!key) return;
        this._memoryCache.delete(key);
        const storage = this._getStorage();
        if (storage) {
            try {
                storage.removeItem(PREFIX + key);
            } catch (e) {}
        }
    }

    clearAll() {
        this._memoryCache.clear();
        const storage = this._getStorage();
        if (storage) {
            try {
                Object.keys(storage).forEach(k => {
                    if (k.startsWith(PREFIX)) storage.removeItem(k);
                });
            } catch (e) {}
        }
    }
}

export const CambusCache = new CacheManager();

if (typeof window !== 'undefined') {
    window.CambusCache = CambusCache;
}
if (typeof globalThis !== 'undefined') {
    globalThis.CambusCache = CambusCache;
}

export default CambusCache;
