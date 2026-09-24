import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabaseConfigurado } from '../lib/supabase';
import { ProveedorSesion, useSesion } from '../sesion/ProveedorSesion';
import { Aviso, Cargando, Pantalla, Parrafo, Titulo } from '../ui/componentes';

SplashScreen.preventAutoHideAsync();

export default function RaizApp() {
  const esquema = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={esquema === 'dark' ? DarkTheme : DefaultTheme}>
        <StatusBar style="auto" />
        {supabaseConfigurado ? (
          <ProveedorSesion>
            <Navegacion />
          </ProveedorSesion>
        ) : (
          <ConfiguracionPendiente />
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navegacion() {
  const { zona } = useSesion();

  useEffect(() => {
    if (zona !== 'cargando') SplashScreen.hideAsync();
  }, [zona]);

  // Mientras se comprueba la sesión no se monta la navegación: con todas las zonas cerradas,
  // el enrutador abriría la primera pantalla libre (la de verificación del correo).
  if (zona === 'cargando') return <Cargando />;

  return (
    <Stack screenOptions={{ headerBackTitle: 'Atrás' }}>
      <Stack.Protected guard={zona === 'publica'}>
        <Stack.Screen name="(publico)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={zona === 'completar_registro'}>
        <Stack.Screen name="completar-registro" options={{ title: 'Completar registro' }} />
      </Stack.Protected>
      <Stack.Protected guard={zona === 'error_cuenta'}>
        <Stack.Screen name="error-cuenta" options={{ title: 'FoodApp' }} />
      </Stack.Protected>
      <Stack.Protected guard={zona === 'app'}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Accesibles en cualquier estado: enlaces de los correos y textos legales. */}
      <Stack.Screen name="confirmar" options={{ title: 'Verificación del correo' }} />
      <Stack.Screen name="nueva-contrasena" options={{ title: 'Nueva contraseña' }} />
      <Stack.Screen name="textos-legales" options={{ title: 'Textos legales', presentation: 'modal' }} />
    </Stack>
  );
}

function ConfiguracionPendiente() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <Pantalla centrada>
      <Titulo>Falta la configuración</Titulo>
      <Aviso tipo="aviso">
        La aplicación no tiene configurada la conexión con el servidor. Define EXPO_PUBLIC_SUPABASE_URL y
        EXPO_PUBLIC_SUPABASE_KEY en el archivo .env de apps/movil (hay un ejemplo en .env.example).
      </Aviso>
      <Parrafo secundario>Este mensaje solo aparece en compilaciones de desarrollo sin configurar.</Parrafo>
    </Pantalla>
  );
}
