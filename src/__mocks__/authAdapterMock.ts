import type { AuthAdapter, AdminProfile, PasskeyInfo } from '../adapters/authAdapter';

export class AuthAdapterMock implements AuthAdapter {
  private users: Record<string, AdminProfile> = {};
  private backupHashes: Record<string, string> = {}; // uid -> hash
  private currentUser: AdminProfile | null = null;
  private listeners: ((user: AdminProfile | null) => void)[] = [];

  constructor() {
    this.reset();
  }

  public reset() {
    this.users = {};
    this.backupHashes = {};
    this.currentUser = null;
    this.listeners = [];
  }

  // Helper for tests to seed users
  public seedUser(user: AdminProfile, backupPassphrase?: string) {
    this.users[user.uid] = { ...user };
    if (backupPassphrase) {
      this.backupHashes[user.uid] = `hash-${backupPassphrase}`;
    }
  }

  public setCurrentUser(user: AdminProfile | null) {
    this.currentUser = user;
    this.notify();
  }

  private notify() {
    this.listeners.forEach(cb => cb(this.currentUser));
  }

  public async getCurrentUser(): Promise<AdminProfile | null> {
    return this.currentUser;
  }

  public onAuthStateChanged(callback: (user: AdminProfile | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentUser);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public async sendEmailSignInLink(_email: string): Promise<void> {
    // Mock sending email link
  }

  public async signInWithEmailLink(email: string, _link: string): Promise<AdminProfile> {
    let user = Object.values(this.users).find(u => u.email === email);
    if (!user) {
      user = {
        uid: `user-${Date.now()}`,
        email,
        roles: { admin: true, superAdmin: email.toLowerCase() === 'admin@example.com' },
        passkeys: []
      };
      this.users[user.uid] = user;
    }
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async signInWithPasskey(email: string): Promise<AdminProfile> {
    const user = Object.values(this.users).find(u => u.email === email);
    if (!user || user.passkeys.length === 0) {
      throw new Error('No passkey registered for this email.');
    }
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async registerPasskey(label: string): Promise<{ backupPassphrase: string }> {
    if (!this.currentUser) {
      throw new Error('Must be authenticated to register a passkey.');
    }
    const newKey: PasskeyInfo = {
      id: `key-${Date.now()}`,
      label,
      createdAt: new Date().toISOString()
    };
    this.currentUser.passkeys.push(newKey);
    this.users[this.currentUser.uid] = { ...this.currentUser };

    const backupPassphrase = 'correct-horse-battery-staple';
    this.backupHashes[this.currentUser.uid] = `hash-${backupPassphrase}`;

    this.notify();
    return { backupPassphrase };
  }

  public async signInWithBackupPassphrase(email: string, passphrase: string): Promise<AdminProfile> {
    const user = Object.values(this.users).find(u => u.email === email);
    if (!user) {
      throw new Error('User not found.');
    }
    const expectedHash = this.backupHashes[user.uid];
    if (!expectedHash || expectedHash !== `hash-${passphrase}`) {
      throw new Error('Invalid recovery passphrase.');
    }
    this.currentUser = user;
    this.notify();
    return user;
  }

  public async deletePasskey(credentialId: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('Must be authenticated.');
    }
    this.currentUser.passkeys = this.currentUser.passkeys.filter(k => k.id !== credentialId);
    this.users[this.currentUser.uid] = { ...this.currentUser };
    this.notify();
  }

  public async getPasskeys(): Promise<PasskeyInfo[]> {
    if (!this.currentUser) {
      return [];
    }
    return this.currentUser.passkeys;
  }

  public async signOut(): Promise<void> {
    this.currentUser = null;
    this.notify();
  }

  public async listAllAdmins(): Promise<AdminProfile[]> {
    if (!this.currentUser || !this.currentUser.roles.superAdmin) {
      throw new Error('Unauthorized.');
    }
    return Object.values(this.users);
  }

  public async revokeAdminPasskeys(uid: string): Promise<void> {
    if (!this.currentUser || !this.currentUser.roles.superAdmin) {
      throw new Error('Unauthorized.');
    }
    const target = this.users[uid];
    if (target) {
      target.passkeys = [];
      delete this.backupHashes[uid];
      this.users[uid] = target;
      if (this.currentUser.uid === uid) {
        this.currentUser.passkeys = [];
        this.notify();
      }
    }
  }
}
