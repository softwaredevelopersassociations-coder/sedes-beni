# Sistema Digital de Gestión del Carnet Sanitario (SEDES Beni)

Este es el Producto Mínimo Viable (MVP) del Sistema de Gestión del Carnet Sanitario para la Unidad de Salud Ambiental del SEDES Beni en Trinidad, Bolivia. El sistema reemplaza los archivos CARDEX y registros manuales físicos por una solución digital que integra recepción, laboratorios clínicos y consultas médicas.

---

## 🚀 Requisitos Previos

Asegúrate de tener instalados los siguientes componentes en tu sistema local:
1. **Node.js** (Versión 18 o superior)
2. **NPM** (Gestor de paquetes de Node)
3. **PostgreSQL** (Servidor de base de datos relacional activo)

---

## 🛠️ Configuración e Inicialización

### 1. Preparar la Base de Datos
Accede a tu consola de PostgreSQL (o a través de una herramienta como pgAdmin / DBeaver) y ejecuta el comando para crear la base de datos:
```sql
CREATE DATABASE sedes_beni;
```

*Nota: No necesitas crear las tablas manualmente. Al arrancar el servidor backend, el sistema leerá el archivo `backend/database/schema.sql` y creará automáticamente toda la estructura relacional e insertará los usuarios de prueba.*

### 2. Configurar Variables de Entorno
Abre el archivo `backend/.env` y personaliza las credenciales de conexión a tu servidor de base de datos PostgreSQL:
```ini
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario_postgres      # Ejemplo: postgres
DB_PASSWORD=tu_contraseña_pg     # Ejemplo: admin123
DB_NAME=sedes_beni
JWT_SECRET=clave_secreta_para_jwt_sedes_beni
```

### 3. Instalar y Arrancar el Proyecto (Monorepo)
Para arrancar el frontend y el backend de forma simultánea, sitúate en la carpeta raíz del proyecto (`proyecto1`) y ejecuta:

*   **Instalación automatizada global**:
    ```bash
    npm run install:all
    ```
    *(Este comando instalará las dependencias en la raíz, en la carpeta `backend` y en la carpeta `frontend`)*

*   **Ejecutar en modo de desarrollo**:
    ```bash
    npm run dev
    ```
    *(Este comando ejecutará de manera concurrente el servidor backend en `http://localhost:5000` y la aplicación React en `http://localhost:5173`)*

---

## 👥 Cuentas de Acceso (Roles Semilla)

Para probar los flujos de roles en el sistema, utiliza las siguientes credenciales autogeneradas por defecto:

| Rol | Usuario | Contraseña | Funcionalidad Clave |
| :--- | :--- | :--- | :--- |
| **Administrador / Recepción** | `admin` | `admin123` | Registro de pacientes, cámara web, inicio de trámites, estadísticas generales, auditorías y gestión de usuarios. |
| **Operador de Laboratorio** | `lab` | `lab123` | Carga de exámenes de química sanguínea, coproparasitológico e inmunología (VIH con consentimiento). |
| **Médico Evaluador** | `medico` | `medico123` | Evaluación física (piel, respiratorio, etc.), diagnóstico, firma interactiva, aprobación y emisión del carnet en formato PDF. |

---

## 🔄 Flujo Operativo del Trámite (Paso a Paso)

1.  **Registro y Caja (Admin)**:
    *   Inicia sesión con `admin` / `admin123`.
    *   Ve a **Registrar Paciente**. Rellena los datos demográficos.
    *   Activa la cámara web y toma la foto del paciente (o sube una imagen).
    *   Selecciona "Apertura" o "Renovación", define el costo y haz clic en **Registrar Paciente e Iniciar**.
    *   El trámite se crea con el estado `Pendiente Laboratorio`.
2.  **Carga de Exámenes (Laboratorio)**:
    *   Inicia sesión con `lab` / `lab123`.
    *   Aparecerá el paciente en la bandeja **Área Laboratorio**.
    *   Haz clic en **Cargar Laboratorios**.
    *   Ingresa valores bioquímicos (glucosa, urea, creatinina).
    *   Selecciona los parásitos encontrados (o "Negativo").
    *   Selecciona el resultado de VIH y marca el checkbox obligatorio de **Consentimiento Informado**.
    *   Haz clic en **Registrar y Derivar**. El trámite cambia a `Pendiente Medicina`.
3.  **Evaluación y Emisión (Médico)**:
    *   Inicia sesión con `medico` / `medico123`.
    *   En el **Área Médica** verás al paciente derivado.
    *   Haz clic en **Evaluar Clínicamente**.
    *   Revisa los resultados bioquímicos y de laboratorio (el sistema te alertará en rojo si hay hallazgos anormales).
    *   Completa el examen físico (revisión de piel/lesiones) e ingresa el diagnóstico.
    *   Dibuja tu firma digitalizada en el lienzo interactivo.
    *   Haz clic en **Aprobado** (o Rechazado si no procede) y luego en **Registrar Evaluación y Emitir**.
4.  **Impresión del Carnet**:
    *   Al aprobarse la consulta, aparecerá un botón para **Imprimir Carnet**.
    *   Haz clic en él; se abrirá el asistente del navegador.
    *   El carnet tiene las dimensiones oficiales ajustadas (`85.6mm x 54mm`) y se imprimirá con la foto del paciente y tu firma digital en sus lugares exactos.
