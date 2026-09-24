// Reglas de inventario: lotes, consumos parciales y totales, asignación entre lotes y estados de caducidad.
// Referencias: RN-INV-03 a RN-INV-13 en docs/01-especificacion-tecnica.md.

import {
  type Cantidad,
  type Fraccion,
  ErrorDominio,
  aplicarFraccion,
  formatear,
  mismaUnidad,
} from './cantidades.ts';

export type EstadoLote = 'disponible' | 'abierto' | 'agotado' | 'descartado';
export type TipoFecha = 'caducidad' | 'consumo_preferente' | 'sin_fecha' | 'pendiente';
export type EstadoCaducidad = 'vigente' | 'proximo_a_caducar' | 'caducado' | 'sin_fecha';

export type TipoMovimiento =
  | 'entrada_compra'
  | 'entrada_manual'
  | 'entrada_sobras'
  | 'consumo_parcial'
  | 'consumo_total'
  | 'desperdicio'
  | 'correccion'
  | 'ajuste'
  | 'caducidad'
  | 'transferencia_entrada'
  | 'transferencia_salida';

export interface Lote {
  id: string;
  producto: string;
  unidad: Cantidad['unidad'];
  envases: number;
  /** Tamaño de un envase en milésimas de la unidad base, o null si es granel o desconocido. */
  tamanoEnvase: number | null;
  inicial: number;
  disponible: number;
  fechaCompra: string;
  fecha: string | null;
  tipoFecha: TipoFecha;
  abierto: boolean;
  estado: EstadoLote;
}

export interface Movimiento {
  loteId: string;
  tipo: TipoMovimiento;
  delta: number;
  antes: number;
  despues: number;
  motivo?: string;
}

export type ModoConsumo =
  | { modo: 'fraccion'; fraccion: Fraccion; referencia: 'envase' | 'restante' }
  | { modo: 'cantidad'; cantidad: Cantidad }
  | { modo: 'porciones'; porciones: number; tamanoPorcion: Cantidad | null }
  | { modo: 'todo' };

/** Umbral de residuo: por debajo del 2 % del envase se pregunta si marcar como agotado (RN-INV-06). */
export const UMBRAL_RESIDUO = 0.02;

function cantidadDe(lote: Lote, valor: number): Cantidad {
  return { valor, unidad: lote.unidad };
}

/** Traduce la forma en que el usuario expresa el consumo a una cantidad exacta en unidad base. */
export function calcularCantidadConsumo(lote: Lote, modo: ModoConsumo): Cantidad {
  switch (modo.modo) {
    case 'fraccion': {
      if (modo.referencia === 'envase') {
        if (lote.tamanoEnvase === null) {
          throw new ErrorDominio(
            'SIN_TAMANO_ENVASE',
            'Este producto no tiene tamaño de envase. Indícalo o usa "de lo que queda".',
          );
        }
        return aplicarFraccion(cantidadDe(lote, lote.tamanoEnvase), modo.fraccion);
      }
      return aplicarFraccion(cantidadDe(lote, lote.disponible), modo.fraccion);
    }
    case 'cantidad':
      mismaUnidad(modo.cantidad, cantidadDe(lote, 0));
      return modo.cantidad;
    case 'porciones': {
      if (modo.tamanoPorcion === null) {
        throw new ErrorDominio(
          'SIN_PORCION_CONFIGURADA',
          'No hay porción configurada para este producto. Indica la cantidad.',
        );
      }
      if (!(modo.porciones > 0)) {
        throw new ErrorDominio('CANTIDAD_NO_POSITIVA', 'El número de porciones debe ser mayor que 0.');
      }
      mismaUnidad(modo.tamanoPorcion, cantidadDe(lote, 0));
      return cantidadDe(lote, Math.round(modo.tamanoPorcion.valor * modo.porciones));
    }
    case 'todo':
      return cantidadDe(lote, lote.disponible);
  }
}

