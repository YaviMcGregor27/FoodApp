# Supabase: base de datos, autenticación y funciones

Contenido:

| Ruta | Qué es |
|---|---|
| `config.toml` | Configuración del proyecto (autenticación, enlaces, límites). Generada con `supabase init` y ajustada a DEC-03. |
| `migrations/` | Esquema de la base de datos, en orden. Nunca se modifica una migración ya aplicada: los cambios van en una nueva. |
| `pruebas/` | Pruebas del esquema sobre PostgreSQL normal, con una réplica mínima del esquema `auth` de Supabase. |

## Probar el esquema en local

Requiere PostgreSQL 17 (o 16) y una base de datos vacía; se ejecuta con un superusuario.

```bash
createdb foodapp_test
PGDATABASE=foodapp_test supabase/pruebas/ejecutar.sh
```

La última línea debe ser `OK: todas las comprobaciones del esquema han pasado`. Las mismas pruebas se ejecutan en GitHub en cada cambio.

## Crear el proyecto alojado (una sola vez)

Pasos para el propietario; requieren una cuenta de Supabase.

1. En [supabase.com](https://supabase.com), crear un proyecto nuevo en la región **Central EU (Frankfurt)**. Guardar la contraseña de la base de datos en un gestor de contraseñas. En el apartado *Security* del formulario:
   - *Enable Data API*: marcada (la app la necesita).
   - *Automatically expose new tables*: desmarcada. La migración concede de forma explícita solo los permisos necesarios; las pruebas pasan también sin los permisos por defecto.
   - *Enable automatic RLS*: marcada, como red de seguridad para tablas futuras.
2. En *Project Settings > API*, copiar la URL del proyecto y la clave pública (publishable o anon). Se ponen en `apps/movil/.env` (ver `apps/movil/.env.example`).
3. Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) instalada, desde la raíz del repositorio:

   ```bash
   npx supabase login
   npx supabase link --project-ref <referencia-del-proyecto>
   npx supabase db push        # aplica supabase/migrations
   npx supabase config push    # aplica la configuración de autenticación de config.toml
   ```

4. En *Authentication > URL Configuration*, comprobar que figuran las direcciones de redirección `foodapp://**` y, durante el desarrollo, `exp://**`.
5. En *Authentication > Emails*, configurar un servidor SMTP propio. El envío de correo incluido en Supabase tiene límites muy bajos y no sirve para usuarios reales.
6. Antes del lanzamiento (DEC-02 y DEC-03): pasar al plan Pro, activar la protección de contraseñas filtradas y la recuperación a un punto en el tiempo.

### Estado del proyecto alojado

- 26/09/2026: proyecto `jepnoulrnrojnwmwvaip` creado en Frankfurt; la app apunta a él (`apps/movil/src/lib/supabase.ts`, solo URL y clave publicable). Ajustes de autenticación hechos en el panel: verificación de correo activada, contraseña mínima de 12 caracteres, Site URL `foodapp://` y redirecciones `foodapp://**` y `exp://**`. La migración `20260925000000_esquema_inicial.sql` se aplicó a mano desde el *SQL Editor* del panel (con la opción *Run and enable RLS*); la comprobación dio 23 tablas, 2 disparadores y 0 tablas sin RLS.
- Como no se aplicó con la CLI, antes del primer `supabase db push` hay que marcarla como aplicada para que no se repita:

  ```bash
  npx supabase migration repair --status applied 20260925000000
  ```

La clave de servicio (`service_role`) nunca se pone en la app ni en el repositorio: solo la usan las funciones de servidor.

## Modelo de seguridad

- Cada usuario solo puede leer y escribir sus propias filas (políticas RLS con `auth.uid()`).
- El rol anónimo no tiene acceso a ninguna tabla.
- Se retiran los privilegios que Supabase concede por defecto y que no respetan RLS (`TRUNCATE`).
- El usuario no puede fabricar consentimientos, cambiar su fecha de nacimiento ni modificar o borrar movimientos de inventario.
- La edad mínima (18 años) y la aceptación de los términos se validan en la base de datos, no solo en la app.
