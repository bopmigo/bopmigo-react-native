/** Settings and details shared by the client and the feedback sheet. */
export type User = { id?: string; email?: string; name?: string };

export const state = {
  appId: null as string | null,
  host: 'https://bopmigo.com',
  /** Attach a picture of the screen to reports. Off unless the app turns it on. */
  screenshots: false,
  /** The app's own version, shown with each report. */
  release: '',
  screen: null as string | null,
  user: {} as User,
  /** The app's own details, sent as custom_<key>. */
  details: {} as Record<string, string | number | boolean>,
};

export const identified = () => !!(state.user.id || state.user.email || state.user.name);

type Listener = () => void;
const listeners = new Set<Listener>();
/** Tells the sheet that who is signed in changed, so it checks for messages again. */
export const onIdentity = (fn: Listener) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const identityChanged = () => { for (const fn of listeners) fn(); };
