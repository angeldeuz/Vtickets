-- Instantánea reconstruida del catálogo tickets_app (25-10-2026).
-- SOLO REFERENCIA: no ejecutar sobre el proyecto remoto existente.
-- Refleja el estado posterior a la migración remota 20261024065838 y anterior
-- a la migración F02 20261025204118; no reaplicar la primera después de esta.
-- Requiere una instancia Supabase limpia con auth.users y el rol postgres.
-- Aún debe validarse mediante restauración y comparación de catálogos.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tickets_app_runtime') THEN
    CREATE ROLE tickets_app_runtime NOLOGIN;
  END IF;
END
$$;

CREATE SCHEMA tickets_app;
REVOKE ALL ON SCHEMA tickets_app FROM PUBLIC;
GRANT USAGE ON SCHEMA tickets_app TO tickets_app_runtime;

-- Tablas y restricciones locales
CREATE TABLE tickets_app.accesos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  ticket_id uuid NOT NULL,
  scanned_by uuid NOT NULL,
  accessed_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT accesos_pkey PRIMARY KEY (id),
  CONSTRAINT accesos_ticket_id_key UNIQUE (ticket_id)
);

ALTER TABLE tickets_app.accesos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.accesos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.accesos TO tickets_app_runtime;

CREATE TABLE tickets_app.auditoria (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  entity_name text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT auditoria_pkey PRIMARY KEY (id)
);

ALTER TABLE tickets_app.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.auditoria FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON tickets_app.auditoria TO tickets_app_runtime;

CREATE TABLE tickets_app.categorias (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_slug_key UNIQUE (slug)
);

ALTER TABLE tickets_app.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.categorias FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.categorias TO tickets_app_runtime;

CREATE TABLE tickets_app.compra_detalles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_id uuid NOT NULL,
  event_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price_cents bigint NOT NULL,
  line_total_cents bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT compra_detalles_check CHECK ((line_total_cents = ((quantity)::bigint * unit_price_cents))),
  CONSTRAINT compra_detalles_line_total_cents_check CHECK ((line_total_cents >= 0)),
  CONSTRAINT compra_detalles_quantity_check CHECK ((quantity > 0)),
  CONSTRAINT compra_detalles_unit_price_cents_check CHECK ((unit_price_cents >= 0)),
  CONSTRAINT compra_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT compra_detalles_id_purchase_id_key UNIQUE (id, purchase_id),
  CONSTRAINT compra_detalles_purchase_id_ticket_type_id_key UNIQUE (purchase_id, ticket_type_id)
);

ALTER TABLE tickets_app.compra_detalles ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.compra_detalles FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.compra_detalles TO tickets_app_runtime;

CREATE TABLE tickets_app.compras (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reservation_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  event_id uuid NOT NULL,
  status text DEFAULT 'awaiting_payment'::text NOT NULL,
  total_cents bigint NOT NULL,
  currency text DEFAULT 'MXN'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT compras_currency_check CHECK ((currency = 'MXN'::text)),
  CONSTRAINT compras_status_check CHECK ((status = ANY (ARRAY['awaiting_payment'::text, 'paid'::text, 'cancelled'::text, 'refunded'::text]))),
  CONSTRAINT compras_total_cents_check CHECK ((total_cents >= 0)),
  CONSTRAINT compras_pkey PRIMARY KEY (id),
  CONSTRAINT compras_id_event_id_key UNIQUE (id, event_id),
  CONSTRAINT compras_reservation_id_key UNIQUE (reservation_id)
);

ALTER TABLE tickets_app.compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.compras FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.compras TO tickets_app_runtime;

CREATE TABLE tickets_app.evento_imagenes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  storage_path text NOT NULL,
  alt_text text,
  is_cover boolean DEFAULT false NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  bucket_id text NOT NULL,
  CONSTRAINT event_images_sort_order_check CHECK ((sort_order >= 0)),
  CONSTRAINT event_images_pkey PRIMARY KEY (id),
  CONSTRAINT event_images_event_id_storage_path_key UNIQUE (event_id, storage_path)
);

ALTER TABLE tickets_app.evento_imagenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.evento_imagenes FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.evento_imagenes TO tickets_app_runtime;

