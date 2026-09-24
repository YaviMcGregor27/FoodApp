// Cantidades en unidad base con aritmética entera en milésimas para evitar errores de coma flotante.
// 1 g = 1000 milésimas; 0,25 ud = 250 milésimas.

export type Unidad = 'g' | 'ml' | 'ud' | 'racion';

export const ESCALA = 1000;

export interface Cantidad {
  /** Valor entero en milésimas de la unidad base. */
  valor: number;
  unidad: Unidad;
}

export class ErrorDominio extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export function cantidad(decimal: number, unidad: Unidad): Cantidad {
  if (!Number.isFinite(decimal)) {
    throw new ErrorDominio('CANTIDAD_INVALIDA', 'La cantidad debe ser un número.');
  }
  return { valor: Math.round(decimal * ESCALA), unidad };
}

export function aDecimal(c: Cantidad): number {
  return c.valor / ESCALA;
}

const EQUIVALENCIAS: Record<string, { unidad: Unidad; factor: number }> = {
  g: { unidad: 'g', factor: 1 },
  gr: { unidad: 'g', factor: 1 },
  kg: { unidad: 'g', factor: 1000 },
  ml: { unidad: 'ml', factor: 1 },
  cl: { unidad: 'ml', factor: 10 },
  l: { unidad: 'ml', factor: 1000 },
  lt: { unidad: 'ml', factor: 1000 },
  ud: { unidad: 'ud', factor: 1 },
  u: { unidad: 'ud', factor: 1 },
  uds: { unidad: 'ud', factor: 1 },
  unidad: { unidad: 'ud', factor: 1 },
  unidades: { unidad: 'ud', factor: 1 },
  racion: { unidad: 'racion', factor: 1 },
  raciones: { unidad: 'racion', factor: 1 },
};

/** Convierte un valor con unidad de texto (kg, l, cl, g, ml, ud) a su unidad base. */
export function normalizar(decimal: number, unidadTexto: string): Cantidad {
  const eq = EQUIVALENCIAS[unidadTexto.trim().toLowerCase()];
  if (!eq) {
    throw new ErrorDominio('UNIDAD_DESCONOCIDA', `Unidad no reconocida: ${unidadTexto}`);
  }
  return cantidad(decimal * eq.factor, eq.unidad);
}

export interface Fraccion {
  numerador: number;
  denominador: number;
}

/** Interpreta "1/4", "3/4", "0,5" o "0.75". Solo admite fracciones entre 0 (excluido) y 1 (incluido). */
export function parsearFraccion(texto: string): Fraccion {
  const t = texto.trim().replace(',', '.');
  let f: Fraccion;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (m) {
    f = { numerador: Number(m[1]), denominador: Number(m[2]) };
  } else if (/^\d*\.?\d+$/.test(t)) {
    f = { numerador: Math.round(Number(t) * ESCALA), denominador: ESCALA };
  } else {
    throw new ErrorDominio('FRACCION_INVALIDA', `Fracción no válida: ${texto}`);
  }
  if (f.denominador === 0 || f.numerador <= 0 || f.numerador > f.denominador) {
    throw new ErrorDominio('FRACCION_FUERA_DE_RANGO', 'La fracción debe ser mayor que 0 y como máximo 1.');
  }
  return f;
}

export function aplicarFraccion(referencia: Cantidad, f: Fraccion): Cantidad {
  return { valor: Math.round((referencia.valor * f.numerador) / f.denominador), unidad: referencia.unidad };
}

export function mismaUnidad(a: Cantidad, b: Cantidad): void {
  if (a.unidad !== b.unidad) {
    throw new ErrorDominio(
      'UNIDAD_INCOMPATIBLE',
      `No se puede operar ${a.unidad} con ${b.unidad} sin un factor de conversión confirmado.`,
    );
  }
}

export function sumar(a: Cantidad, b: Cantidad): Cantidad {
  mismaUnidad(a, b);
  return { valor: a.valor + b.valor, unidad: a.unidad };
}

export function restar(a: Cantidad, b: Cantidad): Cantidad {
  mismaUnidad(a, b);
  return { valor: a.valor - b.valor, unidad: a.unidad };
}

export function formatear(c: Cantidad): string {
  const n = aDecimal(c);
  const texto = n.toLocaleString('es-ES', { maximumFractionDigits: 3 });
  return `${texto} ${c.unidad}`;
}
