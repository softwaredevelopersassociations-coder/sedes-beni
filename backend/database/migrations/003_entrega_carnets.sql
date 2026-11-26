-- Agrega el seguimiento de entrega física sin alterar el estado clínico del trámite.
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS estado_entrega VARCHAR(30);
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS entregado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS recibido_por VARCHAR(150);
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS observacion_entrega TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'tramites'::regclass AND conname = 'tramites_estado_entrega_check'
    ) THEN
        ALTER TABLE tramites ADD CONSTRAINT tramites_estado_entrega_check
            CHECK (estado_entrega IS NULL OR estado_entrega IN ('Pendiente de entrega', 'Entregado'));
    END IF;
END $$;

UPDATE tramites
SET estado_entrega = 'Pendiente de entrega'
WHERE estado = 'Aprobado' AND estado_entrega IS NULL;

CREATE INDEX IF NOT EXISTS idx_tramites_entrega_pendiente
    ON tramites(fecha_emision, id)
    WHERE estado = 'Aprobado' AND estado_entrega = 'Pendiente de entrega';
