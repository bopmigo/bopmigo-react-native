import Bopmigo, { BopmigoProvider } from 'bopmigo-react-native';
import Constants from 'expo-constants';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { DaybookProvider, useDaybook } from '../lib/daybook';

// Your app ID is in Bopmigo under Settings. The host line is only for testing against staging.
Bopmigo.configure({
  appId: process.env.EXPO_PUBLIC_BOPMIGO_APP_ID ?? '',
  host: process.env.EXPO_PUBLIC_BOPMIGO_HOST,
  release: Constants.expoConfig?.version,
  screenshots: true,
});

const SCREENS: Record<string, string> = { '/': 'Today', '/week': 'Week', '/settings': 'Settings', '/new': 'New task' };

function Wiring() {
  const { user } = useDaybook();
  const path = usePathname();
  // Tell Bopmigo who is signed in, so the team can see who wrote and message them.
  useEffect(() => {
    Bopmigo.identify(user ? { id: user.id, email: user.email, name: user.name } : null);
    Bopmigo.setContext(user ? { plan: user.plan } : {});
  }, [user]);
  useEffect(() => { Bopmigo.setScreen(SCREENS[path] ?? path); }, [path]);
  return null;
}

export default function RootLayout() {
  return (
    <DaybookProvider>
      <BopmigoProvider button={false}>
        <Wiring/>
        <StatusBar style="dark"/>
        <Stack screenOptions={{ headerShadowVisible: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }}/>
          <Stack.Screen name="new" options={{ presentation: 'modal', title: 'New task' }}/>
        </Stack>
      </BopmigoProvider>
    </DaybookProvider>
  );
}
