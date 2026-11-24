-- Migración transaccional desde el esquema de la aplicación anterior.
-- Mantiene identificadores y registros, normaliza JSON de laboratorio y examen médico.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tramites WHERE numero_carnet_fisico IS NULL OR btrim(numero_carnet_fisico) = '' OR length(btrim(numero_carnet_fisico)) > 20) THEN
    RAISE EXCEPTION 'Migración cancelada: hay trámites sin número físico válido (máximo 20 caracteres).';
  END IF;
  IF EXISTS (SELECT 1 FROM tramites GROUP BY btrim(numero_carnet_fisico) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Migración cancelada: hay números físicos repetidos.';
  END IF;
  IF EXISTS (SELECT 1 FROM pacientes WHERE length(ci) > 15 OR length(ci_exp) > 5 OR length(nombres) > 100 OR length(apellidos) > 100 OR length(ocupacion) > 100 OR length(empresa_trabajo) > 150 OR length(mercado) > 100) THEN
    RAISE EXCEPTION 'Migración cancelada: un dato de paciente excede el límite del esquema objetivo.';
  END IF;
  IF EXISTS (SELECT 1 FROM tramites WHERE tipo_tramite NOT IN ('Apertura', 'Renovación') OR estado NOT IN ('Pendiente Laboratorio', 'Pendiente Medicina', 'Aprobado', 'Rechazado')) THEN
    RAISE EXCEPTION 'Migración cancelada: hay trámites con tipo o estado fuera del esquema objetivo.';
  END IF;
  IF EXISTS (SELECT 1 FROM usuarios WHERE rol NOT IN ('admin', 'laboratorio', 'medico')) THEN
    RAISE EXCEPTION 'Migración cancelada: hay usuarios con rol no reconocido.';
  END IF;
  IF EXISTS (SELECT 1 FROM tramites t LEFT JOIN pacientes p ON p.id = t.paciente_id WHERE p.id IS NULL) THEN
    RAISE EXCEPTION 'Migración cancelada: se encontró un trámite sin paciente asociado.';
  END IF;
  IF EXISTS (SELECT 1 FROM laboratorios l LEFT JOIN tramites t ON t.id = l.tramite_id WHERE t.id IS NULL) THEN
    RAISE EXCEPTION 'Migración cancelada: se encontró un laboratorio sin trámite asociado.';
  END IF;
  IF EXISTS (SELECT 1 FROM consultas_medicas c LEFT JOIN tramites t ON t.id = c.tramite_id WHERE t.id IS NULL) THEN
    RAISE EXCEPTION 'Migración cancelada: se encontró una consulta sin trámite asociado.';
  END IF;
  IF EXISTS (SELECT 1 FROM laboratorios WHERE length(COALESCE(coproparasitologico->>'aspecto', '')) > 50) THEN
    RAISE EXCEPTION 'Migración cancelada: hay un aspecto coproparasitológico que excede 50 caracteres.';
  END IF;
END $$;

-- Quitar las claves foráneas numéricas que serán sustituidas por el número sanitario.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid IN ('laboratorios'::regclass, 'consultas_medicas'::regclass)
      AND confrelid = 'tramites'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.table_name, r.conname);
  END LOOP;
END $$;

-- Cédula: dividir complemento final del formato habitual 1234567-1A, conservando el CI completo vía alias API.
ALTER TABLE usuarios RENAME COLUMN username TO nombre_usuario;
ALTER TABLE usuarios RENAME COLUMN password TO password_hash;
ALTER TABLE usuarios RENAME COLUMN created_at TO fecha_registro;
ALTER TABLE pacientes RENAME COLUMN ci TO cedula_identidad;
ALTER TABLE pacientes RENAME COLUMN ci_exp TO ci_expedido;
ALTER TABLE pacientes RENAME COLUMN created_at TO fecha_registro;
ALTER TABLE pacientes ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'America/La_Paz';
ALTER TABLE pacientes ADD COLUMN cedula_complemento VARCHAR(5);
UPDATE pacientes
SET cedula_complemento = CASE
      WHEN cedula_identidad ~ '^[0-9]+-[[:alnum:]]{1,5}$' THEN substring(cedula_identidad FROM '-([[:alnum:]]{1,5})$')
      ELSE NULL
    END,
    cedula_identidad = CASE
      WHEN cedula_identidad ~ '^[0-9]+-[[:alnum:]]{1,5}$' THEN split_part(cedula_identidad, '-', 1)
      ELSE cedula_identidad
    END;
