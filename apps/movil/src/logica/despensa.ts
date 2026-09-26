// Lógica de la despensa en la app: conversión de filas de la base de datos al modelo del
// paquete de dominio, resúmenes por producto, filtros, textos y validaciones.
// Funciones puras, probadas en test/despensa.test.ts.

import {
  type Cantidad,
  type EstadoCaducidad,
  type Lote,
  type Unidad,
  ErrorDominio,
  calcularCantidadConsumo,
  estadoCaducidad,
  ordenarLotesParaConsumo,
  parsearFraccion,
  validarLoteNuevo,
} from '@foodapp/dominio';
import { parsearFecha } from './registro.ts';

export const UMBRAL_DIAS_CADUCIDAD = 3;

// ---------------------------------------------------------------------------
// Filas tal como llegan de la base de datos
// ---------------------------------------------------------------------------

export type UnidadBase = 'g' | 'ml' | 'ud';
export type Ubicacion = 'despensa' | 'frigorifico' | 'congelador' | 'otra';
export type TipoFecha = 'caducidad' | 'consumo_preferente' | 'sin_fecha' | 'pendiente';

export interface FilaProducto {
  id: string;
  name: string;
  category: string;
  unit: UnidadBase | 'racion';
  default_package_size: number | null;
  portion_size: number | null;
}

export interface FilaLote {
  id: string;
  user_product_id: string;
  unit: UnidadBase | 'racion';
  package_count: number;
  package_size: number | null;
  initial_quantity: number;
  available_quantity: number;
  purchased_on: string;
  date_value: string | null;
  date_kind: TipoFecha;
  opened_at: string | null;
  location: Ubicacion;
  status: 'disponible' | 'abierto' | 'agotado' | 'descartado';
  created_at: string;
}