export interface ResultadoConsumoLote {
  lote: Lote;
  movimiento: Movimiento;
  /** true si queda un residuo inferior al umbral y conviene preguntar al usuario. */
  residuoBajo: boolean;
}

/** Aplica un consumo a un único lote. Nunca deja cantidades negativas (RN-INV-03). */
export function consumirDeLote(lote: Lote, c: Cantidad): ResultadoConsumoLote {
  mismaUnidad(c, cantidadDe(lote, 0));
  if (c.valor <= 0) {
    throw new ErrorDominio('CANTIDAD_NO_POSITIVA', 'Introduce una cantidad mayor que 0.');
  }
  if (lote.estado === 'agotado' || lote.estado === 'descartado') {
    throw new ErrorDominio('LOTE_NO_DISPONIBLE', 'El lote no tiene existencias.');
  }
  if (c.valor > lote.disponible) {
    throw new ErrorDominio(
      'CONSUMO_SUPERA_DISPONIBLE',
      `La cantidad supera lo disponible (${formatear(cantidadDe(lote, lote.disponible))}).`,
    );
  }
  const despues = lote.disponible - c.valor;
  const tipo: TipoMovimiento = despues === 0 ? 'consumo_total' : 'consumo_parcial';
  const estado: EstadoLote = despues === 0 ? 'agotado' : 'abierto';
  const referenciaResiduo = lote.tamanoEnvase ?? lote.inicial;
  const residuoBajo = despues > 0 && despues < referenciaResiduo * UMBRAL_RESIDUO;
  return {
    lote: { ...lote, disponible: despues, abierto: true, estado },
    movimiento: { loteId: lote.id, tipo, delta: -c.valor, antes: lote.disponible, despues },
    residuoBajo,
  };
}

/**
 * Orden de asignación entre lotes (RN-INV-10): abiertos primero, después caducidad más próxima,
 * después compra más antigua. Los lotes sin fecha van al final.
 */
export function ordenarLotesParaConsumo(lotes: Lote[]): Lote[] {
  const conExistencias = lotes.filter((l) => l.disponible > 0 && l.estado !== 'descartado');
  return [...conExistencias].sort((a, b) => {
    if (a.abierto !== b.abierto) return a.abierto ? -1 : 1;
    if (a.fecha !== b.fecha) {
      if (a.fecha === null) return 1;
      if (b.fecha === null) return -1;
      return a.fecha < b.fecha ? -1 : 1;
    }
    return a.fechaCompra < b.fechaCompra ? -1 : a.fechaCompra > b.fechaCompra ? 1 : 0;
  });
}

export interface ResultadoConsumoProducto {
  lotes: Lote[];
  movimientos: Movimiento[];
  lotesConResiduo: string[];
}

/** Reparte un consumo entre los lotes de un producto según el orden de asignación. */
export function consumirDeProducto(lotes: Lote[], c: Cantidad): ResultadoConsumoProducto {
  const ordenados = ordenarLotesParaConsumo(lotes);
  const total = ordenados.reduce((s, l) => s + l.disponible, 0);
  if (c.valor > total) {
    const unidad = ordenados[0]?.unidad ?? c.unidad;
    throw new ErrorDominio(
      'CONSUMO_SUPERA_DISPONIBLE',
      `La cantidad supera lo disponible en todos los lotes (${formatear({ valor: total, unidad })}).`,
    );
  }
  const actualizados = new Map(lotes.map((l) => [l.id, l]));
  const movimientos: Movimiento[] = [];
  const lotesConResiduo: string[] = [];
  let pendiente = c.valor;
  for (const lote of ordenados) {
    if (pendiente === 0) break;
    const parte = Math.min(pendiente, lote.disponible);
    const r = consumirDeLote(lote, { valor: parte, unidad: c.unidad });
    actualizados.set(lote.id, r.lote);
    movimientos.push(r.movimiento);
    if (r.residuoBajo) lotesConResiduo.push(lote.id);
    pendiente -= parte;
  }
  return { lotes: lotes.map((l) => actualizados.get(l.id)!), movimientos, lotesConResiduo };
}

