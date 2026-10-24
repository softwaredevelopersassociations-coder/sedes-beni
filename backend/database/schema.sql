-- Base de datos para el Carnet Sanitario del SEDES Beni

-- Tabla de Usuarios (RBAC)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'laboratorio', 'medico')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pacientes (Solicitantes de Carnet)
CREATE TABLE IF NOT EXISTS pacientes (
    id SERIAL PRIMARY KEY,
    ci VARCHAR(20) UNIQUE NOT NULL,
    ci_exp VARCHAR(5) NOT NULL, -- BE, LP, SC, CB, OR, PT, CH, TJ, PD
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    genero VARCHAR(20) NOT NULL, -- Masculino, Femenino, Otro
    telefono VARCHAR(20),
    ocupacion VARCHAR(100) NOT NULL, -- Manipulador de Alimentos, Trabajo Sexual, etc.
    empresa_trabajo VARCHAR(100),
    mercado VARCHAR(100), -- Mercado Pompeya, Mercado Central, etc.
    foto_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Trámites (Control de estado del proceso)
CREATE TABLE IF NOT EXISTS tramites (
    id SERIAL PRIMARY KEY,
    paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
    tipo_tramite VARCHAR(20) NOT NULL CHECK (tipo_tramite IN ('Apertura', 'Renovación')),
    codigo_carnet VARCHAR(30) UNIQUE, -- Generado al ser aprobado (ej. CS-2026-0001)
    estado VARCHAR(30) DEFAULT 'Pendiente Laboratorio' CHECK (estado IN ('Pendiente Laboratorio', 'Pendiente Medicina', 'Aprobado', 'Rechazado')),
    observaciones TEXT,
    costo_bs DECIMAL(10,2) DEFAULT 30.00,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_emision TIMESTAMP,
    fecha_vencimiento TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Exámenes de Laboratorio
CREATE TABLE IF NOT EXISTS laboratorios (
    id SERIAL PRIMARY KEY,
    tramite_id INTEGER REFERENCES tramites(id) ON DELETE CASCADE UNIQUE,
    quimica_sanguinea JSONB NOT NULL, -- glucosa, urea, creatinina
    coproparasitologico JSONB NOT NULL, -- parasitos (Negativo / especie), consistencia, color
    vih JSONB NOT NULL, -- resultado (Reactivo / No Reactivo), consentimiento (boolean)
    operador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    observaciones TEXT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratorio_otros_analisis (
    id SERIAL PRIMARY KEY,
    laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id) ON DELETE CASCADE,
    analisis VARCHAR(100) NOT NULL,
    resultado TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Índice para optimizar las lecturas por laboratorio


-- Tabla de Consultas Médicas e Historial Clínico
CREATE TABLE IF NOT EXISTS consultas_medicas (
    id SERIAL PRIMARY KEY,
    tramite_id INTEGER REFERENCES tramites(id) ON DELETE CASCADE UNIQUE,
    medico_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    examen_fisico JSONB NOT NULL, -- piel, respiratorio, cardiovascular, dental
    antecedentes_patologicos TEXT,
    diagnostico TEXT,
    aprobado BOOLEAN NOT NULL,
    firma_medico TEXT, -- Imagen en Base64 o firma dibujada
    fecha_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Logs de Auditoría
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    detalles TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas avanzadas
CREATE INDEX IF NOT EXISTS idx_pacientes_ci ON pacientes(ci);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombres ON pacientes(nombres, apellidos);
CREATE INDEX IF NOT EXISTS idx_tramites_estado ON tramites(estado);
CREATE INDEX IF NOT EXISTS idx_tramites_codigo ON tramites(codigo_carnet);
CREATE INDEX IF NOT EXISTS idx_otros_analisis_lab_id ON laboratorio_otros_analisis(laboratorio_id);