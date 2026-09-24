import { useState } from 'react';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Aviso, Boton, Pantalla, Parrafo, Titulo } from '../../ui/componentes';

export default function Cuenta() {
  const { sesion, cuenta, cerrarSesion } = useSesion();
  const [cerrando, setCerrando] = useState<'local' | 'global' | null>(null);

  async function salir(todos: boolean) {
    setCerrando(todos ? 'global' : 'local');
    await cerrarSesion(todos);
    setCerrando(null);
  }

  return (
    <Pantalla>
      <Titulo>Cuenta</Titulo>
      <Parrafo>{sesion?.user.email ?? 'Cuenta sin correo'}</Parrafo>
      <Parrafo secundario>
        {cuenta?.consentimientoDatosSalud
          ? 'Has dado el consentimiento para el tratamiento de datos de salud.'
          : 'No has dado el consentimiento para el tratamiento de datos de salud.'}
      </Parrafo>
      <Aviso tipo="info">
        La gestión de consentimientos, la exportación de tus datos y la eliminación de la cuenta estarán disponibles
        antes del lanzamiento (fase F7).
      </Aviso>
      <Boton texto="Cerrar sesión" variante="secundario" onPress={() => salir(false)} cargando={cerrando === 'local'} />
      <Boton
        texto="Cerrar sesión en todos los dispositivos"
        variante="enlace"
        onPress={() => salir(true)}
        cargando={cerrando === 'global'}
      />
    </Pantalla>
  );
}
