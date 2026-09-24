import { Stack } from 'expo-router';

export default function LayoutApp() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="(pestanas)" options={{ headerShown: false }} />
      <Stack.Screen name="cuenta" options={{ title: 'Cuenta y ajustes' }} />
    </Stack>
  );
}
