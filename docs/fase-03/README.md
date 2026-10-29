# Fase 03 — Base técnica e identidad

**Estado:** F03 completada el 28 de octubre de 2026 y su dependencia F02 cerrada. La API y las pantallas de identidad compilan; la cuenta PostgreSQL limitada conecta y pasó la verificación de privilegios. El propietario comprobó acceso de administrador, recuperación por correo, cierre de sesión y registro de un cliente con Mailtrap Sandbox. El guard de roles y la asignación de acceso por evento pasaron pruebas con un perfil cliente real. Cada dominio futuro tendrá sus propias pruebas de propiedad.

## Avance comprobado

| Tarea | Avance |
|---|---|
| F03-T01 | Estructura Next.js/NestJS por módulos, SQL versionado y documentación presentes. Los dominios de ventas se añadirán en sus fases. |
| F03-T02 | Ejemplos de entorno, Node 24.15.0, ejecución local y cuenta `tickets_app_login` conectada al Supabase de desarrollo. `db:verify-runtime` confirma privilegios mínimos. Sigue sin haber Docker ni PostgreSQL local; falta revisar región y cuotas efectivas del proyecto. |
| F03-T03 | Variables validadas con Zod, errores `{error:{code,message,details,requestId}}`, logs HTTP sin cuerpo ni token, salud y readiness separados. |
| F03-T04 | Completada. Registro, inicio/cierre de sesión, recuperación y renovación de cookies con `@supabase/ssr`; verificación JWKS ES256/RS256 en NestJS; perfil idempotente y `/me`. El propietario comprobó acceso de administrador, recuperación por correo con Mailtrap Sandbox, cierre de sesión y registro confirmado de un cliente el 28 de octubre. El callback adjunta cookies a la redirección y se usa `localhost` como origen único. |
| F03-T05 | Completada para la base común. El guard rechaza `CLIENTE` ante una operación administrativa y admite `ADMINISTRADOR`. Una prueba transaccional con el perfil cliente real y PostgreSQL verificó que `canAccessEvent` solo concede acceso con asignación `ACCESO` vigente; vencida o retirada devuelve falso. Cada dominio futuro repetirá pruebas de propiedad en sus rutas. |
| F03-T06 | Completada para desarrollo. Supabase Auth conserva las contraseñas y limita los intentos de sus propias rutas. La API limita peticiones a 60/minuto por dirección IP; la prueba HTTP recibió `429`. NestJS comprueba firma, emisor, audiencia y expiración del JWT; las pruebas rechazan tokens vencidos y de otra audiencia. Supabase SSR renueva las cookies. Al cerrar sesión se revocan refresh tokens, pero un access token previamente emitido conserva validez hasta `exp`; las rutas sensibles futuras deben evaluar si requieren comprobación de sesión inmediata. |
| F03-T07 | Workflow de GitHub Actions para instalar, validar esquema, probar F02, revisar tipos, compilar y ejecutar Jest. Pasó localmente y en GitHub al integrar el PR #1. |
| F03-T08 | Completado. Reclamación outbox con `FOR UPDATE SKIP LOCKED`, lease de cinco minutos, reintentos y estado `dead`; solo un handler de diagnóstico. En PostgreSQL de desarrollo cuatro reclamantes concurrentes obtuvieron un solo ganador; el reintento quedó diferido y luego terminó en `succeeded` al segundo intento; otro trabajo con lease vencido llegó a `dead` al quinto. Los handlers de negocio se añadirán en sus fases. |
| F03-T09 | Comentarios en español junto al arranque, módulos, guard, controlador, servicio, páginas y clientes Supabase. El recorrido inicial es formulario → Supabase Auth → token → `/me` → verificación JWKS → perfil/roles en PostgreSQL → pantalla de cuenta. |

## Comprobaciones locales

- `npm.cmd --prefix backend run prisma:validate`: esquema Prisma válido.
- `npm.cmd --prefix backend run db:verify-f02`: línea base, migración, semillas, alta simulada y restricciones verificadas en PGlite.
- En el corte inicial, `npm.cmd --prefix backend run test` pasó cuatro pruebas: firma JWT válida y alterada, salud, readiness y acceso sin token.
- El 28 de octubre `npm.cmd --prefix backend run test` pasó 10 pruebas: añadió rechazo de JWT vencido y con audiencia ajena, rechazo/aceptación del guard de roles y respuesta `429` al superar el límite HTTP.
- `node --env-file=backend/.env backend/scripts/verify-f03-assignments.mjs` pasó contra PostgreSQL de desarrollo. Creó categoría, recinto, evento y asignación dentro de una transacción; comprobó sin asignación, asignación vigente, vencida y retirada, y revirtió todo. No quedaron datos de prueba.
- `npm.cmd --prefix frontend run typecheck` y `npm.cmd --prefix frontend run build`: pasan; las rutas de identidad se generan.
- API iniciada sin credenciales: `/api/v1/health` 200, `/api/v1/ready` 503 esperado, `/api/v1/me` 401 sin token. Se verificó `/ingresar` en móvil y el proyecto publica un JWKS ES256.
- API iniciada con la cuenta limitada: `/api/v1/ready` 200; `db:verify-runtime` pasó. El worker completó dos trabajos temporales, uno pendiente y otro recuperado después de vencer su lease, y se borraron los dos.
- El propietario inició sesión y cambió la contraseña desde «Mi cuenta». Los registros Auth muestran `PUT /user` 200 seguido de `POST /token` 200; la API registró `GET /api/v1/me` 200 y una consulta remota confirmó un solo perfil con `ADMINISTRADOR` y `CLIENTE`. La clave administrativa usada para el cambio temporal y los archivos auxiliares se retiraron del entorno local.
- La prueba manual de outbox creó dos filas temporales en desarrollo. Verificó reclamación concurrente única, reintento diferido, finalización, recuperación de lease vencido y transición a `dead` al quinto intento. La cuenta limitada bloqueó `DELETE` como exige el diseño; ambas filas se borraron por conexión administrativa y se confirmó que no quedaron trabajos de prueba.

## Pendientes para completar la fase

1. Validar región, modo de conexión y tamaño del pool según límites reales de Supabase. La conexión local de desarrollo exige TLS (`sslmode=require` con compatibilidad libpq); antes de producción descargar el certificado CA desde el panel de Supabase y configurar `verify-full` para verificar también el servidor.
2. El 28 de octubre el propietario comprobó el recorrido completo de recuperación por correo con Mailtrap Sandbox, cambió la contraseña, verificó que el cierre de sesión impide reabrir `/cuenta` y registró un cliente nuevo. La interfaz ahora explica el error `same_password` cuando se reutiliza la contraseña actual. Antes de producción se necesita una solución de envío real, ya que Mailtrap solo captura mensajes de prueba.
3. El alta inicial del administrador con identidad Auth real ya se ejecutó y repitió sin duplicados, y su acceso interactivo quedó comprobado. El guard de roles pasó una prueba aislada y la asignación de ACCESO se comprobó con un cliente real y datos transaccionales de prueba. Cada ruta de negocio tendrá su prueba de propiedad en su fase.
4. Activar handlers de negocio del worker en las fases correspondientes; la reclamación concurrente, el reintento y la recuperación de lease ya se probaron en PostgreSQL de desarrollo.
5. La restauración Supabase de F02-T05 pasó el 28 de octubre y el workflow se verificó en GitHub con el PR #1.
