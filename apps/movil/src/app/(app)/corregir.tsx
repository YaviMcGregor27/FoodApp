import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ajustarCantidad, cargarProducto, useCarga } from '../../datos/despensa';
import { formatoCantidad, parsearNumero } from '../../logica/despensa';
import { Aviso, Boton, Campo, Cargando, Pantalla, Parrafo } from '../../ui/componentes';
import { Chips } from '../../ui/controles';

const MOTIVOS = ['Recuento', 'Error al registrar', 'Otro'];

// RF-07: corrección de la cantidad de un lote; queda como movimiento de ajuste en el historial.
export default function Corregir() {
  const p = useLocalSearchParams<{ productoId: string; loteId: string }>();
  const cargar = useCallback(() => cargarProducto(p.productoId), [p.productoId]);
  const { datos, cargando } = useCarga(cargar);
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('Recuento');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (cargando && !datos) return <Cargando />;
  const lote = datos?.lotes.find((l) => l.id === p.loteId);
  if (!datos || !lote) {
    return (
      <Pantalla centrada>
        <Aviso tipo="error">No se ha encontrado el lote.</Aviso>
        <Boton texto="Volver" onPress={() => router.back()} />
      </Pantalla>
    );
  }
  const u = lote.unit;
  const actual = formatoCantidad(Math.round(lote.available_quantity * 1000), u);

  async function guardar() {
    const n = texto.trim() === '' ? null : parsearNumero(texto);
    if (n === null) {
      setError('Introduce la cantidad que hay ahora (0 o más).');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await ajustarCantidad(p.loteId, n, motivo.toLowerCase());
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla>
      <Parrafo>{`Cantidad registrada ahora: ${actual}. Indica la cantidad real; el cambio quedará en el historial y se podrá deshacer.`}</Parrafo>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Campo etiqueta={`Cantidad real (${u})`} value={texto} onChangeText={setTexto} keyboardType="decimal-pad" />
      <Chips etiqueta="Motivo" opciones={MOTIVOS.map((m) => ({ valor: m, texto: m }))} valor={motivo} onCambio={setMotivo} />
      <Boton texto="Guardar corrección" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}
