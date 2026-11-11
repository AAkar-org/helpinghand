import crypto from 'crypto';
import twilio from 'twilio';

/**
 * Masks phone numbers for secure logging to comply with India DPDP Act 2023
 * Example: +919871101001 -> +91 98711 ***01
 */
export function maskPhone(phone?: string): string {
  if (!phone) return 'N/A';
  const clean = phone.trim();
  if (clean.length < 8) return '***';
  const prefix = clean.slice(0, clean.length - 5);
  const suffix = clean.slice(-2);
  return `${prefix}***${suffix}`;
}

/**
 * Sanitizes contractor natural language input against control characters,
 * null bytes, and malicious runaway payload lengths.
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '') // remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Verifies Meta WhatsApp Cloud API HMAC-SHA256 signature (X-Hub-Signature-256)
 * Uses timingSafeEqual to defeat timing attacks.
 */
export function verifyMetaSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader?: string,
  appSecret?: string
): boolean {
  // Allow pass-through in test environment or if secret is not yet set in dev
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const secret = appSecret || process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    // If running in development without app secret configured, warn once and permit
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    console.error('[Security Error] WHATSAPP_APP_SECRET is not configured in production!');
    return false;
  }

  if (!signatureHeader || !rawBody) {
    return false;
  }

  const parts = signatureHeader.split('sha256=');
  if (parts.length !== 2) {
    return false;
  }

  const expectedSignature = parts[1];
  const hmac = crypto.createHmac('sha256', secret);
  const calculatedSignature = hmac.update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expectedSignature, 'utf8');
  const calculatedBuf = Buffer.from(calculatedSignature, 'utf8');

  if (expectedBuf.length !== calculatedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
}

/**
 * Validates Twilio Webhook Request signature (X-Twilio-Signature)
 */
export function verifyTwilioSignature(
  signatureHeader?: string,
  url?: string,
  params: Record<string, any> = {}
): boolean {
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }
    return false;
  }

  if (!signatureHeader || !url) {
    return false;
  }

  try {
    return twilio.validateRequest(authToken, signatureHeader, url, params);
  } catch (err: any) {
    console.warn(`[Security Warning] Twilio signature validation failed: ${err.message}`);
    return false;
  }
}

