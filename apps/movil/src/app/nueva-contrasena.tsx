import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { cliente } from '../lib/supabase';
import { mensajeError } from '../logica/erroresAuth';
import { hayErrores, validarNuevaContrasena, type DatosNuevaContrasena, type Errores } from '../logica/registro';
import { Aviso, Boton, Campo, Cargando, Pantalla } from '../ui/componentes';

// Destino del enlace de recuperación de contraseña.
export default function NuevaContrasena() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [fase, setFase] = useState<'validando' | 'formulario' | 'enlace_invalido' | 'hecho'>('validando');
  const [datos, setDatos] = useState<DatosNuevaContrasena>({ contrasena: '', repetirContrasena: '' });
  const [errores, setErrores] = useState<Errores<keyof DatosNuevaContrasena>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!code) {
      setFase('enlace_invalido');
      return;
    }
    cliente()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => setFase(error ? 'enlace_invalido' : 'formulario'));
  }, [code]);

  async function guardar() {
    const e = validarNuevaContrasena(datos);
    setErrores(e);
    setErrorGeneral(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const auth = cliente().auth;
    const { error } = await auth.updateUser({ password: datos.contrasena });
    if (!error) {
      // Cierra las demás sesiones abiertas con la contraseña anterior (RF-01).
      await auth.signOut({ scope: 'others' });
    }
    setEnviando(false);
    if (error) {
      setErrorGeneral(mensajeError(error, 'nueva_contrasena'));
      return;
    }
    setFase('hecho');
  }

  if (fase === 'validando') return <Cargando />;

  if (fase === 'enlace_invalido') {
    return (
      <Pantalla centrada>
        <Aviso tipo="error">
          El enlace no es válido o ha caducado. Solicita uno nuevo desde "He olvidado mi contraseña" y ábrelo en este
          dispositivo.
        </Aviso>
        <Boton texto="Continuar" onPress={() => router.replace('/')} />
      </Pantalla>
    );
  }

  if (fase === 'hecho') {
    return (
      <Pantalla centrada>
        <Aviso tipo="info">Contraseña cambiada. Se han cerrado las sesiones abiertas en otros dispositivos.</Aviso>
        <Boton texto="Continuar" onPress={() => router.replace('/')} />
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      <Campo
        etiqueta="Nueva contraseña"
        value={datos.contrasena}
        onChangeText={(v) => setDatos((d) => ({ ...d, contrasena: v }))}
        error={errores.contrasena}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Campo
        etiqueta="Repite la nueva contraseña"
        value={datos.repetirContrasena}
        onChangeText={(v) => setDatos((d) => ({ ...d, repetirContrasena: v }))}
        error={errores.repetirContrasena}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Boton texto="Guardar contraseña" onPress={guardar} cargando={enviando} />
    </Pantalla>
  );
}
