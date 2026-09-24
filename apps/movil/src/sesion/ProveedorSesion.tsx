import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { decidirZona, type Zona } from '../logica/rutas';

export interface EstadoCuenta {
  registroCompleto: boolean;
  correoVerificado: boolean;
  consentimientoDatosSalud: boolean;
}

interface ValorSesion {
  sesion: Session | null;
  cuenta: EstadoCuenta | null;
  zona: Zona;
  recargarCuenta: () => Promise<void>;
  cerrarSesion: (todosLosDispositivos?: boolean) => Promise<void>;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cuenta, setCuenta] = useState<EstadoCuenta | null>(null);
  const [errorCuenta, setErrorCuenta] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setCargandoSesion(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, nueva) => setSesion(nueva));
    return () => data.subscription.unsubscribe();
  }, []);

  const idUsuario = sesion?.user.id ?? null;

  const recargarCuenta = useCallback(async () => {
    if (!supabase || !idUsuario) {
      setCuenta(null);
      setErrorCuenta(false);
      return;
    }
    setErrorCuenta(false);
    const { data, error } = await supabase.rpc('estado_cuenta').single<{
      registro_completo: boolean;
      correo_verificado: boolean;
      consentimiento_datos_salud: boolean;
    }>();
    if (error || !data) {
      setCuenta(null);
      setErrorCuenta(true);
      return;
    }
    setCuenta({
      registroCompleto: data.registro_completo,
      correoVerificado: data.correo_verificado,
      consentimientoDatosSalud: data.consentimiento_datos_salud,
    });
  }, [idUsuario]);

  useEffect(() => {
    setCuenta(null);
    void recargarCuenta();
  }, [recargarCuenta]);

  const cerrarSesion = useCallback(async (todosLosDispositivos = false) => {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: todosLosDispositivos ? 'global' : 'local' });
  }, []);

  const zona = decidirZona({
    cargando: cargandoSesion,
    conSesion: sesion !== null,
    registroCompleto: cuenta?.registroCompleto ?? null,
    errorEstado: errorCuenta,
  });

  const valor = useMemo(
    () => ({ sesion, cuenta, zona, recargarCuenta, cerrarSesion }),
    [sesion, cuenta, zona, recargarCuenta, cerrarSesion],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
