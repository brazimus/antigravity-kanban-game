// Mock for ./firebase
export const db = { type: 'database' };
export const auth = {
  currentUser: {
    uid: 'admin-uid-1',
    email: 'admin@test.com'
  }
};

export default { db, auth };
