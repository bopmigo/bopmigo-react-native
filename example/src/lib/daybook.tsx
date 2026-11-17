import Bopmigo from 'bopmigo-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type List = 'Work' | 'Home' | 'Health';
export type Task = { id: string; title: string; time?: string; end?: string; list: List; done: boolean; day: number; icon?: string };
export type User = { id: string; name: string; email: string; plan: 'free' | 'plus' };

const today = new Date().getDay();
const at = (d: number) => (today + d) % 7;
const SEED: Task[] = [
  { id: 't1', title: 'Stand-up with design', time: '09:30', end: '09:45', list: 'Work', done: true, day: today, icon: 'people' },
  { id: 't2', title: 'Review Q3 roadmap draft', time: '11:00', end: '12:00', list: 'Work', done: false, day: today, icon: 'document-text' },
  { id: 't8', title: 'Lunch with Maya', time: '12:30', end: '13:30', list: 'Home', done: false, day: today, icon: 'restaurant' },
  { id: 't4', title: 'Run, 5 km', time: '18:00', end: '18:40', list: 'Health', done: false, day: today, icon: 'walk' },
  { id: 't3', title: 'Pick up dry cleaning', list: 'Home', done: false, day: today, icon: 'shirt' },
  { id: 't13', title: 'Reply to Northwind', list: 'Work', done: false, day: today, icon: 'mail' },
  { id: 't5', title: 'Dentist', time: '08:15', end: '09:00', list: 'Health', done: false, day: at(1), icon: 'medkit' },
  { id: 't9', title: 'Quarterly planning', time: '14:00', end: '15:30', list: 'Work', done: false, day: at(1), icon: 'stats-chart' },
  { id: 't10', title: 'Yoga', time: '07:00', end: '07:45', list: 'Health', done: false, day: at(2), icon: 'body' },
  { id: 't6', title: 'Send invoice to Northwind', list: 'Work', done: false, day: at(2), icon: 'receipt' },
  { id: 't7', title: 'Book flights for May', list: 'Home', done: false, day: at(3), icon: 'airplane' },
  { id: 't11', title: 'Team retro', time: '16:00', end: '17:00', list: 'Work', done: false, day: at(4), icon: 'chatbubbles' },
  { id: 't12', title: 'Farmers market', time: '10:00', end: '11:30', list: 'Home', done: false, day: at(5), icon: 'basket' },
];

const PEOPLE = [['Maria', 'Lopez'], ['Sam', 'Carter'], ['Priya', 'Shah'], ['Leo', 'Martin'], ['Hannah', 'Okafor'], ['Noah', 'Kim']];

type Store = {
  ready: boolean; user: User | null; tasks: Task[];
  toggle(id: string): void; add(title: string, list: List, time?: string): void;
};
const Ctx = createContext<Store | null>(null);

export function DaybookProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(SEED);
  useEffect(() => {
    // No sign-in in this example: each install gets its own sample person, so testers show up separately in Bopmigo.
    AsyncStorage.getItem('daybook.person').then(v => {
      if (v) return setUser(JSON.parse(v));
      const [first, last] = PEOPLE[Math.floor(Math.random() * PEOPLE.length)];
      const u: User = { id: `usr_${Math.random().toString(36).slice(2, 10)}`, name: `${first} ${last}`, email: `${first}.${last}@example.com`.toLowerCase(), plan: 'plus' };
      setUser(u); void AsyncStorage.setItem('daybook.person', JSON.stringify(u));
    }).finally(() => setReady(true));
  }, []);
  const store: Store = {
    ready, user, tasks,
    toggle: id => {
      const task = tasks.find(x => x.id === id);
      setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
      if (task && !task.done) void askAfterFirstTask();
    },
    add: (title, list, time) => setTasks(t => [...t, { id: `t${Date.now()}`, title, time, list, done: false, day: today, icon: list === 'Work' ? 'briefcase' : list === 'Home' ? 'home' : 'heart' }]),
  };
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
// The first time someone ticks off a task, ask how it went. Asked once per install.
async function askAfterFirstTask() {
  if (await AsyncStorage.getItem('daybook.askedFirstTask')) return;
  await AsyncStorage.setItem('daybook.askedFirstTask', '1');
  setTimeout(() => Bopmigo.open({ type: 'idea', message: 'You finished your first task. How was planning it in Daybook?' }), 700);
}
export const useDaybook = () => useContext(Ctx)!;
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Neutral, system-like palette: white surfaces on a light grey background, one blue accent.
export const C = {
  bg: '#F2F2F7', card: '#FFFFFF', ink: '#111114', text: '#3C3C43', muted: '#8A8A8E', line: '#E5E5EA',
  accent: '#2563EB', accentSoft: '#EAF1FE', danger: '#E5484D',
  Work: '#2563EB', Home: '#D97706', Health: '#16A34A',
};
/** Soft background for each list's icon tile. */
export const SOFT: Record<List, string> = { Work: '#EAF1FE', Home: '#FDF1E3', Health: '#E6F6EC' };
export const initials = (name?: string) => (name ?? '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
