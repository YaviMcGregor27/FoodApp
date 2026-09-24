import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { enlaceConfirmacion } from '../../lib/enlaces';
import { cliente } from '../../lib/supabase';
import { mensajeError } from '../../logica/erroresAuth';
import { Aviso, Boton, Pantalla, Parrafo, Titulo } from '../../ui/componentes';

const ESPERA_REENVIO_S = 60;

export default function VerificarCorreo() {
  const { correo } = useLocalSearchParams<{ correo?: string }>();
  const [espera, setEspera] = useState(ESPERA_REENVIO_S);
  const [mensaje, setMensaje] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function reenviar() {
    if (!correo) return;
    setEnviando(true);
    const { error } = await cliente().auth.resend({
      type: 'signup',
      email: correo,
      options: { emailRedirectTo: enlaceConfirmacion() },
    });
    setEnviando(false);
    const texto = mensajeError(error, 'general');
    setMensaje(texto ? { tipo: 'error', texto } : { tipo: 'info', texto: 'Te hemos enviado un nuevo enlace.' });
    setEspera(ESPERA_REENVIO_S);
  }

  return (
    <Pantalla>
      <Titulo>Revisa tu correo</Titulo>
      <Parrafo>
        Te hemos enviado un enlace{correo ? ` a ${correo}` : ''}. Ábrelo en este dispositivo para verificar la cuenta y
        después inicia sesión.
      </Parrafo>
      <Parrafo secundario>Si no lo encuentras, revisa la carpeta de correo no deseado.</Parrafo>
      {mensaje ? <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso> : null}
      {correo ? (
        <Boton
          texto={espera > 0 ? `Reenviar enlace (${espera} s)` : 'Reenviar enlace'}
          variante="secundario"
          onPress={reenviar}
          desactivado={espera > 0}
          cargando={enviando}
        />
      ) : null}
      <Boton texto="Ir a iniciar sesión" onPress={() => router.replace('/iniciar-sesion')} />
    </Pantalla>
  );
}
