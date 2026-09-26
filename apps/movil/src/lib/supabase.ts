// Cliente de Supabase.
//
// Proyecto de FoodApp (región UE, Fráncfort). La URL y la clave publicable son públicas por
// diseño: viajan dentro de la app instalada y solo permiten lo que autorizan las políticas de
// seguridad de la base de datos. Nunca se pone aquí la clave secreta (service_role).
// Las variables EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY, si existen, tienen
// prioridad (por ejemplo, para apuntar a un proyecto local o de pruebas).

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { almacenamientoSesion } from './almacenamientoSesion';

const PROYECTO = {
  url: 'https://jepnoulrnrojnwmwvaip.supabase.co',
  clavePublicable: 'sb_publishable_vKAg57Brolw2ioDqegC60Q_tZAqZSEn',
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || PROYECTO.url;
const clavePublica = process.env.EXPO_PUBLIC_SUPABASE_KEY || PROYECTO.clavePublicable;

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
