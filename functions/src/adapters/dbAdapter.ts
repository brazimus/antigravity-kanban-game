export interface SavedCredential {
  credentialID: string;
  credentialPublicKey: string; // Base64URL string representation of public key
  counter: number;
  transports?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  roles: {
    admin: boolean;
    superAdmin: boolean;
  };
  backupPassphraseHash?: string;
}

export interface DbAdapter {
  getUserByEmail(email: string): Promise<UserProfile | null>;
  getUserById(uid: string): Promise<UserProfile | null>;
  saveUser(user: UserProfile): Promise<void>;
  listAllAdmins(): Promise<UserProfile[]>;
  
  saveCredential(uid: string, cred: SavedCredential): Promise<void>;
  getCredentials(uid: string): Promise<SavedCredential[]>;
  getCredentialById(uid: string, credentialID: string): Promise<SavedCredential | null>;
  deleteCredential(uid: string, credentialID: string): Promise<void>;
  clearAllCredentials(uid: string): Promise<void>;
}
