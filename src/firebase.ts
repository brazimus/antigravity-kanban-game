/**
 * FIREBASE INITIALIZER (Equivalent to establishing a database connection handle in Perl, e.g., DBI->connect)
 * 
 * In a traditional web app, this would be a server-side DB connection pool. Since we are running
 * completely serverless on the client (GitHub Pages), this script initializes the Firebase SDK client-side
 * singleton instance.
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Connection credentials configuration (analogous to a DSN connection string in MSSQL/Perl DBI).
// Built during the Vite compile phase using repository secrets injected from GHA secrets.
// Includes default fallback values for local sandbox testing when env variables are not present.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "mock-api-key-for-local-testing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "antigravity-kanban-game.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "antigravity-kanban-game",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "antigravity-kanban-game.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789012:web:abcdef1234567890"
};

// Initialize the root Firebase app instance (analogous to a database connection manager)
const app = initializeApp(firebaseConfig);

// Export singletons for Authentication and Firestore Database.
// Think of 'db' as our database handle ($dbh in Perl DBI) used to execute queries and transactions.
export const auth = getAuth(app);
export const db = getFirestore(app);

import { FirebaseAuthAdapter } from './adapters/firebaseAuthAdapter';
export const authAdapter = new FirebaseAuthAdapter();

export default app;
