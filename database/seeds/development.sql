-- Solo para una base de desarrollo o pruebas. No aplicar en producción.
-- Catálogo mínimo repetible; los eventos requieren primero un organizador
-- vinculado a Supabase Auth y se crearán con el flujo de F04.

INSERT INTO tickets_app.categorias (id, name, slug, description)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'Música de prueba',
  'musica-prueba',
  'Categoría ficticia para desarrollo'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tickets_app.ubicaciones
  (id, name, address_line1, city, region, country_code, timezone, capacity)
VALUES (
  '10000000-0000-0000-0000-000000000002',
  'Recinto de prueba Saltillo',
  'Dirección ficticia',
  'Saltillo',
  'Coahuila',
  'MX',
  'America/Monterrey',
  100
)
ON CONFLICT (id) DO NOTHING;