CREATE TABLE tickets_app.eventos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category_id uuid NOT NULL,
  venue_id uuid NOT NULL,
  organizer_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  summary text,
  description text,
  starts_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  sales_starts_at timestamp with time zone,
  sales_ends_at timestamp with time zone,
  status text DEFAULT 'draft'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  capacity_limit integer NOT NULL,
  CONSTRAINT eventos_capacity_limit_check CHECK ((capacity_limit > 0)),
  CONSTRAINT events_check CHECK ((ends_at > starts_at)),
  CONSTRAINT events_check1 CHECK (((sales_ends_at IS NULL) OR (sales_starts_at IS NULL) OR (sales_ends_at > sales_starts_at))),
  CONSTRAINT events_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text, 'completed'::text]))),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_slug_key UNIQUE (slug)
);

ALTER TABLE tickets_app.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.eventos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.eventos TO tickets_app_runtime;

CREATE TABLE tickets_app.historial_escaneos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid,
  ticket_id uuid,
  scanned_by uuid,
  result text NOT NULL,
  scanned_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT historial_escaneos_result_check CHECK ((result = ANY (ARRAY['valid'::text, 'already_used'::text, 'unknown'::text, 'invalid'::text, 'revoked'::text, 'cancelled'::text, 'refunded'::text, 'wrong_event'::text, 'unauthorized'::text]))),
  CONSTRAINT historial_escaneos_pkey PRIMARY KEY (id)
);

ALTER TABLE tickets_app.historial_escaneos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.historial_escaneos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.historial_escaneos TO tickets_app_runtime;

CREATE TABLE tickets_app.idempotencia_solicitudes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_sha256 text NOT NULL,
  status text DEFAULT 'processing'::text NOT NULL,
  response_status integer,
  response_body jsonb,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT idempotencia_solicitudes_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text]))),
  CONSTRAINT idempotencia_solicitudes_pkey PRIMARY KEY (id),
  CONSTRAINT idempotencia_solicitudes_user_id_idempotency_key_key UNIQUE (user_id, idempotency_key)
);

ALTER TABLE tickets_app.idempotencia_solicitudes ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.idempotencia_solicitudes FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.idempotencia_solicitudes TO tickets_app_runtime;

CREATE TABLE tickets_app.inventarios (
  ticket_type_id uuid NOT NULL,
  reserved_count integer DEFAULT 0 NOT NULL,
  sold_count integer DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT inventarios_reserved_count_check CHECK ((reserved_count >= 0)),
  CONSTRAINT inventarios_sold_count_check CHECK ((sold_count >= 0)),
  CONSTRAINT inventarios_pkey PRIMARY KEY (ticket_type_id)
);

ALTER TABLE tickets_app.inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.inventarios FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.inventarios TO tickets_app_runtime;

CREATE TABLE tickets_app.notificaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  channel text NOT NULL,
  notification_type text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  dedupe_key text,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  sent_at timestamp with time zone,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT notificaciones_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'in_app'::text]))),
  CONSTRAINT notificaciones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'read'::text]))),
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id),
  CONSTRAINT notificaciones_dedupe_key_key UNIQUE (dedupe_key)
);

ALTER TABLE tickets_app.notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.notificaciones FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.notificaciones TO tickets_app_runtime;

CREATE TABLE tickets_app.outbox_trabajos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  job_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  idempotency_key text,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  available_at timestamp with time zone DEFAULT now() NOT NULL,
  locked_at timestamp with time zone,
  locked_by text,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  completed_at timestamp with time zone,
  CONSTRAINT outbox_trabajos_attempts_check CHECK ((attempts >= 0)),
  CONSTRAINT outbox_trabajos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'succeeded'::text, 'dead'::text]))),
  CONSTRAINT outbox_trabajos_pkey PRIMARY KEY (id),
  CONSTRAINT outbox_trabajos_idempotency_key_key UNIQUE (idempotency_key)
);

ALTER TABLE tickets_app.outbox_trabajos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.outbox_trabajos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.outbox_trabajos TO tickets_app_runtime;

