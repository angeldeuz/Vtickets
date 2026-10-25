-- Semilla idempotente del catálogo de roles del MVP.
-- Ejecutar solo en una instancia con la línea base y la migración F02 validadas.
INSERT INTO tickets_app.roles (code, name, is_system)
VALUES
  ('CLIENTE', 'Cliente', true),
  ('ADMINISTRADOR', 'Administrador', true),
  ('ACCESO', 'Acceso', true)
ON CONFLICT (code) DO NOTHING;
