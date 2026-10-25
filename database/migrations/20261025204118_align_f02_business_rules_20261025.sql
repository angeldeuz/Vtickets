-- Aplicada al proyecto Supabase de desarrollo el 25-10-2026.
-- Versión remota: 20261025204118; nombre: align_f02_business_rules_20261025.
-- Para una instancia limpia, partir de la línea base anterior a F02 en
-- database/baseline/20261025_tickets_app_snapshot.sql.

-- Aplicar mediante un ejecutor de migraciones transaccional.

-- F01 exige que cada evento conserve explícitamente su zona IANA.
ALTER TABLE tickets_app.eventos ADD COLUMN timezone text;

UPDATE tickets_app.eventos AS e
SET timezone = COALESCE(u.timezone, 'America/Monterrey')
FROM tickets_app.ubicaciones AS u
WHERE u.id = e.venue_id;

UPDATE tickets_app.eventos
SET timezone = 'America/Monterrey'
WHERE timezone IS NULL;

ALTER TABLE tickets_app.eventos
  ALTER COLUMN timezone SET NOT NULL,
  ADD CONSTRAINT eventos_timezone_not_blank_check CHECK (btrim(timezone) <> '');

-- Suspensión y republicación; la transición se autoriza en la API.
ALTER TABLE tickets_app.eventos DROP CONSTRAINT events_status_check;
ALTER TABLE tickets_app.eventos
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'published', 'suspended', 'cancelled', 'completed'));

ALTER TABLE tickets_app.eventos
  ADD CONSTRAINT eventos_sales_end_before_start_check
  CHECK (sales_ends_at IS NULL OR sales_ends_at <= starts_at);

-- Un recinto histórico no se borra mientras lo referencie un evento.
-- La FK anterior decía SET NULL sobre una columna NOT NULL.
ALTER TABLE tickets_app.eventos DROP CONSTRAINT events_venue_id_fkey;
ALTER TABLE tickets_app.eventos
  ADD CONSTRAINT events_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES tickets_app.ubicaciones(id) ON DELETE RESTRICT;

-- Una compra puede devolver algunas entradas y después el resto.
ALTER TABLE tickets_app.compras DROP CONSTRAINT compras_status_check;
ALTER TABLE tickets_app.compras
  ADD CONSTRAINT compras_status_check
  CHECK (status IN ('awaiting_payment', 'paid', 'partially_refunded', 'cancelled', 'refunded'));

-- El límite general aprobado es cuatro entradas; un tipo puede reducirlo.
UPDATE tickets_app.tipos_ticket
SET max_per_order = LEAST(max_per_order, 4),
    max_per_user = LEAST(max_per_user, 4)
WHERE max_per_order > 4 OR max_per_user > 4;

ALTER TABLE tickets_app.tipos_ticket
  ALTER COLUMN max_per_order SET DEFAULT 4,
  ALTER COLUMN max_per_user SET DEFAULT 4,
  DROP CONSTRAINT ticket_types_max_per_order_check,
  DROP CONSTRAINT tipos_ticket_max_per_user_check;

ALTER TABLE tickets_app.tipos_ticket
  ADD CONSTRAINT ticket_types_max_per_order_check
    CHECK (max_per_order BETWEEN 1 AND 4),
  ADD CONSTRAINT tipos_ticket_max_per_user_check
    CHECK (max_per_user BETWEEN 1 AND 4);

ALTER TABLE tickets_app.reservas
  ADD CONSTRAINT reservas_duration_max_check
  CHECK (expires_at <= created_at + interval '10 minutes');

-- Se permiten varios reembolsos por compra, con una fila por ticket cuando
-- existen tickets. Un cobro tardío admite ticket_id NULL y reembolso íntegro.
ALTER TABLE tickets_app.reembolsos
  ADD COLUMN ticket_id uuid,
  ADD COLUMN idempotency_key text,
  ADD COLUMN reason text,
  ADD COLUMN reviewed_by uuid,
  ADD COLUMN reviewed_at timestamp with time zone;

-- Backfill para no perder filas si la base recibió pruebas tras la inspección.
UPDATE tickets_app.reembolsos
SET idempotency_key = id::text
WHERE idempotency_key IS NULL;

ALTER TABLE tickets_app.reembolsos
  ALTER COLUMN idempotency_key SET NOT NULL,
  DROP CONSTRAINT reembolsos_purchase_id_key,
  DROP CONSTRAINT reembolsos_status_check;

ALTER TABLE tickets_app.reembolsos
  ADD CONSTRAINT reembolsos_status_check
    CHECK (status IN ('manual_review', 'requested', 'processing', 'retry', 'completed', 'failed', 'rejected')),
  ADD CONSTRAINT reembolsos_manual_review_ticket_check
    CHECK (status <> 'manual_review' OR ticket_id IS NOT NULL),
  ADD CONSTRAINT reembolsos_payment_idempotency_key_key
    UNIQUE (payment_id, idempotency_key),
  ADD CONSTRAINT reembolsos_ticket_id_purchase_id_key UNIQUE (ticket_id, purchase_id),
  ADD CONSTRAINT reembolsos_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;

-- La FK compuesta asegura que un ticket reembolsado pertenece a la compra.
ALTER TABLE tickets_app.tickets
  ADD CONSTRAINT tickets_id_purchase_id_key UNIQUE (id, purchase_id);
ALTER TABLE tickets_app.reembolsos
  ADD CONSTRAINT reembolsos_ticket_id_purchase_id_fkey
  FOREIGN KEY (ticket_id, purchase_id)
  REFERENCES tickets_app.tickets(id, purchase_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX reembolsos_payment_provider_refund_id_idx
  ON tickets_app.reembolsos (payment_id, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

-- Índices guiados por consultas de administración, escaneo y reembolsos.
CREATE INDEX compras_event_created_idx
  ON tickets_app.compras (event_id, created_at DESC, id);
CREATE INDEX reservas_event_status_expiration_idx
  ON tickets_app.reservas (event_id, status, expires_at);
CREATE INDEX historial_escaneos_ticket_time_idx
  ON tickets_app.historial_escaneos (ticket_id, scanned_at DESC);
CREATE INDEX historial_escaneos_scanner_time_idx
  ON tickets_app.historial_escaneos (scanned_by, scanned_at DESC);
CREATE INDEX reembolsos_purchase_created_idx
  ON tickets_app.reembolsos (purchase_id, created_at DESC);
CREATE INDEX reembolsos_payment_purchase_idx
  ON tickets_app.reembolsos (payment_id, purchase_id);

-- Pares exactamente duplicados en el catálogo remoto.
DROP INDEX tickets_app.eventos_category_id_idx;
DROP INDEX tickets_app.eventos_organizer_id_idx;
DROP INDEX tickets_app.eventos_venue_id_idx;

-- Las tablas de acceso e historial son registros append-only para el backend.
REVOKE UPDATE ON tickets_app.accesos, tickets_app.historial_escaneos
  FROM tickets_app_runtime;
-- Los roles globales son semilla administrada; el runtime solo los consulta.
REVOKE INSERT, UPDATE ON tickets_app.roles FROM tickets_app_runtime;
UPDATE tickets_app.roles
SET is_system = true
WHERE code IN ('CLIENTE', 'ADMINISTRADOR', 'ACCESO');