CREATE TABLE tickets_app.pagos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_id uuid NOT NULL,
  provider text NOT NULL,
  external_payment_id text,
  status text DEFAULT 'created'::text NOT NULL,
  amount_cents bigint NOT NULL,
  currency text DEFAULT 'MXN'::text NOT NULL,
  is_test boolean DEFAULT true NOT NULL,
  is_extra_charge boolean DEFAULT false NOT NULL,
  verified_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT pagos_amount_cents_check CHECK ((amount_cents >= 0)),
  CONSTRAINT pagos_currency_check CHECK ((currency = 'MXN'::text)),
  CONSTRAINT pagos_status_check CHECK ((status = ANY (ARRAY['created'::text, 'pending'::text, 'confirmed'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text]))),
  CONSTRAINT pagos_pkey PRIMARY KEY (id),
  CONSTRAINT pagos_id_purchase_id_key UNIQUE (id, purchase_id),
  CONSTRAINT pagos_provider_external_payment_id_key UNIQUE (provider, external_payment_id)
);

ALTER TABLE tickets_app.pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.pagos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.pagos TO tickets_app_runtime;

CREATE TABLE tickets_app.personal_eventos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  status text DEFAULT 'assigned'::text NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  CONSTRAINT event_staff_check CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at))),
  CONSTRAINT event_staff_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'confirmed'::text, 'withdrawn'::text, 'completed'::text]))),
  CONSTRAINT event_staff_pkey PRIMARY KEY (id),
  CONSTRAINT event_staff_event_id_user_id_role_id_key UNIQUE (event_id, user_id, role_id)
);

ALTER TABLE tickets_app.personal_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.personal_eventos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.personal_eventos TO tickets_app_runtime;

CREATE TABLE tickets_app.reembolsos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  status text DEFAULT 'requested'::text NOT NULL,
  amount_cents bigint NOT NULL,
  provider_refund_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reembolsos_amount_cents_check CHECK ((amount_cents > 0)),
  CONSTRAINT reembolsos_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'processing'::text, 'completed'::text, 'failed'::text]))),
  CONSTRAINT reembolsos_pkey PRIMARY KEY (id),
  CONSTRAINT reembolsos_purchase_id_key UNIQUE (purchase_id)
);

ALTER TABLE tickets_app.reembolsos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.reembolsos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.reembolsos TO tickets_app_runtime;

CREATE TABLE tickets_app.reserva_detalles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  reservation_id uuid NOT NULL,
  event_id uuid NOT NULL,
  ticket_type_id uuid NOT NULL,
  quantity integer NOT NULL,
  unit_price_cents bigint NOT NULL,
  line_total_cents bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reserva_detalles_check CHECK ((line_total_cents = ((quantity)::bigint * unit_price_cents))),
  CONSTRAINT reserva_detalles_line_total_cents_check CHECK ((line_total_cents >= 0)),
  CONSTRAINT reserva_detalles_quantity_check CHECK ((quantity > 0)),
  CONSTRAINT reserva_detalles_unit_price_cents_check CHECK ((unit_price_cents >= 0)),
  CONSTRAINT reserva_detalles_pkey PRIMARY KEY (id),
  CONSTRAINT reserva_detalles_reservation_id_ticket_type_id_key UNIQUE (reservation_id, ticket_type_id)
);

ALTER TABLE tickets_app.reserva_detalles ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.reserva_detalles FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.reserva_detalles TO tickets_app_runtime;

CREATE TABLE tickets_app.reservas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  customer_id uuid NOT NULL,
  event_id uuid NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  total_cents bigint DEFAULT 0 NOT NULL,
  currency text DEFAULT 'MXN'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT reservas_check CHECK ((expires_at > created_at)),
  CONSTRAINT reservas_currency_check CHECK ((currency = 'MXN'::text)),
  CONSTRAINT reservas_status_check CHECK ((status = ANY (ARRAY['active'::text, 'converted'::text, 'expired'::text, 'cancelled'::text]))),
  CONSTRAINT reservas_total_cents_check CHECK ((total_cents >= 0)),
  CONSTRAINT reservas_pkey PRIMARY KEY (id),
  CONSTRAINT reservas_id_event_id_customer_id_key UNIQUE (id, event_id, customer_id),
  CONSTRAINT reservas_id_event_id_key UNIQUE (id, event_id)
);

ALTER TABLE tickets_app.reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.reservas FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.reservas TO tickets_app_runtime;

CREATE TABLE tickets_app.roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_code_key UNIQUE (code)
);

ALTER TABLE tickets_app.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.roles FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.roles TO tickets_app_runtime;

