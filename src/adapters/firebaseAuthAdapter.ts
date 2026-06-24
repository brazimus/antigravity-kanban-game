import type { AuthAdapter, AdminProfile, PasskeyInfo } from './authAdapter';
import { 
  signInWithCustomToken, 
  signOut as fbSignOut, 
  sendSignInLinkToEmail, 
  signInWithEmailLink as fbSignInWithEmailLink,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword,
  getAuth
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Note: We initialize Firebase Cloud Functions lazily within class methods to avoid
// circular dependency issues on module load.


// Helper base64url converters for browser-to-backend WebAuthn serialization
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Extracts details from a Firebase Functions HttpsError and formats them into a descriptive standard Error.
 */
export function handleCallableError(err: any, actionName: string): Error {
  console.error(`Firebase function during "${actionName}" failed:`, err);
  if (err && typeof err === 'object') {
    const code = err.code || 'unknown';
    const message = err.message || 'No error message provided';
    
    // Check if the server passed a structured details object
    let detailsStr = '';
    if (err.details) {
      if (typeof err.details === 'string') {
        detailsStr = ` (Details: ${err.details})`;
      } else {
        try {
          detailsStr = ` (Details: ${JSON.stringify(err.details)})`;
        } catch {
          // ignore serialization errors
        }
      }
    }
    
    const displayMsg = `[${code}] Failed during ${actionName}: ${message}${detailsStr}`;
    const formattedError = new Error(displayMsg);
    // Attach details for programmatic inspectability
    (formattedError as any).code = code;
    (formattedError as any).details = err.details;
    (formattedError as any).originalError = err;
    return formattedError;
  }
  
  return new Error(`Failed during ${actionName}: ${String(err)}`);
}

export class FirebaseAuthAdapter implements AuthAdapter {
  private get auth() {
    return getAuth();
  }

  private get db() {
    return getFirestore();
  }

  public async getCurrentUser(): Promise<AdminProfile | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    return this.fetchAdminProfile(user.uid, user.email || '');
  }

  public onAuthStateChanged(callback: (user: AdminProfile | null) => void): () => void {
    return fbOnAuthStateChanged(this.auth, async (fbUser) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      try {
        const profile = await this.fetchAdminProfile(fbUser.uid, fbUser.email || '');
        callback(profile);
      } catch (err) {
        console.error('Error fetching auth state admin profile:', err);
        callback(null);
      }
    });
  }

  private async fetchAdminProfile(uid: string, email: string): Promise<AdminProfile> {
    try {
      const userDocRef = doc(this.db, 'users', uid);
      const userSnapshot = await getDoc(userDocRef);
      
      if (!userSnapshot.exists()) {
        // Legacy user has no profile document and no passkeys registered yet
        return {
          uid,
          email,
          roles: { admin: true, superAdmin: false },
          passkeys: []
        };
      }

      const data = userSnapshot.data();
      const roles = data.roles || { admin: true, superAdmin: false };

      // Fetch credentials list
      const credentialsRef = collection(this.db, 'users', uid, 'credentials');
      const credentialsSnapshot = await getDocs(credentialsRef);
      const passkeys: PasskeyInfo[] = credentialsSnapshot.docs.map(d => {
        const c = d.data();
        return {
          id: d.id,
          label: c.label || 'Unnamed Key',
          createdAt: c.createdAt || new Date().toISOString()
        };
      });

      return {
        uid,
        email,
        roles,
        passkeys
      };
    } catch (err: unknown) {
      console.warn("Failed to fetch admin profile from Firestore, falling back to legacy default:", err);
      return {
        uid,
        email,
        roles: { admin: true, superAdmin: false },
        passkeys: []
      };
    }
  }

  public async sendEmailSignInLink(email: string): Promise<void> {
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true
    };
    await sendSignInLinkToEmail(this.auth, email, actionCodeSettings);
    // Store email locally for sign-in completion
    window.localStorage.setItem('emailForSignIn', email);
  }

  public async signInWithEmailLink(email: string, link: string): Promise<AdminProfile> {
    const credential = await fbSignInWithEmailLink(this.auth, email, link);
    window.localStorage.removeItem('emailForSignIn');
    return this.fetchAdminProfile(credential.user.uid, email);
  }

  public async signInWithPasskey(email: string): Promise<AdminProfile> {
    try {
      // 1. Get Authentication Options from backend
      const getOptionsFn = httpsCallable<{ email: string }, { options: any }>(getFunctions(), 'generateAuthenticationOptions');
      let options;
      try {
        const res = await getOptionsFn({ email });
        options = res.data.options;
      } catch (err) {
        throw handleCallableError(err, 'getting passkey authentication options');
      }

      // 2. Decode challenge and allowCredentials ids to ArrayBuffers
      try {
        options.challenge = base64UrlToBuffer(options.challenge);
        if (options.allowCredentials) {
          options.allowCredentials = options.allowCredentials.map((cred: any) => ({
            ...cred,
            id: base64UrlToBuffer(cred.id)
          }));
        }
      } catch (err) {
        throw new Error(`Failed to process passkey authentication options: ${err instanceof Error ? err.message : err}`);
      }

      // 3. Trigger Browser WebAuthn API
      let assertion;
      try {
        assertion = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential;
        if (!assertion) {
          throw new Error('Authentication cancelled or failed.');
        }
      } catch (err) {
        throw new Error(`Device passkey authentication failed: ${err instanceof Error ? err.message : err}`);
      }

      // 4. Encode assertion buffers back to Base64URL
      let serializedAssertion;
      try {
        const assertionResponse = assertion.response as AuthenticatorAssertionResponse;
        serializedAssertion = {
          id: assertion.id,
          rawId: bufferToBase64Url(assertion.rawId),
          type: assertion.type,
          response: {
            authenticatorData: bufferToBase64Url(assertionResponse.authenticatorData),
            clientDataJSON: bufferToBase64Url(assertionResponse.clientDataJSON),
            signature: bufferToBase64Url(assertionResponse.signature),
            userHandle: assertionResponse.userHandle ? bufferToBase64Url(assertionResponse.userHandle) : null
          }
        };
      } catch (err) {
        throw new Error(`Failed to serialize passkey credentials: ${err instanceof Error ? err.message : err}`);
      }

      // 5. Verify Authentication Response in Backend
      const verifyAuthFn = httpsCallable<
        { email: string; assertion: any }, 
        { customToken: string }
      >(getFunctions(), 'verifyAuthentication');
      let customToken;
      try {
        const res = await verifyAuthFn({ email, assertion: serializedAssertion });
        customToken = res.data.customToken;
      } catch (err) {
        throw handleCallableError(err, 'verifying passkey authentication');
      }

      // 6. Sign in to Firebase Auth using the returned token
      try {
        const credential = await signInWithCustomToken(this.auth, customToken);
        return this.fetchAdminProfile(credential.user.uid, email);
      } catch (err) {
        throw new Error(`Firebase sign-in failed: ${err instanceof Error ? err.message : err}`);
      }
    } catch (err: any) {
      if (err instanceof Error) throw err;
      throw new Error(`signInWithPasskey failed: ${String(err)}`);
    }
  }

  public async registerPasskey(label: string): Promise<{ backupPassphrase: string }> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Must be authenticated to register a passkey.');

    try {
      // 1. Request registration options from backend
      const getOptionsFn = httpsCallable<{ userId: string; email: string }, { options: any }>(getFunctions(), 'generateRegistrationOptions');
      let options;
      try {
        const res = await getOptionsFn({ userId: user.uid, email: user.email || '' });
        options = res.data.options;
      } catch (err) {
        throw handleCallableError(err, 'getting passkey registration options');
      }

      // 2. Decode challenge and user.id to ArrayBuffers
      try {
        options.challenge = base64UrlToBuffer(options.challenge);
        options.user.id = base64UrlToBuffer(options.user.id);
        if (options.excludeCredentials) {
          options.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
            ...cred,
            id: base64UrlToBuffer(cred.id)
          }));
        }
      } catch (err) {
        throw new Error(`Failed to process passkey registration options: ${err instanceof Error ? err.message : err}`);
      }

      // 3. Trigger browser WebAuthn registration prompt
      let credential;
      try {
        credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
        if (!credential) {
          throw new Error('Registration cancelled or failed.');
        }
      } catch (err) {
        throw new Error(`Device passkey registration failed: ${err instanceof Error ? err.message : err}`);
      }

      // 4. Encode credential buffers back to Base64URL
      let serializedCredential;
      try {
        const attestationResponse = credential.response as AuthenticatorAttestationResponse;
        serializedCredential = {
          id: credential.id,
          rawId: bufferToBase64Url(credential.rawId),
          type: credential.type,
          response: {
            attestationObject: bufferToBase64Url(attestationResponse.attestationObject),
            clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
            transports: attestationResponse.getTransports ? attestationResponse.getTransports() : []
          }
        };
      } catch (err) {
        throw new Error(`Failed to serialize passkey credentials: ${err instanceof Error ? err.message : err}`);
      }

      // 5. Verify registration in backend
      const verifyRegistrationFn = httpsCallable<
        { userId: string; email: string; label: string; credential: any }, 
        { backupPassphrase: string }
      >(getFunctions(), 'verifyRegistration');
      let backupPassphrase;
      try {
        const res = await verifyRegistrationFn({ 
          userId: user.uid, 
          email: user.email || '', 
          label, 
          credential: serializedCredential 
        });
        backupPassphrase = res.data.backupPassphrase;
      } catch (err) {
        throw handleCallableError(err, 'verifying passkey registration');
      }

      return { backupPassphrase };
    } catch (err: any) {
      if (err instanceof Error) throw err;
      throw new Error(`registerPasskey failed: ${String(err)}`);
    }
  }

  public async signInWithBackupPassphrase(email: string, passphrase: string): Promise<AdminProfile> {
    try {
      const verifyBackupFn = httpsCallable<
        { email: string; passphrase: string }, 
        { customToken: string }
      >(getFunctions(), 'verifyBackupPassphrase');
      let customToken;
      try {
        const res = await verifyBackupFn({ email, passphrase });
        customToken = res.data.customToken;
      } catch (err) {
        throw handleCallableError(err, 'verifying backup recovery passphrase');
      }

      const credential = await signInWithCustomToken(this.auth, customToken);
      return this.fetchAdminProfile(credential.user.uid, email);
    } catch (err: unknown) {
      console.warn('Backup passphrase verification failed, attempting standard email/password login as fallback:', err);
      try {
        // Fallback to standard email/password authentication (useful for pre-passkey legacy accounts)
        const credential = await signInWithEmailAndPassword(this.auth, email, passphrase);
        return this.fetchAdminProfile(credential.user.uid, email);
      } catch (fallbackErr: unknown) {
        console.error('Email/password fallback also failed:', fallbackErr);
        // Throw a user-friendly error
        const originalMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        const mainMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`Authentication failed. Recovery failed: ${mainMsg}. Password login fallback failed: ${originalMsg}`);
      }
    }
  }

  public async deletePasskey(credentialId: string): Promise<void> {
    try {
      const deleteCredentialFn = httpsCallable<{ credentialId: string }, void>(getFunctions(), 'deleteCredential');
      await deleteCredentialFn({ credentialId });
    } catch (err) {
      throw handleCallableError(err, 'deleting passkey');
    }
  }

  public async getPasskeys(): Promise<PasskeyInfo[]> {
    const user = this.auth.currentUser;
    if (!user) return [];
    const profile = await this.fetchAdminProfile(user.uid, user.email || '');
    return profile.passkeys;
  }

  public async signOut(): Promise<void> {
    await fbSignOut(this.auth);
  }

  public async listAllAdmins(): Promise<AdminProfile[]> {
    try {
      const listAdminsFn = httpsCallable<void, { admins: AdminProfile[] }>(getFunctions(), 'listAllAdmins');
      const { data: { admins } } = await listAdminsFn();
      return admins;
    } catch (err) {
      throw handleCallableError(err, 'listing administrators');
    }
  }

  public async revokeAdminPasskeys(uid: string): Promise<void> {
    try {
      const revokeFn = httpsCallable<{ uid: string }, void>(getFunctions(), 'revokeUserCredentials');
      await revokeFn({ uid });
    } catch (err) {
      throw handleCallableError(err, 'revoking user credentials');
    }
  }
}
