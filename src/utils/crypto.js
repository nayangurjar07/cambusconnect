// src/utils/crypto.js

const TIME_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

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
 */
export async function generateTotpPayload(email, secret) {
  const timeIndex = Math.floor(Date.now() / TIME_WINDOW_MS);
  const hash = await generateHash(secret, timeIndex);
  
  return JSON.stringify({
    email,
    totp: hash,
    t: timeIndex
  });
}

/**
 * Verifies a scanned TOTP payload against the student's secret in the database.
 * Allows a 1-window grace period (previous 15 mins) to account for clock skew/edge scanning.
 */
export async function verifyTotp(scannedTotp, secret) {
  if (!scannedTotp || !secret || typeof secret !== 'string' || secret.trim().length === 0) {
    return false;
  }

  const currentTimeIndex = Math.floor(Date.now() / TIME_WINDOW_MS);
  
  // Check current time window
  const expectedHashCurrent = await generateHash(secret, currentTimeIndex);
  if (scannedTotp === expectedHashCurrent) return true;
  
  // Check previous time window (grace period for edge cases)
  const expectedHashPrevious = await generateHash(secret, currentTimeIndex - 1);
  if (scannedTotp === expectedHashPrevious) return true;
  
  return false;
}
