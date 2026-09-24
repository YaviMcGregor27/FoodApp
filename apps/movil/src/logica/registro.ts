// Validaciones de los formularios de cuenta (RF-01, pantalla P-01). Funciones puras, sin
// dependencias de React Native, para poder probarlas con el ejecutor de pruebas de Node.

export const LONGITUD_MINIMA_CONTRASENA = 12;
export const EDAD_MINIMA = 18;

export const MENSAJES = {
  correo: 'Introduce un correo válido.',
  contrasenaCorta: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`,
  contrasenasDistintas: 'Las contraseñas no coinciden.',
  fechaFormato: 'Introduce la fecha con el formato dd/mm/aaaa.',
  fechaFutura: 'La fecha de nacimiento no puede ser futura.',
  edadMinima: `Debes tener al menos ${EDAD_MINIMA} años para usar la aplicación.`,
  terminos: 'Debes aceptar los términos para crear la cuenta.',
  contrasenaVacia: 'Introduce tu contraseña.',
} as const;

export function validarCorreo(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim());
}

/** Convierte "dd/mm/aaaa" (también con guiones o puntos) en "aaaa-mm-dd". Devuelve null si no es una fecha real. */
export function parsearFecha(texto: string): string | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (anio < 1900 || mes < 1 || mes > 12 || dia < 1) return null;
  const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const fecha = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

/** Edad cumplida en años a fecha de `hoy` (ambas en "aaaa-mm-dd"). */
export function calcularEdad(nacimiento: string, hoy: string): number {
  const [an, mn, dn] = nacimiento.split('-').map(Number);
  const [ah, mh, dh] = hoy.split('-').map(Number);
  let edad = ah - an;
  if (mh < mn || (mh === mn && dh < dn)) edad -= 1;
  return edad;
}

export function hoyLocal(ahora: Date = new Date()): string {
  const a = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export type Errores<K extends string> = Partial<Record<K, string>>;

function validarFechaNacimiento(texto: string, hoy: string): string | undefined {
  const iso = parsearFecha(texto);
  if (iso === null) return MENSAJES.fechaFormato;
  if (iso > hoy) return MENSAJES.fechaFutura;
  if (calcularEdad(iso, hoy) < EDAD_MINIMA) return MENSAJES.edadMinima;
  return undefined;
}

export interface DatosRegistro {
  correo: string;
  contrasena: string;
  repetirContrasena: string;
  fechaNacimiento: string;
  aceptaTerminos: boolean;
}

export function validarRegistro(d: DatosRegistro, hoy: string): Errores<keyof DatosRegistro> {
  const errores: Errores<keyof DatosRegistro> = {};
  if (!validarCorreo(d.correo)) errores.correo = MENSAJES.correo;
  if (d.contrasena.length < LONGITUD_MINIMA_CONTRASENA) errores.contrasena = MENSAJES.contrasenaCorta;
  if (d.repetirContrasena !== d.contrasena) errores.repetirContrasena = MENSAJES.contrasenasDistintas;
  const fecha = validarFechaNacimiento(d.fechaNacimiento, hoy);
  if (fecha) errores.fechaNacimiento = fecha;
  if (!d.aceptaTerminos) errores.aceptaTerminos = MENSAJES.terminos;
  return errores;
}

export interface DatosInicioSesion {
  correo: string;
  contrasena: string;
}

export function validarInicioSesion(d: DatosInicioSesion): Errores<keyof DatosInicioSesion> {
  const errores: Errores<keyof DatosInicioSesion> = {};
  if (!validarCorreo(d.correo)) errores.correo = MENSAJES.correo;
  if (d.contrasena.length === 0) errores.contrasena = MENSAJES.contrasenaVacia;
  return errores;
}

export interface DatosNuevaContrasena {
  contrasena: string;
  repetirContrasena: string;
}

export function validarNuevaContrasena(d: DatosNuevaContrasena): Errores<keyof DatosNuevaContrasena> {
  const errores: Errores<keyof DatosNuevaContrasena> = {};
  if (d.contrasena.length < LONGITUD_MINIMA_CONTRASENA) errores.contrasena = MENSAJES.contrasenaCorta;
  if (d.repetirContrasena !== d.contrasena) errores.repetirContrasena = MENSAJES.contrasenasDistintas;
  return errores;
}

export interface DatosIniciales {
  fechaNacimiento: string;
  aceptaTerminos: boolean;
}

/** Para quien entra con Apple o Google y debe completar el registro. */
export function validarDatosIniciales(d: DatosIniciales, hoy: string): Errores<keyof DatosIniciales> {
  const errores: Errores<keyof DatosIniciales> = {};
  const fecha = validarFechaNacimiento(d.fechaNacimiento, hoy);
  if (fecha) errores.fechaNacimiento = fecha;
  if (!d.aceptaTerminos) errores.aceptaTerminos = MENSAJES.terminos;
  return errores;
}

export function hayErrores(errores: Record<string, string | undefined>): boolean {
  return Object.values(errores).some((e) => e !== undefined);
}
