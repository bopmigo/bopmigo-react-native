import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './daybook';

/** Large title header used by every tab, with an optional eyebrow line and action. */
export function Header({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  const top = useSafeAreaInsets().top;
  return (
    <View style={[h.wrap, { paddingTop: top + 8 }]}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={h.eyebrow}>{eyebrow}</Text>}
        <Text style={h.title} accessibilityRole="header">{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function IconButton({ icon, label, onPress, tint = C.accent, filled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tint?: string; filled?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [h.icon, filled && { backgroundColor: C.accent, borderColor: C.accent }, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={20} color={tint}/>
    </Pressable>
  );
}

const h = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  eyebrow: { color: C.muted, fontSize: 13, fontWeight: '600', letterSpacing: 0.2, marginBottom: 2 },
  title: { color: C.ink, fontSize: 32, fontWeight: '700', letterSpacing: -0.6 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
});
