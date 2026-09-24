# FoodApp: despensa, nutrición y objetivos corporales

Aplicación móvil para gestionar la despensa a partir de fotografías de tickets de compra, registrar consumos parciales y totales con trazabilidad, sugerir recetas que aprovechen lo disponible y hacer seguimiento nutricional y del peso del usuario.

## Estado del proyecto

Fase actual: **F0, fundamentos** (ver `docs/01-especificacion-tecnica.md`, sección 12).

| Elemento | Estado | Ubicación |
|---|---|---|
| Especificación, requisitos, pantallas y decisiones | Documentado | `docs/` |
| Reglas de negocio (cantidades, consumos parciales, lotes, energía, nutrición, recetas, líneas de ticket) | Implementado y probado, todavía sin pantallas que lo usen | `paquetes/dominio/` |
| Base de datos para Supabase: esquema, aislamiento por usuario, alta de cuentas, edad mínima, consentimientos | Implementado y probado; pendiente de desplegar en un proyecto real | `supabase/` |
| App móvil: registro, verificación de correo, inicio y cierre de sesión, recuperación de contraseña, navegación | Implementado y probado con Supabase simulado; pendiente de probar contra un proyecto real y en dispositivos | `apps/movil/` |
| Inicio de sesión con Apple y Google | Pendiente: requiere cuentas de desarrollador | — |
| Despensa, tickets, nutrición, recetas, progreso | Pendiente (fases F1 a F6) | — |
| Exportación de datos y eliminación de cuenta | Pendiente (fase F7, antes del lanzamiento) | — |

Plataforma decidida (motivos en `docs/09-decisiones.md`): React Native con Expo, Supabase en la UE, lectura de tickets con Claude Opus 5 verificada por reglas propias, datos nutricionales de Open Food Facts, CIQUAL y USDA, lanzamiento inicial en España.

## Estructura

```
apps/movil/          App Expo (ver apps/movil/README.md)
paquetes/dominio/    Reglas de negocio compartidas, sin dependencias de plataforma
supabase/            Migraciones, configuración y pruebas de la base de datos (ver supabase/README.md)
docs/                Especificación y decisiones
```

## Comprobaciones

Requiere Node.js 22.18 o superior.

```bash
npm install
npm run typecheck     # tipos de todos los paquetes
npm test              # pruebas de todos los paquetes
```

Pruebas de la base de datos y de extremo a extremo: ver `supabase/README.md` y `apps/movil/README.md`. Todas se ejecutan en GitHub en cada cambio (`.github/workflows/pruebas.yml`).

## Lo que necesita el propietario para avanzar

1. Crear el proyecto de Supabase siguiendo `supabase/README.md` y rellenar `apps/movil/.env`.
2. Las demás tareas (cuenta de Anthropic, tickets de evaluación, cuentas de Apple y Google, revisión legal) están al final de `docs/09-decisiones.md`.

## Aviso

Los cálculos energéticos y nutricionales de esta aplicación son estimaciones. No son una medición médica ni sustituyen el consejo de un profesional sanitario.
