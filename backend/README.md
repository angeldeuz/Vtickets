# Backend — API e identidad de Vtickets

Este directorio contiene NestJS 12.2.0, Prisma 7.9.1, PGlite 0.5.11 para verificar migraciones localmente y el [esquema objetivo de F02](prisma/schema.prisma), basado en el catálogo de `tickets_app` del 25 de octubre de 2026. El avance de la fase 03 está en [docs/fase-03](../docs/fase-03/README.md).

## API local

Con Node 24.15 o posterior y las dependencias instaladas, copia `.env.example` a `.env`. La API puede arrancar sin `DATABASE_URL` para probar `GET /api/v1/health`, pero `GET /api/v1/ready` devolverá 503 y las rutas de perfil no funcionarán. Para identidad real, configura `SUPABASE_URL` y una conexión PostgreSQL de privilegios mínimos que herede `tickets_app_runtime`. No uses la contraseña de `postgres` o una clave `service_role` como conexión de la aplicación.

```powershell
npm.cmd --prefix backend run build
npm.cmd --prefix backend run start
```

La API escucha en `http://127.0.0.1:3001` y la documentación OpenAPI se sirve en `/api/docs`. `GET /api/v1/me`, `PATCH /api/v1/me` y `GET /api/v1/me/roles` requieren un token de Supabase Auth. NestJS verifica firma ES256/RS256, emisor, audiencia y expiración antes de crear o leer el perfil. Los roles vigentes se consultan en PostgreSQL; no se toman de metadatos editables del usuario.

El worker se compila con la API y se inicia con `npm.cmd --prefix backend run worker` cuando `DATABASE_URL` está configurada. Solo reclama tipos de trabajo con handler registrado; los handlers de pagos, reservas y correo se incorporarán en sus fases.

El esquema contiene los 24 modelos y los cambios de [fase 02](../docs/fase-02/01-modelo-y-brechas.md). La [migración SQL](../database/migrations/20261025204118_align_f02_business_rules_20261025.sql) se aplicó al proyecto Supabase de desarrollo el 25 de octubre de 2026. `usuarios.auth_user_id` referencia externamente `auth.users`. Auth, Storage, checks, índices parciales, privilegios y políticas RLS no son objetos administrados por este archivo.

Para comprobar la sintaxis del esquema desde la raíz del repositorio:

```powershell
backend\node_modules\.bin\prisma.cmd validate --schema backend\prisma\schema.prisma
```

La validación actual termina sin advertencias. El esquema y la base de desarrollo ya comparten la FK corregida de `eventos.venue_id`. **No ejecutar `prisma migrate dev` ni `db push` contra el proyecto remoto**; la historia del esquema de negocio se lleva en SQL versionado. `db pull` sobrescribiría este archivo y puede omitir detalles que Prisma no representa.

Para reconstruir la línea base en una base local efímera, aplicar F02 y verificar catálogo, permisos, restricciones, semilla y alta inicial simulada:

```powershell
npx.cmd --yes pnpm@10.28.2 --filter @vtickets/backend db:verify-f02
```

La prueba usa una tabla `auth.users` mínima y no sustituye un ensayo en una instancia Supabase limpia.

Para ver desde la terminal las 24 tablas y algunos datos ficticios de esa misma base temporal:

```powershell
npm.cmd --prefix backend run db:inspect-f02
```

PGlite construye la base en memoria y la cierra al acabar el comando. No queda un archivo de base de datos ni un servidor local al que conectarse después.
