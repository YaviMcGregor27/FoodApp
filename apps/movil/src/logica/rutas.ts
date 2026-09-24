// Decide qué zona de la aplicación corresponde al estado de la sesión.

export type Zona = 'cargando' | 'publica' | 'error_cuenta' | 'completar_registro' | 'app';

export interface EstadoSesion {
  cargando: boolean;
  conSesion: boolean;
  /** null si todavía no se ha podido leer el estado de la cuenta. */
  registroCompleto: boolean | null;
  /** true si falló la lectura del estado de la cuenta (por ejemplo, sin conexión). */
  errorEstado: boolean;
}

export function decidirZona(e: EstadoSesion): Zona {
  if (e.cargando) return 'cargando';
  if (!e.conSesion) return 'publica';
  if (e.errorEstado) return 'error_cuenta';
  if (e.registroCompleto === null) return 'cargando';
  return e.registroCompleto ? 'app' : 'completar_registro';
}