UPDATE pacientes SET fecha_registro = CURRENT_TIMESTAMP WHERE fecha_registro IS NULL;
ALTER TABLE pacientes ALTER COLUMN fecha_registro SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pacientes ALTER COLUMN fecha_registro SET NOT NULL;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'pacientes'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE pacientes DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE pacientes ADD CONSTRAINT pacientes_ci_complemento_key UNIQUE (cedula_identidad, cedula_complemento);

ALTER TABLE tramites ADD COLUMN numero_carnet_sanitario VARCHAR(20);
UPDATE tramites SET numero_carnet_sanitario = upper(btrim(numero_carnet_fisico));
ALTER TABLE tramites ALTER COLUMN numero_carnet_sanitario SET NOT NULL;
ALTER TABLE tramites ADD CONSTRAINT tramites_numero_carnet_sanitario_key UNIQUE (numero_carnet_sanitario);
ALTER TABLE tramites ALTER COLUMN paciente_id SET NOT NULL;
ALTER TABLE tramites ALTER COLUMN estado SET NOT NULL;
ALTER TABLE tramites ALTER COLUMN fecha_inicio TYPE DATE USING COALESCE(fecha_inicio::date, CURRENT_DATE);
ALTER TABLE tramites ALTER COLUMN fecha_emision TYPE DATE USING fecha_emision::date;
ALTER TABLE tramites ALTER COLUMN fecha_vencimiento TYPE DATE USING fecha_vencimiento::date;
ALTER TABLE tramites RENAME COLUMN created_at TO fecha_registro;
ALTER TABLE tramites ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'America/La_Paz';
UPDATE tramites SET fecha_registro = CURRENT_TIMESTAMP WHERE fecha_registro IS NULL;
ALTER TABLE tramites ALTER COLUMN fecha_registro SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tramites ALTER COLUMN fecha_registro SET NOT NULL;