export interface FilaMovimiento {
  id: string;
  lot_id: string;
  kind: string;
  delta: number;
  quantity_before: number;
  quantity_after: number;
  consumption_event_id: string | null;
  reverses_movement_id: string | null;
  reason: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

export const UBICACIONES: { valor: Ubicacion; texto: string }[] = [
  { valor: 'despensa', texto: 'Despensa' },
  { valor: 'frigorifico', texto: 'Frigorífico' },
  { valor: 'congelador', texto: 'Congelador' },
  { valor: 'otra', texto: 'Otra' },
];

export const TIPOS_FECHA: { valor: TipoFecha; texto: string }[] = [
  { valor: 'caducidad', texto: 'Caducidad' },
  { valor: 'consumo_preferente', texto: 'Consumo preferente' },
  { valor: 'pendiente', texto: 'Pendiente' },
  { valor: 'sin_fecha', texto: 'Sin fecha' },
];

export const UNIDADES: { valor: UnidadBase; texto: string }[] = [
  { valor: 'g', texto: 'Gramos (g)' },
  { valor: 'ml', texto: 'Mililitros (ml)' },
  { valor: 'ud', texto: 'Unidades (ud)' },
];

export const CATEGORIAS = [
  'Frutas',
  'Verduras',
  'Carnes',
  'Pescados',
  'Lácteos',
  'Huevos',
  'Panadería',
  'Cereales y legumbres',
  'Conservas',
  'Congelados',
  'Bebidas',
  'Aceites y condimentos',
  'Dulces y aperitivos',
  'Platos preparados',
  'Otros',
];

const TEXTO_MOVIMIENTO: Record<string, string> = {
  entrada_manual: 'Entrada',
  entrada_compra: 'Compra',
  entrada_sobras: 'Sobras guardadas',
  consumo_parcial: 'Consumo',
  consumo_total: 'Consumo (agotado)',
  desperdicio: 'Desechado',
  ajuste: 'Corrección de cantidad',
  correccion: 'Deshecho',
  caducidad: 'Baja por caducidad',
  transferencia_entrada: 'Combinación de lotes',
  transferencia_salida: 'Combinación de lotes',
};

export function textoMovimiento(tipo: string): string {
  return TEXTO_MOVIMIENTO[tipo] ?? tipo;
}

export function textoUbicacion(u: Ubicacion): string {
  return UBICACIONES.find((x) => x.valor === u)?.texto ?? u;
}

// ---------------------------------------------------------------------------
// Números, cantidades y fechas
// ---------------------------------------------------------------------------

/** "1,5" o "1.5" a número. Devuelve null si no es un número finito. */
export function parsearNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const aMilesimas = (decimal: number) => Math.round(decimal * 1000);

function numero(n: number, maxDecimales = 3): string {
  return n.toLocaleString('es-ES', { maximumFractionDigits: maxDecimales, useGrouping: n >= 10000 });
}

/** Cantidad legible: 750 g, 1,25 kg, 330 ml, 1,5 l, 0,25 ud. */
export function formatoCantidad(valorMilesimas: number, unidad: Unidad): string {
  const v = valorMilesimas / 1000;
  if (unidad === 'g' && Math.abs(v) >= 1000) return `${numero(v / 1000)} kg`;
  if (unidad === 'ml' && Math.abs(v) >= 1000) return `${numero(v / 1000)} l`;
  if (unidad === 'racion') return `${numero(v)} ${v === 1 ? 'ración' : 'raciones'}`;
  return `${numero(v)} ${unidad}`;
}

export function formatoFecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function formatoFechaCorta(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Conversión al modelo de dominio y resúmenes
// ---------------------------------------------------------------------------

export function aLote(fila: FilaLote, nombreProducto: string): Lote {
  return {
    id: fila.id,
    producto: nombreProducto,
    unidad: fila.unit,
    envases: fila.package_count,
    tamanoEnvase: fila.package_size === null ? null : aMilesimas(fila.package_size),
    inicial: aMilesimas(fila.initial_quantity),
    disponible: aMilesimas(fila.available_quantity),
    fechaCompra: fila.purchased_on,
    fecha: fila.date_value,
    tipoFecha: fila.date_kind,
    abierto: fila.opened_at !== null || fila.status === 'abierto',
    estado: fila.status,
  };
}

export const activo = (l: Lote) => (l.estado === 'disponible' || l.estado === 'abierto') && l.disponible > 0;

const GRAVEDAD: Record<EstadoCaducidad, number> = { caducado: 3, proximo_a_caducar: 2, vigente: 1, sin_fecha: 0 };

export interface ResumenProducto {
  producto: FilaProducto;
  /** Lotes con existencias, en el orden en que se consumirán (RN-INV-10). */
  lotes: Lote[];
  unidad: Unidad;
  disponible: number;
  /** Fecha más próxima entre los lotes con existencias y su tipo. */
  proximaFecha: { fecha: string; tipo: TipoFecha } | null;
  caducidad: EstadoCaducidad;
  abierto: boolean;
  fechaPendiente: boolean;
  ubicaciones: Ubicacion[];
  agotado: boolean;
}

export function resumirDespensa(
  productos: FilaProducto[],
  filasLotes: FilaLote[],
  hoy: string,
  umbralDias = UMBRAL_DIAS_CADUCIDAD,
): ResumenProducto[] {
  const porProducto = new Map<string, FilaLote[]>();
  for (const f of filasLotes) {
    const lista = porProducto.get(f.user_product_id) ?? [];
    lista.push(f);
    porProducto.set(f.user_product_id, lista);
  }
  const resultado: ResumenProducto[] = [];
  for (const producto of productos) {
    const filas = porProducto.get(producto.id) ?? [];
    if (filas.length === 0) continue;
    const lotes = ordenarLotesParaConsumo(filas.map((f) => aLote(f, producto.name)).filter(activo));
    const ubicaciones = [
      ...new Set(filas.filter((f) => lotes.some((l) => l.id === f.id)).map((f) => f.location)),
    ];
    const conFecha = lotes.filter((l) => l.fecha !== null && (l.tipoFecha === 'caducidad' || l.tipoFecha === 'consumo_preferente'));
    const proxima = conFecha.sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))[0];
    const caducidad = lotes
      .map((l) => estadoCaducidad(l, hoy, umbralDias))
      .reduce<EstadoCaducidad>((peor, e) => (GRAVEDAD[e] > GRAVEDAD[peor] ? e : peor), 'sin_fecha');
    resultado.push({
      producto,
      lotes,
      unidad: producto.unit,
      disponible: lotes.reduce((s, l) => s + l.disponible, 0),
      proximaFecha: proxima ? { fecha: proxima.fecha!, tipo: proxima.tipoFecha as TipoFecha } : null,
      caducidad,
      abierto: lotes.some((l) => l.abierto),
      fechaPendiente: lotes.some((l) => l.tipoFecha === 'pendiente'),
      ubicaciones,
      agotado: lotes.length === 0,
    });
  }
  return resultado.sort((a, b) => a.producto.name.localeCompare(b.producto.name, 'es'));
}

