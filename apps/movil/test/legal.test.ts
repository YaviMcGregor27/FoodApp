import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION_DATOS_SALUD, VERSION_TERMINOS } from '../src/logica/legal.ts';

// Si la app y la base de datos no coinciden en la versión de los textos, nadie podría registrarse.
test('Las versiones de los textos legales coinciden con la migración de la base de datos', () => {
  const dir = join(import.meta.dirname, '../../../supabase/migrations');
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  const version = (proposito: string) => {
    const coincidencias = [...sql.matchAll(new RegExp(`\\('${proposito}',\\s*'([^']+)'\\)`, 'g'))];
    return coincidencias.at(-1)?.[1];
  };
  assert.equal(version('terminos'), VERSION_TERMINOS);
  assert.equal(version('datos_salud'), VERSION_DATOS_SALUD);
});
