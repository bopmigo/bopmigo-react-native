import Ionicons from '@expo/vector-icons/Ionicons';
import Bopmigo from 'bopmigo-react-native';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, SOFT, useDaybook, type Task } from '../../lib/daybook';
import { IconButton } from '../../lib/ui';

type Icon = keyof typeof Ionicons.glyphMap;

export default function Today() {
  const { tasks, toggle, user } = useDaybook();
  const top = useSafeAreaInsets().top;
  const now = new Date();
  const list = tasks.filter(t => t.day === now.getDay());
  const timed = list.filter(t => t.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const anytime = list.filter(t => !t.time);
  const left = list.filter(t => !t.done).length;
  const hour = now.getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const clock = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextIndex = timed.findIndex(t => !t.done && (t.end ?? t.time!) >= clock);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[s.page, { paddingTop: top + 12 }]}>
        <View style={s.top}>
          <View style={s.dateRow}>
            <Text style={s.bigDate}>{now.getDate()}</Text>
            <View style={s.dot}/>
            <View style={{ flex: 1 }}/>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton icon="chatbubble-ellipses-outline" label="Send feedback" onPress={() => Bopmigo.open()}/>
              <IconButton icon="add" label="Add a task" onPress={() => router.push('/new')} tint="#fff" filled/>
            </View>
          </View>
          <Text style={s.weekday}>{now.toLocaleDateString(undefined, { weekday: 'long' })}, {now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text>
          <Text style={s.greet}>{greet}, {user?.name.split(' ')[0]}.</Text>
          <Text style={s.left}>You have <Text style={s.leftStrong}>{left ? `${left} ${left === 1 ? 'task' : 'tasks'}` : 'nothing'}</Text> left today.</Text>
        </View>

        <View style={s.sheet}>
          <Text style={s.section}>Schedule</Text>
          {timed.map((t, i) => <Slot key={t.id} task={t} first={i === 0} last={i === timed.length - 1} now={i === nextIndex} onToggle={() => toggle(t.id)}/>)}

          {anytime.length > 0 && <>
            <Text style={[s.section, { marginTop: 18 }]}>Anytime</Text>
            {anytime.map(t => (
              <Pressable key={t.id} onPress={() => toggle(t.id)} style={({ pressed }) => [s.any, pressed && { opacity: 0.7 }]} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }}>
                <View style={[s.smallTile, { backgroundColor: SOFT[t.list] }]}><Ionicons name={(t.icon ?? 'ellipse') as Icon} size={15} color={C[t.list]}/></View>
                <Text style={[s.anyTitle, t.done && s.done]}>{t.title}</Text>
                <Check on={t.done} color={C[t.list]}/>
              </Pressable>
            ))}
          </>}
        </View>
      </ScrollView>

    </View>
  );
}

function Slot({ task, first, last, now, onToggle }: { task: Task; first: boolean; last: boolean; now: boolean; onToggle: () => void }) {
  const color = C[task.list];
  return (
    <Pressable onPress={onToggle} style={s.slot} accessibilityRole="checkbox" accessibilityState={{ checked: task.done }}>
      <Text style={s.slotTime}>{task.time}</Text>
      <View style={s.rail}>
        <View style={[s.railLine, first && { top: 22 }, last && { bottom: '50%' }]}/>
        <View style={[s.node, { backgroundColor: task.done ? '#F2F2F5' : color }]}>
          <Ionicons name={(task.icon ?? 'ellipse') as Icon} size={18} color={task.done ? C.muted : '#fff'}/>
        </View>
      </View>
      <View style={s.slotBody}>
        {now && <Text style={[s.nowTag, { color }]}>UP NEXT</Text>}
        <Text style={[s.slotTitle, task.done && s.done]} numberOfLines={1}>{task.title}</Text>
        <Text style={s.slotMeta}>{task.time}{task.end ? ` to ${task.end}` : ''} · {task.list}</Text>
      </View>
      <Check on={task.done} color={color}/>
    </Pressable>
  );
}

function Check({ on, color }: { on: boolean; color: string }) {
  return <View style={[s.check, { borderColor: color }, on && { backgroundColor: color }]}>{on && <Ionicons name="checkmark" size={14} color="#fff"/>}</View>;
}

const s = StyleSheet.create({
  page: { paddingBottom: 120 },
  top: { paddingHorizontal: 22, paddingBottom: 22 },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  bigDate: { fontSize: 56, fontWeight: '700', color: C.ink, letterSpacing: -2 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, marginLeft: 8, marginTop: 10 },
  weekday: { color: C.muted, fontSize: 17, fontWeight: '500', marginTop: -4 },
  greet: { fontSize: 22, fontWeight: '600', color: C.ink, marginTop: 18 },
  left: { fontSize: 22, fontWeight: '600', color: '#B0B0B6', marginTop: 2 },
  leftStrong: { color: C.ink },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 30, minHeight: 520 },
  section: { color: C.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  slot: { flexDirection: 'row', alignItems: 'center', minHeight: 72 },
  slotTime: { width: 46, color: C.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  rail: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#ECECF0' },
  node: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  slotBody: { flex: 1, paddingHorizontal: 12, gap: 2 },
  nowTag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  slotTitle: { fontSize: 16, fontWeight: '600', color: C.ink },
  slotMeta: { fontSize: 13, color: C.muted },
  done: { color: C.muted, textDecorationLine: 'line-through' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  any: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  smallTile: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  anyTitle: { flex: 1, fontSize: 16, color: C.ink },
});
