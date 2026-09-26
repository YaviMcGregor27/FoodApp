import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { actualizarLote, cargarProducto, useCarga } from '../../datos/despensa';
import { TIPOS_FECHA, UBICACIONES, formatoFecha, type TipoFecha, type Ubicacion } from '../../logica/despensa';
import { parsearFecha } from '../../logica/registro';
import { Aviso, Boton, Campo, Cargando, Pantalla } from '../../ui/componentes';
import { Chips } from '../../ui/controles';

// Cambiar la ubicación o la fecha de un lote (no afecta a las cantidades).
export default function EditarLote() {
  const p = useLocalSearchParams<{ productoId: string; loteId: string }>();
  const cargar = useCallback(() => cargarProducto(p.productoId), [p.productoId]);
  const { datos, cargando } = useCarga(cargar);
  const lote = datos?.lotes.find((l) => l.id === p.loteId);

  const [ubicacion, setUbicacion] = useState<Ubicacion>('despensa');
  const [tipoFecha, setTipoFecha] = useState<TipoFecha>('pendiente');
  const [fecha, setFecha] = useState('');
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (lote && !listo) {
      setUbicacion(lote.location);
      setTipoFecha(lote.date_kind);
      setFecha(lote.date_value ? formatoFecha(lote.date_value) : '');
      setListo(true);
    }
  }, [lote, listo]);

  if (cargando && !datos) return <Cargando />;
  if (!lote) {
    return (
      <Pantalla centrada>
        <Aviso tipo="error">No se ha encontrado el lote.</Aviso>
        <Boton texto="Volver" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  const conFecha = tipoFecha === 'caducidad' || tipoFecha === 'consumo_preferente';

  async function guardar() {
    let iso: string | null = null;
    if (conFecha) {
      iso = parsearFecha(fecha);
      if (!iso) {
        setError('Introduce la fecha con el formato dd/mm/aaaa.');
        return;
      }
    }
    setGuardando(true);
    setError(null);
    try {
      await actualizarLote(p.loteId, { location: ubicacion, date_kind: tipoFecha, date_value: iso });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Pantalla>
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Chips etiqueta="Ubicación" opciones={UBICACIONES} valor={ubicacion} onCambio={setUbicacion} />
      <Chips etiqueta="Fecha del envase" opciones={TIPOS_FECHA} valor={tipoFecha} onCambio={setTipoFecha} />
      {conFecha ? (
        <Campo etiqueta="Fecha" value={fecha} onChangeText={setFecha} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
      ) : null}
      <Boton texto="Guardar" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}
