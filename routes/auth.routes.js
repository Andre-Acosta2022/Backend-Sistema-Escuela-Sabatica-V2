/**
 * AUTH.ROUTES.JS - Rutas de autenticación
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas relacionadas con autenticación:
 * registro, login, cambio de contraseña, perfil, etc.
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Controladores y middleware
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validateMiddleware = require('../middlewares/validate.middleware');
const logger = require('../utils/logger');

// =============================================
// RATE LIMITING PARA SEGURIDAD
// =============================================

// Límite estricto para login (prevenir ataques de fuerza bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos',
    error: 'TOO_MANY_LOGIN_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Límite de login excedido', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos',
      error: 'TOO_MANY_LOGIN_ATTEMPTS',
      retryAfter: 15 * 60 // segundos
    });
  }
});

// Límite para registro
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por IP por hora
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora',
    error: 'TOO_MANY_SIGNUP_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Límite de registro excedido', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email
    });
    
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora',
      error: 'TOO_MANY_SIGNUP_ATTEMPTS',
      retryAfter: 60 * 60 // segundos
    });
  }
});

// Límite para cambio de contraseña
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3, // 3 intentos por IP
  message: {
    success: false,
    message: 'Demasiados intentos de cambio de contraseña. Intente nuevamente en 15 minutos',
    error: 'TOO_MANY_PASSWORD_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Límite para reset de contraseña
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos por email por hora
  message: {
    success: false,
    message: 'Demasiados intentos de reset. Intente nuevamente en 1 hora',
    error: 'TOO_MANY_RESET_ATTEMPTS'
  },
  keyGenerator: (req) => `${req.ip}-${req.body?.email || 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false
});

// =============================================
// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// =============================================

/**
 * @route   POST /api/auth/signup
 * @desc    Registrar nuevo usuario
 * @access  Público
 */
router.post('/signup',
  signupLimiter,
  validateMiddleware.sanitizeInput,
  validateMiddleware.validateSignup,
  authController.signup
);

/**
 * @route   POST /api/auth/signin
 * @desc    Iniciar sesión
 * @access  Público
 */
router.post('/signin',
  loginLimiter,
  validateMiddleware.sanitizeInput,
  validateMiddleware.validateSignin,
  authController.signin
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Renovar token de acceso
 * @access  Público (requiere refresh token)
 */
router.post('/refresh-token',
  validateMiddleware.sanitizeInput,
  authController.refreshToken
);

/**
 * @route   POST /api/auth/request-reset
 * @desc    Solicitar reset de contraseña
 * @access  Público
 */
router.post('/request-reset',
  resetLimiter,
  validateMiddleware.sanitizeInput,
  [
    validateMiddleware.body('email')
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    validateMiddleware.handleValidationErrors
  ],
  authController.requestPasswordReset
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña con token
 * @access  Público
 */
router.post('/reset-password',
  passwordLimiter,
  validateMiddleware.sanitizeInput,
  [
    validateMiddleware.body('token')
      .notEmpty()
      .withMessage('Token requerido')
      .isLength({ min: 32, max: 64 })
      .withMessage('Token inválido'),
    validateMiddleware.body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
    validateMiddleware.handleValidationErrors
  ],
  authController.resetPassword
);

/**
 * @route   POST /api/auth/initialize
 * @desc    Inicializar sistema (crear admin por defecto)
 * @access  Público (solo funciona si no hay admin)
 */
router.post('/initialize',
  validateMiddleware.sanitizeInput,
  authController.initializeSystem
);

// =============================================
// RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN)
// =============================================

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token y obtener datos del usuario
 * @access  Privado
 */
router.get('/verify',
  authMiddleware.verifyToken,
  authController.verifyToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Privado
 */
router.post('/logout',
  authMiddleware.verifyToken,
  authController.logout
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña
 * @access  Privado
 */
router.post('/change-password',
  passwordLimiter,
  authMiddleware.verifyToken,
  validateMiddleware.sanitizeInput,
  validateMiddleware.validateChangePassword,
  authController.changePassword
);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Privado
 */
router.get('/profile',
  authMiddleware.verifyToken,
  authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil del usuario autenticado
 * @access  Privado
 */
router.put('/profile',
  authMiddleware.verifyToken,
  validateMiddleware.sanitizeInput,
  [
    validateMiddleware.body('firstName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El nombre debe tener entre 2 y 50 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/)
      .withMessage('El nombre solo puede contener letras y espacios'),
    validateMiddleware.body('lastName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('El apellido debe tener entre 2 y 50 caracteres')
      .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/)
      .withMessage('El apellido solo puede contener letras y espacios'),
    validateMiddleware.body('phone')
      .optional()
      .matches(/^[+]?[\d\s\-\(\)]{8,20}$/)
      .withMessage('Teléfono inválido'),
    validateMiddleware.handleValidationErrors
  ],
  authController.updateProfile
);

// =============================================
// RUTAS DE INFORMACIÓN (PÚBLICAS)
// =============================================

/**
 * @route   GET /api/auth/status
 * @desc    Verificar estado del sistema de autenticación
 * @access  Público
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    message: 'Sistema de autenticación activo',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * @route   GET /api/auth/config
 * @desc    Obtener configuración pública del sistema
 * @access  Público
 */
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      tokenExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      passwordRequirements: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        allowedSpecialChars: '@$!%*?&'
      },
      rateLimits: {
        login: {
          attempts: 5,
          windowMinutes: 15
        },
        signup: {
          attempts: 3,
          windowHours: 1
        },
        passwordChange: {
          attempts: 3,
          windowMinutes: 15
        }
      }
    }
  });
});

// =============================================
// MIDDLEWARE DE LOGGING PARA TODAS LAS RUTAS
// =============================================
router.use((req, res, next) => {
  // Log de todas las peticiones a rutas de auth
  logger.info('Petición a ruta de autenticación', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null
  });
  next();
});

// =============================================
// MANEJO DE ERRORES ESPECÍFICO PARA AUTH
// =============================================
router.use((error, req, res, next) => {
  logger.error('Error en rutas de autenticación', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || null
  });

  // Errores específicos de autenticación
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Token inválido',
      error: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expirado',
      error: 'EXPIRED_TOKEN'
    });
  }

  if (error.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      message: 'Token no válido aún',
      error: 'TOKEN_NOT_ACTIVE'
    });
  }

  // Error genérico
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: 'INTERNAL_ERROR'
  });
});

// =============================================
// EXPORTAR ROUTER
// =============================================
module.exports = router;