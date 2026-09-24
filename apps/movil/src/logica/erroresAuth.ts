// Traducción de errores de autenticación y de las funciones de la base de datos a mensajes
// claros en español. Los mensajes de inicio de sesión y recuperación no revelan si un correo
// está registrado (RF-01).

export interface ErrorRemoto {
  code?: string;
  status?: number;
  message?: string;
  name?: string;
}

export type Contexto = 'inicio' | 'registro' | 'recuperacion' | 'nueva_contrasena' | 'completar_registro' | 'general';

const GENERICO = 'Ha ocurrido un error. Inténtalo de nuevo en unos minutos.';
const SIN_CONEXION = 'No hay conexión con el servidor. Comprueba tu conexión a internet e inténtalo de nuevo.';

// Errores que lanzan las funciones de la base de datos (supabase/migrations).
const ERRORES_BASE_DATOS: Record<string, string> = {
  EDAD_MINIMA: 'Debes tener al menos 18 años para usar la aplicación.',
  FECHA_NACIMIENTO_OBLIGATORIA: 'Introduce tu fecha de nacimiento.',
  FECHA_NACIMIENTO_INVALIDA: 'La fecha de nacimiento no es válida.',
  TERMINOS_NO_ACEPTADOS: 'Debes aceptar la versión vigente de los términos. Actualiza la aplicación si el problema continúa.',
  VERSION_DATOS_SALUD_DESACTUALIZADA: 'El texto sobre datos de salud ha cambiado. Actualiza la aplicación para aceptarlo.',
  NO_AUTENTICADO: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  CUENTA_NO_ENCONTRADA: 'No se ha encontrado tu cuenta. Vuelve a iniciar sesión.',
};

export function mensajeError(error: ErrorRemoto | null | undefined, contexto: Contexto): string | null {
  if (!error) return null;

  const codigoBaseDatos = Object.keys(ERRORES_BASE_DATOS).find((c) => error.message === c);
  if (codigoBaseDatos) return ERRORES_BASE_DATOS[codigoBaseDatos];

  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || /network request failed|failed to fetch/i.test(error.message ?? '')) {
    return SIN_CONEXION;
  }

  switch (error.code) {
    case 'invalid_credentials':
      return 'Correo o contraseña incorrectos.';
    case 'email_not_confirmed':
      return 'Todavía no has verificado tu correo. Abre el enlace que te enviamos o solicita uno nuevo.';
    case 'over_request_rate_limit':
      return 'Demasiados intentos. Vuelve a intentarlo en unos minutos.';
    case 'over_email_send_rate_limit':
      return 'Hemos enviado demasiados correos a esta dirección. Espera unos minutos antes de pedir otro.';
    case 'weak_password':
      return 'Esta contraseña no es segura: es demasiado corta o aparece en filtraciones conocidas. Elige otra.';
    case 'same_password':
      return 'La nueva contraseña debe ser distinta de la anterior.';
    case 'email_address_invalid':
      return 'Introduce un correo válido.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return 'El enlace ha caducado o se ha abierto en otro dispositivo. Solicita uno nuevo desde la aplicación.';
    case 'session_not_found':
    case 'session_expired':
    case 'refresh_token_not_found':
    case 'refresh_token_already_used':
      return 'Tu sesión ha caducado. Vuelve a iniciar sesión.';
    case 'user_already_exists':
    case 'email_exists':
      // Con verificación de correo activada, Supabase no revela si la cuenta existe; si llega
      // este código, se responde igual que a un alta correcta para no dar pistas.
      return contexto === 'registro' ? null : GENERICO;
    case 'signup_disabled':
      return 'El registro de nuevas cuentas no está disponible en este momento.';
    case 'unexpected_failure':
      if (contexto === 'registro') return 'No se ha podido crear la cuenta. Revisa los datos e inténtalo de nuevo.';
      return GENERICO;
  }

  if (error.status === 429) return 'Demasiados intentos. Vuelve a intentarlo en unos minutos.';
  return GENERICO;
}
