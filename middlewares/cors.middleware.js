/**
 * CORS.MIDDLEWARE.JS - Configuración de CORS personalizada
 * Sistema de Gestión Misionera
 * 
 * Maneja la configuración de CORS con validación de orígenes,
 * headers personalizados y configuraciones por ambiente
 */

const cors = require('cors');
const logger = require('../utils/logger');

// =============================================
// CONFIGURACIÓN DE ORÍGENES PERMITIDOS
// =============================================

/**
 * Obtener orígenes permitidos según el ambiente
 */
const getAllowedOrigins = () => {
  const defaultOrigins = {
    development: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ],
    production: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : [],
    test: ['http://localhost:3000']
  };

  const environment = process.env.NODE_ENV || 'development';
  return defaultOrigins[environment] || defaultOrigins.development;
};

// =============================================
// VALIDACIÓN DE ORIGEN
// =============================================

const isOriginAllowed = (origin, allowedOrigins) => {
  // Permitir requests sin origin (aplicaciones móviles, Postman, etc.)
  if (!origin) return true;

  // Verificar origen exacto
  if (allowedOrigins.includes(origin)) return true;

  // En desarrollo, permitir localhost con cualquier puerto
  if (process.env.NODE_ENV === 'development') {
    const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
    if (localhostRegex.test(origin)) return true;
  }

  return false;
};

// =============================================
// CONFIGURACIÓN PRINCIPAL DE CORS
// =============================================

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
    if (isOriginAllowed(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      logger.security('CORS_BLOCKED', origin || 'unknown', '', {
        allowedOrigins,
        blockedOrigin: origin
      });
      
      callback(new Error(`CORS: Origen ${origin} no permitido`), false);
    }
  },

  methods: [
    'GET',
    'POST', 
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD'
  ],

  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-access-token',
    'X-Forwarded-For',
    'X-Real-IP',
    'User-Agent',
    'Cache-Control',
    'Pragma'
  ],

  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'Content-Disposition'
  ],

  credentials: true,
  
  // Cache de preflight requests por 24 horas
  maxAge: 24 * 60 * 60,

  // Continuar con la request incluso si CORS falla
  optionsSuccessStatus: 200,

  // Habilitar para requests con credenciales
  preflightContinue: false
};

// =============================================
// CORS ESPECÍFICO POR RUTA
// =============================================

/**
 * CORS restrictivo para rutas administrativas
 */
const adminCorsOptions = {
  ...corsOptions,
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
    // En producción, solo permitir orígenes específicos para rutas admin
    if (process.env.NODE_ENV === 'production') {
      const adminOrigins = process.env.ADMIN_ALLOWED_ORIGINS
        ? process.env.ADMIN_ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : allowedOrigins;
        
      if (isOriginAllowed(origin, adminOrigins)) {
        callback(null, true);
      } else {
        logger.security('ADMIN_CORS_BLOCKED', origin || 'unknown', '', {
          adminOrigins,
          blockedOrigin: origin
        });
        callback(new Error(`CORS Admin: Origen ${origin} no permitido`), false);
      }
    } else {
      corsOptions.origin(origin, callback);
    }
  }
};

/**
 * CORS público para endpoints de solo lectura
 */
const publicCorsOptions = {
  ...corsOptions,
  credentials: false,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  origin: '*' // Permitir todos los orígenes para endpoints públicos
};

// =============================================
// MIDDLEWARE DE CORS DINÁMICO
// =============================================

/**
 * Middleware que aplica diferentes configuraciones CORS según la ruta
 */
const dynamicCors = (req, res, next) => {
  const path = req.path.toLowerCase();
  
  // Rutas administrativas
  if (path.startsWith('/api/v1/admin') || 
      path.startsWith('/api/v1/users') ||
      path.includes('/admin/')) {
    return cors(adminCorsOptions)(req, res, next);
  }
  
  // Rutas públicas (health check, documentación)
  if (path.startsWith('/health') || 
      path.startsWith('/docs') ||
      path === '/') {
    return cors(publicCorsOptions)(req, res, next);
  }
  
  // Configuración CORS por defecto
  return cors(corsOptions)(req, res, next);
};

