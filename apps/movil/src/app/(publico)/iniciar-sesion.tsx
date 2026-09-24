import { router } from 'expo-router';
import { useState } from 'react';
import { cliente } from '../../lib/supabase';
import { mensajeError } from '../../logica/erroresAuth';
import { hayErrores, validarInicioSesion, type Errores } from '../../logica/registro';
import { Aviso, Boton, Campo, Pantalla } from '../../ui/componentes';

export default function IniciarSesion() {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<Errores<'correo' | 'contrasena'>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    const e = validarInicioSesion({ correo, contrasena });
    setErrores(e);
    setErrorGeneral(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const { error } = await cliente().auth.signInWithPassword({ email: correo.trim(), password: contrasena });
    setEnviando(false);
    if (error?.code === 'email_not_confirmed') {
      router.push({ pathname: '/verificar-correo', params: { correo: correo.trim() } });
      return;
    }
    // Si no hay error, la navegación cambia sola al detectar la nueva sesión.
    setErrorGeneral(mensajeError(error, 'inicio'));
  }

  return (
    <Pantalla>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      <Campo
        etiqueta="Correo electrónico"
        value={correo}
        onChangeText={setCorreo}
        error={errores.correo}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Campo
        etiqueta="Contraseña"
        value={contrasena}
        onChangeText={setContrasena}
        error={errores.contrasena}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={entrar}
      />
      <Boton texto="Iniciar sesión" onPress={entrar} cargando={enviando} />
      <Boton texto="He olvidado mi contraseña" variante="enlace" onPress={() => router.push('/recuperar')} />
    </Pantalla>
  );
}
