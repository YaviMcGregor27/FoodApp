import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { cliente } from '../lib/supabase';
import { mensajeError } from '../logica/erroresAuth';
import { VERSION_DATOS_SALUD, VERSION_TERMINOS } from '../logica/legal';
import { hayErrores, hoyLocal, parsearFecha, validarDatosIniciales, type DatosIniciales, type Errores } from '../logica/registro';
import { useSesion } from '../sesion/ProveedorSesion';
import { Aviso, Boton, Campo, Casilla, Pantalla, Parrafo } from '../ui/componentes';
import { useColores } from '../ui/tema';

// Para cuentas creadas con Apple o Google, que no pasan por el formulario de registro.
export default function CompletarRegistro() {
  const c = useColores();
  const { recargarCuenta, cerrarSesion } = useSesion();
  const [datos, setDatos] = useState<DatosIniciales>({ fechaNacimiento: '', aceptaTerminos: false });
  const [aceptaDatosSalud, setAceptaDatosSalud] = useState(false);
  const [errores, setErrores] = useState<Errores<keyof DatosIniciales>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const e = validarDatosIniciales(datos, hoyLocal());
    setErrores(e);
    setErrorGeneral(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const { error } = await cliente().rpc('completar_registro', {
      fecha_nacimiento: parsearFecha(datos.fechaNacimiento),
      version_terminos: VERSION_TERMINOS,
      acepta_datos_salud: aceptaDatosSalud,
      version_datos_salud: aceptaDatosSalud ? VERSION_DATOS_SALUD : null,
    });
    setEnviando(false);
    if (error) {
      setErrorGeneral(mensajeError(error, 'completar_registro'));
      return;
    }
    await recargarCuenta();
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
      <Parrafo>Antes de continuar necesitamos tu fecha de nacimiento y tu aceptación de los términos.</Parrafo>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      <Campo
        etiqueta="Fecha de nacimiento"
        value={datos.fechaNacimiento}
        onChangeText={(v) => setDatos((d) => ({ ...d, fechaNacimiento: v }))}
        error={errores.fechaNacimiento}
        ayuda="Formato dd/mm/aaaa."
        placeholder="dd/mm/aaaa"
        keyboardType="numbers-and-punctuation"
      />
      <Casilla
        marcada={datos.aceptaTerminos}
        onCambio={(v) => setDatos((d) => ({ ...d, aceptaTerminos: v }))}
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
        <Parrafo>Opcional: acepto el {enlaceLegal('datos_salud', 'tratamiento de mis datos de salud')}.</Parrafo>
      </Casilla>
      <Boton texto="Continuar" onPress={guardar} cargando={enviando} />
      <Boton texto="Cerrar sesión" variante="enlace" onPress={() => cerrarSesion()} />
    </Pantalla>
  );
}
