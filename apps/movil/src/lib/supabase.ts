// Cliente de Supabase. La URL y la clave pública del proyecto se leen de las variables de
// entorno EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY (ver apps/movil/.env.example).
// La clave pública solo permite lo que autorizan las políticas de la base de datos.

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { almacenamientoSesion } from './almacenamientoSesion';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const clavePublica = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const supabaseConfigurado = Boolean(url && clavePublica);

export const supabase: SupabaseClient | null = supabaseConfigurado
  ? createClient(url!, clavePublica!, {
      auth: {
        storage: almacenamientoSesion,
        autoRefreshToken: true,
        persistSession: true,
        // Los enlaces de verificación y recuperación los procesan sus propias pantallas.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

// En el móvil, la renovación automática del token solo debe funcionar con la app en primer plano.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

/** Devuelve el cliente o lanza un error si la app no está configurada. */
export function cliente(): SupabaseClient {
  if (!supabase) throw new Error('SUPABASE_NO_CONFIGURADO');
  return supabase;
}
