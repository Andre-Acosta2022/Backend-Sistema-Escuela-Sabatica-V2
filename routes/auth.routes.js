/**
 * AUTH.ROUTES.JS - Rutas de autenticación
 * Sistema de Gestión Misionera
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Controladores y middleware
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const validateMiddleware = require('../middlewares/validate.middleware');
const { body } = require('express-validator'); 
const logger = require('../utils/logger');

// =============================================
// RATE LIMITING PARA SEGURIDAD
// =============================================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos', error: 'TOO_MANY_LOGIN_ATTEMPTS' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Límite de login excedido', { ip: req.ip, userAgent: req.get('User-Agent'), email: req.body?.email });
    res.status(429).json({ success: false, message: 'Demasiados intentos de login. Intente nuevamente en 15 minutos', error: 'TOO_MANY_LOGIN_ATTEMPTS', retryAfter: 15 * 60 });
  }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora', error: 'TOO_MANY_SIGNUP_ATTEMPTS' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Límite de registro excedido', { ip: req.ip, userAgent: req.get('User-Agent'), email: req.body?.email });
    res.status(429).json({ success: false, message: 'Demasiados intentos de registro. Intente nuevamente en 1 hora', error: 'TOO_MANY_SIGNUP_ATTEMPTS', retryAfter: 60 * 60 });
  }
});

const passwordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false });
const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, keyGenerator: (req) => `${req.ip}-${req.body?.email || 'unknown'}`, standardHeaders: true, legacyHeaders: false });

// =============================================
// 🔄 MIDDLEWARE DE LOGGING (MOVIDO AL INICIO)
// =============================================
// Ahora interceptará correctamente cada petición antes de evaluar las rutas
router.use((req, res, next) => {
  logger.info(`Petición Auth: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// =============================================
// RUTAS PÚBLICAS (SIN AUTENTICACIÓN)
// =============================================

router.post('/signup', signupLimiter, validateMiddleware.sanitizeInput, validateMiddleware.validateSignup, authController.signup);
router.post('/signin', loginLimiter, validateMiddleware.sanitizeInput, validateMiddleware.validateSignin, authController.signin);
router.post('/refresh-token', validateMiddleware.sanitizeInput, authController.refreshToken);

router.post('/request-reset',
  resetLimiter,
  validateMiddleware.sanitizeInput,
  [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    validateMiddleware.handleValidationErrors
  ],
  authController.requestPasswordReset
);

router.post('/reset-password',
  passwordLimiter,
  validateMiddleware.sanitizeInput,
  [
    body('token').notEmpty().withMessage('Token requerido').isLength({ min: 32, max: 64 }).withMessage('Token inválido'),
    body('newPassword').isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
    validateMiddleware.handleValidationErrors
  ],
  authController.resetPassword
);

router.post('/initialize', validateMiddleware.sanitizeInput, authController.initializeSystem);

// =============================================
// RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN)
// =============================================

router.get('/verify', authMiddleware.verifyToken, authController.verifyToken);
router.post('/logout', authMiddleware.verifyToken, authController.logout);
router.post('/change-password', passwordLimiter, authMiddleware.verifyToken, validateMiddleware.sanitizeInput, validateMiddleware.validateChangePassword, authController.changePassword);
router.get('/profile', authMiddleware.verifyToken, authController.getProfile);

router.put('/profile',
  authMiddleware.verifyToken,
  validateMiddleware.sanitizeInput,
  [
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('El nombre debe tener entre 2 y 50 caracteres').matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El nombre solo puede contener letras y espacios'),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('El apellido debe tener entre 2 y 50 caracteres').matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/).withMessage('El apellido solo puede contener letras y espacios'),
    body('phone').optional().matches(/^[+]?[\d\s\-\(\)]{8,20}$/).withMessage('Teléfono inválido'),
    validateMiddleware.handleValidationErrors
  ],
  authController.updateProfile
);

// =============================================
// RUTAS DE INFORMACIÓN (PÚBLICAS)
// =============================================

router.get('/status', (req, res) => {
  res.json({ success: true, message: 'Sistema de autenticación activo', timestamp: new Date().toISOString(), version: process.env.APP_VERSION || '1.0.0', environment: process.env.NODE_ENV || 'development' });
});

router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      tokenExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      passwordRequirements: { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecialChars: true, allowedSpecialChars: '@$!%*?&' },
      rateLimits: { login: { attempts: 5, windowMinutes: 15 }, signup: { attempts: 3, windowHours: 1 }, passwordChange: { attempts: 3, windowMinutes: 15 } }
    }
  });
});

// =============================================
// MANEJO DE ERRORES ESPECÍFICO PARA AUTH (DEBE SER EL FINAL)
// =============================================
router.use((error, req, res, next) => {
  logger.error('Error en rutas de autenticación', { error: error.message, stack: error.stack, url: req.originalUrl, method: req.method, ip: req.ip, userId: req.user?.id || null });

  if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Token inválido', error: 'INVALID_TOKEN' });
  if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expirado', error: 'EXPIRED_TOKEN' });
  if (error.name === 'NotBeforeError') return res.status(401).json({ success: false, message: 'Token no válido aún', error: 'TOKEN_NOT_ACTIVE' });

  res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
});

module.exports = router;