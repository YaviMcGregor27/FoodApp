import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ajustarCantidad, cargarProducto, registrarSalida, useCarga } from '../../datos/despensa';
import { formatoCantidad, formatoFecha, nuevoId, prepararSalida, resumirDespensa, type ModoSalida } from '../../logica/despensa';
import { hoyLocal } from '../../logica/registro';
import { Aviso, Boton, Campo, Cargando, Pantalla } from '../../ui/componentes';
import { Chips, confirmar } from '../../ui/controles';

type Modo = ModoSalida['modo'];
type Consumidor = 'usuario' | 'otros' | 'reparto';

const MOTIVOS = ['Caducado', 'En mal estado', 'Sobrante', 'Otro'];
const PARTES = [
  { valor: '0.5', texto: 'La mitad' },
  { valor: '0.3333', texto: 'Un tercio' },
  { valor: '0.25', texto: 'Un cuarto' },
];

// RF-06 y RF-07: consumir o desechar una cantidad, con vista previa antes de confirmar.
export default function Salida() {
  const p = useLocalSearchParams<{ productoId: string; tipo?: string; loteId?: string }>();
  const esDesperdicio = p.tipo === 'desperdicio';
  const cargar = useCallback(() => cargarProducto(p.productoId), [p.productoId]);
  const { datos, error, cargando } = useCarga(cargar);
  const resumen = useMemo(() => (datos ? resumirDespensa(datos.productos, datos.lotes, hoyLocal())[0] : null), [datos]);

  const [modo, setModo] = useState<Modo>('fraccion');
  const [fraccion, setFraccion] = useState('1/4');
  const [otraFraccion, setOtraFraccion] = useState('');
  const [referencia, setReferencia] = useState<'envase' | 'restante'>('envase');
  const [texto, setTexto] = useState('');
  const [loteId, setLoteId] = useState<string>(p.loteId ?? 'auto');
  const [consumidor, setConsumidor] = useState<Consumidor>('usuario');
  const [parte, setParte] = useState('0.5');
  const [motivo, setMotivo] = useState('Caducado');
  const [idempotencia] = useState(nuevoId);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  if (cargando && !datos) return <Cargando />;
  if (!resumen || resumen.agotado) {
    return (
      <Pantalla centrada>
        <Aviso tipo="error">{error ?? 'Este producto no tiene existencias.'}</Aviso>
        <Boton texto="Volver" onPress={() => router.back()} />
      </Pantalla>
    );
  }

  const u = resumen.unidad;
  const elegido = loteId === 'auto' ? null : loteId;
  const loteRef = (elegido ? resumen.lotes.find((l) => l.id === elegido) : undefined) ?? resumen.lotes[0];
  // Sin tamaño de envase solo tiene sentido la fracción de lo que queda.
  const referenciaEfectiva = loteRef.tamanoEnvase === null ? 'restante' : referencia;
  const modoSalida: ModoSalida =
    modo === 'fraccion'
      ? { modo, fraccion: fraccion === 'otra' ? otraFraccion : fraccion, referencia: referenciaEfectiva }
      : modo === 'todo'
        ? { modo }
        : { modo, texto };
  const { salida, error: errorCalculo } = prepararSalida(resumen, modoSalida, elegido);

  const opcionesModo: { valor: Modo; texto: string }[] = [
    { valor: 'fraccion', texto: 'Fracción' },
    { valor: 'cantidad', texto: 'Cantidad' },
    ...(resumen.producto.portion_size !== null ? [{ valor: 'porciones' as const, texto: 'Porciones' }] : []),
    { valor: 'todo', texto: 'Todo' },
  ];

  async function confirmarSalida() {
    if (!salida || !resumen) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const r = await registrarSalida({
        productoId: resumen.producto.id,
        cantidad: salida.cantidadDecimal,
        tipo: esDesperdicio ? 'desperdicio' : 'consumo',
        loteId: elegido,
        consumidor: esDesperdicio ? 'otros' : consumidor,
        parteUsuario: consumidor === 'reparto' ? Number(parte) : null,
        motivo: esDesperdicio ? motivo.toLowerCase() : null,
        idempotencia,
      });
      // RN-INV-06: un resto muy pequeño no se elimina solo; se pregunta.
      for (const m of r.movimientos.filter((x) => x.residuo)) {
        const resto = formatoCantidad(Math.round(m.despues * 1000), u);
        const agotar = await confirmar(
          `Quedan ${resto}`,
          '¿Quieres marcar este envase como agotado?',
          'Marcar como agotado',
          'Mantener',
        );
        if (agotar) await ajustarCantidad(m.lote_id, 0, 'residuo');
      }
      router.back();
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : 'No se ha podido registrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pantalla>
      <Stack.Screen options={{ title: `${esDesperdicio ? 'Desechar' : 'Consumir'}: ${resumen.producto.name}` }} />
      {errorEnvio ? <Aviso tipo="error">{errorEnvio}</Aviso> : null}

      <Chips etiqueta="¿Cuánto?" opciones={opcionesModo} valor={modo} onCambio={setModo} />
      {modo === 'fraccion' ? (
        <>
          <Chips
            opciones={[
              { valor: '1/4', texto: '1/4' },
              { valor: '1/2', texto: '1/2' },
              { valor: '3/4', texto: '3/4' },
              { valor: 'otra', texto: 'Otra' },
            ]}
            valor={fraccion}
            onCambio={setFraccion}
          />
          {fraccion === 'otra' ? (
            <Campo etiqueta="Fracción" value={otraFraccion} onChangeText={setOtraFraccion} placeholder="Por ejemplo, 1/3 o 0,2" keyboardType="numbers-and-punctuation" />
          ) : null}
          <Chips
            etiqueta="¿De qué?"
            opciones={[
              {
                valor: 'envase' as const,
                texto: loteRef.tamanoEnvase !== null ? `Del envase (${formatoCantidad(loteRef.tamanoEnvase, u)})` : 'Del envase (sin tamaño)',
                desactivada: loteRef.tamanoEnvase === null,
              },
              { valor: 'restante' as const, texto: `De lo que queda (${formatoCantidad(loteRef.disponible, u)})` },
            ]}
            valor={referenciaEfectiva}
            onCambio={setReferencia}
          />
        </>
      ) : null}
      {modo === 'cantidad' ? <Campo etiqueta={`Cantidad (${u})`} value={texto} onChangeText={setTexto} keyboardType="decimal-pad" /> : null}
      {modo === 'porciones' && resumen.producto.portion_size !== null ? (
        <Campo
          etiqueta="Número de porciones"
          value={texto}
          onChangeText={setTexto}
          ayuda={`Porción configurada: ${formatoCantidad(Math.round(resumen.producto.portion_size * 1000), u)}`}
          keyboardType="decimal-pad"
        />
      ) : null}

      {resumen.lotes.length > 1 ? (
        <Chips
          etiqueta="Lote"
          opciones={[
            { valor: 'auto', texto: 'Automático: primero el abierto o el que caduca antes' },
            ...resumen.lotes.map((l) => ({
              valor: l.id,
              texto: `${formatoCantidad(l.disponible, u)}${l.fecha ? `, fecha ${formatoFecha(l.fecha)}` : ''}${l.abierto ? ', abierto' : ''}`,
            })),
          ]}
          valor={loteId}
          onCambio={setLoteId}
        />
      ) : null}

      {esDesperdicio ? (
        <Chips etiqueta="Motivo" opciones={MOTIVOS.map((m) => ({ valor: m, texto: m }))} valor={motivo} onCambio={setMotivo} />
      ) : (
        <>
          <Chips
            etiqueta="¿Quién lo consume?"
            opciones={[
              { valor: 'usuario' as const, texto: 'Yo' },
              { valor: 'otros' as const, texto: 'Otras personas' },
              { valor: 'reparto' as const, texto: 'Compartido' },
            ]}
            valor={consumidor}
            onCambio={setConsumidor}
          />
          {consumidor === 'reparto' ? <Chips etiqueta="Tu parte" opciones={PARTES} valor={parte} onCambio={setParte} /> : null}
        </>
      )}

      {salida ? <Aviso tipo="info">{salida.resumen}</Aviso> : errorCalculo ? <Aviso tipo="aviso">{errorCalculo}</Aviso> : null}
      <Boton
        texto={esDesperdicio ? 'Registrar como desechado' : 'Registrar consumo'}
        onPress={confirmarSalida}
        cargando={enviando}
        desactivado={!salida}
      />
    </Pantalla>
  );
}
