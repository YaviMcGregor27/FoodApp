// Estimación energética. Referencias: docs/05-motor-energetico-y-nutricional.md, RN-NUT-05 y RN-NUT-06.
// Los resultados son estimaciones poblacionales, no mediciones.

import { ErrorDominio } from './cantidades.ts';

export type Sexo = 'mujer' | 'hombre' | 'no_indicado';
export type NivelActividad = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'muy_alto';
export type ActividadDiaria = 'sentado' | 'de_pie' | 'fisico';
export type Objetivo = 'perder' | 'mantener' | 'ganar';
export type ObjetivoSecundario = 'ganar_musculo' | 'mantener_musculo' | 'rendimiento' | 'ninguno' | 'otro';
export type Ritmo = 'conservador' | 'moderado';

export const VERSION_METODO = '2026.1';

export const FACTORES_ACTIVIDAD: Record<NivelActividad, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

export const DESCRIPCION_ACTIVIDAD: Record<NivelActividad, string> = {
  sedentario: 'Trabajo sentado y poco o ningún ejercicio.',
  ligero: 'Ejercicio ligero 1 a 3 días por semana o trabajo de pie.',
  moderado: 'Ejercicio moderado 3 a 5 días por semana.',
  alto: 'Ejercicio intenso 6 a 7 días por semana.',
  muy_alto: 'Ejercicio muy intenso a diario o trabajo físico exigente más entrenamiento.',
};

/**
 * Propone un nivel de actividad a partir de la actividad diaria y el volumen de entrenamiento.
 * El usuario confirma o cambia la propuesta; nunca se aplica en silencio.
 */
export function sugerirNivelActividad(
  diaria: ActividadDiaria,
  sesionesSemana: number,
  minutosPorSesion: number,
): NivelActividad {
  const base = { sentado: 0, de_pie: 1, fisico: 2 }[diaria];
  const minutosSemana = Math.max(0, sesionesSemana) * Math.max(0, minutosPorSesion);
  const extra = minutosSemana >= 300 ? 3 : minutosSemana >= 180 ? 2 : minutosSemana >= 60 ? 1 : 0;
  const niveles: NivelActividad[] = ['sedentario', 'ligero', 'moderado', 'alto', 'muy_alto'];
  return niveles[Math.min(4, base + extra)];
}

export interface PerfilEnergetico {
  edad: number;
  sexo: Sexo;
  alturaCm: number;
  pesoKg: number;
  /** Porcentaje de grasa corporal medido. Si existe, se usa Katch-McArdle. */
  grasaPct?: number;
  actividad: NivelActividad;
  objetivo: Objetivo;
  objetivoSecundario: ObjetivoSecundario;
  ritmo?: Ritmo;
  /** Embarazo, lactancia, enfermedad, medicación, antecedentes de TCA. Vacío si no hay ninguna. */
  situacionesRelevantes: string[];
}

export interface EstimacionEnergetica {
  metodo: 'mifflin_st_jeor' | 'katch_mcardle';
  formula: string;
  version: string;
  metabolismoBasal: number;
  factorActividad: number;
  gastoDiario: number;
  gastoDiarioMin: number;
  gastoDiarioMax: number;
  ajustePct: number;
  objetivoKcal: number;
  rangoKcal: [number, number];
  proteinaG: [number, number];
  grasaG: number;
  carbohidratosG: number;
  pesoReferenciaKg: number;
  soloReferencia: boolean;
  advertencias: string[];
}

export const ADVERTENCIA_GENERAL =
  'Estos valores son estimaciones basadas en fórmulas poblacionales, no una medición. ' +
  'No sustituyen la valoración de un profesional sanitario.';

export const ADVERTENCIA_SITUACION =
  'Con la información indicada, te recomendamos consultar con un profesional sanitario antes de fijar ' +
  'un objetivo de pérdida o ganancia de peso. Mostramos una estimación de mantenimiento solo como referencia.';

function validarPerfil(p: PerfilEnergetico): void {
  if (!(p.edad >= 18 && p.edad <= 100)) throw new ErrorDominio('EDAD_FUERA_DE_RANGO', 'La edad debe estar entre 18 y 100 años.');
  if (!(p.alturaCm >= 100 && p.alturaCm <= 250)) throw new ErrorDominio('ALTURA_FUERA_DE_RANGO', 'La altura debe estar entre 100 y 250 cm.');
  if (!(p.pesoKg >= 30 && p.pesoKg <= 300)) throw new ErrorDominio('PESO_FUERA_DE_RANGO', 'El peso debe estar entre 30 y 300 kg.');
  if (p.grasaPct !== undefined && !(p.grasaPct >= 3 && p.grasaPct <= 70)) {
    throw new ErrorDominio('GRASA_FUERA_DE_RANGO', 'El porcentaje de grasa debe estar entre 3 y 70.');
  }
}

