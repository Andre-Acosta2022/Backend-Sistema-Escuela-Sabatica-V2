/**
 * APP.JS - Configuración principal de Express
 * Sistema de Gestión Misionera
 * 
 * Configuración de middleware, rutas y manejo de errores
 * para la API REST del sistema misionero
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Importar middleware personalizados
const errorMiddleware = require('./middlewares/error.middleware');
const logger = require('./utils/logger');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const churchRoutes = require('./routes/church.routes');
const groupRoutes = require('./routes/group.routes');
const memberRoutes = require('./routes/member.routes');
const studentRoutes = require('./routes/student.routes');
const metricRoutes = require('./routes/metric.routes');
const indicatorRoutes = require('./routes/indicator.routes');
const reportRoutes = require('./routes/report.routes');

// Crear instancia de Express
const app = express();

// ==============================================
// MIDDLEWARE DE SEGURIDAD
// ==============================================

// Helmet para headers de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Configuración de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [process.env.FRONTEND_URL || 'http://localhost:5173'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  credentials: true,
  maxAge: 86400 // 24 horas
};

app.use(cors(corsOptions));

// Compresión de respuestas
app.use(compression());

// ==============================================
// RATE LIMITING
// ==============================================

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // límite de requests por IP
  message: {
    error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting específico para autenticación
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5, // máximo 5 intentos de login
  message: {
    error: 'Demasiados intentos de inicio de sesión, intenta de nuevo más tarde.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiting
app.use('/api/', generalLimiter);
app.use('/api/v1/auth/signin', authLimiter);
app.use('/api/v1/auth/signup', authLimiter);

// ==============================================
// MIDDLEWARE DE PARSEO
// ==============================================

// Parser de JSON con límite de tamaño
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  type: ['application/json', 'text/plain']
}));

// Parser de URL encoded
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb' 
}));

// ==============================================
// MIDDLEWARE DE LOGGING
// ==============================================

// Log de requests en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
  });
}

// ==============================================
// HEALTH CHECK
// ==============================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version,
    database: 'Connected', // Se podría verificar la conexión real
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  });
});

// ==============================================
// RUTAS DE LA API
// ==============================================

const API_BASE = process.env.API_BASE_PATH || '/api/v1';

// Middleware para log de rutas de API
app.use(API_BASE, (req, res, next) => {
  logger.info(`API Request: ${req.method} ${req.originalUrl}`);
  next();
});

// Rutas de autenticación
app.use(`${API_BASE}/auth`, authRoutes);

// Rutas de recursos (requieren autenticación)
app.use(`${API_BASE}/users`, userRoutes);
app.use(`${API_BASE}/churches`, churchRoutes);
app.use(`${API_BASE}/groups`, groupRoutes);
app.use(`${API_BASE}/members`, memberRoutes);
app.use(`${API_BASE}/students`, studentRoutes);
app.use(`${API_BASE}/metrics`, metricRoutes);
app.use(`${API_BASE}/indicators`, indicatorRoutes);
app.use(`${API_BASE}/reports`, reportRoutes);

// ==============================================
// RUTA RAÍZ
// ==============================================

app.get('/', (req, res) => {
  res.json({
    message: '🏛️ Sistema de Gestión Misionera - API',
    version: '1.0.0',
    status: 'Activo',
    endpoints: {
      health: '/health',
      api: API_BASE,
      auth: `${API_BASE}/auth`,
      documentation: `${API_BASE}/docs` // Para futura implementación
    },
    features: [
      'Autenticación JWT',
      'Gestión de usuarios y roles',
      'Administración de iglesias',
      'Gestión de grupos misioneros',
      'Seguimiento de miembros',
      'Estudiantes bíblicos',
      'Métricas e indicadores',
      'Sistema de reportes'
    ]
  });
});

// ==============================================
// MANEJO DE RUTAS NO ENCONTRADAS
// ==============================================

app.use('*', (req, res) => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  res.status(404).json({
    error: 'Endpoint no encontrado',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    availableEndpoints: {
      health: '/health',
      api: API_BASE,
      auth: `${API_BASE}/auth`
    }
  });
});

// ==============================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ==============================================

// Debe ser el último middleware
app.use(errorMiddleware);

module.exports = app;