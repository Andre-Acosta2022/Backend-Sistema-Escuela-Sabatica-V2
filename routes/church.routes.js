/**
 * CHURCH.ROUTES.JS - Rutas de gestión de iglesias
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas para operaciones CRUD de iglesias
 * Accesible por administradores y directores
 */

const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdminOrDirector } = require('../middlewares/auth.middleware');
const { validateChurch, validateChurchUpdate } = require('../middlewares/validate.middleware');

// Controlador
const churchController = require('../controllers/church.controller');

// =============================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================
router.use(verifyToken); // Todas las rutas requieren autenticación
router.use(isAdminOrDirector); // Requiere rol de admin o director

// =============================================
// RUTAS DE CONSULTA (GET)
// =============================================

/**
 * GET /api/churches
 * Obtener lista de iglesias con filtros y paginación
 * Query params: page, limit, isActive, country, city, search, sortBy, sortOrder, includeStats
 */
router.get('/', churchController.getAllChurches);

/**
 * GET /api/churches/stats
 * Obtener estadísticas de iglesias
 */
router.get('/stats', churchController.getChurchStats);

/**
 * GET /api/churches/:id
 * Obtener iglesia específica por ID
 * Query params: includeUsers, includeGroups
 */
router.get('/:id', churchController.getChurchById);

// =============================================
// RUTAS DE CREACIÓN (POST)
// =============================================

/**
 * POST /api/churches
 * Crear nueva iglesia
 * Body: name, address, city, country, phone, email, website, description, isActive
 */
router.post('/', 
  validateChurch, 
  churchController.createChurch
);

// =============================================
// RUTAS DE ACTUALIZACIÓN (PUT)
// =============================================

/**
 * PUT /api/churches/:id
 * Actualizar iglesia completa
 * Body: name, address, city, country, phone, email, website, description, isActive
 */
router.put('/:id', 
  validateChurchUpdate, 
  churchController.updateChurch
);

// =============================================
// RUTAS DE ELIMINACIÓN (DELETE)
// =============================================

/**
 * DELETE /api/churches/:id
 * Eliminar iglesia (soft delete)
 * Query params: force (boolean) - para forzar eliminación aunque tenga dependencias
 */
router.delete('/:id', churchController.deleteChurch);

// =============================================
// EXPORTAR ROUTER
// =============================================
module.exports = router;