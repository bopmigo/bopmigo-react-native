import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type ViewStyle,
} from 'react-native';
import * as api from './client';
import { emit, on, type OpenOptions } from './events';
import { Migo } from './migo';
import { onIdentity, state } from './state';
import { storage } from './storage';
import { ANON, draftKey, ownerKey } from './owner';

const C = { ink: '#16130F', text: '#3B3833', muted: '#736E66', faint: '#A39E95', line: '#E8E3DB', soft: '#F3F0EA', cream: '#F8F6F2', orange: '#FF5A1F', rust: '#C2410C', peach: '#FFF4EC', peachLine: '#FFC9AE', red: '#B42318' };
const KINDS = {
  problem: { tab: 'Problem', label: 'What happened?', placeholder: 'I tried to… but…' },
  change: { tab: 'Request', label: 'What should change?', placeholder: 'It would be easier if…' },
  idea: { tab: 'Idea', label: 'What’s your idea?', placeholder: 'It would be great if…' },
} as const;
const THANKS = ['Thanks! The team will take a look.', 'Thanks, sending this to the team.', 'Got it, thanks! It’s with the team now.', 'Thanks for letting us know. The team will take a look.'];
const STATUS: Record<string, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

type Draft = { id: string; owner: string; category: api.Category; description: string; prompt?: string; screen?: string; asked?: boolean; question?: string; answer?: string; screenshot?: string | null };
type Stage = 'write' | 'ask' | 'history' | 'thread';
const fresh = (category: api.Category = 'problem'): Draft => ({ id: api.newId(), owner: ownerKey(), category, description: '' });

export type BopmigoProviderProps = {
  children?: React.ReactNode;
  /** Show the floating Feedback button. Turn it off to open Bopmigo from your own menu with Bopmigo.open(). */
  button?: boolean;
  /** Extra space under the button, e.g. above a tab bar. */
  buttonOffset?: number;
  style?: StyleProp<ViewStyle>;
};

