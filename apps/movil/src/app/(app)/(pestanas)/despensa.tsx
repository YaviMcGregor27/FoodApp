import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { cargarDespensa, useCarga } from '../../../datos/despensa';
import {
  FILTROS,
  UBICACIONES,
  filtrarDespensa,
  resumirDespensa,
  textoDisponible,
  textoFecha,
  type FiltroDespensa,
  type ResumenProducto,
  type Ubicacion,
} from '../../../logica/despensa';
import { hoyLocal } from '../../../logica/registro';
import { Aviso, Boton, Campo, Cargando, Pantalla, Parrafo } from '../../../ui/componentes';
import { Chips, Etiqueta, Tarjeta, TextoFila } from '../../../ui/controles';

export default function Despensa() {
  const cargar = useCallback(() => cargarDespensa(), []);
  const { datos, error, cargando, recargar } = useCarga(cargar);
  const [ubicacion, setUbicacion] = useState<Ubicacion | 'todas'>('todas');
  const [filtro, setFiltro] = useState<FiltroDespensa>('todos');
  const [texto, setTexto] = useState('');

  const resumenes = useMemo(
    () => (datos ? resumirDespensa(datos.productos, datos.lotes, hoyLocal()) : []),
    [datos],
  );
  const visibles = useMemo(() => filtrarDespensa(resumenes, { ubicacion, filtro, texto }), [resumenes, ubicacion, filtro, texto]);
  const hayExistencias = resumenes.some((r) => !r.agotado);

  if (cargando && !datos) return <Cargando />;

  return (
    <Pantalla alRefrescar={recargar} refrescando={cargando}>
      <Boton texto="Añadir producto" onPress={() => router.push('/anadir')} />
      {error ? (
        <Aviso tipo="error">{`${error} Desliza hacia abajo para reintentar.`}</Aviso>
      ) : null}

      {datos && !hayExistencias && filtro !== 'agotados' ? (
        <Aviso tipo="info">
          Tu despensa está vacía. Añade productos a mano; más adelante podrás escanear tus tickets de compra.
        </Aviso>
      ) : (
        <>
          <Campo
            etiqueta="Buscar"
            value={texto}
            onChangeText={setTexto}
            placeholder="Nombre del producto"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Chips
            desplazable
            opciones={[{ valor: 'todas' as const, texto: 'Todo' }, ...UBICACIONES]}
            valor={ubicacion}
            onCambio={setUbicacion}
          />
          <Chips desplazable opciones={FILTROS} valor={filtro} onCambio={setFiltro} />
          {visibles.length === 0 ? (
            <Parrafo secundario>
              {texto.trim() ? `No hay productos que coincidan con "${texto.trim()}".` : 'No hay productos con este filtro.'}
            </Parrafo>
          ) : (
            visibles.map((r) => <FilaDespensa key={r.producto.id} r={r} />)
          )}
        </>
      )}
    </Pantalla>
  );
}

function FilaDespensa({ r }: { r: ResumenProducto }) {
  const fecha = textoFecha(r);
  const etiquetas: { texto: string; tipo: 'neutra' | 'aviso' | 'error' | 'info' }[] = [];
  if (r.caducidad === 'caducado') etiquetas.push({ texto: 'Fecha pasada', tipo: 'error' });
  if (r.caducidad === 'proximo_a_caducar') etiquetas.push({ texto: 'Caduca pronto', tipo: 'aviso' });
  if (r.abierto) etiquetas.push({ texto: 'Abierto', tipo: 'neutra' });
  if (r.fechaPendiente) etiquetas.push({ texto: 'Fecha pendiente', tipo: 'info' });
  const secundario = [textoDisponible(r), fecha].filter(Boolean).join(' · ');
  return (
    <Tarjeta
      onPress={() => router.push({ pathname: '/producto/[id]', params: { id: r.producto.id } })}
      etiquetaAccesible={`${r.producto.name}, ${secundario}`}
    >
      <TextoFila principal={r.producto.name} secundario={secundario} />
      {etiquetas.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {etiquetas.map((e) => (
            <Etiqueta key={e.texto} texto={e.texto} tipo={e.tipo} />
          ))}
        </View>
      ) : null}
    </Tarjeta>
  );
}
