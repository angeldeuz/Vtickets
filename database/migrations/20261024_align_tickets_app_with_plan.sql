-- Relaciona cada webhook resuelto con el intento de pago al que pertenece.
-- El valor puede ser NULL mientras se identifica un evento recibido del proveedor.
ALTER TABLE tickets_app.webhook_eventos
  ADD COLUMN payment_id uuid;

ALTER TABLE tickets_app.webhook_eventos
  ADD CONSTRAINT webhook_eventos_payment_id_fkey
  FOREIGN KEY (payment_id)
  REFERENCES tickets_app.pagos(id)
  ON DELETE RESTRICT;

CREATE INDEX webhook_eventos_payment_id_idx
  ON tickets_app.webhook_eventos (payment_id)
  WHERE payment_id IS NOT NULL;

-- El scanner debe poder registrar por separado una credencial invalida,
-- un evento cancelado y un ticket reembolsado.
ALTER TABLE tickets_app.historial_escaneos
  DROP CONSTRAINT historial_escaneos_result_check;

ALTER TABLE tickets_app.historial_escaneos
  ADD CONSTRAINT historial_escaneos_result_check
  CHECK (result IN (
    'valid', 'already_used', 'unknown', 'invalid', 'revoked',
    'cancelled', 'refunded', 'wrong_event', 'unauthorized'
  ));
