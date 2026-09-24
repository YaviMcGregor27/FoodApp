import { Stack } from 'expo-router';

export default function LayoutPublico() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="iniciar-sesion" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="recuperar" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="verificar-correo" options={{ title: 'Verifica tu correo' }} />
    </Stack>
  );
}
