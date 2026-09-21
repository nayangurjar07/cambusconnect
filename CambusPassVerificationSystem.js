/**
 * CambusPassVerificationSystem.js
 * 
 * Cambus Pass Verification System
 * High-performance, clean Multi-Tenant SaaS framework to prevent passenger boarding fraud.
 */

// Base64 helper supporting UTF-8 for both Node.js and browser
function encodeBase64(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64');
    } else {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    }
}

function decodeBase64(str) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf8');
    } else {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }
}

// Pure JS SHA-256 and HMAC-SHA256 fallback for browsers
function sha256_pure(ascii) {
    function rightRotate(value, amount) {
        return (value >>> amount) | (value << (32 - amount));
    }
    
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = 'length';
    let i, j;

    const words = [];
    const asciiLength = ascii[lengthProperty] * 8;
    
    const hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const asciiBytes = [];
    for (i = 0; i < ascii[lengthProperty]; i++) {
        asciiBytes.push(ascii.charCodeAt(i));
    }
    
    const originalLen = asciiBytes.length;
    asciiBytes.push(0x80);
    while ((asciiBytes.length + 8) % 64 !== 0) {
        asciiBytes.push(0);
    }
    
    const lenBits = originalLen * 8;
    asciiBytes.push(0, 0, 0, 0);
    asciiBytes.push(
        (lenBits >>> 24) & 0xff,
        (lenBits >>> 16) & 0xff,
        (lenBits >>> 8) & 0xff,
        lenBits & 0xff
    );
    
    for (i = 0; i < asciiBytes.length; i++) {
        words[i >> 2] |= asciiBytes[i] << (24 - (i % 4) * 8);
    }
    
    for (j = 0; j < words.length; j += 16) {
        const w = words.slice(j, j + 16);
        for (i = 16; i < 64; i++) {
            const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        
        let a = hash[0], b = hash[1], c = hash[2], d = hash[3], e = hash[4], f = hash[5], g = hash[6], h = hash[7];
        
        for (let i = 0; i < 64; i++) {
            const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
            const ch = (e & f) ^ (~e & g);
            const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
            const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const temp2 = (S0 + maj) | 0;
            
            h = g;
            g = f;
            f = e;
            e = (d + temp1) | 0;
            d = c;
            c = b;
            b = a;
            a = (temp1 + temp2) | 0;
        }
        
        hash[0] = (hash[0] + a) | 0;
        hash[1] = (hash[1] + b) | 0;
        hash[2] = (hash[2] + c) | 0;
        hash[3] = (hash[3] + d) | 0;
        hash[4] = (hash[4] + e) | 0;
        hash[5] = (hash[5] + f) | 0;
        hash[6] = (hash[6] + g) | 0;
        hash[7] = (hash[7] + h) | 0;
    }
    
    let result = '';
    for (i = 0; i < 8; i++) {
        let word = hash[i];
        if (word < 0) word += maxWord;
        let hex = word.toString(16);
        while (hex.length < 8) hex = '0' + hex;
        result += hex;
    }
    return result;
}

function hmacSha256_pure(message, key) {
    let keyBytes = [];
    if (key.length > 64) {
        const hashHex = sha256_pure(key);
        for (let i = 0; i < hashHex.length; i += 2) {
            keyBytes.push(parseInt(hashHex.substring(i, i + 2), 16));
        }
    } else {
        for (let i = 0; i < key.length; i++) {
            keyBytes.push(key.charCodeAt(i));
        }
    }
    
    while (keyBytes.length < 64) {
        keyBytes.push(0);
    }
    
    let ipad = [];
    let opad = [];
    for (let i = 0; i < 64; i++) {
        ipad.push(keyBytes[i] ^ 0x36);
        opad.push(keyBytes[i] ^ 0x5c);
    }
    
    const ipadStr = String.fromCharCode.apply(null, ipad);
    const opadStr = String.fromCharCode.apply(null, opad);
    
    const innerHash = sha256_pure(ipadStr + message);
    let innerHashBytes = [];
    for (let i = 0; i < innerHash.length; i += 2) {
        innerHashBytes.push(String.fromCharCode(parseInt(innerHash.substring(i, i + 2), 16)));
    }
    const innerHashStr = innerHashBytes.join('');
    
    return sha256_pure(opadStr + innerHashStr);
}

function computeHMAC(message, key) {
    if (typeof require !== 'undefined') {
        try {
            const nodeCrypto = require('crypto');
            if (nodeCrypto && typeof nodeCrypto.createHmac === 'function') {
                const hmac = nodeCrypto.createHmac('sha256', key);
                hmac.update(message);
                return hmac.digest('hex');
            }
        } catch (e) {
            // Ignore Node crypto loading error and fall back
        }
    }
    return hmacSha256_pure(message, key);
}

class CambusPassVerificationSystem {
    constructor() {
        // Registry to store daily boardings grouped dynamically by bus number.
        // Schema: Map<busNumber, Array<{ studentId, studentName, routeName, timestamp }>>
        this.dailyBoardingRegistry = new Map();
    }

    /**
     * Decentralized routine to scan and verify a boarding pass offline.
     * Enforces signature validation, 4-hour anti-loop locks, and schedule cutoff limits.
     * Supports both plain text format and Base64 JSON format.
     */
     processScanInput(scannedRawString, trackingBusNumber, adminConfigs, dbReferenceLogs, secretKey, allowedDomains) {
        if (!scannedRawString || !secretKey) {
            return { verified: false, reason: 'Invalid scan string or server configuration.' };
        }

        const lastDotIndex = scannedRawString.lastIndexOf('.');
        if (lastDotIndex === -1) {
            return { verified: false, reason: 'Security verification failed: Malformed token payload.' };
        }

        const payloadStrOrB64 = scannedRawString.substring(0, lastDotIndex);
        const signature = scannedRawString.substring(lastDotIndex + 1);

        // Rule A: Universal Scanner Shield (Verify Signature)
        const calculatedSignature = computeHMAC(payloadStrOrB64, secretKey);

        if (signature !== calculatedSignature) {
            return { verified: false, reason: 'Security verification failed: Tampered or forged signature.' };
        }

        // Decode / parse payload
        let studentId, studentName, routeName, instituteId = '';
        if (payloadStrOrB64.startsWith('Cambus Pass - Verified Student:')) {
            // Plain text format - regex supports optional | Institute: <domain>
            const match = payloadStrOrB64.match(/Verified Student:\s*(.*?)\s*\|\s*Route:\s*(.*?)\s*\|\s*ID:\s*([^|]*?)(?:\s*\|\s*Institute:\s*(.*))?$/);
            if (match) {
                studentName = match[1].trim();
                routeName = match[2].trim();
                studentId = match[3].trim();
                if (match[4]) {
                    instituteId = match[4].trim();
                }
            } else {
                return { verified: false, reason: 'Security verification failed: Plain text payload is malformed.' };
            }
        } else {
            // Base64 JSON format
            try {
                const decodedStr = decodeBase64(payloadStrOrB64);
                const payload = JSON.parse(decodedStr);
                studentId = (payload.studentId || '').toString();
                studentName = payload.studentName || payload.name;
                routeName = payload.routeName || payload.busRoute;
                instituteId = payload.instituteId || payload.institute || '';
            } catch (e) {
                return { verified: false, reason: 'Security verification failed: Base64 JSON payload is unreadable.' };
            }
        }

        if (!studentId || !studentName || !routeName) {
            return { verified: false, reason: 'Security verification failed: Missing payload properties.' };
        }

        // Rule A.1: Multi-Tenant Domain Verification Check
        let passDomain = instituteId ? instituteId.toLowerCase().trim() : '';
        if (!passDomain) {
            // Fallback: parse domain from student's email/id
            const email = studentId.toLowerCase().trim();
            if (email.includes('@')) {
                passDomain = email.split('@')[1];
            }
        }

        if (allowedDomains && allowedDomains.length > 0) {
            if (!passDomain || !allowedDomains.includes(passDomain)) {
                return {
                    verified: false,
                    reason: `Scan rejected. Pass domain (${passDomain || 'unknown'}) is not authorized for this institute.`
                };
            }
        }

        // Rule B: 4-Hour Anti-Loop Lock (Prevent ticket sharing)
        const now = Date.now();
        const lastScanTime = dbReferenceLogs[studentId];
        if (lastScanTime !== undefined) {
            const diffMs = now - lastScanTime;
            const fourHoursMs = 4 * 60 * 60 * 1000;
            if (diffMs < fourHoursMs) {
                const remainingSecs = Math.ceil((fourHoursMs - diffMs) / 1000);
                return {
                    verified: false,
                    reason: '4-Hour Anti-Loop Lock active to prevent pass sharing.',
                    cooldownSeconds: remainingSecs
                };
            }
        }

        // Rule C: Admin Grace Cut-off Time Check
        if (adminConfigs && adminConfigs.lateCutOffTime) {
            const isLate = this._checkLateCutoff(adminConfigs.lateCutOffTime, now);
            const overrideAllowed = adminConfigs.lateBoardingOverride === true;

            if (isLate && !overrideAllowed) {
                return {
                    verified: false,
                    reason: `Scan rejected. Boarding cutoff time (${adminConfigs.lateCutOffTime}) has passed.`
                };
            }
        }

        // Update Scan logs (Cache Layer)
        dbReferenceLogs[studentId] = now;

        // Save entry log in daily boarding registry grouped by Bus number
        if (!this.dailyBoardingRegistry.has(trackingBusNumber)) {
            this.dailyBoardingRegistry.set(trackingBusNumber, []);
        }
        this.dailyBoardingRegistry.get(trackingBusNumber).push({
            studentId,
            studentName,
            routeName,
            timestamp: now
        });

        // UI Payload Mapping
        return {
            verified: true,
            payload: {
                name: studentName,
                routeName: routeName,
                verifiedToken: signature.substring(0, 16) + '...'
            }
        };
    }

    /**
     * Aggregates and returns daily metrics for a specific bus.
     */
    getAdminBusMetrics(busNumber) {
        const boardings = this.dailyBoardingRegistry.get(busNumber) || [];
        
        return {
            totalHeadcountCount: boardings.length,
            boardingList: boardings.map(b => ({
                studentName: b.studentName,
                routeName: b.routeName
            }))
        };
    }

    /**
     * Helper logic to determine if current scan timestamp falls after the schedule cutoff time.
     * Supports formats like "08:45 AM" or "13:30".
     */
    _checkLateCutoff(cutoffStr, currentTimestamp) {
        const match = cutoffStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return false;

        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const ampm = match[3];

        if (ampm) {
            const upperAmpm = ampm.toUpperCase();
            if (upperAmpm === 'PM' && hours < 12) hours += 12;
            if (upperAmpm === 'AM' && hours === 12) hours = 0;
        }

        const scanTime = new Date(currentTimestamp);
        const cutoffTime = new Date(currentTimestamp);
        cutoffTime.setHours(hours, minutes, 0, 0);

        return scanTime.getTime() > cutoffTime.getTime();
    }
}

// Export module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CambusPassVerificationSystem };
} else {
    window.CambusPassVerificationSystem = CambusPassVerificationSystem;
    window.hmacSha256_pure = hmacSha256_pure;
    window.computeHMAC = computeHMAC;
}
