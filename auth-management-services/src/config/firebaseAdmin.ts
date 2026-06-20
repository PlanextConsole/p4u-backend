import * as admin from 'firebase-admin';

/**
 * Lazily-initialized Firebase Admin SDK singleton.
 *
 * Used solely to verify Firebase Phone Auth ID tokens issued to the customer/
 * vendor web apps. We never use this instance for FCM, Realtime DB, etc. —
 * those would justify a dedicated module.
 *
 * Required env (see .env / .env.example):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY    (PEM, with literal "\n" escapes — typical for dotenv)
 *
 * If any are missing the helper logs a single warning and `verifyPhoneIdToken`
 * throws — auth-service still boots so other endpoints (admin login, refresh,
 * etc.) keep working in environments where Firebase isn't configured.
 */

let initAttempted = false;
let initError: string | null = null;

function ensureInitialized(): void {
  if (initAttempted) return;
  initAttempted = true;

  if (admin.apps.length > 0) return;

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';

  if (!projectId || !clientEmail || !rawPrivateKey) {
    initError =
      'Firebase Admin not initialized: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env';
    console.warn('[auth-service] ' + initError);
    return;
  }

  // dotenv preserves the literal `\n` in double-quoted .env values; turn them
  // back into real newlines so the PEM parser is happy.
  const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

  try {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    console.log(`[auth-service] Firebase Admin initialized (project=${projectId})`);
  } catch (err: any) {
    initError = `Firebase Admin init failed: ${err?.message ?? err}`;
    console.error('[auth-service] ' + initError);
  }
}

export interface FirebasePhoneIdTokenClaims {
  /** Firebase user id (uid) of the verified phone identity. */
  uid: string;
  /** E.164 phone number Firebase verified, e.g. "+919876543210". */
  phoneNumber: string;
  /** Issued-at epoch seconds. */
  iat: number;
  /** Expiry epoch seconds. */
  exp: number;
}

/**
 * Verifies a Firebase ID token from the browser SDK after a successful
 * `signInWithPhoneNumber` confirmation. Throws on invalid/expired tokens or
 * when no phone number claim is present.
 */
export async function verifyPhoneIdToken(idToken: string): Promise<FirebasePhoneIdTokenClaims> {
  ensureInitialized();
  if (initError) throw new Error(initError);
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token is required');
  }

  const decoded = await admin.auth().verifyIdToken(idToken, false);
  const phone = String((decoded as any).phone_number || '').trim();
  if (!phone) {
    throw new Error('Firebase token does not contain a verified phone number');
  }

  return {
    uid: decoded.uid,
    phoneNumber: phone,
    iat: Number(decoded.iat),
    exp: Number(decoded.exp),
  };
}
