// Shared standard Web Crypto protocol. No platform credentials or reminder data.
export const REMINDER_ENDPOINT = 'https://projectlocal.app/internal/reminders';
export const TIMESTAMP_HEADER = 'x-project-local-timestamp';
export const SIGNATURE_HEADER = 'x-project-local-signature';
export const SIGNATURE_WINDOW_MS = 120_000;

export function signatureInput(timestamp, method = 'POST', hostname = 'projectlocal.app', pathname = '/internal/reminders') {
  return `v1\n${timestamp}\n${method}\n${hostname}\n${pathname}`;
}
async function signingKey(secret, usages) {
  if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret)) throw new Error('Scheduler signing configuration unavailable');
  const bytes = Uint8Array.from(secret.match(/../g), b => parseInt(b, 16));
  return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}
export async function signSchedulerRequest(secret, timestamp) {
  const key = await signingKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput(timestamp)));
  return 'v1=' + Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifySchedulerRequest(request, secret, now = Date.now()) {
  const url = new URL(request.url);
  if (request.method !== 'POST' || url.origin !== 'https://projectlocal.app' || url.pathname !== '/internal/reminders' || url.search) return false;
  const timestamp = request.headers.get(TIMESTAMP_HEADER);
  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^v1=[0-9a-f]{64}$/.test(signature)) return false;
  if (!Number.isFinite(now) || Math.abs(now - Number(timestamp) * 1000) > SIGNATURE_WINDOW_MS) return false;
  try {
    const key = await signingKey(secret, ['verify']);
    const bytes = Uint8Array.from(signature.slice(3).match(/../g), b => parseInt(b, 16));
    return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(signatureInput(timestamp)));
  } catch { return false; }
}