/** "375 g de 500 g" si hay un único lote con envase; si no, el total y el número de lotes. */
export function textoDisponible(r: ResumenProducto): string {
  if (r.agotado) return 'Agotado';
  const total = formatoCantidad(r.disponible, r.unidad);
  if (r.lotes.length === 1) {
    const l = r.lotes[0];
    const referencia = l.envases === 1 && l.tamanoEnvase !== null ? l.tamanoEnvase : l.inicial;
    if (l.disponible !== referencia) return `${total} de ${formatoCantidad(referencia, r.unidad)}`;
    return total;
  }
  return `${total} en ${r.lotes.length} lotes`;
}

export function textoFecha(r: ResumenProducto): string | null {
  if (!r.proximaFecha) return r.fechaPendiente ? 'Fecha pendiente' : null;
  const prefijo = r.proximaFecha.tipo === 'caducidad' ? 'Cad.' : 'C. pref.';
  return `${prefijo} ${formatoFechaCorta(r.proximaFecha.fecha)}`;
}

export type FiltroDespensa = 'todos' | 'caducan_pronto' | 'caducados' | 'abiertos' | 'fecha_pendiente' | 'agotados';

export const FILTROS: { valor: FiltroDespensa; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'caducan_pronto', texto: 'Caducan pronto' },
  { valor: 'caducados', texto: 'Fecha pasada' },
  { valor: 'abiertos', texto: 'Abiertos' },
  { valor: 'fecha_pendiente', texto: 'Fecha pendiente' },
  { valor: 'agotados', texto: 'Agotados' },
];

export function filtrarDespensa(
  resumenes: ResumenProducto[],
  opciones: { ubicacion: Ubicacion | 'todas'; filtro: FiltroDespensa; texto: string },
): ResumenProducto[] {
  const busqueda = opciones.texto.trim().toLocaleLowerCase('es');
  return resumenes.filter((r) => {
    if (opciones.filtro === 'agotados') {
      if (!r.agotado) return false;
    } else {
      if (r.agotado) return false;
      if (opciones.ubicacion !== 'todas' && !r.ubicaciones.includes(opciones.ubicacion)) return false;
      if (opciones.filtro === 'caducan_pronto' && r.caducidad !== 'proximo_a_caducar') return false;
      if (opciones.filtro === 'caducados' && r.caducidad !== 'caducado') return false;
      if (opciones.filtro === 'abiertos' && !r.abierto) return false;
      if (opciones.filtro === 'fecha_pendiente' && !r.fechaPendiente) return false;
    }
    if (busqueda && !r.producto.name.toLocaleLowerCase('es').includes(busqueda)) return false;
    return true;
  });
}

/** Productos con fecha pasada o próxima, los más urgentes primero (pantalla Hoy). */
export function caducanPronto(resumenes: ResumenProducto[], maximo = 3): ResumenProducto[] {
  return resumenes
    .filter((r) => !r.agotado && (r.caducidad === 'proximo_a_caducar' || r.caducidad === 'caducado'))
    .sort((a, b) => (a.proximaFecha!.fecha < b.proximaFecha!.fecha ? -1 : 1))
    .slice(0, maximo);
}

// ---------------------------------------------------------------------------
// Alta de un lote (RF-05)
// ---------------------------------------------------------------------------

