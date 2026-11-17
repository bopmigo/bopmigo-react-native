import Ionicons from '@expo/vector-icons/Ionicons';
import Bopmigo from 'bopmigo-react-native';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { C, useDaybook } from '../../lib/daybook';

export default function TabLayout() {
  const { ready, user } = useDaybook();
  const [waiting, setWaiting] = useState(0);
  // A reply or a message from the team shows as a badge on Settings.
  useEffect(() => Bopmigo.on('unread', u => setWaiting(u.replies + u.messages)), []);
  if (!ready || !user) return null;
  return (
    <Tabs screenOptions={{
      headerShown: false, sceneStyle: { backgroundColor: C.bg },
      tabBarActiveTintColor: C.accent, tabBarInactiveTintColor: C.muted,
      tabBarStyle: { backgroundColor: 'rgba(255,255,255,0.97)', borderTopColor: C.line },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'sunny' : 'sunny-outline'} size={size} color={color as string}/> }}/>
      <Tabs.Screen name="week" options={{ title: 'Week', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size} color={color as string}/> }}/>
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarBadge: waiting || undefined, tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color as string}/> }}/>
    </Tabs>
  );
}
