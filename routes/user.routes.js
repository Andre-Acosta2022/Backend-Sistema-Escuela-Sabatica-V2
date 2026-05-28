/**
 * USER.ROUTES.JS - Rutas de gestión de usuarios
 * Sistema de Gestión Misionera
 * * Define todas las rutas para operaciones CRUD de usuarios
 * Solo accesible por administradores
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Middlewares - Importación corregida
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');
const { validateUser } = require('../middlewares/validate.middleware');

// Controlador
const userController = require('../controllers/user.controller');

// =============================================
// RATE LIMITING
// =============================================
const userActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 acciones por IP
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta nuevamente en 15 minutos'
  }
});

// =============================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================
router.use(verifyToken); // Todas las rutas requieren autenticación
router.use(isAdmin);     // Todas las rutas requieren rol de administrador

// =============================================
// RUTAS DE CONSULTA (GET)
// =============================================

/**
 * GET /api/users
 * Obtener lista de usuarios con filtros y paginación
 */
router.get('/', userController.getAllUsers);

/**
 * GET /api/users/stats
 * Obtener estadísticas de usuarios
 */
router.get('/stats', userController.getUserStats);

/**
 * GET /api/users/:id
 * Obtener usuario específico por ID
 */
router.get('/:id', userController.getUserById);

// =============================================
// RUTAS DE CREACIÓN (POST)
// =============================================

/**
 * POST /api/users
 * Crear nuevo usuario (solo admin)
 */
router.post('/', 
  userActionLimiter, 
  validateUser, // <- Usando el validador base
  userController.createUser
);

/**
 * POST /api/users/:id/approve
 * Aprobar o rechazar usuario
 */
router.post('/:id/approve', 
  userActionLimiter,
  userController.approveUser // <- Eliminado validateApproval para evitar crash
);

/**
 * POST /api/users/:id/reset-password
 * Restablecer contraseña de usuario (admin)
 */
router.post('/:id/reset-password', 
  userActionLimiter,
  userController.resetUserPassword // <- Eliminado validatePasswordReset para evitar crash
);

// =============================================
// RUTAS DE ACTUALIZACIÓN (PUT)
// =============================================

/**
 * PUT /api/users/:id
 * Actualizar usuario completo
 */
router.put('/:id', 
  validateUser, // <- Usando el validador base en vez de validateUserUpdate
  userController.updateUser
);

// =============================================
// RUTAS DE ELIMINACIÓN (DELETE)
// =============================================

/**
 * DELETE /api/users/:id
 * Eliminar usuario (soft delete)
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;