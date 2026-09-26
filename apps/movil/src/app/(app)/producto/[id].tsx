import { mensajeCaducidad, type Lote } from '@foodapp/dominio';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { cargarProducto, deshacerEvento, useCarga } from '../../../datos/despensa';
import {
  type FilaLote,
  aLote,
  construirHistorial,
  formatoCantidad,
  formatoFecha,
  resumirDespensa,
  textoDisponible,
  textoUbicacion,
  TIPOS_FECHA,
} from '../../../logica/despensa';
import { hoyLocal } from '../../../logica/registro';
import { Aviso, Boton, Cargando, Pantalla, Parrafo } from '../../../ui/componentes';
import { confirmar, Etiqueta, Subtitulo, Tarjeta, TextoFila } from '../../../ui/controles';

export default function DetalleProducto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cargar = useCallback(() => cargarProducto(id), [id]);
  const { datos, error, cargando, recargar } = useCarga(cargar);
  const [aviso, setAviso] = useState<{ tipo: 'error' | 'info'; texto: string } | null>(null);
  const hoy = hoyLocal();

  const resumen = useMemo(() => (datos ? resumirDespensa(datos.productos, datos.lotes, hoy)[0] : null), [datos, hoy]);
  const historial = useMemo(
    () => (datos && resumen ? construirHistorial(datos.movimientos, resumen.unidad) : []),
    [datos, resumen],
  );

  if (cargando && !datos) return <Cargando />;
  if (!datos || !resumen) {
    return (
      <Pantalla centrada>
        <Aviso tipo="error">{error ?? 'No se ha encontrado el producto.'}</Aviso>
        <Boton texto="Volver" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  const producto = resumen.producto;
  const filasAgotadas = datos.lotes.filter((f) => !resumen.lotes.some((l) => l.id === f.id));
  const filaDe = (loteId: string) => datos.lotes.find((f) => f.id === loteId)!;
  const irA = (pathname: '/salida' | '/corregir' | '/editar-lote', params: Record<string, string>) =>
    router.push({ pathname, params: { productoId: producto.id, ...params } });

  async function deshacer(eventoId: string) {
    const ok = await confirmar('Deshacer operación', 'Se devolverá la cantidad a la despensa y quedará registrado en el historial.', 'Deshacer');
    if (!ok) return;
    try {
      await deshacerEvento(eventoId);
      setAviso({ tipo: 'info', texto: 'Operación deshecha.' });
    } catch (e) {
      setAviso({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se ha podido deshacer.' });
    }
    await recargar();
  }

  return (
    <Pantalla alRefrescar={recargar} refrescando={cargando}>
      <Stack.Screen options={{ title: producto.name }} />
      <Parrafo>{`${textoDisponible(resumen)} · ${producto.category}`}</Parrafo>
      {producto.portion_size !== null ? (
        <Parrafo secundario>{`Porción configurada: ${formatoCantidad(Math.round(producto.portion_size * 1000), resumen.unidad)}`}</Parrafo>
      ) : null}
      {aviso ? <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso> : null}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {!resumen.agotado ? (
        <>
          <Boton texto="Consumir" onPress={() => irA('/salida', { tipo: 'consumo' })} />
          <Boton texto="Desechar" variante="secundario" onPress={() => irA('/salida', { tipo: 'desperdicio' })} />
        </>
      ) : (
        <Aviso tipo="info">Sin existencias.</Aviso>
      )}
      <Boton
        texto="Añadir otra compra de este producto"
        variante="enlace"
        onPress={() =>
          router.push({
            pathname: '/anadir',
            params: {
              productoId: producto.id,
              nombre: producto.name,
              categoria: producto.category,
              unidad: producto.unit,
              tamano: producto.default_package_size === null ? '' : String(producto.default_package_size),
            },
          })
        }
      />

      {resumen.lotes.length > 0 ? <Subtitulo>{resumen.lotes.length === 1 ? 'Lote' : 'Lotes (se consumen en este orden)'}</Subtitulo> : null}
      {resumen.lotes.map((l) => (
        <FichaLote
          key={l.id}
          lote={l}
          fila={filaDe(l.id)}
          hoy={hoy}
          varios={resumen.lotes.length > 1}
          acciones={{
            consumir: () => irA('/salida', { tipo: 'consumo', loteId: l.id }),
            corregir: () => irA('/corregir', { loteId: l.id }),
            editar: () => irA('/editar-lote', { loteId: l.id }),
          }}
        />
      ))}

      {filasAgotadas.length > 0 ? (
        <>
          <Subtitulo>Lotes agotados</Subtitulo>
          {filasAgotadas.map((f) => (
            <Tarjeta key={f.id}>
              <TextoFila
                principal={`Comprado el ${formatoFecha(f.purchased_on)}`}
                secundario={`${formatoCantidad(Math.round(f.initial_quantity * 1000), resumen.unidad)} al comprar`}
              />
              <Boton texto="Corregir cantidad" variante="enlace" onPress={() => irA('/corregir', { loteId: f.id })} />
            </Tarjeta>
          ))}
        </>
      ) : null}

      <Subtitulo>Historial</Subtitulo>
      {historial.length === 0 ? <Parrafo secundario>Sin movimientos.</Parrafo> : null}
      {historial.map((h) => (
        <Tarjeta key={h.movimiento.id}>
          <TextoFila
            principal={`${h.texto}: ${h.cambio}`}
            secundario={`${new Date(h.movimiento.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · quedan ${h.despues}${h.deshecho ? ' · deshecho' : ''}`}
          />
          {h.eventoDeshacible ? (
            <Boton texto="Deshacer" variante="enlace" onPress={() => deshacer(h.eventoDeshacible!)} />
          ) : null}
        </Tarjeta>
      ))}
    </Pantalla>
  );
}

function FichaLote({
  lote,
  fila,
  hoy,
  varios,
  acciones,
}: {
  lote: Lote;
  fila: FilaLote;
  hoy: string;
  varios: boolean;
  acciones: { consumir: () => void; corregir: () => void; editar: () => void };
}) {
  const inicial = formatoCantidad(lote.inicial, lote.unidad);
  const envase =
    lote.tamanoEnvase !== null
      ? `${lote.envases} ${lote.envases === 1 ? 'envase' : 'envases'} de ${formatoCantidad(lote.tamanoEnvase, lote.unidad)}`
      : 'A granel o sin envase';
  const tipoFecha = TIPOS_FECHA.find((t) => t.valor === lote.tipoFecha)?.texto ?? '';
  const fecha = lote.fecha ? `${tipoFecha}: ${formatoFecha(lote.fecha)}` : `Fecha: ${tipoFecha.toLowerCase()}`;
  const aviso = mensajeCaducidad(lote, hoy);
  return (
    <Tarjeta>
      <TextoFila
        principal={`${formatoCantidad(lote.disponible, lote.unidad)} de ${inicial}`}
        secundario={`${envase}\nComprado el ${formatoFecha(lote.fechaCompra)} · ${textoUbicacion(fila.location)}\n${fecha}`}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {lote.abierto ? <Etiqueta texto="Abierto" /> : null}
        {aviso ? <Etiqueta texto={aviso} tipo={aviso.includes('pasado') ? 'error' : aviso.includes('pendiente') ? 'info' : 'aviso'} /> : null}
      </View>
      {varios ? <Boton texto="Consumir de este lote" variante="enlace" onPress={acciones.consumir} /> : null}
      <Boton texto="Corregir cantidad" variante="enlace" onPress={acciones.corregir} />
      <Boton texto="Cambiar fecha o ubicación" variante="enlace" onPress={acciones.editar} />
    </Tarjeta>
  );
}
