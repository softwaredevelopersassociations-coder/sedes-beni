-- Esquema objetivo para el Sistema de Carnet Sanitario SEDES Beni.
-- Los campos marcados como compatibilidad conservan funciones existentes del sistema.

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'laboratorio', 'medico')),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    cedula_identidad VARCHAR(15) NOT NULL,
    cedula_complemento VARCHAR(5),
    ci_expedido VARCHAR(5) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(100),
    telefono VARCHAR(20),
    ocupacion VARCHAR(100),
    empresa_trabajo VARCHAR(150),
    mercado VARCHAR(100),
    foto_url TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pacientes_ci_complemento_key UNIQUE (cedula_identidad, cedula_complemento)
);

CREATE TABLE IF NOT EXISTS tramites (
    numero_carnet_sanitario VARCHAR(20) PRIMARY KEY,
    paciente_id INTEGER NOT NULL REFERENCES pacientes(id) ON DELETE RESTRICT,
    tipo_tramite VARCHAR(20) NOT NULL CHECK (tipo_tramite IN ('Apertura', 'Renovación')),
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente Laboratorio'
        CHECK (estado IN ('Pendiente Laboratorio', 'Pendiente Medicina', 'Aprobado', 'Rechazado')),
    observaciones TEXT,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Compatibilidad: ID usado por pantallas y URLs anteriores.
    id SERIAL NOT NULL UNIQUE,
    -- Compatibilidad: código generado y costo de caja que no existen en el esquema base.
    codigo_carnet VARCHAR(30) UNIQUE,
    costo_bs NUMERIC(10,2) NOT NULL DEFAULT 30.00,
    -- Estado operativo de la entrega física; no reemplaza el estado clínico del trámite.
    estado_entrega VARCHAR(30),
    fecha_entrega TIMESTAMPTZ,
    entregado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    recibido_por VARCHAR(150),
    observacion_entrega TEXT,
    CONSTRAINT tramites_estado_entrega_check
        CHECK (estado_entrega IS NULL OR estado_entrega IN ('Pendiente de entrega', 'Entregado'))
);

CREATE TABLE IF NOT EXISTS quimica_sanguinea (
    id_sanguinea SERIAL PRIMARY KEY,
    glucosa NUMERIC(6,2),
    urea NUMERIC(6,2),
    creatinina NUMERIC(6,2),
    grupo_sanguineo VARCHAR(2) CHECK (grupo_sanguineo IN ('A', 'B', 'AB', 'O')),
    factor_rh VARCHAR(1) CHECK (factor_rh IN ('+', '-')),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coproparasitologico (
    id_coproparasitologico SERIAL PRIMARY KEY,
    aspecto VARCHAR(50),
    moco BOOLEAN,
    sangre_macroscopica BOOLEAN,
    examen_microscopico_directo TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratorios (
    id SERIAL PRIMARY KEY,
    tramite_id VARCHAR(20) NOT NULL REFERENCES tramites(numero_carnet_sanitario) ON DELETE CASCADE,
    quimica_sanguinea_id INTEGER REFERENCES quimica_sanguinea(id_sanguinea) ON DELETE RESTRICT,
    coproparasitologico_id INTEGER REFERENCES coproparasitologico(id_coproparasitologico) ON DELETE RESTRICT,
    vih_resultado VARCHAR(20),
    operador_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    observaciones TEXT,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Compatibilidad: conservar consentimiento y representación JSON anteriores.
    vih_realizado BOOLEAN,
    vih_consentimiento BOOLEAN,
    vih_mostrar_en_registro_medico BOOLEAN,
    datos_compatibilidad JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS laboratorio_otros_analisis (
    id SERIAL PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
    analisis VARCHAR(100) NOT NULL,
    resultado TEXT NOT NULL,
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS examen_revision_general (
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

CREATE TABLE IF NOT EXISTS consultas_medicas (
    id SERIAL PRIMARY KEY,
    tramite_id VARCHAR(20) NOT NULL REFERENCES tramites(numero_carnet_sanitario) ON DELETE CASCADE,
    medico_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    examen_revision_general_id INTEGER REFERENCES examen_revision_general(id_examen) ON DELETE RESTRICT,
    antecedentes_patologicos TEXT,
    diagnostico TEXT,
    aprobado BOOLEAN,
    fecha_consulta TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Compatibilidad: guardar campos/firma de consultas creadas antes de esta migración.
    examen_fisico_legacy JSONB,
    firma_medico TEXT
);

CREATE TABLE IF NOT EXISTS logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT,
    ip_address VARCHAR(45),
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ajustar instalaciones que ya tengan el esquema normalizado sin los campos de compatibilidad.
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS codigo_carnet VARCHAR(30);
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS costo_bs NUMERIC(10,2) NOT NULL DEFAULT 30.00;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS estado_entrega VARCHAR(30);
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS entregado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS recibido_por VARCHAR(150);
ALTER TABLE tramites ADD COLUMN IF NOT EXISTS observacion_entrega TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tramites_id_compat ON tramites(id);

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

ALTER TABLE laboratorios ADD COLUMN IF NOT EXISTS vih_realizado BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN IF NOT EXISTS vih_consentimiento BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN IF NOT EXISTS vih_mostrar_en_registro_medico BOOLEAN;
ALTER TABLE laboratorios ADD COLUMN IF NOT EXISTS datos_compatibilidad JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE consultas_medicas ADD COLUMN IF NOT EXISTS examen_fisico_legacy JSONB;
ALTER TABLE consultas_medicas ADD COLUMN IF NOT EXISTS firma_medico TEXT;

-- Mantener la opción de rechazo que ya usa el flujo médico.
DO $$
DECLARE check_name TEXT;
BEGIN
    FOR check_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'tramites'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%estado%'
    LOOP
        EXECUTE format('ALTER TABLE tramites DROP CONSTRAINT %I', check_name);
    END LOOP;
    ALTER TABLE tramites ADD CONSTRAINT tramites_estado_compat_check
        CHECK (estado IN ('Pendiente Laboratorio', 'Pendiente Medicina', 'Aprobado', 'Rechazado'));
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quimica_sanguinea_por_laboratorio
    ON laboratorios(quimica_sanguinea_id) WHERE quimica_sanguinea_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_coproparasitologico_por_laboratorio
    ON laboratorios(coproparasitologico_id) WHERE coproparasitologico_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pacientes_ci ON pacientes(cedula_identidad, cedula_complemento);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombres ON pacientes(nombres, apellidos);
CREATE INDEX IF NOT EXISTS idx_tramites_paciente_id ON tramites(paciente_id);
CREATE INDEX IF NOT EXISTS idx_tramites_estado ON tramites(estado);
CREATE INDEX IF NOT EXISTS idx_tramites_entrega_pendiente
    ON tramites(fecha_emision, id)
    WHERE estado = 'Aprobado' AND estado_entrega = 'Pendiente de entrega';
CREATE INDEX IF NOT EXISTS idx_laboratorios_tramite_id ON laboratorios(tramite_id);
CREATE INDEX IF NOT EXISTS idx_laboratorios_operador_id ON laboratorios(operador_id);
CREATE INDEX IF NOT EXISTS idx_lab_otros_laboratorio_id ON laboratorio_otros_analisis(laboratorio_id);
CREATE INDEX IF NOT EXISTS idx_consultas_tramite_id ON consultas_medicas(tramite_id);
CREATE INDEX IF NOT EXISTS idx_consultas_medico_id ON consultas_medicas(medico_id);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs_auditoria(usuario_id);
