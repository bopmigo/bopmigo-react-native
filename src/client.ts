import { Dimensions, PixelRatio, Platform } from 'react-native';
import { identified, state } from './state';
import { storage } from './storage';
import { ANON, draftKey, legacyKeys, ownerKey, tokenKey } from './owner';

export const VERSION = '0.1.0';

export type Category = 'problem' | 'change' | 'idea';
export type Draft = {
  /** Set on saved reports: the session they were written in, so they're sent as that person. */
  token?: string;
  id: string; category: Category | 'answer'; description: string; question?: string; answer?: string;
  prompt?: string; askId?: string; context: Record<string, unknown>; screenshot?: string | null;
};
export type Report = { id: string; title: string; status: string; last_reply_at?: string | null; team_question?: string | null };
export type Message = { id: string; author: 'team' | 'reporter'; body: string; created_at?: string };
export type Thread = Report & { description: string; question?: string | null; answer?: string | null; messages: Message[] };
export type Ask = { id: string; body: string; created_at: string; seen_at?: string | null; open_on_arrival?: boolean };

export class BopmigoError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}

export function newId() {
  const b = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Details sent with every report, so the team knows where and on what it happened. */
export function context(extra: Record<string, unknown> = {}) {
  const { width, height } = Dimensions.get('window');
  let language = '', timezone = '';
  try { const o = Intl.DateTimeFormat().resolvedOptions(); language = o.locale; timezone = o.timeZone; } catch {}
  const name = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS === 'web' ? 'Web' : Platform.OS;
  const c = (Platform as { constants?: Record<string, unknown> }).constants ?? {};
  // Android reports its version as an API level; the release number reads better.
  const version = Platform.OS === 'android' ? String(c.Release ?? Platform.Version ?? '') : String(Platform.Version ?? '');
  const device = Platform.OS === 'android' ? [c.Manufacturer, c.Model].filter(Boolean).join(' ') : Platform.OS === 'ios' ? (Platform as { isPad?: boolean }).isPad ? 'iPad' : 'iPhone' : '';
  return {
    screen: state.screen ?? undefined, release: state.release || undefined,
    os: `${name} ${version}`.trim(), device: device || undefined, language, timezone,
    viewport: `${Math.round(width)} × ${Math.round(height)}`, pixelRatio: PixelRatio.get(), sdk: `bopmigo-react-native/${VERSION}`,
    ...(state.user.id ? { userId: state.user.id } : {}), ...(state.user.email ? { userEmail: state.user.email } : {}), ...(state.user.name ? { userName: state.user.name } : {}),
    ...Object.fromEntries(Object.entries(state.details).map(([k, v]) => [`custom_${k}`.slice(0, 40), v])),
    ...extra,
  };
}

const QUEUE = 'bopmigo.queue';
const TIMEOUT = 20_000;
let token: string | null = null;
/** Whose session `token` is. */
let tokenOwner = ANON;
let migrated = false;
let sending = false;

/** The session of whoever is signed in now. Never another person's, including after a restart. */
async function currentToken(): Promise<string | null> {
  if (!migrated) { migrated = true; for (const k of legacyKeys()) await storage.removeItem(k); }
  const owner = ownerKey();
  if (token && tokenOwner !== owner) {
    // Someone who wasn't signed in has now signed in: their conversation continues, as on the web.
    if (tokenOwner === ANON) { await storage.setItem(tokenKey(owner), token); await storage.removeItem(tokenKey(ANON)); tokenOwner = owner; }
    else token = null;
  }
  if (!token) {
    let saved = await storage.getItem(tokenKey(owner));
    if (!saved && owner !== ANON) {
      saved = await storage.getItem(tokenKey(ANON));
      if (saved) { await storage.setItem(tokenKey(owner), saved); await storage.removeItem(tokenKey(ANON)); }
    }
    token = saved; tokenOwner = owner;
  }
  return token;
}

/** A request that gives up after 20 seconds, so a stalled connection never leaves someone waiting. */
async function timed(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function request<T = unknown>(method: 'GET' | 'POST', path: string, body?: unknown, auth = true, retried = false, as?: string): Promise<T> {
  const site = state.appId;
  if (!site) throw new BopmigoError('Bopmigo isn’t set up yet.');
  if (auth && !as && !(await currentToken())) await newToken(site);
  const res = await timed(`${state.host.replace(/\/$/, '')}/api/v1/reporter/${site}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && (as ?? token) ? { Authorization: `Bearer ${as ?? token}` } : {}) },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  // The saved session ended (or belongs to someone else who used this phone): start a fresh one, once.
  if ((res.status === 401 || res.status === 409) && auth && !retried && !as) {
    const data = res.status === 409 ? await res.clone().json().catch(() => null) : null;
    if (res.status === 401 || data?.code === 'other_account') { await resetSession(); return request(method, path, body, auth, true); }
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) throw new BopmigoError(typeof data?.error === 'string' ? data.error : 'Couldn’t send. Try again in a moment.', res.status);
  return data as T;
}

async function newToken(site: string) {
  const owner = ownerKey();
  let res: Response;
  try { res = await timed(`${state.host.replace(/\/$/, '')}/api/v1/reporter/${site}/session`, { method: 'POST' }); }
  catch { throw new BopmigoError('Couldn’t reach Bopmigo.'); }
  const data = await res.json().catch(() => null);
  if (!res.ok || typeof data?.token !== 'string') throw new BopmigoError('Couldn’t reach Bopmigo.', res.status >= 500 ? res.status : 0);
  token = data.token as string; tokenOwner = owner;
  await storage.setItem(tokenKey(owner), token);
}

/** Ends the session saved for `owner` (whoever is signed in now, unless given). */
export async function resetSession(owner = ownerKey()) {
  if (tokenOwner === owner) token = null;
  await storage.removeItem(tokenKey(owner));
}

/** Someone else signed in, or the person signed out: remove what the last person left on this phone. */
export async function forget(owner: string) {
  token = null; tokenOwner = ANON;
  await storage.removeItem(tokenKey(owner));
  await storage.removeItem(draftKey(owner));
}

export async function hasSession() {
  return !!(await currentToken());
}

/** Loads the app's settings once, so the package stays quiet while an app is being removed. */
export async function config() {
  try { return await request<{ accepting?: boolean }>('GET', '/config', undefined, false); } catch { return null; }
}

/** Says who is signed in and where they are. Returns the team's messages waiting for them. */
export async function presence(): Promise<Ask[]> {
  if (!identified() && !(await hasSession())) return [];
  const details = Object.fromEntries(Object.entries(state.details).map(([k, v]) => [`custom_${k}`.slice(0, 40), v]));
  const data = await request<{ asks?: Ask[] }>('POST', '/presence', {
    identity: { userId: state.user.id, userEmail: state.user.email, userName: state.user.name }, details, page: state.screen ?? undefined,
  });
  return data?.asks ?? [];
}

export const markAskSeen = (id: string) => request('POST', `/asks/${id}/seen`, {}).catch(() => {});

/** A short follow-up when something important is missing, or null. */
export async function followUp(d: Draft): Promise<{ question: string | null; notice?: string }> {
  try {
    const data = await request<{ question?: string | null; notice?: string }>('POST', '/question', { requestId: d.id, category: d.category, description: d.description, context: d.context, prompt: d.prompt });
    return { question: data?.question?.trim() || null, notice: data?.notice };
  } catch { return { question: null }; }
}

function body(d: Draft) {
  return {
    requestId: d.id, category: d.category, description: d.description, context: d.context,
    ...(d.askId ? { askId: d.askId } : { question: d.question ?? '', answer: d.answer ?? '', prompt: d.prompt }),
    screenshot: d.screenshot ? `data:image/jpeg;base64,${d.screenshot}` : null,
  };
}

/** Sends a report. If it can't be sent now it is saved and sent later; `saved` is then true. */
export async function send(d: Draft): Promise<{ report?: Report; saved?: boolean }> {
  try {
    return { report: await request<Report>('POST', '', body(d)) };
  } catch (e) {
    // Answers to a withdrawn question, and refusals from Bopmigo, are not worth retrying.
    if (d.askId || (e instanceof BopmigoError && e.status >= 400 && e.status < 500 && e.status !== 429)) throw e;
    await save({ ...d, token: token ?? undefined });
    return { saved: true };
  }
}

/** Sends reports saved from earlier attempts. */
export async function sendQueued() {
  if (sending) return;
  sending = true;
  try {
    for (const d of await queue()) {
      try { await request('POST', '', body(d), true, false, d.token); }
      catch (e) {
        // Still offline: try again later. Refused (e.g. that session ended): drop it rather than retry forever.
        if (!(e instanceof BopmigoError) || e.status === 0 || e.status === 429 || e.status >= 500) return;
      }
      await write((await queue()).filter(x => x.id !== d.id));
    }
  } finally { sending = false; }
}

export async function myReports(): Promise<Report[]> {
  if (!(await hasSession())) return [];
  try { const rows = await request<Report[]>('GET', ''); return Array.isArray(rows) ? rows : []; } catch { return []; }
}

export const thread = (id: string) => request<Thread>('GET', `/${id}`);
export const reply = (id: string, message: string, requestId = newId()) => request('POST', `/${id}`, { message, requestId });

/** Reports with a team reply the person hasn't seen yet. */
export async function unread(list?: Report[]) {
  const reports = list ?? await myReports();
  const out: Report[] = [];
  for (const r of reports) if (r.last_reply_at && (await storage.getItem(`bopmigo.seen.${r.id}`)) !== r.last_reply_at) out.push(r);
  return out;
}
export const markSeen = (r: Report) => r.last_reply_at ? storage.setItem(`bopmigo.seen.${r.id}`, r.last_reply_at) : Promise.resolve();

async function queue(): Promise<Draft[]> {
  try { return JSON.parse((await storage.getItem(QUEUE)) ?? '[]'); } catch { return []; }
}
const write = (q: Draft[]) => storage.setItem(QUEUE, JSON.stringify(q.slice(-20)));
const save = async (d: Draft) => write([...(await queue()).filter(x => x.id !== d.id), d]);
