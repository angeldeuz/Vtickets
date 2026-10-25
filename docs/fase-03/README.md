# Fase 03 — Base técnica e identidad

**Estado:** en curso desde el 25 de octubre de 2026. La API y las pantallas de identidad están implementadas y compilan. La cuenta PostgreSQL limitada ya conecta con la API y pasó la verificación de privilegios. Hay una cuenta Auth confirmada y vinculada como administrador. El propietario inició sesión en la web y cambió la contraseña temporal; `/me` respondió 200 y la base conserva un perfil con roles `ADMINISTRADOR` y `CLIENTE`. Faltan pruebas de recuperación por correo, cierre de sesión y permisos de dominios futuros. F02-T05 conserva el cotejo de una restauración en Supabase limpio.

## Avance comprobado

| Tarea | Avance |
|---|---|
| F03-T01 | Estructura Next.js/NestJS por módulos, SQL versionado y documentación presentes. Los dominios de ventas se añadirán en sus fases. |
| F03-T02 | Ejemplos de entorno, Node 24.15.0, ejecución local y cuenta `tickets_app_login` conectada al Supabase de desarrollo. `db:verify-runtime` confirma privilegios mínimos. Sigue sin haber Docker ni PostgreSQL local; falta revisar región y cuotas efectivas del proyecto. |
| F03-T03 | Variables validadas con Zod, errores `{error:{code,message,details,requestId}}`, logs HTTP sin cuerpo ni token, salud y readiness separados. |
| F03-T04 | Registro, inicio/cierre de sesión, recuperación y renovación de cookies con `@supabase/ssr`; verificación JWKS ES256/RS256 en NestJS; perfil idempotente y `/me`. La cuenta real está confirmada y vinculada en PostgreSQL. El propietario accedió en la web y cambió la contraseña temporal; `/me` respondió 200 y añadió `CLIENTE` sin duplicar el perfil. El callback adjunta cookies a la redirección y se usa `localhost` como origen único. Faltan prueba completa de recuperación por correo y cierre de sesión. |
| F03-T05 | Guard de roles y consulta de asignaciones vigentes a eventos implementados. Falta comprobar permisos de todos los dominios cuando existan sus rutas. |
| F03-T06 | Supabase Auth conserva las contraseñas; la API limita peticiones a 60/minuto por dirección IP y verifica expiración y firma en cada ruta protegida. Revisar controles de sesiones sensibles y límites tras pruebas de carga. |
| F03-T07 | Workflow de GitHub Actions para instalar, validar esquema, probar F02, revisar tipos, compilar y ejecutar Jest. Pasó localmente; la primera ejecución en GitHub queda pendiente. |
| F03-T08 | Completado. Reclamación outbox con `FOR UPDATE SKIP LOCKED`, lease de cinco minutos, reintentos y estado `dead`; solo un handler de diagnóstico. En PostgreSQL de desarrollo cuatro reclamantes concurrentes obtuvieron un solo ganador; el reintento quedó diferido y luego terminó en `succeeded` al segundo intento; otro trabajo con lease vencido llegó a `dead` al quinto. Los handlers de negocio se añadirán en sus fases. |
| F03-T09 | Comentarios en español junto al arranque, módulos, guard, controlador, servicio, páginas y clientes Supabase. El recorrido inicial es formulario → Supabase Auth → token → `/me` → verificación JWKS → perfil/roles en PostgreSQL → pantalla de cuenta. |

## Comprobaciones locales

- `npm.cmd --prefix backend run prisma:validate`: esquema Prisma válido.
- `npm.cmd --prefix backend run db:verify-f02`: línea base, migración, semillas, alta simulada y restricciones verificadas en PGlite.
- `npm.cmd --prefix backend run test`: cuatro pruebas pasan, incluida firma JWT válida y alterada, salud, readiness y acceso sin token.
- `npm.cmd --prefix frontend run typecheck` y `npm.cmd --prefix frontend run build`: pasan; las rutas de identidad se generan.
- API iniciada sin credenciales: `/api/v1/health` 200, `/api/v1/ready` 503 esperado, `/api/v1/me` 401 sin token. Se verificó `/ingresar` en móvil y el proyecto publica un JWKS ES256.
- API iniciada con la cuenta limitada: `/api/v1/ready` 200; `db:verify-runtime` pasó. El worker completó dos trabajos temporales, uno pendiente y otro recuperado después de vencer su lease, y se borraron los dos.
- El propietario inició sesión y cambió la contraseña desde «Mi cuenta». Los registros Auth muestran `PUT /user` 200 seguido de `POST /token` 200; la API registró `GET /api/v1/me` 200 y una consulta remota confirmó un solo perfil con `ADMINISTRADOR` y `CLIENTE`. La clave administrativa usada para el cambio temporal y los archivos auxiliares se retiraron del entorno local.
- La prueba manual de outbox creó dos filas temporales en desarrollo. Verificó reclamación concurrente única, reintento diferido, finalización, recuperación de lease vencido y transición a `dead` al quinto intento. La cuenta limitada bloqueó `DELETE` como exige el diseño; ambas filas se borraron por conexión administrativa y se confirmó que no quedaron trabajos de prueba.

## Pendientes para completar la fase

1. Validar región, modo de conexión y tamaño del pool según límites reales de Supabase. La conexión local de desarrollo exige TLS (`sslmode=require` con compatibilidad libpq); antes de producción descargar el certificado CA desde el panel de Supabase y configurar `verify-full` para verificar también el servidor.
2. Configurar SMTP, plantillas y URL de redirección de Auth para los enlaces de confirmación y recuperación. La cuenta inicial quedó confirmada; un correo de recuperación se envió a las 22:26 UTC y el siguiente intento recibió HTTP 429 (`over_email_send_rate_limit`) a las 22:29 UTC. La sesión web, el cambio de contraseña por el propietario y `/me` ya se comprobaron. Restan la recuperación completa por correo y el cierre de sesión.
3. El alta inicial del administrador con identidad Auth real ya se ejecutó y repitió sin duplicados, y su acceso interactivo quedó comprobado. Probar el guard con un cliente sin privilegios y la asignación vigente de ACCESO a un evento; repetir las pruebas de propiedad en las rutas de negocio de sus fases.
4. Activar handlers de negocio del worker en las fases correspondientes; la reclamación concurrente, el reintento y la recuperación de lease ya se probaron en PostgreSQL de desarrollo.
5. Verificar el workflow en GitHub y cerrar el pendiente de restauración Supabase de F02-T05 antes de declarar completa F03.
