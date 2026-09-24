// Validación de datos nutricionales y cálculo de recetas. Referencias: RN-NUT-02, RN-NUT-03, RN-NUT-04.

export interface Nutrientes {
  kcal: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
  fibra?: number;
  alcohol?: number;
  azucares?: number;
  saturadas?: number;
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

/** Valida valores por 100 g o 100 ml. Los errores impiden guardar; las advertencias marcan para revisión. */
export function validarNutrientes(n: Nutrientes): ResultadoValidacion {
  const errores: string[] = [];
  const advertencias: string[] = [];
  const campos: (keyof Nutrientes)[] = ['kcal', 'proteinas', 'carbohidratos', 'grasas', 'fibra', 'alcohol', 'azucares', 'saturadas'];
  for (const c of campos) {
    const v = n[c];
    if (v !== undefined && (!Number.isFinite(v) || v < 0)) errores.push(`VALOR_NEGATIVO_O_INVALIDO:${c}`);
  }
  if (errores.length > 0) return { valido: false, errores, advertencias };

  const masa = n.proteinas + n.carbohidratos + n.grasas + (n.fibra ?? 0) + (n.alcohol ?? 0);
  if (masa > 102) errores.push('MACRONUTRIENTES_SUPERAN_100G');
  if (n.azucares !== undefined && n.azucares > n.carbohidratos) errores.push('AZUCARES_SUPERAN_CARBOHIDRATOS');
  if (n.saturadas !== undefined && n.saturadas > n.grasas) errores.push('SATURADAS_SUPERAN_GRASAS');

  const calculadas = 4 * n.proteinas + 4 * n.carbohidratos + 9 * n.grasas + 2 * (n.fibra ?? 0) + 7 * (n.alcohol ?? 0);
  const tolerancia = Math.max(10, n.kcal * 0.15);
  if (Math.abs(calculadas - n.kcal) > tolerancia) advertencias.push('ENERGIA_INCOHERENTE_CON_MACRONUTRIENTES');

  return { valido: errores.length === 0, errores, advertencias };
}

export function nutrientesDeCantidad(por100: Nutrientes, gramos: number): Nutrientes {
  const f = gramos / 100;
  return {
    kcal: por100.kcal * f,
    proteinas: por100.proteinas * f,
    carbohidratos: por100.carbohidratos * f,
    grasas: por100.grasas * f,
  };
}

export interface IngredienteNutricional {
  nombre: string;
  gramos: number;
  /** Valores por 100 g, o null si no hay datos fiables. */
  por100: Nutrientes | null;
}

export interface NutrientesReceta {
  total: Nutrientes;
  porRacion: Nutrientes;
  /** Porcentaje del peso de ingredientes con datos nutricionales. */
  coberturaPct: number;
  sinDatos: string[];
}

function redondear(n: Nutrientes): Nutrientes {
  return {
    kcal: Math.round(n.kcal),
    proteinas: Math.round(n.proteinas * 10) / 10,
    carbohidratos: Math.round(n.carbohidratos * 10) / 10,
    grasas: Math.round(n.grasas * 10) / 10,
  };
}

export function nutrientesReceta(ingredientes: IngredienteNutricional[], raciones: number): NutrientesReceta {
  if (!(raciones > 0)) throw new Error('RACIONES_NO_VALIDAS');
  const total: Nutrientes = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0 };
  let pesoTotal = 0;
  let pesoConDatos = 0;
  const sinDatos: string[] = [];
  for (const ing of ingredientes) {
    pesoTotal += ing.gramos;
    if (ing.por100 === null) {
      sinDatos.push(ing.nombre);
      continue;
    }
    pesoConDatos += ing.gramos;
    const n = nutrientesDeCantidad(ing.por100, ing.gramos);
    total.kcal += n.kcal;
    total.proteinas += n.proteinas;
    total.carbohidratos += n.carbohidratos;
    total.grasas += n.grasas;
  }
  const porRacion: Nutrientes = {
    kcal: total.kcal / raciones,
    proteinas: total.proteinas / raciones,
    carbohidratos: total.carbohidratos / raciones,
    grasas: total.grasas / raciones,
  };
  return {
    total: redondear(total),
    porRacion: redondear(porRacion),
    coberturaPct: pesoTotal === 0 ? 0 : Math.round((pesoConDatos / pesoTotal) * 1000) / 10,
    sinDatos,
  };
}
