# Fase 02 — Modelo de datos y contratos

**Estado:** F02 completada el 28 de octubre de 2026. La fase 01 está aprobada. La migración F02 se aplicó al proyecto Supabase de desarrollo con autorización del propietario y se reprodujo desde la línea base en `Vtickets-pruebas`, una instancia limpia. El catálogo completo cotejado coincide con desarrollo.

| Tarea | Estado | Entregable |
|---|---|---|
| F02-T01 Modelo entidad-relación y esquema Prisma | Completado: modelo objetivo y sintaxis Prisma validados | [Modelo y brechas](01-modelo-y-brechas.md) y [esquema Prisma objetivo](../../backend/prisma/schema.prisma), validado con Prisma 7.9.1. El cotejo con PostgreSQL corresponde a F02-T05. |
| F02-T02 Personal por evento e idempotencia | Completado: incorporado al modelo y a la base de desarrollo | [Modelo y brechas](01-modelo-y-brechas.md), [Transacciones](02-transacciones.md), [esquema Prisma](../../backend/prisma/schema.prisma) y [migración SQL](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql). |
| F02-T03 Claves, índices y restricciones | Completado: diseño aplicado al proyecto de desarrollo | [Modelo y brechas](01-modelo-y-brechas.md) y [migración SQL](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql). Faltan pruebas de carga representativa en fases de implementación. |
| F02-T04 Transacciones críticas | Completado: diseño documentado | [Transacciones](02-transacciones.md) |
| F02-T05 Migraciones, permisos, datos y administrador inicial | Completado | [Estrategia de migraciones](04-migraciones-y-seguridad.md), [instantánea SQL](../../database/baseline/20261025_tickets_app_snapshot.sql), [migración aplicada](../../database/migrations/20261025204118_align_f02_business_rules_20261025.sql), [semilla de roles](../../database/seeds/roles.sql) y [alta inicial del administrador](../../database/scripts/bootstrap_admin.psql). El alta con identidad Auth real se ejecutó y se repitió sin duplicados. `Vtickets-pruebas` se restauró desde cero y coincidió en tablas, columnas, restricciones, índices, políticas y permisos con desarrollo. |
| F02-T06 Contratos REST | Completado: contratos documentados; OpenAPI se generará en F03 | [Contratos API](03-contratos-api.md) |
| F02-T07 Auth, autorización, validación, paginación y errores | Completado: convenciones documentadas | [Contratos API](03-contratos-api.md) |

## Base verificada

La inspección de solo lectura del 25 de octubre de 2026 encontró 24 tablas en `tickets_app`, ninguna en `public`, 37 claves foráneas y RLS activo en las 24 tablas de negocio. `roles` tiene tres registros; Auth no tiene usuarios y Storage no tiene buckets. La revisión y los nombres de tablas se registraron en [plan.md](../../plan.md).

## Verificación y siguientes dependencias

- Prisma 7.9.1 validó el esquema; la migración F02 y los permisos se comprobaron en desarrollo y se reprodujeron en `Vtickets-pruebas`. El [verificador remoto](../../backend/scripts/verify-f02-supabase.mjs) permite repetir el cotejo con `--compare`.
- No ejecutar `db push` ni la instantánea inicial sobre la base de desarrollo ya poblada. El proyecto de pruebas ahora también contiene `tickets_app`; volver a ejecutar `--apply` se rechaza.
- Las carreras de reserva, pago, reembolso y acceso se probarán junto con la implementación de esos flujos en las fases correspondientes de [plan.md](../../plan.md). Los contratos REST sirven de base para esas fases.