// =============================================
// MANEJO DE ERRORES DE CORS
// =============================================

const corsErrorHandler = (error, req, res, next) => {
  if (error.message && error.message.includes('CORS')) {
    logger.security('CORS_ERROR', req.ip, req.get('User-Agent'), {
      origin: req.get('Origin'),
      method: req.method,
      path: req.path,
      error: error.message
    });

    return res.status(403).json({
      success: false,
      message: 'Acceso no permitido por política CORS',
      error: 'CORS_BLOCKED',
      details: process.env.NODE_ENV === 'development' 
        ? {
            origin: req.get('Origin'),
            allowedOrigins: getAllowedOrigins(),
            method: req.method
          }
        : undefined
    });
  }
  
  next(error);
};

// =============================================
// MIDDLEWARE DE PREFLIGHT
// =============================================

const handlePreflight = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    logger.info('Preflight request', {
      origin: req.get('Origin'),
      method: req.get('Access-Control-Request-Method'),
      headers: req.get('Access-Control-Request-Headers'),
      path: req.path
    });
  }
  next();
};

// =============================================
// CONFIGURACIÓN DE HEADERS ADICIONALES
// =============================================

const additionalHeaders = (req, res, next) => {
  // Prevenir embedding en iframes maliciosos
  res.header('X-Frame-Options', 'SAMEORIGIN');
  
  // Prevenir MIME type sniffing
  res.header('X-Content-Type-Options', 'nosniff');
  
  // Habilitar protección XSS
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature policy
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  next();
};

// =============================================
// LOGGING DE REQUESTS CORS
// =============================================

const logCorsRequests = (req, res, next) => {
  const origin = req.get('Origin');
  
  if (origin && origin !== req.get('Host')) {
    logger.info('CORS Request', {
      origin,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  }
  
  next();
};

// =============================================
// UTILIDADES PARA CONFIGURACIÓN
// =============================================

/**
 * Agregar origen permitido dinámicamente
 */
const addAllowedOrigin = (origin) => {
  if (typeof origin !== 'string' || !origin.startsWith('http')) {
    throw new Error('Origen debe ser una URL válida');
  }
  
  const currentOrigins = getAllowedOrigins();
  if (!currentOrigins.includes(origin)) {
    process.env.ALLOWED_ORIGINS = [...currentOrigins, origin].join(',');
    logger.info('Origen agregado a CORS', { origin });
  }
};

/**
 * Validar configuración CORS
 */
const validateCorsConfig = () => {
  const origins = getAllowedOrigins();
  
  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    logger.warn('⚠️ No hay orígenes CORS configurados para producción');
    return false;
  }
  
  // Verificar que no hay orígenes inseguros en producción
  if (process.env.NODE_ENV === 'production') {
    const insecureOrigins = origins.filter(origin => 
      origin.startsWith('http://') || 
      origin.includes('localhost') ||
      origin === '*'
    );
    
    if (insecureOrigins.length > 0) {
      logger.warn('⚠️ Orígenes inseguros en producción', { insecureOrigins });
      return false;
    }
  }
  
  logger.info('✅ Configuración CORS validada', {
    environment: process.env.NODE_ENV,
    originsCount: origins.length,
    origins: process.env.NODE_ENV === 'development' ? origins : '[HIDDEN]'
  });
  
  return true;
};

// =============================================
// EXPORTAR CONFIGURACIONES
// =============================================

module.exports = {
  // Middleware principal
  corsMiddleware: dynamicCors,
  
  // Configuraciones específicas
  cors: corsOptions,
  adminCors: adminCorsOptions,
  publicCors: publicCorsOptions,
  
  // Middleware adicionales
  corsErrorHandler,
  handlePreflight,
  additionalHeaders,
  logCorsRequests,
  
  // Utilidades
  addAllowedOrigin,
  validateCorsConfig,
  getAllowedOrigins,
  
  // Aplicar todo el stack de CORS
  applyCorsStack: (app) => {
    app.use(handlePreflight);
    app.use(logCorsRequests);
    app.use(dynamicCors);
    app.use(additionalHeaders);
    app.use(corsErrorHandler);
    
    // Validar configuración al inicio
    validateCorsConfig();
  }
};