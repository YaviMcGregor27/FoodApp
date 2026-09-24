import { useColorScheme } from 'react-native';

const claro = {
  fondo: '#FAFAF7',
  superficie: '#FFFFFF',
  borde: '#D9DBD4',
  texto: '#1B1D1A',
  textoSecundario: '#5D6259',
  primario: '#2F6B3A',
  textoSobrePrimario: '#FFFFFF',
  error: '#B3261E',
  fondoError: '#FCECEA',
  aviso: '#7A5A00',
  fondoAviso: '#FFF6DB',
  fondoInfo: '#EAF2EB',
};

const oscuro: typeof claro = {
  fondo: '#121411',
  superficie: '#1C1F1B',
  borde: '#3A3E37',
  texto: '#ECEEE8',
  textoSecundario: '#A9AEA4',
  primario: '#7CC48A',
  textoSobrePrimario: '#0E1A10',
  error: '#F2B8B5',
  fondoError: '#3B1715',
  aviso: '#F0CF72',
  fondoAviso: '#3A2E0A',
  fondoInfo: '#1E2A20',
};

export type Colores = typeof claro;

export function useColores(): Colores {
  return useColorScheme() === 'dark' ? oscuro : claro;
}

export const espacio = { xs: 4, s: 8, m: 16, l: 24, xl: 32 } as const;
export const radio = 10;
export const anchoMaximo = 560;