export interface FormularioAlta {
  nombre: string;
  categoria: string;
  unidad: UnidadBase;
  modo: 'envases' | 'cantidad';
  envases: string;
  tamanoEnvase: string;
  cantidad: string;
  fechaCompra: string;
  tipoFecha: TipoFecha;
  fecha: string;
  ubicacion: Ubicacion;
  porcion: string;
  abierto: boolean;
  confirmaFechaAnterior: boolean;
}

export interface ParametrosAlta {
  p_nombre: string;
  p_categoria: string;
  p_unidad: UnidadBase;
  p_fecha_compra: string;
  p_ubicacion: Ubicacion;
  p_tipo_fecha: TipoFecha;
  p_fecha: string | null;
  p_envases: number;
  p_tamano_envase: number | null;
  p_cantidad: number | null;
  p_porcion: number | null;
  p_abierto: boolean;
  p_confirma_fecha_anterior: boolean;
}

export type ErroresAlta = Partial<Record<keyof FormularioAlta, string>>;

const FORMATO_FECHA = 'Introduce la fecha con el formato dd/mm/aaaa.';

export function validarAlta(f: FormularioAlta, hoy: string): { errores: ErroresAlta; parametros: ParametrosAlta | null } {
  const errores: ErroresAlta = {};

  let envases = 1;
  let tamano: number | null = null;
  let cantidad: number | null = null;
  if (f.modo === 'envases') {
    const e = parsearNumero(f.envases);
    if (e === null || !Number.isInteger(e) || e < 1) errores.envases = 'Indica un número entero de envases (1 o más).';
    else envases = e;
    const t = parsearNumero(f.tamanoEnvase);
    if (t === null || t <= 0) errores.tamanoEnvase = 'Indica el tamaño de cada envase, mayor que 0.';
    else tamano = t;
  } else {
    const c = parsearNumero(f.cantidad);
    if (c === null || c <= 0) errores.cantidad = 'Introduce una cantidad mayor que 0.';
    else cantidad = c;
  }

  const fechaCompra = parsearFecha(f.fechaCompra);
  if (fechaCompra === null) errores.fechaCompra = FORMATO_FECHA;

  let fecha: string | null = null;
  if (f.tipoFecha === 'caducidad' || f.tipoFecha === 'consumo_preferente') {
    fecha = parsearFecha(f.fecha);
    if (fecha === null) errores.fecha = FORMATO_FECHA;
  }

  let porcion: number | null = null;
  if (f.porcion.trim() !== '') {
    porcion = parsearNumero(f.porcion);
    if (porcion === null || porcion <= 0) errores.porcion = 'La porción debe ser mayor que 0.';
  }

  const total = tamano !== null ? tamano * envases : (cantidad ?? 0);
  if (fechaCompra !== null) {
    const codigos = validarLoteNuevo(
      { nombre: f.nombre, cantidad: total || 1, fechaCompra, fecha, confirmaFechaAnterior: f.confirmaFechaAnterior },
      hoy,
    );
    for (const c of codigos) {
      if (c === 'NOMBRE_OBLIGATORIO') errores.nombre = 'El nombre del producto es obligatorio.';
      if (c === 'FECHA_COMPRA_FUTURA') errores.fechaCompra = 'La fecha de compra no puede ser futura.';
      if (c === 'FECHA_COMPRA_DEMASIADO_ANTIGUA') errores.fechaCompra = 'La fecha de compra no puede ser de hace más de dos años.';
      if (c === 'CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR') {
        errores.fecha = 'La fecha es anterior a la compra. Si es correcto, marca la casilla de confirmación.';
      }
    }
  } else if (f.nombre.trim() === '') {
    errores.nombre = 'El nombre del producto es obligatorio.';
  }
  if (porcion !== null && tamano !== null && porcion > tamano) {
    errores.porcion = 'La porción no puede ser mayor que el envase.';
  }

  if (Object.keys(errores).length > 0) return { errores, parametros: null };
  return {
    errores,
    parametros: {
      p_nombre: f.nombre.trim(),
      p_categoria: f.categoria,
      p_unidad: f.unidad,
      p_fecha_compra: fechaCompra!,
      p_ubicacion: f.ubicacion,
      p_tipo_fecha: f.tipoFecha,
      p_fecha: fecha,
      p_envases: envases,
      p_tamano_envase: tamano,
      p_cantidad: tamano === null ? cantidad : null,
      p_porcion: porcion,
      p_abierto: f.abierto,
      p_confirma_fecha_anterior: f.confirmaFechaAnterior,
    },
  };
}

