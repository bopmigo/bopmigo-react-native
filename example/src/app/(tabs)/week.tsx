import Ionicons from '@expo/vector-icons/Ionicons';
import Bopmigo from 'bopmigo-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C, DAYS, SOFT, useDaybook } from '../../lib/daybook';
import { Header } from '../../lib/ui';

type Icon = keyof typeof Ionicons.glyphMap;
const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function Week() {
  const { tasks } = useDaybook();
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(now.getDate() + i); return d; });
  const all = days.flatMap(d => tasks.filter(t => t.day === d.getDay()));
  const done = all.filter(t => t.done).length;
  const busiest = days.reduce((a, d) => tasks.filter(t => t.day === d.getDay()).length > tasks.filter(t => t.day === a.getDay()).length ? d : a, days[0]);

  return (
    <View style={{ flex: 1 }}>
      <Header eyebrow={`${short(days[0]).toUpperCase()} TO ${short(days[6]).toUpperCase()}`} title="This week"/>
      <ScrollView contentContainerStyle={s.page} contentInsetAdjustmentBehavior="never">
        <View style={s.stats}>
          <Stat icon="list" color={C.accent} value={String(all.length)} label="Planned"/>
          <Stat icon="checkmark-done" color={C.Health} value={String(done)} label="Done"/>
          <Stat icon="flame" color={C.Home} value={DAYS[busiest.getDay()]} label="Busiest day"/>
        </View>

        {days.map((d, i) => {
          const list = tasks.filter(t => t.day === d.getDay()).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
          const today = i === 0;
          return (
            <View key={i} style={s.day}>
              <View style={s.dayCol}>
                <Text style={[s.dayName, today && { color: C.accent }]}>{DAYS[d.getDay()]}</Text>
                <View style={[s.dayNum, today && s.dayNumOn]}><Text style={[s.dayNumText, today && { color: '#fff' }]}>{d.getDate()}</Text></View>
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                {list.length ? list.map(t => (
                  <View key={t.id} style={s.item}>
                    <View style={[s.tile, { backgroundColor: SOFT[t.list] }]}><Ionicons name={(t.icon ?? 'ellipse') as Icon} size={18} color={C[t.list]}/></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.title, t.done && { color: C.muted, textDecorationLine: 'line-through' }]} numberOfLines={1}>{t.title}</Text>
                      <Text style={s.meta}>{t.time ? `${t.time}${t.end ? ` to ${t.end}` : ''}` : 'Anytime'} · {t.list}</Text>
                    </View>
                    {t.done && <Ionicons name="checkmark-circle" size={20} color={C[t.list]}/>}
                  </View>
                )) : <View style={s.free}><Text style={s.freeText}>Free day</Text></View>}
              </View>
            </View>
          );
        })}

        {/* Asking at the right moment: your own question opens Bopmigo with it shown above the box. */}
        <View style={s.prompt}>
          <View style={s.promptIcon}><Ionicons name="sparkles" size={18} color={C.accent}/></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.promptTitle}>How’s your first week going?</Text>
            <Text style={s.meta}>Tell us what works and what doesn’t.</Text>
          </View>
          <Pressable style={s.promptButton} onPress={() => Bopmigo.open({ type: 'idea', message: 'How was your first week planning with Daybook?' })} accessibilityRole="button">
            <Text style={s.promptButtonText}>Share</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ icon, color, value, label }: { icon: Icon; color: string; value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={18} color={color}/>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, gap: 6 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  statLabel: { fontSize: 12, color: C.muted, fontWeight: '500' },
  day: { flexDirection: 'row', gap: 12 },
  dayCol: { width: 44, alignItems: 'center', paddingTop: 6, gap: 4 },
  dayName: { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase' },
  dayNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayNumOn: { backgroundColor: C.accent },
  dayNumText: { fontSize: 17, fontWeight: '600', color: C.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 12 },
  tile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: C.ink },
  meta: { fontSize: 13, color: C.muted, marginTop: 1 },
  free: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D4D4DA', paddingVertical: 16, alignItems: 'center' },
  freeText: { color: C.muted, fontSize: 14 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 6 },
  promptIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  promptTitle: { fontSize: 15, fontWeight: '600', color: C.ink },
  promptButton: { backgroundColor: C.accent, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  promptButtonText: { color: '#fff', fontWeight: '600' },
});