/** Marca como agotado un residuo con un movimiento de ajuste explícito (solo tras confirmación del usuario). */
export function descartarResiduo(lote: Lote): ResultadoConsumoLote {
  if (lote.disponible === 0) {
    throw new ErrorDominio('LOTE_NO_DISPONIBLE', 'El lote ya está agotado.');
  }
  return {
    lote: { ...lote, disponible: 0, estado: 'agotado' },
    movimiento: {
      loteId: lote.id,
      tipo: 'ajuste',
      delta: -lote.disponible,
      antes: lote.disponible,
      despues: 0,
      motivo: 'residuo',
    },
    residuoBajo: false,
  };
}

function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Estado derivado de la fecha. No bloquea el consumo; solo sirve para advertir (RN-INV-11, RN-INV-14). */
export function estadoCaducidad(lote: Lote, hoy: string, umbralDias = 3): EstadoCaducidad {
  if (lote.fecha === null || lote.tipoFecha === 'sin_fecha' || lote.tipoFecha === 'pendiente') {
    return 'sin_fecha';
  }
  const dias = diasEntre(hoy, lote.fecha);
  if (dias < 0) return 'caducado';
  if (dias <= umbralDias) return 'proximo_a_caducar';
  return 'vigente';
}

export function mensajeCaducidad(lote: Lote, hoy: string, umbralDias = 3): string | null {
  const estado = estadoCaducidad(lote, hoy, umbralDias);
  if (estado === 'caducado') {
    return lote.tipoFecha === 'caducidad'
      ? 'La fecha de caducidad ha pasado. Revisa el producto antes de consumirlo.'
      : 'La fecha de consumo preferente ha pasado. Revisa el producto antes de consumirlo.';
  }
  if (estado === 'proximo_a_caducar') {
    const dias = diasEntre(hoy, lote.fecha!);
    if (dias === 0) return 'La fecha indicada es hoy.';
    return `La fecha indicada es dentro de ${dias} ${dias === 1 ? 'día' : 'días'}.`;
  }
  if (estado === 'sin_fecha' && lote.tipoFecha === 'pendiente') {
    return 'Fecha pendiente de confirmar.';
  }
  return null;
}

export interface DatosLoteNuevo {
  nombre: string;
  cantidad: number;
  fechaCompra: string;
  fecha: string | null;
  confirmaFechaAnterior?: boolean;
}

function esFechaValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Validaciones de alta (RN-INV-12, RN-INV-13, RN-INV-03). Devuelve la lista de códigos de error. */
export function validarLoteNuevo(d: DatosLoteNuevo, hoy: string): string[] {
  const errores: string[] = [];
  if (d.nombre.trim().length === 0) errores.push('NOMBRE_OBLIGATORIO');
  if (!(d.cantidad > 0)) errores.push('CANTIDAD_NO_POSITIVA');
  if (!esFechaValida(d.fechaCompra)) {
    errores.push('FECHA_COMPRA_INVALIDA');
  } else {
    if (diasEntre(hoy, d.fechaCompra) > 0) errores.push('FECHA_COMPRA_FUTURA');
    if (diasEntre(d.fechaCompra, hoy) > 730) errores.push('FECHA_COMPRA_DEMASIADO_ANTIGUA');
  }
  if (d.fecha !== null) {
    if (!esFechaValida(d.fecha)) {
      errores.push('FECHA_CADUCIDAD_INVALIDA');
    } else if (esFechaValida(d.fechaCompra) && d.fecha < d.fechaCompra && !d.confirmaFechaAnterior) {
      errores.push('CADUCIDAD_ANTERIOR_A_COMPRA_SIN_CONFIRMAR');
    }
  }
  return errores;
}
