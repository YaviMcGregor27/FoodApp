import { Stack } from 'expo-router';

export default function LayoutApp() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Screen name="(pestanas)" options={{ headerShown: false }} />
      <Stack.Screen name="cuenta" options={{ title: 'Cuenta y ajustes' }} />
      <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
      <Stack.Screen name="anadir" options={{ title: 'Añadir producto', presentation: 'modal' }} />
      <Stack.Screen name="salida" options={{ title: 'Consumir', presentation: 'modal' }} />
      <Stack.Screen name="corregir" options={{ title: 'Corregir cantidad', presentation: 'modal' }} />
      <Stack.Screen name="editar-lote" options={{ title: 'Fecha y ubicación', presentation: 'modal' }} />
    </Stack>
  );
}
