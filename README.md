# FoodApp — Despensa, nutrición y objetivos corporales

Aplicación móvil para gestionar la despensa a partir de fotografías de tickets de compra, registrar consumos parciales y totales con trazabilidad, sugerir recetas que aprovechen lo disponible y hacer seguimiento nutricional y del peso del usuario.

## Estado del proyecto

| Elemento | Estado | Ubicación |
|---|---|---|
| Especificación técnica completa | Diseño propuesto | `docs/01-especificacion-tecnica.md` |
| Requisitos funcionales detallados | Requisito funcional | `docs/02-requisitos-funcionales.md` |
| Diseño de pantallas | Diseño propuesto | `docs/03-pantallas.md` |
| Modelo de datos y esquema SQL con aislamiento por usuario | Diseño propuesto (no desplegado) | `docs/04-modelo-de-datos.md`, `db/schema.sql` |
| Motor energético y nutricional | Diseño propuesto + prototipo | `docs/05-motor-energetico-y-nutricional.md` |
| Lectura de tickets y normalización | Diseño propuesto + prototipo de verificación de líneas | `docs/06-ocr-y-normalizacion.md` |
| Motor de recetas | Diseño propuesto + prototipo de clasificación y puntuación | `docs/07-motor-de-recetas.md` |
| Ejemplos operativos (inventario, consumos, receta, perfil) | Ejemplo ilustrativo | `docs/08-ejemplos-operativos.md` |
| Decisiones de plataforma, proveedores y mercado inicial | Decidido | `docs/09-decisiones.md` |
| Integración continua (tipos, pruebas del dominio y del esquema SQL) | Activa | `.github/workflows/pruebas.yml` |
| Núcleo de reglas de negocio en TypeScript con pruebas | Prototipo | `prototipo/` |
| Aplicación móvil, backend en Supabase, autenticación, lectura real de tickets | Limitación pendiente: no implementado (fase F0 en adelante) | — |

Plataforma decidida (detalle y motivos en `docs/09-decisiones.md`): app en React Native con Expo, backend en Supabase (región UE), lectura de tickets con Claude Opus 5 verificada por reglas propias, datos nutricionales de Open Food Facts, CIQUAL y USDA, y lanzamiento inicial en España. La siguiente fase es F0 (fundamentos); las tareas que requieren al propietario están al final de `docs/09-decisiones.md`.

Ninguna parte de este repositorio es todavía una funcionalidad implementada en producción. El prototipo de `prototipo/` valida reglas de negocio (cantidades, consumos parciales, lotes, cálculo energético, lectura de líneas de ticket, clasificación de ingredientes) de forma aislada y verificable mediante pruebas.

## Ejecutar las pruebas del prototipo

Requiere Node.js 22.18 o superior (ejecuta TypeScript de forma nativa; las únicas dependencias son de desarrollo, para comprobar tipos).

```bash
cd prototipo
npm ci
npm run typecheck
npm test
```

## Ejecutar las pruebas del esquema SQL

Requiere PostgreSQL 16 y una base de datos vacía; se ejecuta con un superusuario (las pruebas cambian al rol `app_user_role` para comprobar el aislamiento entre usuarios).

```bash
createdb foodapp_test
psql -d foodapp_test -v ON_ERROR_STOP=1 -f db/schema.sql -f db/test_rls.sql
```

La última línea de la salida debe ser `OK: todas las comprobaciones del esquema han pasado`.

## Aviso

Los cálculos energéticos y nutricionales de esta aplicación son estimaciones. No son una medición médica ni sustituyen el consejo de un profesional sanitario.
