import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { C, SOFT, useDaybook, type List } from '../lib/daybook';

const TIMES = ['Anytime', '09:00', '12:00', '15:00', '18:00'];
const LISTS: { name: List; icon: keyof typeof Ionicons.glyphMap }[] = [{ name: 'Work', icon: 'briefcase' }, { name: 'Home', icon: 'home' }, { name: 'Health', icon: 'heart' }];

export default function NewTask() {
  const { add } = useDaybook();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('Anytime');
  const [list, setList] = useState<List>('Work');
  const ok = !!title.trim();
  const save = () => { if (!ok) return; add(title.trim(), list, time === 'Anytime' ? undefined : time); router.back(); };
  return (
    <>
      <Stack.Screen options={{
        title: 'New task', headerStyle: { backgroundColor: C.bg },
        headerLeft: () => <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button"><Text style={s.cancel}>Cancel</Text></Pressable>,
        headerRight: () => <Pressable onPress={save} disabled={!ok} hitSlop={10} accessibilityRole="button"><Text style={[s.addText, !ok && { opacity: 0.35 }]}>Add</Text></Pressable>,
      }}/>
      <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.card}>
          <TextInput value={title} onChangeText={setTitle} placeholder="What needs doing?" placeholderTextColor={C.muted} style={s.input} autoFocus returnKeyType="done" onSubmitEditing={save} accessibilityLabel="Task"/>
        </View>

        <Text style={s.section}>Time</Text>
        <View style={s.chips}>
          {TIMES.map(t => (
            <Pressable key={t} onPress={() => setTime(t)} style={[s.chip, time === t && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: time === t }}>
              <Text style={[s.chipText, time === t && { color: '#fff' }]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.section}>List</Text>
        <View style={s.card}>
          {LISTS.map((l, i) => (
            <Pressable key={l.name} onPress={() => setList(l.name)} style={[s.row, i < LISTS.length - 1 && s.line]} accessibilityRole="button" accessibilityState={{ selected: list === l.name }}>
              <View style={[s.tile, { backgroundColor: SOFT[l.name] }]}><Ionicons name={l.icon} size={16} color={C[l.name]}/></View>
              <Text style={s.rowText}>{l.name}</Text>
              {list === l.name && <Ionicons name="checkmark" size={20} color={C.accent}/>}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 8 },
  cancel: { color: C.accent, fontSize: 17 },
  addText: { color: C.accent, fontSize: 17, fontWeight: '600' },
  card: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  input: { paddingHorizontal: 16, height: 54, fontSize: 17, color: C.ink },
  section: { color: C.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginLeft: 4, marginTop: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: C.card },
  chipOn: { backgroundColor: C.accent },
  chipText: { color: C.ink, fontWeight: '500', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 50 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  tile: { width: 29, height: 29, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 16, color: C.ink },
});
