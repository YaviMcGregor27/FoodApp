// Filtro de seguridad, clasificación de ingredientes y puntuación de recetas.
// Referencias: RN-NUT-07, regla 8 y 9 del rol, docs/07-motor-de-recetas.md.

import type { Cantidad } from './cantidades.ts';

export interface Sustituto {
  alimento: string;
  nombre: string;
  /** Cantidad del sustituto por unidad del original. */
  ratio: number;
  nota?: string;
}

export interface IngredienteReceta {
  alimento: string;
  nombre: string;
  cantidad: Cantidad;
  opcional?: boolean;
  alergenos?: string[];
  trazas?: string[];
  sustitutos?: Sustituto[];
}

export interface Receta {
  id: string;
  nombre: string;
  raciones: number;
  tiempoMin: number;
  dificultad: 1 | 2 | 3;
  /** Dietas que cumple la receta: 'vegana', 'vegetariana', 'sin_gluten'... */
  dietas: string[];
  ingredientes: IngredienteReceta[];
  kcalPorRacion: number | null;
}

export interface Existencia {
  alimento: string;
  disponible: Cantidad;
  /** Días hasta la fecha más próxima entre sus lotes; null si ningún lote tiene fecha. */
  diasHastaFecha: number | null;
  abierto: boolean;
}

export interface Restricciones {
  alergenos: string[];
  intolerancias: { codigo: string; toleraTrazas: boolean }[];
  dietas: string[];
  rechazados: string[];
  basicosDeclarados: string[];
}

export interface Seguridad {
  segura: boolean;
  motivos: string[];
  /** Ingredientes opcionales retirados por contener un alérgeno o intolerancia. */
  opcionalesRetirados: string[];
}

/** Filtro estricto previo a cualquier sugerencia. Una receta insegura nunca se muestra. */
export function evaluarSeguridad(receta: Receta, r: Restricciones): Seguridad {
  const motivos: string[] = [];
  const opcionalesRetirados: string[] = [];
  const estrictas = new Set([
    ...r.alergenos,
    ...r.intolerancias.map((i) => i.codigo),
  ]);
  const trazasProhibidas = new Set([
    ...r.alergenos,
    ...r.intolerancias.filter((i) => !i.toleraTrazas).map((i) => i.codigo),
  ]);
  for (const ing of receta.ingredientes) {
    const conflicto =
      (ing.alergenos ?? []).find((a) => estrictas.has(a)) ?? (ing.trazas ?? []).find((a) => trazasProhibidas.has(a));
    if (conflicto === undefined) continue;
    if (ing.opcional) {
      opcionalesRetirados.push(ing.nombre);
    } else {
      motivos.push(`${ing.nombre} contiene o puede contener ${conflicto}`);
    }
  }
  for (const dieta of r.dietas) {
    if (!receta.dietas.includes(dieta)) motivos.push(`No es apta para dieta ${dieta}`);
  }
  return { segura: motivos.length === 0, motivos, opcionalesRetirados };
}

export type Grupo = 'disponible' | 'parcial' | 'falta' | 'opcional' | 'basico';

export interface IngredienteClasificado {
  nombre: string;
  alimento: string;
  grupo: Grupo;
  necesario: Cantidad;
  disponible: Cantidad | null;
  faltante: Cantidad | null;
  sustitutosEnDespensa: Sustituto[];
  nota?: string;
}

function escalar(c: Cantidad, factor: number): Cantidad {
  return { valor: Math.round(c.valor * factor), unidad: c.unidad };
}

/** Clasifica cada ingrediente en disponible, parcial, falta, opcional o básico declarado. */
export function clasificarIngredientes(
  receta: Receta,
  despensa: Existencia[],
  r: Restricciones,
  raciones = receta.raciones,
): IngredienteClasificado[] {
  const factor = raciones / receta.raciones;
  const porAlimento = new Map(despensa.map((e) => [e.alimento, e]));
  const retirados = new Set(evaluarSeguridad(receta, r).opcionalesRetirados);
  const resultado: IngredienteClasificado[] = [];

  for (const ing of receta.ingredientes) {
    if (retirados.has(ing.nombre)) continue;
    const necesario = escalar(ing.cantidad, factor);
    const existencia = porAlimento.get(ing.alimento);
    const sustitutosEnDespensa = (ing.sustitutos ?? []).filter((s) => {
      const e = porAlimento.get(s.alimento);
      return e !== undefined && e.disponible.unidad === necesario.unidad && e.disponible.valor >= necesario.valor * s.ratio;
    });
    const base = { nombre: ing.nombre, alimento: ing.alimento, necesario, sustitutosEnDespensa };

    if (r.basicosDeclarados.includes(ing.alimento) && existencia === undefined) {
      resultado.push({ ...base, grupo: 'basico', disponible: null, faltante: null, nota: 'Básico declarado, sin control de cantidad' });
      continue;
    }
    if (existencia !== undefined && existencia.disponible.unidad !== necesario.unidad) {
      resultado.push({
        ...base,
        grupo: ing.opcional ? 'opcional' : 'parcial',
        disponible: existencia.disponible,
        faltante: null,
        nota: 'Unidades distintas: confirma si la cantidad disponible es suficiente',
      });
      continue;
    }
    const disp = existencia?.disponible.valor ?? 0;
    const disponible = existencia ? existencia.disponible : null;
    if (ing.opcional) {
      const faltante = disp >= necesario.valor ? null : { valor: necesario.valor - disp, unidad: necesario.unidad };
      resultado.push({ ...base, grupo: 'opcional', disponible, faltante });
    } else if (disp >= necesario.valor) {
      resultado.push({ ...base, grupo: 'disponible', disponible, faltante: null });
    } else if (disp > 0) {
      resultado.push({ ...base, grupo: 'parcial', disponible, faltante: { valor: necesario.valor - disp, unidad: necesario.unidad } });
    } else {
      resultado.push({ ...base, grupo: 'falta', disponible: null, faltante: necesario });
    }
  }
  return resultado;
}

