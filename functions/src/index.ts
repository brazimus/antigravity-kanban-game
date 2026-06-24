import { onCall, HttpsError } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';
import { FirestoreDbAdapter } from './adapters/firestoreDbAdapter.js';
import { 
  generateRegistrationOptions as genRegOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions as genAuthOptions, 
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import * as crypto from 'crypto';

// Initialize Firebase Admin SDK
admin.initializeApp();

const dbAdapter = new FirestoreDbAdapter();

const rpName = 'Antigravity Kanban Classroom';

function getRpId(request: any): string {
  const origin = request.rawRequest?.headers?.origin || '';
  return origin.includes('localhost') ? 'localhost' : 'brazimus.github.io';
}

const allowedOrigins = [
  'https://brazimus.github.io',
  'http://localhost:5173',
  'http://localhost:3000'
];

// Helper base64url converters for node runtime
function bufferToBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

// Challenge Handshake helpers
async function saveChallenge(id: string, challenge: string) {
  await admin.firestore().collection('challenges').doc(id).set({
    challenge,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function getChallenge(id: string): Promise<string | null> {
  const docRef = admin.firestore().collection('challenges').doc(id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) return null;
  const challenge = snapshot.data()!.challenge;
  await docRef.delete(); // Prevent replay
  return challenge;
}

// xkcd Word list for backup passphrases
const wordList = [
  'correct', 'horse', 'battery', 'staple', 'apple', 'banana', 'orange', 'grape',
  'stone', 'river', 'mountain', 'valley', 'forest', 'desert', 'ocean', 'island',
  'house', 'chair', 'table', 'window', 'mirror', 'candle', 'pocket', 'bottle',
  'guitar', 'violin', 'trumpet', 'flute', 'piano', 'drum', 'whistle', 'bell',
  'yellow', 'purple', 'silver', 'bronze', 'copper', 'golden', 'shadow',
  'winter', 'summer', 'spring', 'autumn', 'morning', 'evening', 'midnight', 'sunset',
  'rocket', 'planet', 'comet', 'galaxy', 'cosmos', 'gravity', 'nebula', 'quasar'
];

function generateXkcdPassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = crypto.randomInt(0, wordList.length);
    words.push(wordList[idx]);
  }
  return words.join('-');
}

function hashPassphrase(passphrase: string): string {
  const salt = 'antigravity-kanban-salt'; // standard static salt for recovery key comparison
  const hash = crypto.pbkdf2Sync(passphrase.toLowerCase(), salt, 1000, 32, 'sha256');
  return hash.toString('hex');
}

// Helper to check if context caller is Super-Admin
async function assertSuperAdmin(uid: string) {
  const user = await dbAdapter.getUserById(uid);
  if (!user || !user.roles.superAdmin) {
    throw new HttpsError('permission-denied', 'Only Super-Admins can perform this action.');
  }
}

// 1. Generate Registration Options
export const generateRegistrationOptions = onCall(async (request) => {
  try {
    const { userId, email } = request.data as { userId: string; email: string };
    if (!userId || !email) {
      throw new HttpsError('invalid-argument', 'Missing userId or email.');
    }

    const credentials = await dbAdapter.getCredentials(userId);

    const options = await genRegOptions({
      rpName,
      rpID: getRpId(request),
      userID: bufferToBase64Url(Buffer.from(userId)) as any,
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      excludeCredentials: credentials.map((c: any) => ({
        id: base64UrlToBuffer(c.credentialID),
        type: 'public-key'
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred'
      }
    });

    await saveChallenge(`reg-${userId}`, options.challenge);

    return { options };
  } catch (err: any) {
    console.error('Error in generateRegistrationOptions:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', `generateRegistrationOptions failed: ${err.message || err}`);
  }
});

// 2. Verify Registration
export const verifyRegistration = onCall(async (request) => {
  try {
    const { userId, email, label, credential } = request.data as {
      userId: string;
      email: string;
      label: string;
      credential: any;
    };

    if (!userId || !email || !label || !credential) {
      throw new HttpsError('invalid-argument', 'Missing parameters.');
    }

    const expectedChallenge = await getChallenge(`reg-${userId}`);
    if (!expectedChallenge) {
      throw new HttpsError('failed-precondition', 'Challenge expired or not found.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: getRpId(request)
      });
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message || 'Signature verification failed.');
    }

    const { verified, registrationInfo } = verification;
    if (!verified || !registrationInfo) {
      throw new HttpsError('invalid-argument', 'WebAuthn verification failed.');
    }

    const { credentialID, credentialPublicKey, counter } = registrationInfo;

    await dbAdapter.saveCredential(userId, {
      credentialID: bufferToBase64Url(credentialID),
      credentialPublicKey: bufferToBase64Url(credentialPublicKey),
      counter,
      transports: credential.response.transports
    });

    let user = await dbAdapter.getUserById(userId);
    let backupPassphrase = '';

    if (!user) {
      user = {
        uid: userId,
        email,
        roles: { admin: true, superAdmin: email.toLowerCase() === 'admin@example.com' }
      };
    }

    if (!user.backupPassphraseHash) {
      backupPassphrase = generateXkcdPassphrase();
      user.backupPassphraseHash = hashPassphrase(backupPassphrase);
    }

    await dbAdapter.saveUser(user);

    return { success: true, backupPassphrase };
  } catch (err: any) {
    console.error('Error in verifyRegistration:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', `verifyRegistration failed: ${err.message || err}`);
  }
});

// 3. Generate Authentication Options
export const generateAuthenticationOptions = onCall(async (request) => {
  try {
    const { email } = request.data as { email: string };
    if (!email) {
      throw new HttpsError('invalid-argument', 'Missing email.');
    }

    const user = await dbAdapter.getUserByEmail(email);
    if (!user) {
      throw new HttpsError('not-found', 'No admin found with this email.');
    }

    const credentials = await dbAdapter.getCredentials(user.uid);
    if (credentials.length === 0) {
      throw new HttpsError('failed-precondition', 'No passkeys registered for this account.');
    }

    const options = await genAuthOptions({
      rpID: getRpId(request),
      allowCredentials: credentials.map((c: any) => ({
        id: base64UrlToBuffer(c.credentialID),
        type: 'public-key',
        transports: c.transports as any
      })),
      userVerification: 'preferred'
    });

    await saveChallenge(`auth-${email.toLowerCase()}`, options.challenge);

    return { options };
  } catch (err: any) {
    console.error('Error in generateAuthenticationOptions:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', `generateAuthenticationOptions failed: ${err.message || err}`);
  }
});

// 4. Verify Authentication Signature
export const verifyAuthentication = onCall(async (request) => {
  try {
    const { email, assertion } = request.data as { email: string; assertion: any };
    if (!email || !assertion) {
      throw new HttpsError('invalid-argument', 'Missing parameters.');
    }

    const user = await dbAdapter.getUserByEmail(email);
    if (!user) {
      throw new HttpsError('not-found', 'User not found.');
    }

    const expectedChallenge = await getChallenge(`auth-${email.toLowerCase()}`);
    if (!expectedChallenge) {
      throw new HttpsError('failed-precondition', 'Challenge expired or not found.');
    }

    const cred = await dbAdapter.getCredentialById(user.uid, assertion.id);
    if (!cred) {
      throw new HttpsError('not-found', 'Credential key not found.');
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: assertion,
        expectedChallenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: getRpId(request),
        authenticator: {
          credentialID: base64UrlToBuffer(cred.credentialID),
          credentialPublicKey: base64UrlToBuffer(cred.credentialPublicKey),
          counter: cred.counter
        }
      });
    } catch (err: any) {
      throw new HttpsError('invalid-argument', err.message || 'Signature assertion failed.');
    }

    const { verified, authenticationInfo } = verification;
    if (!verified || !authenticationInfo) {
      throw new HttpsError('invalid-argument', 'Assertion verification failed.');
    }

    // Update key counter
    cred.counter = authenticationInfo.newCounter;
    await dbAdapter.saveCredential(user.uid, cred);

    // Generate Firebase custom auth token with claims
    const customToken = await admin.auth().createCustomToken(user.uid, {
      admin: true,
      superAdmin: user.roles.superAdmin
    });

    return { success: true, customToken };
  } catch (err: any) {
    console.error('Error in verifyAuthentication:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', `verifyAuthentication failed: ${err.message || err}`);
  }
});

