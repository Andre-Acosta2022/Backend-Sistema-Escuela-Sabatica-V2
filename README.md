🏗️ Estructura Backend - Sistema de Gestión Misionera
backend/
│── 📁 config/
│ ├── database.js # Configuración PostgreSQL + Sequelize
│ ├── auth.config.js # Configuración JWT
│ └── environment.js # Variables de entorno centralizadas
│
│── 📁 controllers/
│ ├── auth.controller.js # Login, registro, cambio contraseña
│ ├── user.controller.js # CRUD usuarios (solo admin)
│ ├── church.controller.js # CRUD iglesias
│ ├── group.controller.js # CRUD grupos misioneros
│ ├── member.controller.js # CRUD miembros
│ ├── student.controller.js# CRUD estudiantes bíblicos
│ ├── metric.controller.js # CRUD métricas
│ ├── indicator.controller.js # CRUD indicadores espirituales
│ └── report.controller.js # Generación de reportes
│
│── 📁 middlewares/
│ ├── auth.middleware.js # Verificación JWT y roles
│ ├── validate.middleware.js # Validación de datos
│ ├── error.middleware.js # Manejo global de errores
│ └── cors.middleware.js # Configuración CORS
│
│── 📁 models/
│ ├── index.js # Configuración Sequelize
│ ├── User.model.js # Modelo de usuarios
│ ├── Church.model.js # Modelo de iglesias
│ ├── Group.model.js # Modelo de grupos
│ ├── Member.model.js # Modelo de miembros
│ ├── Student.model.js # Modelo estudiantes bíblicos
│ ├── Metric.model.js # Modelo de métricas
│ ├── Indicator.model.js # Modelo indicadores espirituales
│ └── Semester.model.js # Modelo de semestres
│
│── 📁 routes/
│ ├── auth.routes.js # Rutas de autenticación
│ ├── user.routes.js # Rutas de usuarios
│ ├── church.routes.js # Rutas de iglesias
│ ├── group.routes.js # Rutas de grupos
│ ├── member.routes.js # Rutas de miembros
│ ├── student.routes.js # Rutas de estudiantes
│ ├── metric.routes.js # Rutas de métricas
│ ├── indicator.routes.js # Rutas de indicadores
│ └── report.routes.js # Rutas de reportes
│
│── 📁 services/
│ ├── email.service.js # Servicio de emails
│ ├── report.service.js # Servicio de reportes
│ ├── export.service.js # Servicio de exportación
│ └── dashboard.service.js # Servicio de métricas dashboard
│
│── 📁 utils/
│ ├── validator.js # Funciones de validación
│ ├── constants.js # Constantes del sistema
│ ├── helpers.js # Funciones auxiliares
│ └── logger.js # Sistema de logs con Winston
│
│── 📁 migrations/
│ └── [timestamp]-initial-setup.js # Migraciones iniciales
│
│── 📁 seeders/
│ └── admin-seeder.js # Crear admin automáticamente
│
│── 📄 app.js # Configuración principal Express
│── 📄 server.js # Punto de entrada del servidor
│── 📄 package.json # Dependencias y scripts
│── 📄 .env.example # Variables de entorno ejemplo
│── 📄 .gitignore # Archivos ignorados por Git
│── 📄 README.md # Documentación
