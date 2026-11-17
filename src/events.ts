/** A tiny event bus between the static Bopmigo API and the mounted provider. */
export type OpenOptions = {
  /** Which kind of feedback to start with. */
  type?: 'problem' | 'change' | 'idea';
  /** Your own question shown above the box, e.g. "How was your first week planning?". */
  message?: string;
  /** Name of the screen this is about, if different from setScreen(). */
  screen?: string;
};
export type Events = {
  open: OpenOptions | undefined;
  replies: undefined;
  close: undefined;
  /** Someone else signed in (or the person signed out): forget what belonged to the last person. */
  reset: undefined;
  sent: { id: string; title: string; type: string };
  unread: { replies: number; messages: number };
};
type Handler<K extends keyof Events> = (value: Events[K]) => void;
// The latest unread counts, so a screen that mounts later still gets them.
let lastUnread: Events['unread'] | undefined;
const handlers: Partial<Record<keyof Events, Set<(value: never) => void>>> = {};

export function on<K extends keyof Events>(name: K, fn: Handler<K>) {
  const set = (handlers[name] ??= new Set()) as unknown as Set<Handler<K>>;
  set.add(fn);
  if (name === 'unread' && lastUnread) (fn as Handler<'unread'>)(lastUnread);
  return () => { set.delete(fn); };
}
export function emit<K extends keyof Events>(name: K, value: Events[K]) {
  if (name === 'unread') lastUnread = value as Events['unread'];
  for (const fn of (handlers[name] ?? []) as unknown as Set<Handler<K>>) { try { fn(value); } catch {} }
}
export const listening = (name: keyof Events) => (handlers[name]?.size ?? 0) > 0;