export function imc(pesoKg: number, alturaCm: number): number {
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

export function metabolismoBasal(p: PerfilEnergetico): { valor: number; metodo: EstimacionEnergetica['metodo']; formula: string } {
  if (p.grasaPct !== undefined) {
    const masaMagra = p.pesoKg * (1 - p.grasaPct / 100);
    return {
      valor: 370 + 21.6 * masaMagra,
      metodo: 'katch_mcardle',
      formula: 'TMB = 370 + 21,6 x masa magra (kg)',
    };
  }
  const constante = p.sexo === 'hombre' ? 5 : p.sexo === 'mujer' ? -161 : -78;
  const textoConstante = p.sexo === 'hombre' ? '+ 5' : p.sexo === 'mujer' ? '- 161' : '- 78 (media de ambos sexos)';
  return {
    valor: 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.edad + constante,
    metodo: 'mifflin_st_jeor',
    formula: `TMB = 10 x peso (kg) + 6,25 x altura (cm) - 5 x edad ${textoConstante}`,
  };
}

function ajusteObjetivo(p: PerfilEnergetico): number {
  const ritmo = p.ritmo ?? 'conservador';
  if (p.objetivo === 'perder') return ritmo === 'moderado' ? -0.2 : -0.1;
  if (p.objetivo === 'ganar') return ritmo === 'moderado' ? 0.1 : 0.05;
  return 0;
}

export function estimarEnergia(p: PerfilEnergetico): EstimacionEnergetica {
  validarPerfil(p);
  const advertencias: string[] = [ADVERTENCIA_GENERAL];

  const tmb = metabolismoBasal(p);
  const factor = FACTORES_ACTIVIDAD[p.actividad];
  const gasto = tmb.valor * factor;
  const incertidumbre = p.sexo === 'no_indicado' && tmb.metodo === 'mifflin_st_jeor' ? 0.15 : 0.1;
  if (incertidumbre > 0.1) {
    advertencias.push('Sin el dato de sexo se usa un valor intermedio y el margen de error es mayor (+-15 %).');
  }

  const indiceMasa = imc(p.pesoKg, p.alturaCm);
  let soloReferencia = false;
  let ajuste = ajusteObjetivo(p);
  if (p.situacionesRelevantes.length > 0) {
    soloReferencia = true;
    ajuste = 0;
    advertencias.push(ADVERTENCIA_SITUACION);
  } else if (p.objetivo === 'perder' && indiceMasa < 18.5) {
    soloReferencia = true;
    ajuste = 0;
    advertencias.push(
      'Tu índice de masa corporal está por debajo de 18,5. No calculamos un objetivo de pérdida; ' +
        'te recomendamos consultarlo con un profesional sanitario.',
    );
  }

  let objetivo = gasto * (1 + ajuste);
  if (objetivo < tmb.valor) {
    objetivo = tmb.valor;
    advertencias.push('El objetivo se ha limitado para no quedar por debajo del metabolismo basal estimado.');
  }
  const rangoMin = Math.max(tmb.valor, objetivo * 0.95);
  const rangoMax = objetivo * 1.05;

  // Peso de referencia para proteína: con IMC > 30 se usa el peso correspondiente a IMC 25.
  const m = p.alturaCm / 100;
  const pesoRef = indiceMasa > 30 ? 25 * m * m : p.pesoKg;
  const priorizaProteina =
    p.objetivo === 'perder' || p.objetivoSecundario === 'ganar_musculo' || p.objetivoSecundario === 'mantener_musculo';
  const [protMinKg, protMaxKg] = priorizaProteina ? [1.6, 2.2] : [1.2, 1.6];
  const proteinaMin = protMinKg * pesoRef;
  const proteinaMax = protMaxKg * pesoRef;
  const proteinaMedia = (proteinaMin + proteinaMax) / 2;

  const objetivoRedondeado = Math.round(objetivo);
  const grasa = Math.max(0.6 * pesoRef, (objetivoRedondeado * 0.25) / 9);
  const carbohidratos = (objetivoRedondeado - Math.round(proteinaMedia) * 4 - Math.round(grasa) * 9) / 4;
  if (carbohidratos < 50) {
    advertencias.push('El reparto deja menos de 50 g de carbohidratos; revisa el objetivo o la proteína.');
  }

  return {
    metodo: tmb.metodo,
    formula: tmb.formula,
    version: VERSION_METODO,
    metabolismoBasal: Math.round(tmb.valor),
    factorActividad: factor,
    gastoDiario: Math.round(gasto),
    gastoDiarioMin: Math.round(gasto * (1 - incertidumbre)),
    gastoDiarioMax: Math.round(gasto * (1 + incertidumbre)),
    ajustePct: Math.round(ajuste * 100),
    objetivoKcal: objetivoRedondeado,
    rangoKcal: [Math.round(rangoMin), Math.round(rangoMax)],
    proteinaG: [Math.round(proteinaMin), Math.round(proteinaMax)],
    grasaG: Math.round(grasa),
    carbohidratosG: Math.max(0, Math.round(carbohidratos)),
    pesoReferenciaKg: Math.round(pesoRef * 10) / 10,
    soloReferencia,
    advertencias,
  };
}

/** Tendencia de peso por media móvil exponencial (factor 0,1 por registro diario). */
export function tendenciaPeso(pesosDiarios: number[], alfa = 0.1): number[] {
  const salida: number[] = [];
  for (const peso of pesosDiarios) {
    const previo = salida.length === 0 ? peso : salida[salida.length - 1];
    salida.push(previo + alfa * (peso - previo));
  }
  return salida.map((v) => Math.round(v * 100) / 100);
}
