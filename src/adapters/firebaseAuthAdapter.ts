import type { AuthAdapter, AdminProfile, PasskeyInfo } from './authAdapter';
import { 
  signInWithCustomToken, 
  signOut as fbSignOut, 
  sendSignInLinkToEmail, 
  signInWithEmailLink as fbSignInWithEmailLink,
  onAuthStateChanged as fbOnAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth, db } from '../firebase';

// Initialize Firebase Cloud Functions
const functions = getFunctions(app);

// Base64URL helper utilities for browser-to-backend WebAuthn serialization
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

export class FirebaseAuthAdapter implements AuthAdapter {
  public async getCurrentUser(): Promise<AdminProfile | null> {
    const user = auth.currentUser;
    if (!user) return null;
    return this.fetchAdminProfile(user.uid, user.email || '');
  }

  public onAuthStateChanged(callback: (user: AdminProfile | null) => void): () => void {
    return fbOnAuthStateChanged(auth, async (fbUser) => {
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
    const userDocRef = doc(db, 'users', uid);
    const userSnapshot = await getDoc(userDocRef);
    
    let roles = { admin: true, superAdmin: false };
    let passkeys: PasskeyInfo[] = [];

    if (userSnapshot.exists()) {
      const data = userSnapshot.data();
      roles = data.roles || roles;
    }

    // Fetch credentials list
    const credentialsRef = collection(db, 'users', uid, 'credentials');
    const credentialsSnapshot = await getDocs(credentialsRef);
    passkeys = credentialsSnapshot.docs.map(d => {
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
  }

  public async sendEmailSignInLink(email: string): Promise<void> {
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Store email locally for sign-in completion
    window.localStorage.setItem('emailForSignIn', email);
  }

  public async signInWithEmailLink(email: string, link: string): Promise<AdminProfile> {
    const credential = await fbSignInWithEmailLink(auth, email, link);
    window.localStorage.removeItem('emailForSignIn');
    return this.fetchAdminProfile(credential.user.uid, email);
  }

  public async signInWithPasskey(email: string): Promise<AdminProfile> {
    // 1. Get Authentication Options from backend
    const getOptionsFn = httpsCallable<{ email: string }, { options: any }>(functions, 'generateAuthenticationOptions');
    const { data: { options } } = await getOptionsFn({ email });

    // 2. Decode challenge and allowCredentials ids to ArrayBuffers
    options.challenge = base64UrlToBuffer(options.challenge);
    if (options.allowCredentials) {
      options.allowCredentials = options.allowCredentials.map((cred: any) => ({
        ...cred,
        id: base64UrlToBuffer(cred.id)
      }));
    }

    // 3. Trigger Browser WebAuthn API
    const assertion = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential;
    if (!assertion) {
      throw new Error('Authentication cancelled or failed.');
    }

    // 4. Encode assertion buffers back to Base64URL
    const assertionResponse = assertion.response as AuthenticatorAssertionResponse;
    const serializedAssertion = {
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

    // 5. Verify Authentication Response in Backend
    const verifyAuthFn = httpsCallable<
      { email: string; assertion: any }, 
      { customToken: string }
    >(functions, 'verifyAuthentication');
    const { data: { customToken } } = await verifyAuthFn({ email, assertion: serializedAssertion });

    // 6. Sign in to Firebase Auth using the returned token
    const credential = await signInWithCustomToken(auth, customToken);
    return this.fetchAdminProfile(credential.user.uid, email);
  }

  public async registerPasskey(label: string): Promise<{ backupPassphrase: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Must be authenticated to register a passkey.');

    // 1. Request registration options from backend
    const getOptionsFn = httpsCallable<{ userId: string; email: string }, { options: any }>(functions, 'generateRegistrationOptions');
    const { data: { options } } = await getOptionsFn({ userId: user.uid, email: user.email || '' });

    // 2. Decode challenge and user.id to ArrayBuffers
    options.challenge = base64UrlToBuffer(options.challenge);
    options.user.id = base64UrlToBuffer(options.user.id);
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map((cred: any) => ({
        ...cred,
        id: base64UrlToBuffer(cred.id)
      }));
    }

    // 3. Trigger browser WebAuthn registration prompt
    const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
    if (!credential) {
      throw new Error('Registration cancelled or failed.');
    }

    // 4. Encode credential buffers back to Base64URL
    const attestationResponse = credential.response as AuthenticatorAttestationResponse;
    const serializedCredential = {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64Url(attestationResponse.attestationObject),
        clientDataJSON: bufferToBase64Url(attestationResponse.clientDataJSON),
        transports: attestationResponse.getTransports ? attestationResponse.getTransports() : []
      }
    };

    // 5. Verify registration in backend
    const verifyRegistrationFn = httpsCallable<
      { userId: string; email: string; label: string; credential: any }, 
      { backupPassphrase: string }
    >(functions, 'verifyRegistration');
    const { data: { backupPassphrase } } = await verifyRegistrationFn({ 
      userId: user.uid, 
      email: user.email || '', 
      label, 
      credential: serializedCredential 
    });

    return { backupPassphrase };
  }

  public async signInWithBackupPassphrase(email: string, passphrase: string): Promise<AdminProfile> {
    const verifyBackupFn = httpsCallable<
      { email: string; passphrase: string }, 
      { customToken: string }
    >(functions, 'verifyBackupPassphrase');
    const { data: { customToken } } = await verifyBackupFn({ email, passphrase });

    const credential = await signInWithCustomToken(auth, customToken);
    return this.fetchAdminProfile(credential.user.uid, email);
  }

  public async deletePasskey(credentialId: string): Promise<void> {
    const deleteCredentialFn = httpsCallable<{ credentialId: string }, void>(functions, 'deleteCredential');
    await deleteCredentialFn({ credentialId });
  }

  public async getPasskeys(): Promise<PasskeyInfo[]> {
    const user = auth.currentUser;
    if (!user) return [];
    const profile = await this.fetchAdminProfile(user.uid, user.email || '');
    return profile.passkeys;
  }

  public async signOut(): Promise<void> {
    await fbSignOut(auth);
  }

  public async listAllAdmins(): Promise<AdminProfile[]> {
    const listAdminsFn = httpsCallable<void, { admins: AdminProfile[] }>(functions, 'listAllAdmins');
    const { data: { admins } } = await listAdminsFn();
    return admins;
  }

  public async revokeAdminPasskeys(uid: string): Promise<void> {
    const revokeFn = httpsCallable<{ uid: string }, void>(functions, 'revokeUserCredentials');
    await revokeFn({ uid });
  }
}