CREATE TABLE tickets_app.tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  purchase_id uuid NOT NULL,
  purchase_detail_id uuid NOT NULL,
  payment_id uuid NOT NULL,
  ordinal integer NOT NULL,
  public_code uuid DEFAULT gen_random_uuid() NOT NULL,
  credential_version smallint DEFAULT 1 NOT NULL,
  credential_key_id text,
  status text DEFAULT 'issued'::text NOT NULL,
  issued_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT tickets_credential_version_check CHECK ((credential_version > 0)),
  CONSTRAINT tickets_ordinal_check CHECK ((ordinal > 0)),
  CONSTRAINT tickets_status_check CHECK ((status = ANY (ARRAY['issued'::text, 'used'::text, 'revoked'::text, 'refunded'::text]))),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_id_public_code_key UNIQUE (id, public_code),
  CONSTRAINT tickets_public_code_key UNIQUE (public_code),
  CONSTRAINT tickets_purchase_detail_id_ordinal_key UNIQUE (purchase_detail_id, ordinal)
);

ALTER TABLE tickets_app.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.tickets FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.tickets TO tickets_app_runtime;

CREATE TABLE tickets_app.tipos_ticket (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  event_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price_cents bigint DEFAULT 0 NOT NULL,
  currency text DEFAULT 'MXN'::text NOT NULL,
  quantity_total integer NOT NULL,
  max_per_order integer DEFAULT 10 NOT NULL,
  sales_starts_at timestamp with time zone,
  sales_ends_at timestamp with time zone,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  max_per_user integer DEFAULT 10 NOT NULL,
  CONSTRAINT ticket_types_check CHECK (((sales_ends_at IS NULL) OR (sales_starts_at IS NULL) OR (sales_ends_at > sales_starts_at))),
  CONSTRAINT ticket_types_max_per_order_check CHECK ((max_per_order > 0)),
  CONSTRAINT ticket_types_quantity_total_check CHECK ((quantity_total > 0)),
  CONSTRAINT ticket_types_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'sold_out'::text, 'cancelled'::text]))),
  CONSTRAINT tipos_ticket_currency_check CHECK ((currency = 'MXN'::text)),
  CONSTRAINT tipos_ticket_max_per_user_check CHECK ((max_per_user > 0)),
  CONSTRAINT tipos_ticket_price_cents_check CHECK ((price_cents >= 0)),
  CONSTRAINT ticket_types_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_types_event_id_name_key UNIQUE (event_id, name),
  CONSTRAINT tipos_ticket_id_event_id_key UNIQUE (id, event_id)
);

ALTER TABLE tickets_app.tipos_ticket ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.tipos_ticket FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.tipos_ticket TO tickets_app_runtime;

CREATE TABLE tickets_app.ubicaciones (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  country_code text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text,
  capacity integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT venues_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0))),
  CONSTRAINT venues_country_code_check CHECK (((country_code IS NULL) OR (country_code ~ '^[A-Z]{2}$'::text))),
  CONSTRAINT venues_latitude_check CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::numeric) AND (latitude <= (90)::numeric)))),
  CONSTRAINT venues_longitude_check CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::numeric) AND (longitude <= (180)::numeric)))),
  CONSTRAINT venues_pkey PRIMARY KEY (id)
);

ALTER TABLE tickets_app.ubicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.ubicaciones FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.ubicaciones TO tickets_app_runtime;

CREATE TABLE tickets_app.usuario_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id)
);

ALTER TABLE tickets_app.usuario_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.usuario_roles FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.usuario_roles TO tickets_app_runtime;

CREATE TABLE tickets_app.usuarios (
  auth_user_id uuid,
  full_name text,
  phone text,
  avatar_url text,
  status text DEFAULT 'active'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  anonymized_at timestamp with time zone,
  CONSTRAINT usuarios_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'suspended'::text, 'deleted'::text]))),
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_auth_user_id_key UNIQUE (auth_user_id)
);

ALTER TABLE tickets_app.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.usuarios FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.usuarios TO tickets_app_runtime;

CREATE TABLE tickets_app.webhook_eventos (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  payload_sha256 text NOT NULL,
  safe_payload jsonb,
  status text DEFAULT 'received'::text NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
  processed_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  payment_id uuid,
  CONSTRAINT webhook_eventos_attempts_check CHECK ((attempts >= 0)),
  CONSTRAINT webhook_eventos_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processing'::text, 'processed'::text, 'retry'::text, 'dead'::text]))),
  CONSTRAINT webhook_eventos_pkey PRIMARY KEY (id),
  CONSTRAINT webhook_eventos_provider_external_event_id_key UNIQUE (provider, external_event_id)
);

