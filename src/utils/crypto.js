// src/utils/crypto.js

export const TIME_STEP_MS = 15 * 1000; // 15-second rotating TOTP window

/**
 * Generates a random cryptographic secret for a new student.
 * Uses Web Crypto API for secure randomness.
 */
export function generateQrSecret() {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a secret and a time window index using SHA-256.
 */
async function generateHash(secret, timeIndex) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${secret}:${timeIndex}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16); // Use first 16 chars for QR brevity
}

/**
 * Generates the current TOTP payload for a student.
 * Rotates every 15 seconds and includes persistent deviceSessionId for single-device binding.
 */
export async function generateTotpPayload(email, secret, deviceSessionId = null) {
  const timeIndex = Math.floor(Date.now() / TIME_STEP_MS);
  const hash = await generateHash(secret, timeIndex);
  
  const payload = {
    email,
    totp: hash,
    t: timeIndex
  };

  if (deviceSessionId) {
    payload.d = String(deviceSessionId).slice(0, 12);
  }
  
  return JSON.stringify(payload);
}

/**
 * Verifies a scanned TOTP payload against the student's secret in the database.
 * Accepts a ±1 time step window (30-second window) to accommodate device clock drift.
 */
export async function verifyTotp(scannedTotp, secret) {
  if (!scannedTotp || !secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return false;
  }

  const currentTimeIndex = Math.floor(Date.now() / TIME_STEP_MS);
  
  // Check current and adjacent steps (±1 step grace period for clock skew)
  for (let offset = -1; offset <= 1; offset++) {
    const expectedHash = await generateHash(secret, currentTimeIndex + offset);
    if (scannedTotp === expectedHash) {
      return true;
    }
  }
  
  return false;
}