export interface ContextoSugerencia {
  /** kcal objetivo para esta comida; null si el usuario no tiene objetivo o es solo referencia. */
  kcalObjetivoComida: number | null;
  tiempoMaxMin?: number;
  dificultadMax?: 1 | 2 | 3;
  preferidos?: string[];
}

export interface Puntuacion {
  total: number;
  desglose: { caducidad: number; abiertos: number; cobertura: number; ajusteNutricional: number; preferencias: number };
  motivos: string[];
}

export const PESOS = { caducidad: 30, abiertos: 15, cobertura: 25, ajusteNutricional: 20, preferencias: 10 };

/** Puntúa una receta segura. Devuelve null si no cumple los filtros de tiempo o dificultad. */
export function puntuarReceta(
  receta: Receta,
  clasificados: IngredienteClasificado[],
  despensa: Existencia[],
  r: Restricciones,
  ctx: ContextoSugerencia,
): Puntuacion | null {
  if (ctx.tiempoMaxMin !== undefined && receta.tiempoMin > ctx.tiempoMaxMin) return null;
  if (ctx.dificultadMax !== undefined && receta.dificultad > ctx.dificultadMax) return null;

  const porAlimento = new Map(despensa.map((e) => [e.alimento, e]));
  const usados = clasificados.filter((c) => c.grupo === 'disponible' || c.grupo === 'parcial');
  const motivos: string[] = [];

  // Caducidad: 10 puntos por ingrediente usado con fecha en 0 a 3 días (máximo 30). Los caducados no suman.
  const urgentes = usados.filter((c) => {
    const d = porAlimento.get(c.alimento)?.diasHastaFecha;
    return d !== null && d !== undefined && d >= 0 && d <= 3;
  });
  const caducidad = Math.min(PESOS.caducidad, urgentes.length * 10);
  if (urgentes.length > 0) {
    motivos.push(`Usa ${urgentes.length} ${urgentes.length === 1 ? 'producto' : 'productos'} con fecha próxima: ${urgentes.map((u) => u.nombre).join(', ')}`);
  }

  const abiertosUsados = usados.filter((c) => porAlimento.get(c.alimento)?.abierto);
  const abiertos = Math.min(PESOS.abiertos, abiertosUsados.length * 7.5);
  if (abiertosUsados.length > 0) {
    motivos.push(`Aprovecha ${abiertosUsados.length} ${abiertosUsados.length === 1 ? 'producto abierto' : 'productos abiertos'}`);
  }

  const principales = clasificados.filter((c) => c.grupo !== 'opcional' && c.grupo !== 'basico');
  const cubiertos = principales.reduce((s, c) => s + (c.grupo === 'disponible' ? 1 : c.grupo === 'parcial' ? 0.5 : 0), 0);
  const fraccion = principales.length === 0 ? 1 : cubiertos / principales.length;
  const cobertura = PESOS.cobertura * fraccion;
  const disponibles = principales.filter((c) => c.grupo === 'disponible').length;
  motivos.push(`${disponibles} de ${principales.length} ingredientes principales disponibles`);

  let ajusteNutricional = PESOS.ajusteNutricional / 2;
  if (ctx.kcalObjetivoComida !== null && receta.kcalPorRacion !== null && ctx.kcalObjetivoComida > 0) {
    const desviacion = Math.abs(receta.kcalPorRacion - ctx.kcalObjetivoComida) / ctx.kcalObjetivoComida;
    ajusteNutricional = PESOS.ajusteNutricional * Math.max(0, 1 - desviacion);
    if (desviacion <= 0.15) motivos.push('Encaja en tu objetivo para esta comida');
  }

  const preferidos = new Set(ctx.preferidos ?? []);
  const rechazados = new Set(r.rechazados);
  const nPref = receta.ingredientes.filter((i) => preferidos.has(i.alimento)).length;
  const nRech = receta.ingredientes.filter((i) => rechazados.has(i.alimento) && !i.opcional).length;
  const preferencias = Math.max(0, Math.min(PESOS.preferencias, PESOS.preferencias / 2 + nPref * 2.5 - nRech * 5));

  const total = Math.round((caducidad + abiertos + cobertura + ajusteNutricional + preferencias) * 10) / 10;
  return { total, desglose: { caducidad, abiertos, cobertura, ajusteNutricional, preferencias }, motivos };
}

export interface Sugerencia {
  receta: Receta;
  puntuacion: Puntuacion;
  ingredientes: IngredienteClasificado[];
}

/** Aplica filtro de seguridad, clasifica y ordena. Las recetas inseguras se descartan siempre. */
export function sugerirRecetas(
  recetas: Receta[],
  despensa: Existencia[],
  r: Restricciones,
  ctx: ContextoSugerencia,
): Sugerencia[] {
  const sugerencias: Sugerencia[] = [];
  for (const receta of recetas) {
    if (!evaluarSeguridad(receta, r).segura) continue;
    const ingredientes = clasificarIngredientes(receta, despensa, r);
    const puntuacion = puntuarReceta(receta, ingredientes, despensa, r, ctx);
    if (puntuacion !== null) sugerencias.push({ receta, puntuacion, ingredientes });
  }
  return sugerencias.sort((a, b) => b.puntuacion.total - a.puntuacion.total);
}
