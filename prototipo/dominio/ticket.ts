// Analizador de líneas de ticket (texto ya extraído por OCR). Referencias: RN-TIC-03 a RN-TIC-06,
// docs/06-ocr-y-normalizacion.md. Solo propone: toda línea requiere revisión del usuario.
// Importes en céntimos (enteros).

import { type Unidad, normalizar } from './cantidades.ts';

export type TipoLinea = 'producto' | 'descuento' | 'total' | 'ignorada';

export interface Confianza {
  cantidad: number;
  importe: number;
}

export interface LineaProducto {
  tipo: 'producto';
  textoOriginal: string;
  nombreLeido: string;
  /** Unidades compradas (envases) o peso en g para productos a granel. */
  cantidad: number;
  unidadCantidad: 'envase' | Unidad;
  envase: { cantidad: number; tamano: number | null; unidad: Unidad | null };
  precioUnitario: number | null;
  precioKg: number | null;
  importe: number;
  descuento: number;
  confianza: Confianza;
  avisos: string[];
}

export interface LineaDescuento {
  tipo: 'descuento';
  textoOriginal: string;
  importe: number;
}

export interface LineaTotal {
  tipo: 'total';
  textoOriginal: string;
  importe: number;
}

export interface LineaIgnorada {
  tipo: 'ignorada';
  textoOriginal: string;
}

export type LineaAnalizada = LineaProducto | LineaDescuento | LineaTotal | LineaIgnorada;

const IMPORTE = String.raw`(-?\d{1,5}[.,]\d{2})`;

/** "1,17" o "1.17" o "-0,45" a céntimos. */
export function aCentimos(texto: string): number {
  const negativo = texto.trim().startsWith('-');
  const [ent, dec] = texto.replace('-', '').trim().replace('.', ',').split(',');
  const valor = Number(ent) * 100 + Number(dec.padEnd(2, '0').slice(0, 2));
  return negativo ? -valor : valor;
}

function aDecimal(texto: string): number {
  return Number(texto.replace(',', '.'));
}

/**
 * Extrae el formato de envase del nombre: "6X125G", "1L", "1,5 L", "500G", "250 ML", "1KG".
 * Devuelve null en tamaño si no aparece; nunca se inventa.
 */
export function extraerEnvase(nombre: string): LineaProducto['envase'] {
  const pack = /(\d+)\s*[xX×]\s*(\d+(?:[.,]\d+)?)\s*(KG|G|GR|ML|CL|L)\b/i.exec(nombre);
  if (pack) {
    const c = normalizar(aDecimal(pack[2]), pack[3]);
    return { cantidad: Number(pack[1]), tamano: c.valor / 1000, unidad: c.unidad };
  }
  const simple = /(\d+(?:[.,]\d+)?)\s*(KG|G|GR|ML|CL|L|LT)\b/i.exec(nombre);
  if (simple) {
    const c = normalizar(aDecimal(simple[1]), simple[2]);
    return { cantidad: 1, tamano: c.valor / 1000, unidad: c.unidad };
  }
  return { cantidad: 1, tamano: null, unidad: null };
}

const PALABRAS_TOTAL = /^(TOTAL(\s+A\s+PAGAR)?|IMPORTE\s+TOTAL)\b/i;
const PALABRAS_IGNORAR = /^(SUBTOTAL|IVA|BASE\s+IMPONIBLE|TARJETA|EFECTIVO|ENTREGADO|CAMBIO|CUOTA|N\.?\s*OP|FACTURA|GRACIAS|TEL|NIF|CIF)\b/i;
const PALABRAS_DESCUENTO = /^(DTO\.?|DESCUENTO|DESC\.?|PROMO(CION)?|AHORRO|OFERTA|2[ªA]\s*UD|CUPON)\b/i;

