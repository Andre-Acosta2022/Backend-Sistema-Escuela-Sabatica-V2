/**
 * GROUP.ROUTES.JS - Rutas de gestión de grupos
 * Sistema de Gestión Misionera
 * * Define todas las rutas para operaciones CRUD de grupos
 * Accesible por admin, directores y líderes (con restricciones)
 */

const express = require('express');
const router = express.Router();

// Middlewares - Importación corregida añadiendo isReader
const { verifyToken, isLeader, isReader } = require('../middlewares/auth.middleware');
const { validateGroup } = require('../middlewares/validate.middleware');

// Controlador
const groupController = require('../controllers/group.controller');

// =============================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================
router.use(verifyToken); // Todas las rutas requieren autenticación
// ELIMINADO router.use(isLeader) global para no bloquear lecturas

// =============================================
// RUTAS DE CONSULTA (GET) - Requieren isReader
// =============================================

/**
 * GET /api/groups
 * Obtener lista de grupos con filtros y paginación
 * Query params: page, limit, churchId, leaderId, isActive, search, sortBy, sortOrder, includeStats
 */
router.get('/', isReader, groupController.getAllGroups);

/**
 * GET /api/groups/my
 * Obtener grupos del usuario actual
 */
router.get('/my', isReader, groupController.getMyGroups);

/**
 * GET /api/groups/stats
 * Obtener estadísticas de grupos
 */
router.get('/stats', isReader, groupController.getGroupStats);

/**
 * GET /api/groups/:id
 * Obtener grupo específico por ID
 * Query params: includeMembers, includeStudents, includeMetrics, includeIndicators
 */
router.get('/:id', isReader, groupController.getGroupById);

// =============================================
// RUTAS DE CREACIÓN (POST) - Requieren isLeader
// =============================================

/**
 * POST /api/groups
 * Crear nuevo grupo
 * Body: name, description, location, meetingDay, meetingTime, churchId, leaderId, isActive
 */
router.post('/', 
  isLeader,
  validateGroup, 
  groupController.createGroup
);

// =============================================
// RUTAS DE ACTUALIZACIÓN (PUT) - Requieren isLeader
// =============================================

/**
 * PUT /api/groups/:id
 * Actualizar grupo completo
 * Body: name, description, location, meetingDay, meetingTime, leaderId, isActive
 */
router.put('/:id', 
  isLeader,
  validateGroup, 
  groupController.updateGroup
);

// =============================================
// RUTAS DE ELIMINACIÓN (DELETE) - Requieren isLeader
// =============================================

/**
 * DELETE /api/groups/:id
 * Eliminar grupo (soft delete)
 * Query params: force (boolean) - para forzar eliminación aunque tenga dependencias
 */
router.delete('/:id', isLeader, groupController.deleteGroup);

// =============================================
// EXPORTAR ROUTER
// =============================================
module.exports = router;