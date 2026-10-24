# Fase 01 — Reglas de negocio y arquitectura

**Estado:** aprobado por el propietario el **24 de octubre de 2026**. Este directorio es el entregable de F01 de [plan.md](../../plan.md). Las comprobaciones restantes están asignadas a la fase técnica o al lanzamiento y no cambian el modelo conceptual acordado aquí. La vista previa del frontend no equivale a la aceptación de las fases posteriores.

Las reglas marcadas como **confirmadas** fueron respondidas por el propietario en la conversación del **24 de octubre de 2026**. Las decisiones técnicas que no son reglas de negocio son propuestas de arquitectura sujetas a la revisión final de esta fase.

| Tarea | Estado | Evidencia |
|---|---|---|
| F01-T01 Alcance del MVP | Aprobado | [Alcance y arquitectura](01-alcance-y-arquitectura.md) |
| F01-T02 Permisos | Aprobado | [Matriz de permisos](02-permisos.md) |
| F01-T03 Estados y transiciones | Aprobado | [Estados y reglas](03-estados-y-reglas.md) |
| F01-T04 Límites, reservas y ventanas | Aprobado | [Estados y reglas](03-estados-y-reglas.md) |
| F01-T05 Cancelaciones, reembolsos y pagos tardíos | Aprobado | [Estados y reglas](03-estados-y-reglas.md) |
| F01-T06 Stack y versiones | Aprobado; versiones exactas de paquetes en el lockfile de F03 | [Alcance y arquitectura](01-alcance-y-arquitectura.md) |
| F01-T07 Cuotas y costos | Aprobado; verificar cuotas del proyecto existente en F03 | [Servicios y costos](04-servicios-y-costos.md) |
| F01-T08 Límites entre módulos, moneda y tiempo | Aprobado | [Alcance y arquitectura](01-alcance-y-arquitectura.md) |

## Decisiones del propietario

| Tema | Decisión confirmada |
|---|---|
| Mercado | Inicio en Saltillo, Coahuila; eventos en México y cobro en MXN. |
| Publicación | Solo administrador interno. |
| Compra | Solo tarjeta; precio anunciado como total final, sin cargo de servicio adicional. |
| Reserva | 10 minutos; máximo 4 entradas por compra y por cliente para un evento. |
| Ventas y acceso | Venta hasta el inicio del evento; escaneo hasta su finalización. |
| Cancelaciones | Sin reembolso por cancelación voluntaria de compra de un evento vigente. |
| Cobro tardío | No emitir tickets; solicitar reembolso íntegro. |
| Evento cancelado | Reembolsar entradas no utilizadas; las ya utilizadas requieren revisión manual del administrador. |
| Servicios | Existe un proyecto Supabase solo para desarrollo y pruebas y una cuenta GitHub. Stripe y Resend aún no tienen cuenta. |

## Puerta de salida de la fase

1. Resolver las decisiones abiertas en los documentos de este directorio y registrar quién las aprobó.
2. Revisar que la matriz de permisos y los diagramas cubran el flujo completo, incluidos errores y cancelaciones.
3. Confirmar que las reglas permiten diseñar datos y contratos sin cambiar la estructura durante F02.
4. F01-T01 a F01-T08 quedaron marcadas en `plan.md` tras la aprobación del propietario.

## Preguntas abiertas para el propietario

- En F03, confirmar la región y cuotas del proyecto Supabase existente desde su panel; la cuenta es solo para desarrollo y pruebas.
- En F03, fijar versiones exactas del backend cuando se autorice la instalación de dependencias.
- Antes de vender entradas reales, definir tratamiento fiscal y comprobantes con asesoría aplicable.
