import { DbAdapter, SavedCredential, UserProfile } from './dbAdapter.js';
import * as admin from 'firebase-admin';

export class FirestoreDbAdapter implements DbAdapter {
  private get db() {
    return admin.firestore();
  }

  public async getUserByEmail(email: string): Promise<UserProfile | null> {
    const usersRef = this.db.collection('users');
    const snapshot = await usersRef.where('email', '==', email.toLowerCase()).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email,
      roles: data.roles || { admin: true, superAdmin: false },
      backupPassphraseHash: data.backupPassphraseHash
    };
  }

  public async getUserById(uid: string): Promise<UserProfile | null> {
    const userDoc = await this.db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data()!;
    return {
      uid: userDoc.id,
      email: data.email,
      roles: data.roles || { admin: true, superAdmin: false },
      backupPassphraseHash: data.backupPassphraseHash
    };
  }

  public async saveUser(user: UserProfile): Promise<void> {
    await this.db.collection('users').doc(user.uid).set({
      email: user.email.toLowerCase(),
      roles: user.roles,
      backupPassphraseHash: user.backupPassphraseHash
    }, { merge: true });
  }

  public async listAllAdmins(): Promise<UserProfile[]> {
    const snapshot = await this.db.collection('users').where('roles.admin', '==', true).get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email,
        roles: data.roles || { admin: true, superAdmin: false },
        backupPassphraseHash: data.backupPassphraseHash
      };
    });
  }

  public async saveCredential(uid: string, cred: SavedCredential): Promise<void> {
    await this.db.collection('users').doc(uid).collection('credentials').doc(cred.credentialID).set({
      credentialPublicKey: cred.credentialPublicKey,
      counter: cred.counter,
      transports: cred.transports || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  public async getCredentials(uid: string): Promise<SavedCredential[]> {
    const snapshot = await this.db.collection('users').doc(uid).collection('credentials').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        credentialID: doc.id,
        credentialPublicKey: data.credentialPublicKey,
        counter: data.counter,
        transports: data.transports || []
      };
    });
  }

  public async getCredentialById(uid: string, credentialID: string): Promise<SavedCredential | null> {
    const doc = await this.db.collection('users').doc(uid).collection('credentials').doc(credentialID).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      credentialID: doc.id,
      credentialPublicKey: data.credentialPublicKey,
      counter: data.counter,
      transports: data.transports || []
    };
  }

  public async deleteCredential(uid: string, credentialID: string): Promise<void> {
    await this.db.collection('users').doc(uid).collection('credentials').doc(credentialID).delete();
  }

  public async clearAllCredentials(uid: string): Promise<void> {
    const credentialsRef = this.db.collection('users').doc(uid).collection('credentials');
    const snapshot = await credentialsRef.get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    // Also remove recovery passphrase hash
    batch.update(this.db.collection('users').doc(uid), {
      backupPassphraseHash: admin.firestore.FieldValue.delete()
    });
    await batch.commit();
  }
}