// 5. Verify Backup Recovery Passphrase
export const verifyBackupPassphrase = onCall(async (request) => {
  try {
    const { email, passphrase } = request.data as { email: string; passphrase: string };
    if (!email || !passphrase) {
      throw new HttpsError('invalid-argument', 'Missing parameters.');
    }

    const user = await dbAdapter.getUserByEmail(email);
    if (!user) {
      throw new HttpsError('not-found', 'User not found.');
    }

    const currentHash = hashPassphrase(passphrase);
    if (!user.backupPassphraseHash || user.backupPassphraseHash !== currentHash) {
      throw new HttpsError('permission-denied', 'Invalid recovery passphrase.');
    }

    // Generate custom token for recovery sign-in
    const customToken = await admin.auth().createCustomToken(user.uid, {
      admin: true,
      superAdmin: user.roles.superAdmin
    });

    return { success: true, customToken };
  } catch (err: any) {
    console.error('Error in verifyBackupPassphrase:', err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', `verifyBackupPassphrase failed: ${err.message || err}`);
  }
});

// 6. Delete Credential
export const deleteCredential = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  const { credentialId } = request.data as { credentialId: string };
  if (!credentialId) {
    throw new HttpsError('invalid-argument', 'Missing credentialId.');
  }

  await dbAdapter.deleteCredential(request.auth.uid, credentialId);
  return { success: true };
});

// 7. Super-Admin: List All Admins
export const listAllAdmins = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  await assertSuperAdmin(request.auth.uid);

  const admins = await dbAdapter.listAllAdmins();
  // Map admins profiles to return safe data
  const resultList = await Promise.all(admins.map(async (adminUser: any) => {
    const credentials = await dbAdapter.getCredentials(adminUser.uid);
    return {
      uid: adminUser.uid,
      email: adminUser.email,
      roles: adminUser.roles,
      passkeys: credentials.map((c: any) => ({
        id: c.credentialID,
        label: 'Registered Key',
        createdAt: new Date().toISOString() // placeholder
      }))
    };
  }));

  return { admins: resultList };
});

// 8. Super-Admin: Revoke All Admin Passkeys
export const revokeUserCredentials = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }
  await assertSuperAdmin(request.auth.uid);

  const { uid } = request.data as { uid: string };
  if (!uid) {
    throw new HttpsError('invalid-argument', 'Missing uid.');
  }

  await dbAdapter.clearAllCredentials(uid);
  return { success: true };
});
