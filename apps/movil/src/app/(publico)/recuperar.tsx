import { useState } from 'react';
import { enlaceNuevaContrasena } from '../../lib/enlaces';
import { cliente } from '../../lib/supabase';
import { mensajeError } from '../../logica/erroresAuth';
import { MENSAJES, validarCorreo } from '../../logica/registro';
import { Aviso, Boton, Campo, Pantalla, Parrafo } from '../../ui/componentes';

export default function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!validarCorreo(correo)) {
      setError(MENSAJES.correo);
      return;
    }
    setError(undefined);
    setEnviando(true);
    const { error: e } = await cliente().auth.resetPasswordForEmail(correo.trim(), {
      redirectTo: enlaceNuevaContrasena(),
    });
    setEnviando(false);
    const texto = mensajeError(e, 'recuperacion');
    if (texto) {
      setErrorGeneral(texto);
      return;
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Pantalla>
        {/* Mismo mensaje exista o no la cuenta, para no revelar qué correos están registrados. */}
        <Aviso tipo="info">
          Si hay una cuenta con ese correo, recibirás un enlace para crear una nueva contraseña. Caduca en poco tiempo:
          ábrelo en este dispositivo.
        </Aviso>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <Parrafo>Te enviaremos un enlace para crear una nueva contraseña.</Parrafo>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      <Campo
        etiqueta="Correo electrónico"
        value={correo}
        onChangeText={setCorreo}
        error={error}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={enviar}
      />
      <Boton texto="Enviar enlace" onPress={enviar} cargando={enviando} />
    </Pantalla>
  );
}
