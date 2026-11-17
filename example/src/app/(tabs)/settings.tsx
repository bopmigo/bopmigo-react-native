import Ionicons from '@expo/vector-icons/Ionicons';
import Bopmigo from 'bopmigo-react-native';
import Constants from 'expo-constants';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { C, initials, useDaybook } from '../../lib/daybook';
import { Header } from '../../lib/ui';

type Icon = keyof typeof Ionicons.glyphMap;

export default function Settings() {
  const { user } = useDaybook();
  const [waiting, setWaiting] = useState({ replies: 0, messages: 0 });
  const [reminders, setReminders] = useState(true);
  const [monday, setMonday] = useState(true);
  useEffect(() => Bopmigo.on('unread', setWaiting), []);
  const unread = waiting.replies + waiting.messages;
  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings"/>
      <ScrollView contentContainerStyle={s.page} contentInsetAdjustmentBehavior="never">
        <View style={[s.group, s.profile]}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials(user?.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.muted}>{user?.email}</Text>
          </View>
          <View style={s.plan}><Text style={s.planText}>Plus</Text></View>
        </View>

        <Group title="Planning">
          <Row icon="notifications" color="#E5484D" label="Reminders" right={<Switch value={reminders} onValueChange={setReminders}/>}/>
          <Row icon="calendar" color="#2563EB" label="Week starts on Monday" right={<Switch value={monday} onValueChange={setMonday}/>}/>
          <Row icon="time" color="#7C3AED" label="Default reminder" value="15 min before" last/>
        </Group>

        <Group title="Help and feedback">
          <Row icon="chatbubble-ellipses" color="#2563EB" label="Send feedback" onPress={() => Bopmigo.open()}/>
          <Row icon="bug" color="#D97706" label="Report a problem" onPress={() => Bopmigo.open({ type: 'problem' })}/>
          <Row icon="mail" color="#16A34A" label="Your feedback and replies" badge={unread} onPress={() => Bopmigo.showReplies()} last/>
        </Group>

        <Group title="About">
          <Row icon="lock-closed" color="#64748B" label="Privacy" onPress={() => {}}/>
          <Row icon="information-circle" color="#64748B" label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} last/>
        </Group>

      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ gap: 6 }}><Text style={s.section}>{title}</Text><View style={s.group}>{children}</View></View>;
}

function Row({ icon, color, label, value, right, badge, onPress, last }: { icon: Icon; color: string; label: string; value?: string; right?: ReactNode; badge?: number; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.row, pressed && s.pressed]} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={[s.tile, { backgroundColor: color }]}><Ionicons name={icon} size={16} color="#fff"/></View>
      <View style={[s.rowBody, !last && s.line]}>
        <Text style={s.label}>{label}</Text>
        {!!value && <Text style={s.value}>{value}</Text>}
        {!!badge && <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>}
        {right ?? (onPress && <Ionicons name="chevron-forward" size={17} color="#C4C4C7"/>)}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 22 },
  group: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 19, fontWeight: '600' },
  name: { fontSize: 18, fontWeight: '600', color: C.ink },
  muted: { color: C.muted, fontSize: 14, marginTop: 1 },
  plan: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  planText: { color: C.accent, fontWeight: '600', fontSize: 12 },
  section: { color: C.muted, fontSize: 13, fontWeight: '600', marginLeft: 16, textTransform: 'uppercase', letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, minHeight: 48 },
  pressed: { backgroundColor: '#ECECF0' },
  tile: { width: 29, height: 29, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingRight: 14 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  label: { flex: 1, fontSize: 16, color: C.ink },
  value: { color: C.muted, fontSize: 15 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