// ---------------------------------------------------------------------------
// Consumo y desperdicio (RF-06, RF-07)
// ---------------------------------------------------------------------------

export type ModoSalida =
  | { modo: 'fraccion'; fraccion: string; referencia: 'envase' | 'restante' }
  | { modo: 'cantidad'; texto: string }
  | { modo: 'porciones'; texto: string }
  | { modo: 'todo' };

export interface Salida {
  cantidad: Cantidad;
  /** Cantidad decimal en unidad base, para enviar a la base de datos. */
  cantidadDecimal: number;
  resumen: string;
}

/**
 * Traduce lo que indica el usuario a una cantidad exacta y el texto de confirmación.
 * Las fracciones se refieren al lote que se consumirá primero (o al elegido).
 */
export function prepararSalida(
  r: ResumenProducto,
  modo: ModoSalida,
  loteElegidoId: string | null,
): { salida: Salida | null; error: string | null } {
  const elegido = loteElegidoId ? r.lotes.find((l) => l.id === loteElegidoId) ?? null : null;
  if (loteElegidoId && !elegido) return { salida: null, error: 'El lote elegido ya no tiene existencias.' };
  const referencia = elegido ?? r.lotes[0];
  if (!referencia) return { salida: null, error: 'No hay existencias de este producto.' };
  const disponible = elegido ? elegido.disponible : r.disponible;

  let cantidad: Cantidad;
  try {
    switch (modo.modo) {
      case 'fraccion':
        cantidad = calcularCantidadConsumo(referencia, {
          modo: 'fraccion',
          fraccion: parsearFraccion(modo.fraccion),
          referencia: modo.referencia,
        });
        break;
      case 'cantidad': {
        const n = parsearNumero(modo.texto);
        if (n === null || n <= 0) return { salida: null, error: 'Introduce una cantidad mayor que 0.' };
        cantidad = { valor: aMilesimas(n), unidad: r.unidad };
        break;
      }
      case 'porciones': {
        const n = parsearNumero(modo.texto);
        if (n === null || n <= 0) return { salida: null, error: 'Introduce un número de porciones mayor que 0.' };
        const porcion = r.producto.portion_size;
        cantidad = calcularCantidadConsumo(referencia, {
          modo: 'porciones',
          porciones: n,
          tamanoPorcion: porcion === null ? null : { valor: aMilesimas(porcion), unidad: r.unidad },
        });
        break;
      }
      case 'todo':
        cantidad = { valor: disponible, unidad: r.unidad };
        break;
    }
  } catch (e) {
    if (e instanceof ErrorDominio) return { salida: null, error: e.message };
    throw e;
  }

  if (cantidad.valor <= 0) return { salida: null, error: 'La cantidad resultante es 0.' };
  if (cantidad.valor > disponible) {
    return { salida: null, error: `La cantidad supera lo disponible (${formatoCantidad(disponible, r.unidad)}).` };
  }
  const quedan = disponible - cantidad.valor;
  const ambito = elegido && r.lotes.length > 1 ? ' en este lote' : '';
  return {
    salida: {
      cantidad,
      cantidadDecimal: cantidad.valor / 1000,
      resumen: `Se descontarán ${formatoCantidad(cantidad.valor, r.unidad)}. Quedarán ${formatoCantidad(quedan, r.unidad)}${ambito}.`,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Errores de las funciones de la base de datos
// ---------------------------------------------------------------------------

const MENSAJES_DESPENSA: Record<string, string> = {
  NOMBRE_OBLIGATORIO: 'El nombre del producto es obligatorio.',
  NOMBRE_DEMASIADO_LARGO: 'El nombre es demasiado largo (máximo 120 caracteres).',
  CANTIDAD_NO_POSITIVA: 'Introduce una cantidad mayor que 0.',
  CANTIDAD_NEGATIVA: 'La cantidad no puede ser negativa.',
  CANTIDAD_DEMASIADO_GRANDE: 'La cantidad es demasiado grande.',
  FECHA_COMPRA_FUTURA: 'La fecha de compra no puede ser futura.',
  FECHA_COMPRA_DEMASIADO_ANTIGUA: 'La fecha de compra no puede ser de hace más de dos años.',
  FECHA_INCOHERENTE: 'Indica la fecha o elige "Pendiente" o "Sin fecha".',
  CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR: 'La fecha es anterior a la compra. Si es correcto, marca la casilla de confirmación.',
  PORCION_NO_VALIDA: 'La porción debe ser mayor que 0.',
  PRODUCTO_NO_ENCONTRADO: 'No se ha encontrado el producto. Vuelve a la despensa y actualízala.',
  LOTE_NO_ENCONTRADO: 'No se ha encontrado el lote. Vuelve a la despensa y actualízala.',
  EVENTO_NO_ENCONTRADO: 'No se ha encontrado la operación.',
  CONSUMO_SUPERA_DISPONIBLE: 'La cantidad supera lo disponible. Puede que se haya consumido desde otro dispositivo: actualiza la despensa.',
  PARTE_USUARIO_NO_VALIDA: 'Indica qué parte has consumido tú.',
  SIN_CAMBIOS: 'La cantidad es la misma que la actual.',
  MOTIVO_OBLIGATORIO: 'Indica el motivo.',
  YA_DESHECHO: 'Esta operación ya se había deshecho.',
  NO_REVERSIBLE: 'No se puede deshacer: parte de esa cantidad se ha consumido después.',
};

export function mensajeErrorDespensa(error: { message?: string } | null | undefined): string | null {
  if (!error) return null;
  const codigo = Object.keys(MENSAJES_DESPENSA).find((c) => error.message === c || error.message?.startsWith(`${c}:`));
  return codigo ? MENSAJES_DESPENSA[codigo] : null;
}

// ---------------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------------

export interface EntradaHistorial {
  movimiento: FilaMovimiento;
  texto: string;
  cambio: string;
  despues: string;
  /** Evento que se puede deshacer desde esta entrada (null si no procede). */
  eventoDeshacible: string | null;
  deshecho: boolean;
}

export function construirHistorial(movimientos: FilaMovimiento[], unidad: Unidad): EntradaHistorial[] {
  const revertidos = new Set(movimientos.map((m) => m.reverses_movement_id).filter((x): x is string => x !== null));
  const eventosRevertidos = new Set(
    movimientos.filter((m) => revertidos.has(m.id) && m.consumption_event_id).map((m) => m.consumption_event_id!),
  );
  const DESHACIBLES = new Set(['consumo_parcial', 'consumo_total', 'desperdicio', 'ajuste']);
  return [...movimientos]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .map((m) => {
      const signo = m.delta > 0 ? '+' : '−';
      const deshecho = m.consumption_event_id !== null && eventosRevertidos.has(m.consumption_event_id);
      return {
        movimiento: m,
        texto: textoMovimiento(m.kind) + (m.reason && m.kind !== 'correccion' ? ` (${m.reason})` : ''),
        cambio: `${signo}${formatoCantidad(Math.abs(aMilesimas(m.delta)), unidad)}`,
        despues: formatoCantidad(aMilesimas(m.quantity_after), unidad),
        eventoDeshacible: DESHACIBLES.has(m.kind) && m.consumption_event_id && !deshecho ? m.consumption_event_id : null,
        deshecho,
      };
    });
}

// ---------------------------------------------------------------------------
// Identificadores para idempotencia
// ---------------------------------------------------------------------------

/** UUID v4 con el generador criptográfico del entorno. */
export function nuevoId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export type { EstadoCaducidad, Lote };
