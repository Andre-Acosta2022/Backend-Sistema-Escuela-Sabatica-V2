/**
 * GROUP.ROUTES.JS - Rutas de gestión de grupos
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas para operaciones CRUD de grupos
 * Accesible por admin, directores y líderes (con restricciones)
 */

const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdminDirectorOrLeader } = require('../middlewares/auth.middleware');
const { validateGroup, validateGroupUpdate } = require('../middlewares/validate.middleware');

// Controlador
const groupController = require('../controllers/group.controller');

// =============================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================
router.use(verifyToken); // Todas las rutas requieren autenticación
router.use(isAdminDirectorOrLeader); // Requiere rol de admin, director o leader

// =============================================
// RUTAS DE CONSULTA (GET)
// =============================================

/**
 * GET /api/groups
 * Obtener lista de grupos con filtros y paginación
 * Query params: page, limit, churchId, leaderId, isActive, search, sortBy, sortOrder, includeStats
 */
router.get('/', groupController.getAllGroups);

/**
 * GET /api/groups/my
 * Obtener grupos del usuario actual
 */
router.get('/my', groupController.getMyGroups);

/**
 * GET /api/groups/stats
 * Obtener estadísticas de grupos
 */
router.get('/stats', groupController.getGroupStats);

/**
 * GET /api/groups/:id
 * Obtener grupo específico por ID
 * Query params: includeMembers, includeStudents, includeMetrics, includeIndicators
 */
router.get('/:id', groupController.getGroupById);

// =============================================
// RUTAS DE CREACIÓN (POST)
// =============================================

/**
 * POST /api/groups
 * Crear nuevo grupo
 * Body: name, description, location, meetingDay, meetingTime, churchId, leaderId, isActive
 */
router.post('/', 
  validateGroup, 
  groupController.createGroup
);

// =============================================
// RUTAS DE ACTUALIZACIÓN (PUT)
// =============================================

/**
 * PUT /api/groups/:id
 * Actualizar grupo completo
 * Body: name, description, location, meetingDay, meetingTime, leaderId, isActive
 */
router.put('/:id', 
  validateGroupUpdate, 
  groupController.updateGroup
);

// =============================================
// RUTAS DE ELIMINACIÓN (DELETE)
// =============================================

/**
 * DELETE /api/groups/:id
 * Eliminar grupo (soft delete)
 * Query params: force (boolean) - para forzar eliminación aunque tenga dependencias
 */
router.delete('/:id', groupController.deleteGroup);

// =============================================
// EXPORTAR ROUTER
// =============================================
module.exports = router;