# Fase 02 — Modelo de datos y contratos

**Estado:** en curso desde el 25 de octubre de 2026. La fase 01 está aprobada. La migración F02 se aplicó al proyecto Supabase de desarrollo con autorización del propietario; la restauración de la línea base en una instancia limpia sigue pendiente.

| Tarea | Estado | Entregable |
|---|---|---|
| F02-T01 Modelo entidad-relación y esquema Prisma | Completado: modelo objetivo y sintaxis Prisma validados | [Modelo y brechas](01-modelo-y-brechas.md) y [esquema Prisma objetivo](../../backend/prisma/schema.prisma), validado con Prisma 7.9.1. El cotejo con PostgreSQL corresponde a F02-T05. |
| F02-T02 Personal por evento e idempotencia | Completado: incorporado al modelo y a la base de desarrollo | [Modelo y brechas](01-modelo-y-brechas.md), [Transacciones](02-transacciones.md), [esquema Prisma](../../backend/prisma/schema.prisma) y [migración SQL](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql). |
| F02-T03 Claves, índices y restricciones | Completado: diseño aplicado al proyecto de desarrollo | [Modelo y brechas](01-modelo-y-brechas.md) y [migración SQL](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql). Faltan pruebas de carga representativa en fases de implementación. |
| F02-T04 Transacciones críticas | Completado: diseño documentado | [Transacciones](02-transacciones.md) |
| F02-T05 Migraciones, permisos, datos y administrador inicial | En curso | [Estrategia de migraciones](04-migraciones-y-seguridad.md), [instantánea SQL](../../database/baseline/20261025_tickets_app_snapshot.sql), [migración aplicada](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql), [semilla de roles](../../database/seeds/roles.sql) y [alta inicial del administrador](../../database/scripts/bootstrap_admin.psql). El alta con identidad Auth real se ejecutó y se repitió sin duplicados. Falta restaurar y cotejar la línea base en una instancia Supabase limpia. |
| F02-T06 Contratos REST | Completado: contratos documentados; OpenAPI se generará en F03 | [Contratos API](03-contratos-api.md) |
| F02-T07 Auth, autorización, validación, paginación y errores | Completado: convenciones documentadas | [Contratos API](03-contratos-api.md) |

## Base verificada

La inspección de solo lectura del 25 de octubre de 2026 encontró 24 tablas en `tickets_app`, ninguna en `public`, 37 claves foráneas y RLS activo en las 24 tablas de negocio. `roles` tiene tres registros; Auth no tiene usuarios y Storage no tiene buckets. La revisión y los nombres de tablas se registraron en [plan.md](../../plan.md).

## Orden para continuar

1. Revisar las brechas del modelo contra las reglas aprobadas de F01 y fijar los cambios de datos que sí entran al MVP.
2. Prisma 7.9.1 ya está instalado con autorización del propietario. El esquema se validó sintácticamente y los objetos cambiados se comprobaron en PostgreSQL remoto tras aplicar la migración.
3. Verificar mediante restauración la instantánea reconstruida del esquema anterior a F02 y reproducir después la migración aplicada. No ejecutar `db push` ni la instantánea inicial sobre la base remota ya poblada.
4. Validar restricciones, transacciones y permisos con PostgreSQL de pruebas, incluidos los casos de concurrencia de [plan.md](../../plan.md).
5. Revisar contratos REST y marcar F02-T01 a F02-T07 solo cuando sus criterios estén comprobados.
