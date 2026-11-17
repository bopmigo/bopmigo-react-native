/** Small key-value storage. Uses AsyncStorage when the app has it, otherwise keeps values in memory. */
type Store = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> };

const memory = new Map<string, string>();
const fallback: Store = {
  getItem: async k => memory.get(k) ?? null,
  setItem: async (k, v) => { memory.set(k, v); },
  removeItem: async k => { memory.delete(k); },
};

let store: Store = fallback;
try {
  // Optional peer dependency: without it, the token and saved reports last until the app closes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@react-native-async-storage/async-storage');
  store = (mod?.default ?? mod) as Store;
} catch {}

export const storage: Store = {
  getItem: k => store.getItem(k).catch(() => fallback.getItem(k)),
  setItem: (k, v) => store.setItem(k, v).catch(() => fallback.setItem(k, v)),
  removeItem: k => store.removeItem(k).catch(() => fallback.removeItem(k)),
};
