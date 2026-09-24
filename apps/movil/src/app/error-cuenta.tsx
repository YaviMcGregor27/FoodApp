import { useState } from 'react';
import { useSesion } from '../sesion/ProveedorSesion';
import { Aviso, Boton, Pantalla } from '../ui/componentes';

export default function ErrorCuenta() {
  const { recargarCuenta, cerrarSesion } = useSesion();
  const [reintentando, setReintentando] = useState(false);

  async function reintentar() {
    setReintentando(true);
    await recargarCuenta();
    setReintentando(false);
  }

  return (
    <Pantalla centrada>
      <Aviso tipo="error">
        No se han podido cargar los datos de tu cuenta. Comprueba tu conexión a internet e inténtalo de nuevo.
      </Aviso>
      <Boton texto="Reintentar" onPress={reintentar} cargando={reintentando} />
      <Boton texto="Cerrar sesión" variante="enlace" onPress={() => cerrarSesion()} />
    </Pantalla>
  );
}
