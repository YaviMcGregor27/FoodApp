import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';
import { useColores } from '../../../ui/tema';

type NombreIcono = ComponentProps<typeof Ionicons>['name'];

const PESTANAS: { nombre: string; titulo: string; icono: NombreIcono }[] = [
  { nombre: 'index', titulo: 'Hoy', icono: 'today-outline' },
  { nombre: 'despensa', titulo: 'Despensa', icono: 'file-tray-stacked-outline' },
  { nombre: 'escanear', titulo: 'Escanear', icono: 'scan-outline' },
  { nombre: 'recetas', titulo: 'Recetas', icono: 'restaurant-outline' },
  { nombre: 'progreso', titulo: 'Progreso', icono: 'trending-up-outline' },
];

export default function LayoutPestanas() {
  const c = useColores();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primario,
        tabBarInactiveTintColor: c.textoSecundario,
        headerRight: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cuenta y ajustes"
            onPress={() => router.push('/cuenta')}
            style={{ paddingHorizontal: 16, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: c.primario, fontSize: 16, fontWeight: '600' }}>Cuenta</Text>
          </Pressable>
        ),
      }}
    >
      {PESTANAS.map((p) => (
        <Tabs.Screen
          key={p.nombre}
          name={p.nombre}
          options={{
            title: p.titulo,
            tabBarIcon: ({ color, size }) => <Ionicons name={p.icono} color={color} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