export function analizarLinea(texto: string): LineaAnalizada {
  const t = texto.replace(/\s+/g, ' ').trim();

  const importeFinal = new RegExp(`${IMPORTE}\\s*€?$`).exec(t);

  if (PALABRAS_TOTAL.test(t) && importeFinal) {
    return { tipo: 'total', textoOriginal: texto, importe: aCentimos(importeFinal[1]) };
  }
  if (PALABRAS_IGNORAR.test(t) || !importeFinal) {
    return { tipo: 'ignorada', textoOriginal: texto };
  }
  if (PALABRAS_DESCUENTO.test(t) || importeFinal[1].startsWith('-')) {
    return { tipo: 'descuento', textoOriginal: texto, importe: Math.abs(aCentimos(importeFinal[1])) };
  }

  // Producto a peso: "PLATANO CANARIAS 0,532 kg x 2,19 €/kg 1,17"
  const peso = new RegExp(
    String.raw`^(.+?)\s+(\d+[.,]\d{1,3})\s*kg\s*[xX×]?\s*(\d+[.,]\d{2})\s*€?\s*/\s*kg\s+` + IMPORTE + String.raw`\s*€?$`,
    'i',
  ).exec(t);
  if (peso) {
    const gramos = Math.round(aDecimal(peso[2]) * 1000);
    const precioKg = aCentimos(peso[3]);
    const importe = aCentimos(peso[4]);
    const calculado = Math.round((gramos * precioKg) / 1000);
    const coherente = Math.abs(calculado - importe) <= 2;
    return {
      tipo: 'producto',
      textoOriginal: texto,
      nombreLeido: peso[1].trim(),
      cantidad: gramos,
      unidadCantidad: 'g',
      envase: { cantidad: 1, tamano: null, unidad: 'g' },
      precioUnitario: null,
      precioKg,
      importe,
      descuento: 0,
      confianza: { cantidad: coherente ? 0.95 : 0.5, importe: coherente ? 0.95 : 0.5 },
      avisos: coherente ? [] : [`PESO_INCOHERENTE: ${gramos} g x ${precioKg} c/kg = ${calculado} c, leído ${importe} c`],
    };
  }

  // Multiplicador: "2 x LECHE SEMI 1L 0,89 1,78", "2 LECHE SEMI 1L 0,89 1,78" o "LECHE SEMI 1L 2 x 0,89 1,78"
  const multAntes = new RegExp(String.raw`^(\d{1,3})\s*[xX×]?\s+(\D.*?)\s+(\d+[.,]\d{2})\s+` + IMPORTE + String.raw`\s*€?$`).exec(t);
  const multDespues = new RegExp(String.raw`^(.+?)\s+(\d{1,3})\s*[xX×]\s*(\d+[.,]\d{2})\s+` + IMPORTE + String.raw`\s*€?$`).exec(t);
  const mult = multAntes
    ? { n: Number(multAntes[1]), nombre: multAntes[2], pu: multAntes[3], imp: multAntes[4] }
    : multDespues
      ? { n: Number(multDespues[2]), nombre: multDespues[1], pu: multDespues[3], imp: multDespues[4] }
      : null;
  if (mult && mult.n > 0) {
    const pu = aCentimos(mult.pu);
    const importe = aCentimos(mult.imp);
    const coherente = pu * mult.n === importe;
    return {
      tipo: 'producto',
      textoOriginal: texto,
      nombreLeido: mult.nombre.trim(),
      cantidad: mult.n,
      unidadCantidad: 'envase',
      envase: extraerEnvase(mult.nombre),
      precioUnitario: pu,
      precioKg: null,
      importe,
      descuento: 0,
      confianza: { cantidad: coherente ? 0.95 : 0.6, importe: coherente ? 0.95 : 0.6 },
      avisos: coherente ? [] : [`MULTIPLICADOR_INCOHERENTE: ${mult.n} x ${pu} c distinto de ${importe} c`],
    };
  }

  // Línea simple: "YOGUR NATURAL 6X125G 1,45"
  const nombre = t.slice(0, importeFinal.index).trim();
  if (nombre.length === 0) return { tipo: 'ignorada', textoOriginal: texto };
  const importe = aCentimos(importeFinal[1]);
  return {
    tipo: 'producto',
    textoOriginal: texto,
    nombreLeido: nombre,
    cantidad: 1,
    unidadCantidad: 'envase',
    envase: extraerEnvase(nombre),
    precioUnitario: importe,
    precioKg: null,
    importe,
    descuento: 0,
    // La cantidad 1 es una suposición del formato de línea simple: confianza media, requiere revisión.
    confianza: { cantidad: 0.8, importe: 0.9 },
    avisos: [],
  };
}

export interface Reconciliacion {
  sumaLineas: number;
  descuentos: number;
  totalImpreso: number | null;
  diferencia: number | null;
  coincide: boolean | null;
}

export interface TicketAnalizado {
  productos: LineaProducto[];
  descuentosSinAsociar: LineaDescuento[];
  reconciliacion: Reconciliacion;
}

/** Analiza todas las líneas, asocia descuentos a la línea de producto anterior y reconcilia con el total. */
export function analizarTicket(lineas: string[]): TicketAnalizado {
  const productos: LineaProducto[] = [];
  const descuentosSinAsociar: LineaDescuento[] = [];
  let totalImpreso: number | null = null;
  let anterior: LineaAnalizada | null = null;

  for (const texto of lineas) {
    const l = analizarLinea(texto);
    if (l.tipo === 'producto') {
      productos.push(l);
    } else if (l.tipo === 'descuento') {
      if (anterior !== null && anterior.tipo === 'producto' && l.importe <= anterior.importe) {
        anterior.descuento += l.importe;
        anterior.avisos.push(`DESCUENTO_ASOCIADO: "${l.textoOriginal.trim()}"`);
      } else {
        descuentosSinAsociar.push(l);
      }
    } else if (l.tipo === 'total') {
      totalImpreso = l.importe;
    }
    if (l.tipo !== 'ignorada') anterior = l;
  }

  const sumaLineas = productos.reduce((s, p) => s + p.importe, 0);
  const descuentos =
    productos.reduce((s, p) => s + p.descuento, 0) + descuentosSinAsociar.reduce((s, d) => s + d.importe, 0);
  const diferencia = totalImpreso === null ? null : totalImpreso - (sumaLineas - descuentos);
  return {
    productos,
    descuentosSinAsociar,
    reconciliacion: {
      sumaLineas,
      descuentos,
      totalImpreso,
      diferencia,
      coincide: diferencia === null ? null : Math.abs(diferencia) <= 1,
    },
  };
}
