import { emit, on, type Events, type OpenOptions } from './events';
import { identityChanged, state, type User } from './state';
import { forget, VERSION } from './client';
import { ownerKey } from './owner';

export { BopmigoProvider, type BopmigoProviderProps } from './ui';
export type { OpenOptions } from './events';

export type ConfigureOptions = {
  /** Your app's ID from Bopmigo (Settings, then your app). */
  appId: string;
  /** Attach a picture of the screen to reports. Needs react-native-view-shot. Off by default. */
  screenshots?: boolean;
  /** Your app's version, e.g. "2.4.1 (310)". Shown with each report. */
  release?: string;
  /** Only for testing against another Bopmigo address. */
  host?: string;
};

export const Bopmigo = {
  version: VERSION,
  /** Call once when your app starts. */
  configure(o: ConfigureOptions) {
    state.appId = o.appId.trim();
    if (o.host) state.host = o.host;
    state.screenshots = !!o.screenshots;
    state.release = o.release ?? '';
  },
  /** Open the feedback sheet, optionally with a type and your own question. */
  open(o?: OpenOptions) { emit('open', o); },
  /** Open the person's past feedback and the team's replies. */
  showReplies() { emit('replies', undefined); },
  close() { emit('close', undefined); },
  /** Who is signed in, so your team can see who wrote and message them. Pass null on sign-out. */
  identify(user: User | null) {
    const next = user ?? {};
    const was = state.user;
    if (was.id === next.id && was.email === next.email && was.name === next.name) return;
    // Signing out (or in as someone else) starts a fresh conversation on this phone.
    const switched = (was.id || was.email) && (!user || (next.id ?? next.email) !== (was.id ?? was.email));
    const before = ownerKey();
    state.user = { ...next };
    // The last person's session and unsent draft are removed from the phone; the sheet then loads what belongs to the new person.
    if (switched) { emit('reset', undefined); void forget(before).then(identityChanged); }
    else identityChanged();
  },
  /** The screen the person is on, e.g. "Today" or "Settings". Sent with reports. */
  setScreen(name: string | null) { state.screen = name ? name.slice(0, 120) : null; },
  /** Your own details, e.g. { plan: 'pro', team: 'Studio' }. Sent with reports and shown on the person. */
  setContext(details: Record<string, string | number | boolean | null | undefined>) {
    const out: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(details)) {
      const key = k.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 32);
      if (key && v !== null && v !== undefined) out[key] = v;
    }
    state.details = out;
    identityChanged();
  },
  /** Listen for "sent" and "unread". Returns a function that stops listening. */
  on<K extends 'sent' | 'unread'>(name: K, fn: (value: Events[K]) => void) { return on(name, fn); },
};

export default Bopmigo;