-- Los datos JSON se copian a tablas hijas normalizadas y también se guardan como respaldo de compatibilidad.
CREATE TABLE quimica_sanguinea (
  id_sanguinea SERIAL PRIMARY KEY,
  glucosa NUMERIC(6,2),
  urea NUMERIC(6,2),
  creatinina NUMERIC(6,2),
  grupo_sanguineo VARCHAR(2) CHECK (grupo_sanguineo IN ('A', 'B', 'AB', 'O')),
  factor_rh VARCHAR(1) CHECK (factor_rh IN ('+', '-')),
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE coproparasitologico (
  id_coproparasitologico SERIAL PRIMARY KEY,
  aspecto VARCHAR(50),
  moco BOOLEAN,
  sangre_macroscopica BOOLEAN,
  examen_microscopico_directo TEXT,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE laboratorios ADD COLUMN tramite_numero_nuevo VARCHAR(20);
UPDATE laboratorios l
SET tramite_numero_nuevo = t.numero_carnet_sanitario
FROM tramites t
WHERE t.id = l.tramite_id;
ALTER TABLE laboratorios ALTER COLUMN tramite_numero_nuevo SET NOT NULL;
ALTER TABLE laboratorios DROP COLUMN tramite_id;
ALTER TABLE laboratorios RENAME COLUMN tramite_numero_nuevo TO tramite_id;

ALTER TABLE laboratorios ADD COLUMN quimica_sanguinea_id INTEGER;
ALTER TABLE laboratorios ADD COLUMN coproparasitologico_id INTEGER;
ALTER TABLE laboratorios ADD COLUMN vih_resultado VARCHAR(20);
ALTER TABLE laboratorios ADD COLUMN vih_realizado BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN vih_consentimiento BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN vih_mostrar_en_registro_medico BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN datos_compatibilidad JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO quimica_sanguinea (id_sanguinea, glucosa, urea, creatinina, grupo_sanguineo, factor_rh, fecha_registro)
SELECT l.id,
       CASE WHEN l.quimica_sanguinea->>'glucosa' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (l.quimica_sanguinea->>'glucosa')::numeric END,
       CASE WHEN l.quimica_sanguinea->>'urea' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (l.quimica_sanguinea->>'urea')::numeric END,
       CASE WHEN l.quimica_sanguinea->>'creatinina' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (l.quimica_sanguinea->>'creatinina')::numeric END,
       CASE WHEN upper(l.quimica_sanguinea->>'grupo_sanguineo') IN ('A', 'B', 'AB', 'O') THEN upper(l.quimica_sanguinea->>'grupo_sanguineo') END,
       CASE WHEN l.quimica_sanguinea->>'factor_rh' IN ('+', '-') THEN l.quimica_sanguinea->>'factor_rh' END,
       l.fecha_registro AT TIME ZONE 'America/La_Paz'
FROM laboratorios l;

INSERT INTO coproparasitologico (id_coproparasitologico, aspecto, moco, sangre_macroscopica, examen_microscopico_directo, fecha_registro)
SELECT l.id,
       left(l.coproparasitologico->>'aspecto', 50),
       CASE lower(COALESCE(l.coproparasitologico->>'moco', '')) WHEN 'true' THEN true WHEN '1' THEN true WHEN 'si' THEN true WHEN 'sí' THEN true WHEN 'positivo' THEN true WHEN 'false' THEN false WHEN '0' THEN false WHEN 'no' THEN false WHEN 'negativo' THEN false ELSE NULL END,
       CASE lower(COALESCE(l.coproparasitologico->>'sangre_macroscopica', l.coproparasitologico->>'sangre', '')) WHEN 'true' THEN true WHEN '1' THEN true WHEN 'si' THEN true WHEN 'sí' THEN true WHEN 'positivo' THEN true WHEN 'false' THEN false WHEN '0' THEN false WHEN 'no' THEN false WHEN 'negativo' THEN false ELSE NULL END,
       COALESCE(NULLIF(l.coproparasitologico->>'examen_microscopico', ''), NULLIF(l.coproparasitologico->>'parasito', '')),
       l.fecha_registro AT TIME ZONE 'America/La_Paz'
FROM laboratorios l;

UPDATE laboratorios l
SET quimica_sanguinea_id = l.id,
    coproparasitologico_id = l.id,
    vih_resultado = NULLIF(l.vih->>'resultado', ''),
    vih_realizado = CASE lower(COALESCE(l.vih->>'realizado', '')) WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'si' THEN true WHEN 'sí' THEN true WHEN 'false' THEN false WHEN 'f' THEN false WHEN '0' THEN false WHEN 'no' THEN false ELSE NULL END,
    vih_consentimiento = CASE lower(COALESCE(l.vih->>'consentimiento', '')) WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'si' THEN true WHEN 'sí' THEN true WHEN 'false' THEN false WHEN 'f' THEN false WHEN '0' THEN false WHEN 'no' THEN false ELSE NULL END,
    vih_mostrar_en_registro_medico = CASE lower(COALESCE(l.vih->>'mostrar_en_registro_medico', '')) WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'si' THEN true WHEN 'sí' THEN true WHEN 'false' THEN false WHEN 'f' THEN false WHEN '0' THEN false WHEN 'no' THEN false ELSE NULL END,
    datos_compatibilidad = jsonb_build_object(
      'quimica_sanguinea', l.quimica_sanguinea,
      'coproparasitologico', l.coproparasitologico,
      'vih', l.vih
    );
ALTER TABLE laboratorios DROP COLUMN quimica_sanguinea;
ALTER TABLE laboratorios DROP COLUMN coproparasitologico;
ALTER TABLE laboratorios DROP COLUMN vih;
ALTER TABLE laboratorios ALTER COLUMN tramite_id SET NOT NULL;
ALTER TABLE laboratorios ALTER COLUMN operador_id SET NOT NULL;
ALTER TABLE laboratorios ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'America/La_Paz';
ALTER TABLE laboratorios
  ADD CONSTRAINT laboratorios_tramite_id_fkey FOREIGN KEY (tramite_id) REFERENCES tramites(numero_carnet_sanitario) ON DELETE CASCADE,
  ADD CONSTRAINT laboratorios_quimica_sanguinea_id_fkey FOREIGN KEY (quimica_sanguinea_id) REFERENCES quimica_sanguinea(id_sanguinea) ON DELETE RESTRICT,
  ADD CONSTRAINT laboratorios_coproparasitologico_id_fkey FOREIGN KEY (coproparasitologico_id) REFERENCES coproparasitologico(id_coproparasitologico) ON DELETE RESTRICT;
SELECT setval(pg_get_serial_sequence('quimica_sanguinea', 'id_sanguinea'), GREATEST(COALESCE((SELECT max(id_sanguinea) FROM quimica_sanguinea), 1), 1), EXISTS (SELECT 1 FROM quimica_sanguinea));
SELECT setval(pg_get_serial_sequence('coproparasitologico', 'id_coproparasitologico'), GREATEST(COALESCE((SELECT max(id_coproparasitologico) FROM coproparasitologico), 1), 1), EXISTS (SELECT 1 FROM coproparasitologico));

ALTER TABLE laboratorio_otros_analisis RENAME COLUMN created_at TO fecha_registro;

-- El detalle histórico del examen se conserva en consultas_medicas; la revisión pasa a su tabla propia.
CREATE TABLE examen_revision_general (
  id_examen SERIAL PRIMARY KEY,
  evaluacion_dermica TEXT,
  evaluacion_respiratoria TEXT,
  evaluacion_cardiovascular TEXT,
  evaluacion_gastrointestinal TEXT,
  peso NUMERIC(5,2),
  altura NUMERIC(4,2),
  presion VARCHAR(10),
  temperatura NUMERIC(4,1),
  pulso INTEGER,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO examen_revision_general (id_examen, evaluacion_dermica, evaluacion_respiratoria, evaluacion_cardiovascular, fecha_registro)
SELECT id,
       examen_fisico->>'piel',
       examen_fisico->>'respiratorio',
       examen_fisico->>'cardiovascular',
       fecha_consulta AT TIME ZONE 'America/La_Paz'
FROM consultas_medicas;
SELECT setval(pg_get_serial_sequence('examen_revision_general', 'id_examen'), GREATEST(COALESCE((SELECT max(id_examen) FROM examen_revision_general), 1), 1), EXISTS (SELECT 1 FROM examen_revision_general));

ALTER TABLE consultas_medicas RENAME COLUMN examen_fisico TO examen_fisico_legacy;
ALTER TABLE consultas_medicas ADD COLUMN tramite_numero_nuevo VARCHAR(20);
UPDATE consultas_medicas c
SET tramite_numero_nuevo = t.numero_carnet_sanitario
FROM tramites t
WHERE t.id = c.tramite_id;
ALTER TABLE consultas_medicas ALTER COLUMN tramite_numero_nuevo SET NOT NULL;
ALTER TABLE consultas_medicas DROP COLUMN tramite_id;
ALTER TABLE consultas_medicas RENAME COLUMN tramite_numero_nuevo TO tramite_id;
ALTER TABLE consultas_medicas ADD COLUMN examen_revision_general_id INTEGER;
UPDATE consultas_medicas SET examen_revision_general_id = id;
ALTER TABLE consultas_medicas ALTER COLUMN medico_id SET NOT NULL;
ALTER TABLE consultas_medicas ALTER COLUMN fecha_consulta TYPE TIMESTAMPTZ USING fecha_consulta AT TIME ZONE 'America/La_Paz';
ALTER TABLE consultas_medicas
  ADD CONSTRAINT consultas_medicas_tramite_id_fkey FOREIGN KEY (tramite_id) REFERENCES tramites(numero_carnet_sanitario) ON DELETE CASCADE,
  ADD CONSTRAINT consultas_medicas_examen_revision_general_id_fkey FOREIGN KEY (examen_revision_general_id) REFERENCES examen_revision_general(id_examen) ON DELETE RESTRICT;

-- Reemplazar PK autoincremental por el número sanitario, conservando el ID viejo como UNIQUE para rutas actuales.
DO $$
DECLARE pk_name TEXT;
BEGIN
  SELECT conname INTO pk_name FROM pg_constraint WHERE conrelid = 'tramites'::regclass AND contype = 'p';
  IF pk_name IS NOT NULL THEN EXECUTE format('ALTER TABLE tramites DROP CONSTRAINT %I', pk_name); END IF;
END $$;
ALTER TABLE tramites ADD CONSTRAINT tramites_pkey PRIMARY KEY (numero_carnet_sanitario);
ALTER TABLE tramites ADD CONSTRAINT tramites_id_compat_key UNIQUE (id);
ALTER TABLE tramites DROP COLUMN numero_carnet_fisico;

ALTER TABLE logs_auditoria RENAME COLUMN fecha TO fecha_registro;
ALTER TABLE logs_auditoria ALTER COLUMN fecha_registro TYPE TIMESTAMPTZ USING fecha_registro AT TIME ZONE 'America/La_Paz';
UPDATE logs_auditoria SET fecha_registro = CURRENT_TIMESTAMP WHERE fecha_registro IS NULL;
ALTER TABLE logs_auditoria ALTER COLUMN fecha_registro SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE logs_auditoria ALTER COLUMN fecha_registro SET NOT NULL;
