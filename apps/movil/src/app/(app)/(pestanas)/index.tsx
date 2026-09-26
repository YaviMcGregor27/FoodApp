import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { cargarDespensa, useCarga } from '../../../datos/despensa';
import { caducanPronto, resumirDespensa, textoDisponible, textoFecha } from '../../../logica/despensa';
import { hoyLocal } from '../../../logica/registro';
import { useSesion } from '../../../sesion/ProveedorSesion';
import { Aviso, Pantalla, Parrafo } from '../../../ui/componentes';
import { Etiqueta, Subtitulo, Tarjeta, TextoFila } from '../../../ui/controles';

export default function Hoy() {
  const { cuenta } = useSesion();
  const cargar = useCallback(() => cargarDespensa(), []);
  const { datos, cargando, recargar } = useCarga(cargar);
  const urgentes = useMemo(
    () => (datos ? caducanPronto(resumirDespensa(datos.productos, datos.lotes, hoyLocal())) : []),
    [datos],
  );

  return (
    <Pantalla alRefrescar={recargar} refrescando={cargando}>
      <Subtitulo>Caducan pronto</Subtitulo>
      {datos && urgentes.length === 0 ? (
        <Parrafo secundario>Ningún producto de tu despensa caduca en los próximos días.</Parrafo>
      ) : null}
      {urgentes.map((r) => (
        <Tarjeta
          key={r.producto.id}
          onPress={() => router.push({ pathname: '/producto/[id]', params: { id: r.producto.id } })}
          etiquetaAccesible={`${r.producto.name}, ${textoFecha(r) ?? ''}`}
        >
          <TextoFila principal={r.producto.name} secundario={`${textoDisponible(r)} · ${textoFecha(r) ?? ''}`} />
          <Etiqueta
            texto={r.caducidad === 'caducado' ? 'Fecha pasada: revísalo antes de consumirlo' : 'Caduca pronto'}
            tipo={r.caducidad === 'caducado' ? 'error' : 'aviso'}
          />
        </Tarjeta>
      ))}

      <Subtitulo>Resumen del día</Subtitulo>
      <Aviso tipo="info">
        El resumen de energía y macronutrientes frente a tu objetivo se construirá en la fase F4 del desarrollo.
      </Aviso>
      {cuenta && !cuenta.consentimientoDatosSalud ? (
        <Aviso tipo="aviso">
          No has dado el consentimiento para datos de salud. Podrás usar la despensa y las recetas; el perfil corporal y
          el seguimiento de peso necesitarán ese consentimiento.
        </Aviso>
      ) : null}
    </Pantalla>
  );
}
