import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { cliente } from '../lib/supabase';
import { Aviso, Boton, Cargando, Pantalla } from '../ui/componentes';

// Destino del enlace de verificación del correo. Supabase ya ha verificado el correo antes de
// redirigir aquí; esta pantalla intenta además iniciar la sesión con el código del enlace.
export default function Confirmar() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [estado, setEstado] = useState<'procesando' | 'hecho' | 'sin_sesion' | 'error'>('procesando');

  useEffect(() => {
    if (error_description || !code) {
      setEstado('error');
      return;
    }
    cliente()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => setEstado(error ? 'sin_sesion' : 'hecho'));
  }, [code, error_description]);

  useEffect(() => {
    if (estado === 'hecho') router.replace('/');
  }, [estado]);

  if (estado === 'procesando' || estado === 'hecho') return <Cargando />;

  return (
    <Pantalla centrada>
      {estado === 'sin_sesion' ? (
        <Aviso tipo="info">Tu correo está verificado. Inicia sesión para continuar.</Aviso>
      ) : (
        <Aviso tipo="error">
          El enlace no es válido o ha caducado. Inicia sesión: si tu correo no está verificado, podrás pedir un enlace
          nuevo.
        </Aviso>
      )}
      <Boton texto="Continuar" onPress={() => router.replace('/')} />
    </Pantalla>
  );
}