ALTER TABLE tickets_app.webhook_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_runtime_access ON tickets_app.webhook_eventos FOR ALL TO tickets_app_runtime USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON tickets_app.webhook_eventos TO tickets_app_runtime;

-- Claves foráneas (después de crear todas las tablas)
ALTER TABLE tickets_app.accesos ADD CONSTRAINT accesos_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.accesos ADD CONSTRAINT accesos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets_app.tickets(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.auditoria ADD CONSTRAINT auditoria_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES tickets_app.usuarios(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.compra_detalles ADD CONSTRAINT compra_detalles_purchase_id_event_id_fkey FOREIGN KEY (purchase_id, event_id) REFERENCES tickets_app.compras(id, event_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.compra_detalles ADD CONSTRAINT compra_detalles_ticket_type_id_event_id_fkey FOREIGN KEY (ticket_type_id, event_id) REFERENCES tickets_app.tipos_ticket(id, event_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.compras ADD CONSTRAINT compras_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.compras ADD CONSTRAINT compras_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.compras ADD CONSTRAINT compras_reservation_id_event_id_customer_id_fkey FOREIGN KEY (reservation_id, event_id, customer_id) REFERENCES tickets_app.reservas(id, event_id, customer_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.evento_imagenes ADD CONSTRAINT event_images_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE CASCADE;
ALTER TABLE tickets_app.eventos ADD CONSTRAINT eventos_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.eventos ADD CONSTRAINT events_category_id_fkey FOREIGN KEY (category_id) REFERENCES tickets_app.categorias(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.eventos ADD CONSTRAINT events_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES tickets_app.ubicaciones(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.historial_escaneos ADD CONSTRAINT historial_escaneos_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.historial_escaneos ADD CONSTRAINT historial_escaneos_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES tickets_app.usuarios(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.historial_escaneos ADD CONSTRAINT historial_escaneos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets_app.tickets(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.idempotencia_solicitudes ADD CONSTRAINT idempotencia_solicitudes_user_id_fkey FOREIGN KEY (user_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.inventarios ADD CONSTRAINT inventarios_ticket_type_id_fkey FOREIGN KEY (ticket_type_id) REFERENCES tickets_app.tipos_ticket(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.notificaciones ADD CONSTRAINT notificaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES tickets_app.usuarios(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.pagos ADD CONSTRAINT pagos_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES tickets_app.compras(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.personal_eventos ADD CONSTRAINT event_staff_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE CASCADE;
ALTER TABLE tickets_app.personal_eventos ADD CONSTRAINT event_staff_role_id_fkey FOREIGN KEY (role_id) REFERENCES tickets_app.roles(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.personal_eventos ADD CONSTRAINT personal_eventos_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES tickets_app.usuarios(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.personal_eventos ADD CONSTRAINT personal_eventos_user_id_fkey FOREIGN KEY (user_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reembolsos ADD CONSTRAINT reembolsos_payment_id_purchase_id_fkey FOREIGN KEY (payment_id, purchase_id) REFERENCES tickets_app.pagos(id, purchase_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reembolsos ADD CONSTRAINT reembolsos_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES tickets_app.compras(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reserva_detalles ADD CONSTRAINT reserva_detalles_reservation_id_event_id_fkey FOREIGN KEY (reservation_id, event_id) REFERENCES tickets_app.reservas(id, event_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reserva_detalles ADD CONSTRAINT reserva_detalles_ticket_type_id_event_id_fkey FOREIGN KEY (ticket_type_id, event_id) REFERENCES tickets_app.tipos_ticket(id, event_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reservas ADD CONSTRAINT reservas_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.reservas ADD CONSTRAINT reservas_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.tickets ADD CONSTRAINT tickets_payment_id_purchase_id_fkey FOREIGN KEY (payment_id, purchase_id) REFERENCES tickets_app.pagos(id, purchase_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.tickets ADD CONSTRAINT tickets_purchase_detail_id_purchase_id_fkey FOREIGN KEY (purchase_detail_id, purchase_id) REFERENCES tickets_app.compra_detalles(id, purchase_id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.tipos_ticket ADD CONSTRAINT ticket_types_event_id_fkey FOREIGN KEY (event_id) REFERENCES tickets_app.eventos(id) ON DELETE CASCADE;
ALTER TABLE tickets_app.usuario_roles ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES tickets_app.roles(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.usuario_roles ADD CONSTRAINT usuario_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES tickets_app.usuarios(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.usuario_roles ADD CONSTRAINT usuario_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES tickets_app.usuarios(id) ON DELETE RESTRICT;
ALTER TABLE tickets_app.usuarios ADD CONSTRAINT usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE tickets_app.webhook_eventos ADD CONSTRAINT webhook_eventos_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES tickets_app.pagos(id) ON DELETE RESTRICT;

-- Índices sin restricción UNIQUE/PRIMARY KEY asociada
CREATE INDEX auditoria_created_idx ON tickets_app.auditoria USING btree (created_at DESC);
CREATE INDEX compra_detalles_ticket_type_idx ON tickets_app.compra_detalles USING btree (ticket_type_id);
CREATE INDEX compras_customer_created_idx ON tickets_app.compras USING btree (customer_id, created_at DESC);
CREATE INDEX event_images_event_id_idx ON tickets_app.evento_imagenes USING btree (event_id);
CREATE UNIQUE INDEX event_images_one_cover_per_event_idx ON tickets_app.evento_imagenes USING btree (event_id) WHERE is_cover;
CREATE INDEX eventos_category_id_idx ON tickets_app.eventos USING btree (category_id);
CREATE INDEX eventos_organizer_id_idx ON tickets_app.eventos USING btree (organizer_id);
CREATE INDEX eventos_venue_id_idx ON tickets_app.eventos USING btree (venue_id);
CREATE INDEX events_category_id_idx ON tickets_app.eventos USING btree (category_id);
CREATE INDEX events_organizer_id_idx ON tickets_app.eventos USING btree (organizer_id);
CREATE INDEX events_venue_id_idx ON tickets_app.eventos USING btree (venue_id);
CREATE INDEX historial_escaneos_event_time_idx ON tickets_app.historial_escaneos USING btree (event_id, scanned_at DESC);
CREATE INDEX idempotencia_expiration_idx ON tickets_app.idempotencia_solicitudes USING btree (expires_at);
CREATE INDEX notificaciones_user_created_idx ON tickets_app.notificaciones USING btree (user_id, created_at DESC);
CREATE INDEX outbox_claim_idx ON tickets_app.outbox_trabajos USING btree (available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text]));
CREATE UNIQUE INDEX pagos_one_primary_confirmation_idx ON tickets_app.pagos USING btree (purchase_id) WHERE ((status = 'confirmed'::text) AND (NOT is_extra_charge));
CREATE INDEX pagos_purchase_created_idx ON tickets_app.pagos USING btree (purchase_id, created_at DESC);
CREATE INDEX event_staff_event_id_idx ON tickets_app.personal_eventos USING btree (event_id);
CREATE INDEX event_staff_role_id_idx ON tickets_app.personal_eventos USING btree (role_id);
CREATE INDEX event_staff_user_id_idx ON tickets_app.personal_eventos USING btree (user_id);
CREATE INDEX personal_eventos_user_id_status_idx ON tickets_app.personal_eventos USING btree (user_id, status);
CREATE INDEX reserva_detalles_ticket_type_idx ON tickets_app.reserva_detalles USING btree (ticket_type_id);
CREATE INDEX reservas_customer_status_idx ON tickets_app.reservas USING btree (customer_id, status, created_at DESC);
CREATE INDEX reservas_expiration_idx ON tickets_app.reservas USING btree (expires_at) WHERE (status = 'active'::text);
CREATE INDEX tickets_payment_id_idx ON tickets_app.tickets USING btree (payment_id);
CREATE INDEX ticket_types_event_id_idx ON tickets_app.tipos_ticket USING btree (event_id);
CREATE INDEX usuario_roles_role_id_idx ON tickets_app.usuario_roles USING btree (role_id);
CREATE INDEX webhook_eventos_payment_id_idx ON tickets_app.webhook_eventos USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX webhook_eventos_retry_idx ON tickets_app.webhook_eventos USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['received'::text, 'retry'::text]));
