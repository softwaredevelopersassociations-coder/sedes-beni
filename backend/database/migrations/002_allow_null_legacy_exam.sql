-- La columna conserva datos históricos, pero las consultas nuevas usan examen_revision_general_id.
ALTER TABLE public.consultas_medicas
  ALTER COLUMN examen_fisico_legacy DROP NOT NULL;
