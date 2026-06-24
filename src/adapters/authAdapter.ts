export interface PasskeyInfo {
  id: string;
  label: string;
  createdAt: string; // ISO String
}

export interface AdminProfile {
  uid: string;
  email: string;
  roles: {
    admin: boolean;
    superAdmin: boolean;
  };
  passkeys: PasskeyInfo[];
}

export interface AuthAdapter {
  getCurrentUser(): Promise<AdminProfile | null>;
  onAuthStateChanged(callback: (user: AdminProfile | null) => void): () => void;
  sendEmailSignInLink(email: string): Promise<void>;
  signInWithEmailLink(email: string, link: string): Promise<AdminProfile>;
  signInWithPasskey(email: string): Promise<AdminProfile>;
  registerPasskey(label: string): Promise<{ backupPassphrase: string }>;
  signInWithBackupPassphrase(email: string, passphrase: string): Promise<AdminProfile>;
  deletePasskey(credentialId: string): Promise<void>;
  getPasskeys(): Promise<PasskeyInfo[]>;
  signOut(): Promise<void>;
  
  // Super-Admin only functions
  listAllAdmins(): Promise<AdminProfile[]>;
  revokeAdminPasskeys(uid: string): Promise<void>;
}
