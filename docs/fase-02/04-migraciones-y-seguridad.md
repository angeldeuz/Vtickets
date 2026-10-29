# Migraciones, permisos y datos de desarrollo

**Estado:** la migración F02 se aplicó al proyecto de desarrollo el 25 de octubre de 2026 con autorización del propietario. La restauración local desde cero se verificó con PGlite y se vinculó un administrador real de Auth en desarrollo. El 28 de octubre se restauró y cotejó en una instancia Supabase limpia. Fuentes: [plan.md](../../plan.md), [modelo y brechas](01-modelo-y-brechas.md) y consultas de catálogo a Supabase.

El propietario creó el proyecto vacío `Vtickets-pruebas` el 28 de octubre para realizar el cotejo remoto. La línea base, la migración F02 y la semilla de roles se aplicaron allí en una transacción después de comprobar que no existía `tickets_app`. Una segunda ejecución de solo lectura confirmó el mismo resultado: 24 tablas, 223 columnas, 147 restricciones, 85 índices, 24 políticas, 288 combinaciones de privilegios de tabla, 3 privilegios de esquema y 3 roles de negocio coinciden con desarrollo. La prueba no cargó usuarios ni ventas y no alteró el proyecto de desarrollo.

## Verificación en Vtickets-pruebas

El [verificador remoto](../../backend/scripts/verify-f02-supabase.mjs) comprueba primero que la conexión administrativa corresponda al identificador del proyecto de pruebas, que sea distinta a desarrollo y que el esquema `tickets_app` aún no exista. Sin `--apply` solo hace esa revisión. Con `--apply` ejecuta en una transacción la línea base, la migración F02 y la semilla de roles; después compara tablas, columnas, restricciones, índices, políticas RLS y privilegios con desarrollo. Si falla el SQL, revierte esa transacción. Esta prueba no sustituye el historial de migraciones del proyecto de desarrollo y no debe dirigirse a él.

1. Copiar `database/.env.example` a `database/.env.pruebas`. El segundo archivo está ignorado por Git.
2. En el Dashboard de `Vtickets-pruebas`, copiar el identificador del proyecto a `TEST_PROJECT_REF` y la cadena **Direct connection** de su botón **Connect** a `TEST_DATABASE_URL`, sustituyendo `[YOUR-PASSWORD]` por la contraseña codificada para URL. Si la red local no admite IPv6, usar **Session pooler** (puerto 5432) del mismo botón. No usar Transaction pooler ni compartir la URL por chat.
3. Desde la raíz, ejecutar `node --env-file=backend/.env --env-file=database/.env.pruebas backend/scripts/verify-f02-supabase.mjs` y revisar que indique preflight correcto y el identificador esperado.
4. Ejecutar el mismo comando con `--apply` al final para restaurar y cotejar. Para repetir el cotejo después sin escribir en la base, usar `--compare`.

