
// Global store and listener registry
export const store = new Map<string, any>();
export const listeners = new Map<string, Set<(snap: any) => void>>();

// Helper to reset store and listeners between tests
export function resetMockFirestore() {
  store.clear();
  listeners.clear();
}

// Helper to deeply merge updates (including dotted path keys)
export function mergeData(target: any, source: any) {
  const result = JSON.parse(JSON.stringify(target || {}));
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (key.includes('.')) {
      const parts = key.split('.');
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = current[part] ? { ...current[part] } : {};
        current = current[part];
      }
      current[parts[parts.length - 1]] = val;
    } else {
      // If the field is an object and needs merging, check if we should merge or replace.
      // Firestore updateDoc does shallow merge at the top level or replaces completely.
      // We will perform a simple replacement to mimic Firestore's top-level behavior.
      result[key] = val;
    }
  }
  return result;
}

export function doc(dbOrParent: any, ...pathSegments: string[]) {
  let segments: string[] = [];
  if (typeof dbOrParent === 'string') {
    segments.push(dbOrParent);
  } else if (dbOrParent && dbOrParent.path) {
    segments.push(dbOrParent.path);
  }
  segments.push(...pathSegments);
  const path = segments.join('/');
  return {
    type: 'document',
    path,
    id: segments[segments.length - 1]
  };
}

export function collection(dbOrParent: any, ...pathSegments: string[]) {
  let segments: string[] = [];
  if (typeof dbOrParent === 'string') {
    segments.push(dbOrParent);
  } else if (dbOrParent && dbOrParent.path) {
    segments.push(dbOrParent.path);
  }
  segments.push(...pathSegments);
  const path = segments.join('/');
  return {
    type: 'collection',
    path,
    id: segments[segments.length - 1]
  };
}

export function getDocSync(ref: any) {
  const data = store.get(ref.path);
  return {
    exists: () => data !== undefined,
    data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
    id: ref.id,
    ref
  };
}

export async function getDoc(ref: any) {
  return getDocSync(ref);
}

export function getDocsSync(colRef: any) {
  const docs: any[] = [];
  store.forEach((value, key) => {
    if (key.startsWith(colRef.path + '/')) {
      const remainingPath = key.substring(colRef.path.length + 1);
      if (!remainingPath.includes('/')) {
        docs.push({
          id: remainingPath,
          ref: doc(colRef, remainingPath),
          data: () => JSON.parse(JSON.stringify(value)),
          exists: () => true
        });
      }
    }
  });
  return {
    forEach: (callback: (snap: any) => void) => docs.forEach(callback),
    docs
  };
}

export async function getDocs(colRef: any) {
  return getDocsSync(colRef);
}

export function triggerListeners(path: string) {
  // 1. Trigger document listeners
  const docRef = { type: 'document', path, id: path.split('/').pop()! };
  const docSnap = getDocSync(docRef);
  const docCbs = listeners.get(path);
  if (docCbs) {
    docCbs.forEach(cb => cb(docSnap));
  }

  // 2. Trigger parent collection listeners
  const parts = path.split('/');
  if (parts.length > 1) {
    const parentPath = parts.slice(0, -1).join('/');
    const colRef = { type: 'collection', path: parentPath, id: parts[parts.length - 2] };
    const colSnap = getDocsSync(colRef);
    const colCbs = listeners.get(parentPath);
    if (colCbs) {
      colCbs.forEach(cb => cb(colSnap));
    }
  }
}

export async function setDoc(ref: any, data: any) {
  store.set(ref.path, JSON.parse(JSON.stringify(data)));
  triggerListeners(ref.path);
}

export async function updateDoc(ref: any, data: any) {
  const current = store.get(ref.path) || {};
  const updated = mergeData(current, data);
  store.set(ref.path, updated);
  triggerListeners(ref.path);
}

export function onSnapshot(ref: any, callback: (snap: any) => void) {
  const path = ref.path;
  if (!listeners.has(path)) {
    listeners.set(path, new Set());
  }
  listeners.get(path)!.add(callback);

  // Trigger immediately
  if (ref.type === 'document') {
    callback(getDocSync(ref));
  } else if (ref.type === 'collection') {
    callback(getDocsSync(ref));
  }

  // Return unsubscribe
  return () => {
    const cbs = listeners.get(path);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) {
        listeners.delete(path);
      }
    }
  };
}

export function writeBatch(_db: any) {
  const operations: Array<{ type: 'set' | 'update'; ref: any; data: any }> = [];
  return {
    set: (ref: any, data: any) => {
      operations.push({ type: 'set', ref, data });
    },
    update: (ref: any, data: any) => {
      operations.push({ type: 'update', ref, data });
    },
    commit: async () => {
      for (const op of operations) {
        if (!op.ref) {
          console.error("COMMIT FOUND UNDEFINED REF in OP:", op);
          continue;
        }
        const current = store.get(op.ref.path) || {};
        const updated = op.type === 'set' 
          ? JSON.parse(JSON.stringify(op.data))
          : mergeData(current, op.data);
        store.set(op.ref.path, updated);
      }
      for (const op of operations) {
        if (op.ref) {
          triggerListeners(op.ref.path);
        }
      }
    }
  };
}

export async function runTransaction(_db: any, callback: (transaction: any) => Promise<any>) {
  const updates: Array<{ ref: any; data: any }> = [];
  const transaction = {
    get: async (ref: any) => {
      return getDocSync(ref);
    },
    update: (ref: any, data: any) => {
      updates.push({ ref, data });
    },
    set: (ref: any, data: any) => {
      updates.push({ ref, data });
    }
  };

  const result = await callback(transaction);

  // Commit updates
  for (const update of updates) {
    const current = store.get(update.ref.path) || {};
    const updated = mergeData(current, update.data);
    store.set(update.ref.path, updated);
  }

  // Trigger listeners
  for (const update of updates) {
    triggerListeners(update.ref.path);
  }

  return result;
}
