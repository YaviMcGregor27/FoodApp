import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { enlaceConfirmacion } from '../../lib/enlaces';
import { cliente } from '../../lib/supabase';
import { mensajeError } from '../../logica/erroresAuth';
import { VERSION_DATOS_SALUD, VERSION_TERMINOS } from '../../logica/legal';
import {
  LONGITUD_MINIMA_CONTRASENA,
  hayErrores,
  hoyLocal,
  parsearFecha,
  validarRegistro,
  type DatosRegistro,
  type Errores,
} from '../../logica/registro';
import { Aviso, Boton, Campo, Casilla, Pantalla, Parrafo } from '../../ui/componentes';
import { useColores } from '../../ui/tema';

export default function Registro() {
  const c = useColores();
  const [datos, setDatos] = useState<DatosRegistro>({
    correo: '',
    contrasena: '',
    repetirContrasena: '',
    fechaNacimiento: '',
    aceptaTerminos: false,
  });
  const [aceptaDatosSalud, setAceptaDatosSalud] = useState(false);
  const [errores, setErrores] = useState<Errores<keyof DatosRegistro>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cambiar = <K extends keyof DatosRegistro>(campo: K) => (valor: DatosRegistro[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }));

  async function crearCuenta() {
    const e = validarRegistro(datos, hoyLocal());
    setErrores(e);
    setErrorGeneral(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const correo = datos.correo.trim();
    const { error } = await cliente().auth.signUp({
      email: correo,
      password: datos.contrasena,
      options: {
        emailRedirectTo: enlaceConfirmacion(),
        // La base de datos vuelve a validar estos datos al crear la cuenta.
        data: {
          fecha_nacimiento: parsearFecha(datos.fechaNacimiento),
          version_terminos: VERSION_TERMINOS,
          acepta_datos_salud: aceptaDatosSalud,
          version_datos_salud: aceptaDatosSalud ? VERSION_DATOS_SALUD : null,
        },
      },
    });
    setEnviando(false);
    const mensaje = mensajeError(error, 'registro');
    if (mensaje) {
      setErrorGeneral(mensaje);
      return;
    }
    router.replace({ pathname: '/verificar-correo', params: { correo } });
  }

  const enlaceLegal = (tipo: 'terminos' | 'datos_salud', texto: string) => (
    <Text
      accessibilityRole="link"
      style={{ color: c.primario, textDecorationLine: 'underline' }}
      onPress={() => router.push({ pathname: '/textos-legales', params: { tipo } })}
    >
      {texto}
    </Text>
  );

  return (
    <Pantalla>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      <Campo
        etiqueta="Correo electrónico"
        value={datos.correo}
        onChangeText={cambiar('correo')}
        error={errores.correo}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Campo
        etiqueta="Contraseña"
        value={datos.contrasena}
        onChangeText={cambiar('contrasena')}
        error={errores.contrasena}
        ayuda={`Al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Campo
        etiqueta="Repite la contraseña"
        value={datos.repetirContrasena}
        onChangeText={cambiar('repetirContrasena')}
        error={errores.repetirContrasena}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Campo
        etiqueta="Fecha de nacimiento"
        value={datos.fechaNacimiento}
        onChangeText={cambiar('fechaNacimiento')}
        error={errores.fechaNacimiento}
        ayuda="Formato dd/mm/aaaa. Solo se usa para comprobar la edad mínima y calcular estimaciones."
        placeholder="dd/mm/aaaa"
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
      />
      <Casilla
        marcada={datos.aceptaTerminos}
        onCambio={cambiar('aceptaTerminos')}
        etiquetaAccesible="Acepto los términos de uso y la política de privacidad"
        error={errores.aceptaTerminos}
      >
        <Parrafo>Acepto los {enlaceLegal('terminos', 'términos de uso y la política de privacidad')}.</Parrafo>
      </Casilla>
      <Casilla
        marcada={aceptaDatosSalud}
        onCambio={setAceptaDatosSalud}
        etiquetaAccesible="Opcional: acepto el tratamiento de mis datos de salud"
      >
        <Parrafo>
          Opcional: acepto el {enlaceLegal('datos_salud', 'tratamiento de mis datos de salud')} para usar el perfil
          corporal, los objetivos y el seguimiento de peso. Puedo darlo o retirarlo más adelante.
        </Parrafo>
      </Casilla>
      <Boton texto="Crear cuenta" onPress={crearCuenta} cargando={enviando} />
    </Pantalla>
  );
}
