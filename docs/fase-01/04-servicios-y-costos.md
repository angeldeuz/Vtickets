# Servicios, cuotas y preparación de cuentas

**Estado: revisión documental de F01-T07 al 24 de octubre de 2026.** Las condiciones públicas pueden cambiar. Las cuotas reales y configuración de cada cuenta se comprobarán antes de integrar servicios y otra vez antes de lanzar ventas.

| Servicio | Desarrollo previsto | Condiciones públicas verificadas | Situación del proyecto |
|---|---|---|---|
| Supabase | PostgreSQL, Auth y Storage; CLI local cuando Docker esté disponible | Free: 500 MB de base de datos, 1 GB de archivos, hasta 2 proyectos activos y pausa tras una semana de inactividad. El SMTP predeterminado de Auth solo envía a direcciones autorizadas del equipo y tiene un límite actual de 2 correos por hora. | Proyecto existente solo para desarrollo y pruebas; falta verificar región, plan y cuotas efectivas. |
| Resend | Captura local durante desarrollo; pruebas externas de correo y SMTP personalizado para Auth | Free: 3,000 correos transaccionales al mes, 100 al día; para envíos generales hace falta dominio verificado. | Cuenta por crear; no se asume correo externo funcional todavía. |
| Stripe | Checkout y webhooks solo en sandbox | Las pruebas no mueven dinero. Stripe declara disponibilidad en México; activar pagos reales requiere validar la cuenta del negocio. Su tarifa pública estándar para tarjeta nacional en México es 3.6 % + MXN 3 por transacción exitosa, sujeta a condiciones vigentes. | Cuenta por crear; ningún cobro real habilitado. |
| GitHub Actions | Compilación, análisis estático y pruebas | GitHub Free incluye 2,000 minutos mensuales y 500 MB de almacenamiento de Actions para repositorios privados; el uso adicional puede generar cargos si no se limita. | Cuenta disponible; falta confirmar repositorio, titular de facturación y presupuesto de Actions. |

Fuentes oficiales: [Supabase Free](https://supabase.com/pricing), [correo de Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp), [Resend Free](https://resend.com/pricing?product=transactional), [Stripe sandbox](https://docs.stripe.com/testing), [disponibilidad de Stripe](https://stripe.com/mx/global), [tarifas de Stripe México](https://stripe.com/mx/pricing), [cuotas de GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Condiciones para avanzar

1. Consultar en el panel la región, plan y cuotas del proyecto Supabase existente sin compartir claves en documentación o chat.
2. Revisar la necesidad de Docker para Supabase local; en el entorno inspeccionado el comando `docker` no está instalado. Si sigue sin estar disponible, usar un proyecto Free de integración con datos ficticios hasta disponer de entorno local.
3. Crear cuentas de Stripe y Resend solo cuando lleguen sus fases; no configurar pagos o correo real durante F01.
4. Antes de ventas reales, elegir hosting continuo para frontend, API y worker, dominio, SMTP propio, respaldo recuperable y presupuesto. Supabase Free puede pausarse, así que no es una garantía de operación durante un evento.
5. Para GitHub Actions, usar runners Linux estándar, retención corta y un presupuesto que detenga consumo adicional. Verificar el titular de facturación antes de activarlo.

No se han contratado servicios ni instalado dependencias del backend durante esta fase.
