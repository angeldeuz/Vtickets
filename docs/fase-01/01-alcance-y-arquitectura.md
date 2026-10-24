# Alcance y decisiones de arquitectura

Fuentes: [plan.md](../../plan.md), [Vtickets_requerimientos.md](../../Vtickets_requerimientos.md). **Estado: borrador de F01-T01, F01-T06 y F01-T08.**

## Objetivo del MVP

Un administrador interno crea y publica un evento con tipos de boleto; un cliente se registra, reserva inventario durante 10 minutos, paga con tarjeta en MXN y recibe un ticket individual por cada entrada. El personal asignado al evento valida un QR en línea y registra como máximo un acceso válido por ticket. Se incluyen cancelación de evento, reembolso básico y auditoría esencial, conforme al mapa maestro.

Quedan fuera del primer lanzamiento: organizadores externos, asientos numerados, venta en taquilla, aplicaciones nativas, scanner sin conexión, reventa, transferencia de tickets, Wallet, promociones avanzadas, multimoneda, precios dinámicos y pagos divididos. Cualquier cambio de alcance exige revisar estados, permisos y contratos antes de implementarlo.

## Módulos y propietarios de reglas

| Componente | Responsabilidad |
|---|---|
| Next.js | Páginas públicas, área del cliente, checkout, administración y scanner; presenta datos y solicita operaciones a la API. |
| Supabase Auth | Credenciales, registro, recuperación y sesión. |
| NestJS | Única entrada a las operaciones de negocio: permisos, precios, inventario, reservas, compras, pagos, tickets y accesos. Verifica el token de Auth y consulta permisos vigentes. |
| PostgreSQL en Supabase | Integridad, transacciones, restricciones de inventario y acceso único, auditoría y outbox. |
| Supabase Storage | Imágenes públicas de eventos y archivos privados si se necesitan. |
| Proveedor de pagos | Cobra y notifica de forma autenticada; solo su confirmación verificada permite emitir tickets. |
| Worker | Expira reservas, procesa tareas outbox, reintenta correos y concilia fallas recuperables. |

Las tablas de negocio irán en un esquema no expuesto directamente a la Data API. El navegador no escribirá reservas, compras, pagos, tickets ni accesos mediante Supabase. El backend aplicará permisos por rol y por recurso incluso si la interfaz oculta una acción. Las credenciales de base de datos y las claves secretas permanecerán en el servidor.

## Stack de partida

Se mantiene la propuesta de `plan.md`: TypeScript, Next.js App Router, React, NestJS REST/OpenAPI, PostgreSQL en Supabase, Prisma con migraciones SQL versionadas, Supabase Auth y Storage, Stripe en entorno de pruebas, un worker Node.js y pnpm workspaces. El frontend ya fija Next.js 16.1.6, React 19.2.4 y TypeScript 5.9.3 en `frontend/package.json`. Para el backend se elige **NestJS 12** y **Prisma ORM 7** como líneas objetivo: [NestJS 12](https://docs.nestjs.com/migration-guide) está documentado como versión actual y [Prisma 8](https://www.prisma.io/docs/orm/release-status) aún es candidata de lanzamiento, mientras Prisma 7 sigue con soporte. Las versiones exactas se fijarán en `package.json` y el lockfile al autorizar su instalación.

Se recomienda **Node.js 24 LTS**, como mínimo 24.15 para los generadores actuales de NestJS; la versión 22.12 disponible en este equipo es insuficiente para ellos. [NestJS](https://docs.nestjs.com/migration-guide) y [Prisma](https://www.prisma.io/docs/orm/v7/reference/system-requirements) respaldan la compatibilidad de la línea 24. No se ha actualizado Node. Se mantiene pnpm 10.28.2, declarado en el `package.json` raíz. Para pruebas del backend se conserva Jest y Supertest según `plan.md`; con NestJS 12 y Jest se requiere Node 24.9 o posterior, cubierto por la línea 24.15+. Se mantienen Tailwind CSS y shadcn/ui como objetivo del sistema de componentes; el CSS propio existente es una vista previa y se migrará o adaptará al construir las pantallas definitivas.

El desarrollo ejecutará frontend, API y worker localmente. Supabase local con CLI y Docker está previsto cuando el equipo lo permita; **Docker no está disponible en el entorno inspeccionado**. Ya existe un proyecto Supabase dedicado a desarrollo y pruebas, sin ventas ni datos reales. Su región y cuotas efectivas aún no se han consultado. Supabase Free no se asumirá apto para operar ventas reales.

Los eventos ficticios del frontend actual muestran Ciudad de México; son solo material de diseño. En F05 se sustituirán por eventos publicados desde la API, empezando por Saltillo.

## Dinero y tiempo

- **Confirmado:** el catálogo real empieza en **Saltillo, Coahuila, México** y cobra únicamente en **MXN**. La zona horaria inicial es `America/Monterrey`, que cubre la mayor parte de Coahuila según la [base IANA](https://github.com/eggert/tz/blob/main/zone.tab); otros eventos conservarán su zona específica.
- Los importes se guardarán en centavos como enteros; el backend calcula el total y conserva una copia de los importes de cada compra. **Confirmado:** el precio publicado es el total a pagar, sin cargo de servicio adicional en el MVP. El tratamiento fiscal y los comprobantes se definirán antes de ventas reales.
- Las marcas de tiempo de operaciones se almacenarán en UTC. Cada evento conservará una zona horaria IANA; la interfaz mostrará fecha y hora locales del evento. La expiración de una reserva se compara con la hora del servidor, no con el reloj del navegador.
- Una fecha/hora de evento o de apertura de ventas se introduce en su zona local y se convierte a un instante inequívoco al guardar. Las ventanas de venta pertenecen a cada tipo de boleto y nunca se prolongan automáticamente por una reserva.

## Comprobaciones posteriores

| Decisión | Motivo |
|---|---|
| Comprobantes e impuestos | Requieren decisión operativa y revisión aplicable antes de venta real; el MVP conserva precio total y no genera facturación avanzada. |
| Región y cuotas del proyecto Supabase | Se revisarán en F03 para elegir conexión, latencia y capacidad de integración. |
| Versiones exactas del backend | Se fijarán en F03 al autorizar la instalación, tras validar la combinación. |
