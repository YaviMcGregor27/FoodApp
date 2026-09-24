// Textos legales y sus versiones. Las versiones deben coincidir con app.legal_text en la
// migración inicial (lo comprueba test/legal.test.ts).
//
// Estado: BORRADOR pendiente de revisión legal antes del lanzamiento (docs/09-decisiones.md).

export const VERSION_TERMINOS = '2026-09';
export const VERSION_DATOS_SALUD = '2026-09';

export type TipoTexto = 'terminos' | 'datos_salud';

export interface TextoLegal {
  titulo: string;
  version: string;
  parrafos: string[];
}

export const TEXTOS_LEGALES: Record<TipoTexto, TextoLegal> = {
  terminos: {
    titulo: 'Términos de uso y privacidad',
    version: VERSION_TERMINOS,
    parrafos: [
      'Borrador pendiente de revisión legal. No es el texto definitivo.',
      'FoodApp te ayuda a gestionar tu despensa, registrar lo que consumes y proponer recetas. Para ello guarda los productos que añades, los tickets que fotografías y los consumos que registras.',
      'Tus datos se guardan en servidores de la Unión Europea y solo tú puedes verlos. No los vendemos ni los compartimos con fines publicitarios.',
      'Las fotografías de los tickets se envían, sin tu nombre ni tu correo, a un proveedor de inteligencia artificial para leerlas. Ese proveedor no puede usarlas para entrenar sus modelos.',
      'Puedes exportar tus datos o eliminar tu cuenta en cualquier momento desde la aplicación.',
      'Las recetas, cálculos y datos nutricionales son orientativos y no sustituyen el consejo de un profesional sanitario.',
      'Debes tener al menos 18 años para usar la aplicación.',
    ],
  },
  datos_salud: {
    titulo: 'Consentimiento para datos de salud',
    version: VERSION_DATOS_SALUD,
    parrafos: [
      'Borrador pendiente de revisión legal. No es el texto definitivo.',
      'El perfil corporal, el peso, las medidas, las alergias, las intolerancias y las situaciones de salud que indiques son datos de salud, una categoría especial de datos protegida por el RGPD.',
      'Solo los usaremos para calcular estimaciones de energía y nutrientes, filtrar recetas por seguridad y mostrarte tu evolución.',
      'Este consentimiento es opcional y puedes retirarlo cuando quieras. Sin él puedes usar la despensa y las recetas, pero no el perfil corporal, los objetivos ni el seguimiento de peso.',
    ],
  },
};
