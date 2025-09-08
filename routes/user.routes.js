/**
 * USER.ROUTES.JS - Rutas de gestión de usuarios
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas para operaciones CRUD de usuarios
 * Solo accesible por administradores
 */

const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdmin } = require('../middlewares/auth.middleware');
const { validateUser, validateUserUpdate, validateApproval, validatePasswordReset } = require('../middlewares/validate.middleware');
const { rateLimiter } = require('../middlewares/auth.middleware');

// Controlador
const userController = require('../controllers/user.controller');

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
 * Query params: page, limit, role, churchId, isActive, isApproved, search, sortBy, sortOrder
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
 * Body: email, password, firstName, lastName, phone, role, churchId, isActive, isApproved
 */
router.post('/', 
  rateLimiter.createUser, 
  validateUser, 
  userController.createUser
);

/**
 * POST /api/users/:id/approve
 * Aprobar o rechazar usuario
 * Body: isApproved, reason (opcional)
 */
router.post('/:id/approve', 
  validateApproval, 
  userController.approveUser
);

/**
 * POST /api/users/:id/reset-password
 * Restablecer contraseña de usuario (admin)
 * Body: newPassword
 */
router.post('/:id/reset-password', 
  rateLimiter.resetPassword,
  validatePasswordReset, 
  userController.resetUserPassword
);

// =============================================
// RUTAS DE ACTUALIZACIÓN (PUT)
// =============================================

/**
 * PUT /api/users/:id
 * Actualizar usuario completo
 * Body: email, firstName, lastName, phone, role, churchId, isActive, isApproved, password (opcional)
 */
router.put('/:id', 
  validateUserUpdate, 
  userController.updateUser
);

// =============================================
// RUTAS DE ELIMINACIÓN (DELETE)
// =============================================

/**
 * DELETE /api/users/:id
 * Eliminar usuario (soft delete)
 * Query params: force (boolean) - para forzar eliminación aunque tenga grupos
 */
router.delete('/:id', userController.deleteUser);

// =============================================
// EXPORTAR ROUTER
// =============================================
module.exports = router;