Los dos archivos `.env` no se versionan. La URL del backend usa el rol mínimo solo para leer el catálogo de desarrollo; la URL de pruebas requiere el usuario administrativo `postgres` para crear el esquema y el rol de ejecución. Supabase [recomienda conexión directa para migraciones](https://supabase.com/docs/guides/database/connecting-to-postgres); Session pooler es la alternativa IPv4 del proyecto para una sesión persistente.

## Punto de partida comprobado

- El proyecto remoto ya contiene 24 tablas de negocio en `tickets_app`. Todas tienen RLS habilitado. No hay tablas de negocio en `public`.
- Antes de F02 el historial `supabase_migrations.schema_migrations` tenía una entrada: `20261024065838_align_tickets_app_with_plan_20261024`. El archivo local [20261024065838_align_tickets_app_with_plan_20261024.sql](../../database/migrations/20261024065838_align_tickets_app_with_plan_20261024.sql) contiene únicamente una columna y FK para `webhook_eventos.payment_id`, su índice y una ampliación de resultados de escaneo. **No representa la creación de las 24 tablas.** Tras F02, el historial tiene también `20261025204118_align_f02_business_rules_20261025`, cuyo SQL está [versionado aquí](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql).
- `anon` y `authenticated` carecen de `USAGE` en `tickets_app` y de permisos de lectura e inserción sobre sus tablas. `tickets_app_runtime` tiene `USAGE`, lectura e inserción sobre las 24; cada una tiene una política RLS `backend_runtime_access` con `USING (true)` y `WITH CHECK (true)` para ese rol. La autorización por usuario, evento y recurso corresponde obligatoriamente a NestJS.
- `roles` tiene tres filas. `auth.users` y `storage.buckets` están vacíos. El resumen de Supabase muestra cero filas en las otras tablas de negocio; los conteos de ese resumen pueden ser estimaciones.
- El asesor de seguridad de Supabase no devolvió hallazgos antes ni después de F02. El de rendimiento pasó de 16 a 12 FK sin índice de cobertura; señaló también índices sin uso registrado, esperable en una base sin tráfico de negocio. [Aviso de índices FK](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- `tickets_app_runtime` es un rol `NOLOGIN`, sin capacidad de crear bases ni eludir RLS. En F03 se creó `tickets_app_login` con contraseña aleatoria local y membresía de ese rol. La conexión quedó solo en `backend/.env`, ignorado por Git. [El script de provisión](../../database/scripts/create_backend_login.psql) permite repetir el alta en otra instancia sin versionar la contraseña. `db:verify-runtime` comprobó que la cuenta puede leer e insertar en `tickets_app.usuarios`, pero no leer `auth.users` ni crear en `public`.

## Una sola fuente para el esquema de negocio

El historial remoto de `supabase_migrations` es el único historial de DDL del esquema de negocio a partir de F02. El repositorio guarda el SQL con su versión remota; Prisma aporta el modelo tipado y **no** ejecuta otro historial de migraciones. Dado que la base remota fue creada antes de que existiera una migración inicial en el repositorio, **no se debe ejecutar una migración `CREATE TABLE` ni `prisma migrate dev` sobre ese proyecto**: duplicaría objetos o podría solicitar un reset.

Se creó la [instantánea SQL reconstruida](../../database/baseline/20261025_tickets_app_snapshot.sql) a partir del catálogo remoto **anterior a F02**: 24 tablas, 217 columnas, 139 restricciones y 29 índices independientes de restricciones, con RLS y permisos del rol `tickets_app_runtime`. Refleja el estado posterior a la migración remota de 20261024, por lo que no debe seguirse de la ejecución de esa migración histórica. Es **un archivo de referencia para restauración inicial, no una migración que deba ejecutarse sobre desarrollo**. El [verificador local](../../backend/scripts/verify-f02-schema.mjs) lo restauró en PGlite con una tabla mínima `auth.users` de prueba, aplicó F02 y comprobó 24 tablas, 223 columnas, 24 tablas con RLS y 24 políticas, además de permisos y restricciones seleccionadas. La restauración se repitió en `Vtickets-pruebas` y el catálogo completo coincidió con el proyecto de desarrollo. La instantánea no incluye objetos internos de Auth o Storage ni filas de roles.

`schema.prisma` es el modelo de acceso tipado, **no** el único lugar para checks, índices parciales, roles o RLS. La línea base y la migración F02 forman una secuencia reproducible para nuevas instancias sin volver a aplicar la migración histórica de ajustes sobre la instantánea. No se mantendrán dos mecanismos aplicando DDL a las mismas tablas.

## Secuencia de cambios y pruebas

1. La instantánea de línea base se restauró en `Vtickets-pruebas`; después se aplicó la migración F02 y se cotejaron relaciones, índices, checks y políticas que Prisma no representa.
2. La migración F02 ya se aplicó al desarrollo y se comprobaron en catálogo `eventos.timezone`, `suspended`, `partially_refunded`, la idempotencia de reembolsos, la FK del recinto, la eliminación de los tres índices duplicados y los permisos reducidos de `roles` y `accesos`.
3. Validar operaciones reales con PostgreSQL de pruebas: compra, pago, reembolso, escaneo y carreras de concurrencia. Esas pruebas pertenecen a las fases de implementación F03–F10 y no se sustituyen por la revisión de catálogo de F02.
4. En F03 se creó y comprobó una cuenta de conexión de backend con privilegios mínimos; NestJS verifica los tokens y consulta permisos vigentes. No aplicar cambios a un proyecto de producción en esta fase.

La migración de `reembolsos` quitó `UNIQUE (purchase_id)` y añadió unicidad por `(payment_id, idempotency_key)` y por `(ticket_id, purchase_id)`. La regla transaccional que evita que dos devoluciones simultáneas superen el importe elegible se implementará y probará en la fase de pagos. Antes de aplicar F02 se confirmó mediante conteo exacto que no había eventos, tipos, reservas, compras, tickets ni reembolsos; los tres roles existentes se conservaron y se marcaron como del sistema.

## Semillas y administrador inicial

- Conservar los tres códigos de rol existentes (`CLIENTE`, `ADMINISTRADOR`, `ACCESO`). La [semilla de roles](../../database/seeds/roles.sql) usa `INSERT ... ON CONFLICT (code)` para ser repetible y no cambia IDs ya referenciados; F02 marcó esos roles como del sistema.
- La [semilla de desarrollo](../../database/seeds/development.sql) crea una categoría y un recinto ficticios de Saltillo. Se ejecutó dos veces en la prueba local sin duplicados; aún no se aplicó al proyecto remoto. Los eventos ficticios requieren primero un organizador vinculado a Auth y se crearán mediante el flujo de F04. Las semillas de eventos nunca incluyen credenciales, clientes reales ni pagos reales.
- Crear primero la identidad del administrador mediante el flujo seguro de Supabase Auth. Después ejecutar el [script de alta inicial](../../database/scripts/bootstrap_admin.psql) con el UUID de Auth y una conexión administrativa temporal. El script vincula `usuarios.auth_user_id`, asigna `ADMINISTRADOR` en una transacción, registra la primera asignación en auditoría y comprueba el resultado. No insertar contraseñas en SQL, no basar el rol en `user_metadata` y no asignarlo desde un formulario público. Una segunda ejecución no duplica el perfil ni el rol. Registrar también fuera de la base quién ejecutó el procedimiento y cuándo.
- La prueba local ejecutó dos veces la semilla y el cuerpo SQL del alta inicial con una identidad Auth simulada; confirmó una sola asignación y una sola entrada de auditoría. Esto valida la repetición del SQL, pero no prueba el flujo real de Supabase Auth ni los metacomandos de `psql`. Ejecutar `pnpm --filter @vtickets/backend db:verify-f02` para repetir la comprobación local.
- El 25 de octubre de 2026 el propietario autorizó el alta con una cuenta real ya confirmada en Supabase Auth. El procedimiento se ejecutó dos veces sobre desarrollo: quedó un perfil, una asignación `ADMINISTRADOR` y una entrada de auditoría `bootstrap_admin`. El acceso interactivo se comprobó después en F03, junto con `/me`, recuperación y cierre de sesión.
- Secretos de Stripe, correo y base de datos quedan en variables de servidor. La clave `service_role` no entra al frontend ni al repositorio.

## Criterios de verificación

- La base de pruebas se construyó desde archivos versionados en `Vtickets-pruebas` y su catálogo de negocio coincidió con desarrollo el 28 de octubre.
- `anon` y `authenticated` siguen sin acceso a `tickets_app`; solo el backend usa `tickets_app_runtime`, con políticas y privilegios comprobados.
- La creación inicial de administrador es repetible y no permite escalación desde cuentas ordinarias.
- Cada restricción clave se prueba con un caso válido y uno inválido; las carreras de reserva, pago, reembolso y acceso cumplen [transacciones](02-transacciones.md).
- No quedan migraciones del esquema de negocio aplicadas fuera del historial acordado.
