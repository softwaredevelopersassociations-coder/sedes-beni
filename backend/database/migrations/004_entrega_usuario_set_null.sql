-- Mantiene el historial de entrega sin impedir que se elimine una cuenta de usuario.
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'tramites'::regclass
          AND confrelid = 'usuarios'::regclass
          AND contype = 'f'
          AND pg_get_constraintdef(oid) ILIKE '%FOREIGN KEY (entregado_por)%'
    LOOP
        EXECUTE format('ALTER TABLE tramites DROP CONSTRAINT %I', constraint_name);
    END LOOP;

    ALTER TABLE tramites ADD CONSTRAINT tramites_entregado_por_fkey
        FOREIGN KEY (entregado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
END $$;
