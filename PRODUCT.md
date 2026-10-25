# Producto Vtickets

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Personas que buscan eventos locales y compran entradas desde teléfono o computadora.
- Administradores internos que publican eventos y personal autorizado que valida accesos desde un teléfono.

## Product Purpose

Vtickets permite descubrir eventos, reservar entradas, pagar y recibir un ticket individual con QR. El recorrido termina cuando el personal valida un único acceso por ticket. En el lanzamiento, el catálogo real empieza en Saltillo, Coahuila.

## Positioning

El propietario eligió **comprar entradas con confianza** como promesa principal de la experiencia pública. La interfaz debe mostrar con claridad los hechos que sostienen esa confianza: evento, fecha y hora local, recinto, precio total en MXN, disponibilidad y estado de la compra. Esto es una prioridad de producto, no una afirmación de garantía comercial.

## Operating Context

La primera versión usa Next.js para la web y NestJS para las reglas de negocio. Supabase aporta PostgreSQL, Auth y almacenamiento. El frontend actual es una vista previa con eventos ficticios; no habilita compras. Los eventos de prueba visibles aún muestran Ciudad de México y se sustituirán por datos reales de Saltillo al conectar la API.

## Capabilities and Constraints

- El precio publicado es el total a pagar; el MVP no añade un cargo de servicio.
- La reserva dura diez minutos. Solo una confirmación verificada del proveedor permite emitir entradas.
- El navegador no confirma pagos ni valida tickets por sí mismo; la API aplica permisos por rol y recurso.
- No presentar eventos de demostración como publicados ni una compra deshabilitada como disponible.

## Evidence on Hand

- [Reglas y alcance aprobados](docs/fase-01/01-alcance-y-arquitectura.md).
- [Plan de entregas](plan.md) y [contratos de fase 02](docs/fase-02/03-contratos-api.md).
- [Frontend de vista previa](frontend/README.md); no hay fotografías ni logotipo de marca aportados por el propietario en el repositorio.

## Product Principles

1. Mostrar los datos que permiten decidir antes de pedir una acción.
2. Nombrar cada estado y su siguiente paso con palabras concretas.
3. Distinguir claramente la demostración de una venta real.
4. Mantener las operaciones de administración y escaneo rápidas y legibles en móvil.

## Accessibility & Inclusion

Las pantallas deben adaptarse a móvil y permitir navegación por teclado, etiquetas y mensajes comprensibles, según F05-T05 del plan. Las animaciones futuras deben respetar la preferencia de movimiento reducido.
