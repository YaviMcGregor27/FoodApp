import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { altaLote } from '../../datos/despensa';
import {
  CATEGORIAS,
  TIPOS_FECHA,
  UBICACIONES,
  UNIDADES,
  formatoFecha,
  validarAlta,
  type ErroresAlta,
  type FormularioAlta,
  type UnidadBase,
} from '../../logica/despensa';
import { hoyLocal } from '../../logica/registro';
import { Aviso, Boton, Campo, Casilla, Pantalla, Parrafo } from '../../ui/componentes';
import { Chips } from '../../ui/controles';

// RF-05: alta manual de productos y lotes. Si llega un producto, se añade una compra nueva de él.
export default function Anadir() {
  const p = useLocalSearchParams<{ productoId?: string; nombre?: string; categoria?: string; unidad?: string; tamano?: string }>();
  const productoFijo = Boolean(p.productoId);
  const unidadInicial: UnidadBase = p.unidad === 'ml' || p.unidad === 'ud' ? p.unidad : 'g';

  const [f, setF] = useState<FormularioAlta>({
    nombre: p.nombre ?? '',
    categoria: p.categoria && CATEGORIAS.includes(p.categoria) ? p.categoria : 'Otros',
    unidad: unidadInicial,
    modo: p.tamano ? 'envases' : unidadInicial === 'ud' ? 'cantidad' : 'envases',
    envases: '1',
    tamanoEnvase: p.tamano ?? '',
    cantidad: '',
    fechaCompra: formatoFecha(hoyLocal()),
    tipoFecha: 'pendiente',
    fecha: '',
    ubicacion: 'despensa',
    porcion: '',
    abierto: false,
    confirmaFechaAnterior: false,
  });
  const [errores, setErrores] = useState<ErroresAlta>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = <K extends keyof FormularioAlta>(campo: K) => (valor: FormularioAlta[K]) =>
    setF((actual) => ({ ...actual, [campo]: valor }));

  async function guardar() {
    const { errores: e, parametros } = validarAlta(f, hoyLocal());
    setErrores(e);
    setErrorGeneral(null);
    if (!parametros) return;
    setGuardando(true);
    try {
      await altaLote(p.productoId ? { ...parametros, p_producto_id: p.productoId } as typeof parametros : parametros);
      router.back();
    } catch (err) {
      setErrorGeneral(err instanceof Error ? err.message : 'No se ha podido guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const u = f.unidad;
  const conFecha = f.tipoFecha === 'caducidad' || f.tipoFecha === 'consumo_preferente';

  return (
    <Pantalla>
      {errorGeneral ? <Aviso tipo="error">{errorGeneral}</Aviso> : null}
      {productoFijo ? (
        <Parrafo>{`Nueva compra de ${f.nombre}. Se guardará como un lote aparte, con su propia fecha.`}</Parrafo>
      ) : (
        <>
          <Campo etiqueta="Nombre del producto" value={f.nombre} onChangeText={cambiar('nombre')} error={errores.nombre} placeholder="Por ejemplo, arroz redondo" />
          <Chips etiqueta="Categoría" opciones={CATEGORIAS.map((c) => ({ valor: c, texto: c }))} valor={f.categoria} onCambio={cambiar('categoria')} desplazable />
          <Chips etiqueta="Unidad" opciones={UNIDADES} valor={f.unidad} onCambio={cambiar('unidad')} />
        </>
      )}

      <Chips
        etiqueta="Cantidad comprada"
        opciones={[
          { valor: 'envases' as const, texto: 'Por envases' },
          { valor: 'cantidad' as const, texto: 'Cantidad total' },
        ]}
        valor={f.modo}
        onCambio={cambiar('modo')}
      />
      {f.modo === 'envases' ? (
        <>
          <Campo etiqueta="Número de envases" value={f.envases} onChangeText={cambiar('envases')} error={errores.envases} keyboardType="number-pad" />
          <Campo
            etiqueta={`Tamaño de cada envase (${u})`}
            value={f.tamanoEnvase}
            onChangeText={cambiar('tamanoEnvase')}
            error={errores.tamanoEnvase}
            ayuda="Por ejemplo, 1000 para un paquete de 1 kg o un brik de 1 litro."
            keyboardType="decimal-pad"
          />
        </>
      ) : (
        <Campo
          etiqueta={`Cantidad (${u})`}
          value={f.cantidad}
          onChangeText={cambiar('cantidad')}
          error={errores.cantidad}
          ayuda="Para productos a granel o sin envase. Sin tamaño de envase no se podrá consumir por fracciones del envase."
          keyboardType="decimal-pad"
        />
      )}

      <Campo etiqueta="Fecha de compra" value={f.fechaCompra} onChangeText={cambiar('fechaCompra')} error={errores.fechaCompra} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
      <Chips etiqueta="Fecha del envase" opciones={TIPOS_FECHA} valor={f.tipoFecha} onCambio={cambiar('tipoFecha')} />
      {conFecha ? (
        <Campo etiqueta="Fecha" value={f.fecha} onChangeText={cambiar('fecha')} error={errores.fecha} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
      ) : (
        <Parrafo secundario>
          {f.tipoFecha === 'pendiente'
            ? 'La fecha quedará pendiente y el producto aparecerá en el filtro "Fecha pendiente".'
            : 'Para productos que no tienen fecha, como la sal o el azúcar.'}
        </Parrafo>
      )}
      {errores.fecha?.includes('anterior a la compra') || f.confirmaFechaAnterior ? (
        <Casilla
          marcada={f.confirmaFechaAnterior}
          onCambio={cambiar('confirmaFechaAnterior')}
          etiquetaAccesible="Confirmo que la fecha es anterior a la compra"
        >
          <Parrafo>Confirmo que la fecha es correcta (por ejemplo, un producto en oferta por fecha corta).</Parrafo>
        </Casilla>
      ) : null}

      <Chips etiqueta="Ubicación" opciones={UBICACIONES} valor={f.ubicacion} onCambio={cambiar('ubicacion')} />
      <Campo
        etiqueta={`Porción habitual (${u}, opcional)`}
        value={f.porcion}
        onChangeText={cambiar('porcion')}
        error={errores.porcion}
        ayuda="Permite consumir por porciones. Si no la indicas, no se supondrá ninguna."
        keyboardType="decimal-pad"
      />
      <Casilla marcada={f.abierto} onCambio={cambiar('abierto')} etiquetaAccesible="El envase ya está abierto">
        <Parrafo>El envase ya está abierto</Parrafo>
      </Casilla>
      <Boton texto="Guardar en la despensa" onPress={guardar} cargando={guardando} />
    </Pantalla>
  );
}