/** Wrap your app once, near the root. Draws the feedback sheet and (optionally) the Feedback button. */
export function BopmigoProvider({ children, button = true, buttonOffset = 0, style }: BopmigoProviderProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('write');
  const [draft, setDraft] = useState<Draft>(fresh);
  const [asks, setAsks] = useState<api.Ask[]>([]);
  const [reports, setReports] = useState<api.Report[]>([]);
  const [unread, setUnread] = useState<api.Report[]>([]);
  const [thread, setThread] = useState<api.Thread | null>(null);
  const [justSent, setJustSent] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState<'' | 'capture' | 'question' | 'send' | 'history' | 'reply'>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [accepting, setAccepting] = useState(true);
  const openRef = useRef(false); openRef.current = open;
  const draftRef = useRef(draft); draftRef.current = draft;
  const asksRef = useRef(asks); asksRef.current = asks;
  /** Whose saved draft has been loaded. Drafts are only saved once this matches, so one person's never lands under another's. */
  const ready = useRef<string | null>(null);
  const scroller = useRef<ScrollView>(null);
  // With the keyboard up, keep the box being typed in and its button in view.
  const toEnd = () => setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 300);

  // A half-written draft survives closing the sheet and restarting the app, for the person who wrote it only.
  const hydrate = useCallback(async (): Promise<Draft> => {
    const owner = ownerKey();
    ready.current = null;
    await storage.removeItem('bopmigo.draft'); // saved before drafts had an owner: nobody knows whose it is
    const read = async (o: string): Promise<Draft | null> => {
      try { const d = JSON.parse((await storage.getItem(draftKey(o))) ?? 'null'); return d?.id && typeof d.description === 'string' ? d : null; } catch { return null; }
    };
    const cur = draftRef.current;
    let d = await read(owner);
    if (!d && owner !== ANON) {
      // Someone who wasn't signed in has now signed in: they keep what they were writing.
      d = cur.owner === ANON && cur.description ? cur : await read(ANON);
      if (d) await storage.removeItem(draftKey(ANON));
    }
    const next: Draft = d ? { ...d, owner, screenshot: d === cur ? cur.screenshot : null } : fresh(cur.category);
    if (ownerKey() !== owner) return hydrate(); // they changed again while this loaded
    draftRef.current = next; setDraft(next); ready.current = owner;
    return next;
  }, []);
  useEffect(() => {
    void hydrate();
    api.config().then(c => { if (c && c.accepting === false) setAccepting(false); });
  }, [hydrate]);
  useEffect(() => onIdentity(() => { if (ready.current !== ownerKey()) void hydrate(); }), [hydrate]);
  useEffect(() => { if (ready.current === draft.owner) void storage.setItem(draftKey(draft.owner), JSON.stringify({ ...draft, screenshot: null })); }, [draft]);
  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }));

  const findUnread = useCallback(async (list?: api.Report[]) => {
    setUnread(await api.unread(list));
  }, []);

  const openAsk = useCallback((target?: api.Ask) => {
    const list = asksRef.current;
    const a = target ?? list.find(x => !x.seen_at) ?? list[0];
    if (!a) return;
    setAsks([a, ...list.filter(x => x.id !== a.id)]);
    setError(''); setNotice(''); setAnswer(''); setStage('ask'); setOpen(true);
    if (!a.seen_at) void api.markAskSeen(a.id).then(() => setAsks(l => l.map(x => x.id === a.id ? { ...x, seen_at: new Date().toISOString() } : x)));
  }, []);

  // Check in: who is signed in, which screen they're on, and whether the team has a message for them.
  const checkIn = useCallback(async () => {
    if (!state.appId) return;
    api.sendQueued();
    if (await api.hasSession()) findUnread().catch(() => {});
    try {
      const list = await api.presence();
      setAsks(list);
      // The team chose to open this message when they arrive: once, unless the sheet is already open.
      const pop = list.find(a => a.open_on_arrival && !a.seen_at);
      if (pop && !openRef.current) setTimeout(() => { if (!openRef.current) openAsk(pop); }, 1200);
    } catch {}
  }, [findUnread, openAsk]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => { clearTimeout(timer); timer = setTimeout(checkIn, 400); };
    soon();
    const every = setInterval(() => { if (AppState.currentState === 'active') checkIn(); }, 60_000);
    const app = AppState.addEventListener('change', s => { if (s === 'active') soon(); });
    const off = onIdentity(soon);
    return () => { clearTimeout(timer); clearInterval(every); app.remove(); off(); };
  }, [checkIn]);

  const begin = useCallback(async (o?: OpenOptions) => {
    setError(''); setNotice(''); setThread(null); setJustSent(null);
    const d = ready.current === ownerKey() ? draftRef.current : await hydrate();
    // A new preset starts a new draft; plain opens continue the last one.
    let next: Draft = o && (o.message || o.type) && (o.message !== d.prompt || (o.type && o.type !== d.category)) && !d.description ? { ...fresh(o.type ?? 'problem'), prompt: o.message } : d;
    if (o?.screen) next = { ...next, screen: o.screen };
    if (o?.message && !next.description) next = { ...next, prompt: o.message };
    // Like the web widget: the screen is captured each time feedback opens, so the picture matches where they are now.
    if (state.screenshots && Platform.OS !== 'web') {
      // The picture shows the app, not the sheet: close it first if it's open.
      if (openRef.current) { setOpen(false); await new Promise(r => setTimeout(r, 450)); }
      setBusy('capture');
      next = { ...next, screenshot: await capture() };
      setBusy('');
    }
    setDraft(next); setStage('write'); setOpen(true);
  }, [hydrate]);

  const history = useCallback(async () => {
    setStage('history'); setOpen(true); setError(''); setNotice(''); setBusy('history');
    try { const list = await api.myReports(); setReports(list); await findUnread(list); }
    catch { setError('Could not load feedback. Try again.'); }
    finally { setBusy(''); }
  }, [findUnread]);

  const loadThread = useCallback(async (id: string) => {
    setError(''); setJustSent(null);
    try {
      const t = await api.thread(id); setThread(t); setStage('thread'); setOpen(true);
      const r = reports.find(x => x.id === id) ?? unread.find(x => x.id === id);
      const last = t.messages.filter(m => m.author === 'team').at(-1)?.created_at ?? r?.last_reply_at;
      if (last) { await api.markSeen({ ...t, last_reply_at: last }); setUnread(u => u.filter(x => x.id !== id)); }
    } catch { setError('Could not load this report. Try again.'); }
  }, [reports, unread]);

  useEffect(() => on('open', o => { void begin(o); }), [begin]);
  useEffect(() => on('replies', () => { if (unread.length === 1) { void loadThread(unread[0].id); } else void history(); }), [history, loadThread, unread]);
  useEffect(() => on('close', () => setOpen(false)), []);
  useEffect(() => on('reset', () => {
    ready.current = null;
    setOpen(false); setDraft(fresh()); setAsks([]); setUnread([]); setReports([]); setThread(null); setAnswer(''); setReplyText('');
    void hydrate();
  }), [hydrate]);

  // While a conversation is open, new team replies appear on their own.
  useEffect(() => {
    if (!open || stage !== 'thread' || !thread) return;
    const id = thread.id;
    const t = setInterval(() => {
      api.thread(id).then(async x => {
        setThread(cur => cur?.id === id ? x : cur);
        // A reply that arrives while they're reading it is already seen.
        const last = x.messages.filter(m => m.author === 'team').at(-1)?.created_at;
        if (last) { await api.markSeen({ ...x, last_reply_at: last }); setUnread(u => u.filter(r => r.id !== id)); }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [open, stage, thread?.id]);

  async function sendNow(d: Draft) {
    setBusy('send'); setError('');
    try {
      const res = await api.send({ id: d.id, category: d.category, description: d.description.trim(), question: d.question, answer: d.answer, prompt: d.prompt, screenshot: d.screenshot, context: api.context(d.screen ? { screen: d.screen } : {}) });
      const clean = fresh(d.category);
      setDraft(clean);
      if (res.saved) { setNotice('You’re offline. We saved it and will send it when you’re back online.'); setStage('write'); return; }
      const r = res.report!;
      setThread({ ...r, description: d.description.trim(), question: d.question || null, answer: d.answer || null, messages: [] });
      setJustSent(THANKS[Math.floor(Math.random() * THANKS.length)]);
      setStage('thread');
      emit('sent', { id: r.id, title: r.title, type: d.category });
    } catch (e) { setError(e instanceof api.BopmigoError ? e.message : 'Could not send. Try again.'); }
    finally { setBusy(''); }
  }

  // The first press may bring a short follow-up when something important is missing. The second press sends.
  async function submit() {
    const d = draftRef.current;
    if (d.description.trim().length < 5 || busy) return;
    if (d.asked) return sendNow(d);
    patch({ asked: true }); setBusy('question'); setError('');
    const { question, notice: n } = await api.followUp({ id: d.id, category: d.category, description: d.description.trim(), prompt: d.prompt, context: api.context(d.screen ? { screen: d.screen } : {}) });
    setBusy('');
    if (n) setNotice(n);
    if (draftRef.current.id !== d.id) return;
    if (question) patch({ question }); else await sendNow({ ...d, asked: true });
  }

  async function sendAnswer() {
    const a = asks[0];
    if (!a || !answer.trim() || busy) return;
    setBusy('send'); setError('');
    try {
      const res = await api.send({ id: api.newId(), category: 'answer', description: answer.trim(), askId: a.id, context: api.context() });
      const r = res.report!;
      setAsks(l => l.filter(x => x.id !== a.id)); setAnswer('');
      setThread({ ...r, team_question: a.body, description: answer.trim(), messages: [] });
      setJustSent(THANKS[Math.floor(Math.random() * THANKS.length)]); setStage('thread');
    } catch (e) {
      setError(e instanceof api.BopmigoError ? e.message : 'Could not send. Try again.');
      if (e instanceof api.BopmigoError && /withdrawn/.test(e.message)) setAsks(l => l.filter(x => x.id !== a.id));
    } finally { setBusy(''); }
  }

  async function sendReply() {
    if (!thread || !replyText.trim() || busy) return;
    setBusy('reply'); setError('');
    try {
      await api.reply(thread.id, replyText.trim());
      setReplyText(''); setThread(await api.thread(thread.id));
    } catch { setError('Could not send your reply. Try again.'); }
    finally { setBusy(''); }
  }

  const unseen = asks.filter(a => !a.seen_at);
  // Lets the app show its own badge, e.g. on a Settings tab.
  useEffect(() => { emit('unread', { replies: unread.length, messages: unseen.length }); }, [unread.length, unseen.length]);
  const press = () => {
    if (unseen.length) return openAsk();
    if (unread.length === 1) return void loadThread(unread[0].id);
    if (unread.length > 1) return void history();
    void begin();
  };
  const title = stage === 'history' ? 'Your feedback' : stage === 'ask' ? 'New message' : stage === 'thread' && !justSent ? 'Conversation' : 'What’s on your mind?';
  const kind = KINDS[draft.category] ?? KINDS.problem;
  const showButton = button && accepting && !!state.appId;

  return (
    <View style={[{ flex: 1 }, style]}>
      {children}
      {showButton && (
        <Pressable accessibilityRole="button" accessibilityLabel={unseen.length ? 'Feedback, you have a new message' : unread.length ? 'Feedback, you have a new reply' : 'Feedback'}
          onPress={press} disabled={busy === 'capture'} style={({ pressed }) => [s.trigger, { bottom: 24 + buttonOffset, opacity: pressed ? 0.85 : 1 }]}>
          <Wave active={unseen.length > 0 || unread.length > 0}><Migo size={22}/></Wave>
          <Text style={s.triggerText}>{busy === 'capture' ? 'Opening…' : unseen.length ? 'New message' : unread.length ? 'New reply' : draft.description ? 'Continue feedback' : 'Feedback'}</Text>
          {(unseen.length > 0 || unread.length > 0) && <View style={s.dot}/>}
        </Pressable>
      )}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
          {/* Tapping outside closes it; screen readers use the close button instead of this invisible area. */}
          <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={() => setOpen(false)}/>
          <View style={s.sheet} accessibilityViewIsModal>
            <View style={s.grabber}/>
            <View style={s.header}>
              <View style={s.headTitle}><Migo size={26} look={busy === 'question' ? 'up' : 'side'}/><Text style={s.h2} accessibilityRole="header">{title}</Text></View>
              <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close feedback" hitSlop={10} style={s.icon}><Text style={s.iconText}>×</Text></Pressable>
            </View>
            <ScrollView ref={scroller} style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
              {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
              {!!notice && <Text style={s.notice}>{notice}</Text>}

              {stage === 'write' && <>
                <View style={s.types}>
                  {(Object.keys(KINDS) as api.Category[]).map(k => (
                    <Pressable key={k} onPress={() => patch({ category: k })} style={[s.type, draft.category === k && s.typeOn]} accessibilityRole="button" accessibilityState={{ selected: draft.category === k }}>
                      <Text style={[s.typeText, draft.category === k && s.typeTextOn]}>{KINDS[k].tab}</Text>
                    </Pressable>
                  ))}
                </View>
                {draft.asked ? (
                  <View style={{ gap: 6 }}>
                    <Bubble who="reporter" label="You" text={draft.description}/>
                    <Pressable onPress={() => patch({ asked: false, question: '', answer: '' })} style={{ alignSelf: 'flex-end' }}><Text style={s.link}>Edit</Text></Pressable>
                  </View>
                ) : <>
                  <Text style={s.label}>{draft.prompt || kind.label}</Text>
                  <TextInput value={draft.description} onChangeText={t => patch({ description: t })} placeholder={draft.prompt ? 'A line or two is plenty.' : kind.placeholder}
                    placeholderTextColor={C.faint} multiline maxLength={5000} style={[s.input, { minHeight: 110 }]} accessibilityLabel={draft.prompt || kind.label} autoFocus={!draft.description}/>
                </>}
                {busy === 'question' && <View style={s.thinking}><Migo size={16}/><Text style={s.who}>Bopmigo</Text><ActivityIndicator size="small" color={C.rust}/></View>}
                {!!draft.question && <>
                  <Bubble who="bopmigo" label="Bopmigo asks" text={draft.question}/>
                  <Text style={s.label}>Your answer <Text style={s.optional}>Optional</Text></Text>
                  <TextInput value={draft.answer ?? ''} onChangeText={t => patch({ answer: t })} multiline maxLength={3000} style={[s.input, { minHeight: 70 }]} accessibilityLabel="Your answer" autoFocus onFocus={toEnd}/>
                </>}
              </>}

              {stage === 'ask' && asks[0] && <>
                <Bubble who="team" label="Team" text={asks[0].body}/>
                <Text style={s.label}>Your reply</Text>
                <TextInput value={answer} onChangeText={setAnswer} multiline maxLength={5000} placeholder="A line or two is plenty." placeholderTextColor={C.faint} style={[s.input, { minHeight: 90 }]} accessibilityLabel="Your reply" autoFocus onFocus={toEnd}/>
                {asks.length > 1 && <Text style={s.notice}>{asks.length - 1} more message{asks.length > 2 ? 's' : ''} after this one.</Text>}
              </>}

              {stage === 'history' && <>
                {asks.map(a => <Row key={a.id} title={a.body.length > 70 ? a.body.slice(0, 68).trimEnd() + '…' : a.body} sub={a.seen_at ? 'Message from the team' : 'New message'} fresh={!a.seen_at} onPress={() => openAsk(a)}/>)}
                {busy === 'history' ? <ActivityIndicator color={C.muted} style={{ marginVertical: 24 }}/> : !reports.length && !asks.length ? (
                  <View style={s.empty}><Text style={s.h3}>No feedback yet</Text><Text style={s.muted}>Your reports and the team’s replies will appear here.</Text></View>
                ) : reports.map(r => {
                  const isNew = unread.some(u => u.id === r.id);
                  return <Row key={r.id} title={r.title} sub={isNew ? 'New reply' : STATUS[r.status] ?? r.status} fresh={isNew} onPress={() => loadThread(r.id)}/>;
                })}
              </>}

              {stage === 'thread' && thread && <>
                {!justSent && <>
                  <Pressable onPress={history} style={{ alignSelf: 'flex-start' }}><Text style={s.link}>‹  All feedback</Text></Pressable>
                  <View style={s.threadTitle}><Text style={s.h3} numberOfLines={2}>{thread.title}</Text><Text style={s.status}>{STATUS[thread.status] ?? thread.status}</Text></View>
                </>}
                {!!thread.team_question && <Bubble who="team" label="Team" text={thread.team_question}/>}
                <Bubble who="reporter" label="You" text={thread.description}/>
                {!!thread.question && <Bubble who="bopmigo" label="Bopmigo asked" text={thread.question}/>}
                {!!thread.question && !!thread.answer && <Bubble who="reporter" label="You" text={thread.answer}/>}
                {thread.messages.map(m => <Bubble key={m.id} who={m.author} label={m.author === 'team' ? 'Team' : 'You'} text={m.body}/>)}
                {!!justSent && <Bubble who="bopmigo" label="Bopmigo" text={justSent}/>}
                <Text style={s.label}>Reply to the team</Text>
                <TextInput value={replyText} onChangeText={setReplyText} multiline maxLength={5000} style={[s.input, { minHeight: 64 }]} accessibilityLabel="Reply to the team" onFocus={toEnd}/>
                <Primary label={busy === 'reply' ? 'Sending…' : 'Send reply'} disabled={!replyText.trim() || !!busy} onPress={sendReply} style={{ alignSelf: 'flex-end' }}/>
              </>}
            </ScrollView>

            <View style={s.footer}>
              {stage === 'ask' ? <>
                <Pressable onPress={() => void begin()}><Text style={s.link}>Send feedback instead</Text></Pressable>
                <Primary label={busy === 'send' ? 'Sending…' : 'Send'} disabled={!answer.trim() || !!busy} onPress={sendAnswer}/>
              </> : stage === 'write' ? <>
                <Pressable onPress={history}><Text style={s.link}>Your feedback{unseen.length ? <Text style={s.new}> · New message</Text> : unread.length ? <Text style={s.new}> · New reply</Text> : null}</Text></Pressable>
                <Primary label={busy === 'question' ? 'Thinking…' : busy === 'send' ? 'Sending…' : 'Send'} disabled={draft.description.trim().length < 5 || !!busy} onPress={submit}/>
              </> : (
                <Pressable onPress={() => { setDraft(d => d.description ? d : fresh()); void begin(); }}><Text style={s.link}>+  New feedback</Text></Pressable>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/** Like the web widget: Migo gives a little wave every few seconds while something is waiting. Still for Reduce Motion. */
function Wave({ active, children }: { active: boolean; children: React.ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  const [still, setStill] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setStill).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setStill);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!active || still) { t.setValue(0); return; }
    // 3.2 s cycle: rest for 70%, then a quick tilt left, right and back (web: bm-wave).
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(2240),
      Animated.timing(t, { toValue: 1, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 2, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 3, duration: 192, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(t, { toValue: 4, duration: 384, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => { loop.stop(); t.setValue(0); };
  }, [active, still]);
  const rotate = t.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: ['0deg', '-14deg', '10deg', '-6deg', '0deg'] });
  const translateY = t.interpolate({ inputRange: [0, 1, 2, 3, 4], outputRange: [0, -3, -3, 0, 0] });
  // Pivot near the bottom, like the web's transform-origin 50% 90%.
  return (
    <Animated.View style={{ transform: [{ translateY: 9 }, { rotate }, { translateY: -9 }, { translateY }] }}>{children}</Animated.View>
  );
}

function Bubble({ who, label, text }: { who: 'team' | 'reporter' | 'bopmigo'; label: string; text: string }) {
  const box = who === 'team' ? s.team : who === 'reporter' ? s.mine : s.bot;
  return (
    <View style={[s.bubble, box]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
        {who === 'bopmigo' && <Migo size={13}/>}
        <Text style={[s.bubbleLabel, { color: who === 'reporter' ? 'rgba(255,255,255,0.6)' : C.rust }]}>{label}</Text>
      </View>
      <Text style={[s.bubbleText, who === 'reporter' && { color: '#fff' }]} selectable>{text}</Text>
    </View>
  );
}

function Row({ title, sub, fresh: isNew, onPress }: { title: string; sub: string; fresh?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: C.soft }]} accessibilityRole="button">
      <View style={{ flex: 1 }}><Text style={s.rowTitle} numberOfLines={2}>{title}</Text><Text style={[s.rowSub, isNew && s.new]}>{sub}</Text></View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

function Primary({ label, disabled, onPress, style }: { label: string; disabled?: boolean; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={({ pressed }) => [s.primary, disabled && { opacity: 0.4 }, pressed && { backgroundColor: '#000' }, style]}>
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** A picture of the screen, if react-native-view-shot is installed. Taken before the sheet opens. */
async function capture(): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const shot = require('react-native-view-shot');
    const b64: string = await shot.captureScreen({ format: 'jpg', quality: 0.7, result: 'base64' });
    // The server takes up to 2 MB; base64 is about 4/3 of the bytes.
    return b64 && b64.length < 2_600_000 ? b64.replace(/^data:image\/\w+;base64,/, '') : null;
  } catch { return null; }
}

const s = StyleSheet.create({
  trigger: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingLeft: 12, paddingRight: 18, borderRadius: 999, backgroundColor: C.ink, shadowColor: C.ink, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  triggerText: { color: '#fff', fontWeight: '600', fontSize: 14.5 },
  dot: { position: 'absolute', top: 6, right: 8, width: 9, height: 9, borderRadius: 9, backgroundColor: C.orange, borderWidth: 2, borderColor: C.ink },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22,19,15,0.32)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', paddingBottom: Platform.OS === 'ios' ? 28 : 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 5, backgroundColor: C.line, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 6 },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  h2: { fontSize: 18, fontWeight: '700', color: C.ink, flexShrink: 1 },
  h3: { fontSize: 16, fontWeight: '700', color: C.ink, flexShrink: 1 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 24, lineHeight: 26, color: C.muted },
  body: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 18, paddingVertical: 10, gap: 12 },
  types: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: C.soft },
  type: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  typeOn: { backgroundColor: '#fff', shadowColor: C.ink, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  typeText: { fontWeight: '600', fontSize: 13, color: C.muted },
  typeTextOn: { color: C.ink },
  label: { fontWeight: '600', fontSize: 14, color: C.ink },
  optional: { fontWeight: '400', color: C.faint },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, fontSize: 16, color: C.ink, textAlignVertical: 'top', backgroundColor: '#fff' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { color: C.rust, fontWeight: '700', fontSize: 12 },
  bubble: { maxWidth: '92%', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16 },
  team: { alignSelf: 'flex-start', backgroundColor: C.cream, borderWidth: 1, borderColor: '#F0EBE3', borderBottomLeftRadius: 6 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.ink, borderBottomRightRadius: 6 },
  bot: { alignSelf: 'flex-start', backgroundColor: C.peach, borderWidth: 1, borderStyle: 'dashed', borderColor: C.peachLine, borderBottomLeftRadius: 6 },
  bubbleLabel: { fontSize: 11.5, fontWeight: '700' },
  bubbleText: { fontSize: 14.5, lineHeight: 21, color: C.ink },
  error: { color: C.red, backgroundColor: '#FEF3F2', padding: 10, borderRadius: 10, fontSize: 13.5 },
  notice: { color: C.text, backgroundColor: C.soft, padding: 10, borderRadius: 10, fontSize: 13.5 },
  link: { color: C.muted, fontWeight: '600', fontSize: 14 },
  new: { color: C.rust, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.soft, minHeight: 52 },
  primary: { height: 40, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line },
  rowTitle: { color: C.ink, fontSize: 14.5, fontWeight: '500' },
  rowSub: { color: C.muted, fontSize: 12.5, marginTop: 2 },
  chev: { color: C.faint, fontSize: 22 },
  threadTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  status: { fontSize: 12, fontWeight: '600', color: C.muted, backgroundColor: C.soft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 4, paddingVertical: 28 },
  muted: { color: C.muted, textAlign: 'center' },
});
