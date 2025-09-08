/**
 * INDICATOR.ROUTES.JS - Rutas de indicadores espirituales
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas relacionadas con indicadores espirituales
 * Incluye validaciones, permisos y rate limiting específicos
 */

const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdmin, isDirector, isLeader } = require('../middlewares/auth.middleware');
const { 
  validateIndicator, 
  validateIndicatorUpdate,
  validateBulkIndicators 
} = require('../middlewares/validate.middleware');

// Controladores
const {
  createIndicator,
  getIndicatorsByMember,
  getIndicatorById,
  updateIndicator,
  deleteIndicator,
  getIndicatorStats,
  bulkCreateIndicators
} = require('../controllers/indicator.controller');

// Rate limiting
const rateLimit = require('express-rate-limit');

const createIndicatorLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 indicadores por ventana
  message: {
    success: false,
    message: 'Demasiados indicadores registrados. Intenta más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const bulkIndicatorLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 evaluaciones grupales por hora
  message: {
    success: false,
    message: 'Demasiadas evaluaciones grupales. Intenta más tarde.'
  }
});

// =============================================================================
// RUTAS DE INDICADORES ESPIRITUALES
// =============================================================================

/**
 * @route   POST /api/indicators/member/:memberId
 * @desc    Crear nuevo indicador espiritual para un miembro
 * @access  Leader+, Director+, Admin
 * @validation validateIndicator
 * @rateLimit createIndicatorLimit
 */
router.post('/member/:memberId', 
  verifyToken,
  isLeader,
  createIndicatorLimit,
  validateIndicator,
  createIndicator
);

/**
 * @route   GET /api/indicators/member/:memberId
 * @desc    Obtener todos los indicadores de un miembro
 * @access  Leader+, Director+, Admin
 * @query   page, limit, type, semesterId, startDate, endDate, sortBy, sortOrder
 */
router.get('/member/:memberId',
  verifyToken,
  isLeader,
  getIndicatorsByMember
);

/**
 * @route   GET /api/indicators/:id
 * @desc    Obtener indicador específico por ID
 * @access  Leader+, Director+, Admin
 */
router.get('/:id',
  verifyToken,
  isLeader,
  getIndicatorById
);

/**
 * @route   PUT /api/indicators/:id
 * @desc    Actualizar indicador espiritual
 * @access  Leader+, Director+, Admin
 * @validation validateIndicatorUpdate
 */
router.put('/:id',
  verifyToken,
  isLeader,
  validateIndicatorUpdate,
  updateIndicator
);

/**
 * @route   DELETE /api/indicators/:id
 * @desc    Eliminar indicador espiritual
 * @access  Leader+, Director+, Admin
 * @note    Restricciones de tiempo aplicadas
 */
router.delete('/:id',
  verifyToken,
  isLeader,
  deleteIndicator
);

/**
 * @route   GET /api/indicators/stats/:groupId
 * @desc    Obtener estadísticas de indicadores espirituales del grupo
 * @access  Leader+, Director+, Admin
 * @query   semesterId, type
 */
router.get('/stats/:groupId',
  verifyToken,
  isLeader,
  getIndicatorStats
);

/**
 * @route   POST /api/indicators/bulk/:groupId
 * @desc    Crear múltiples indicadores (evaluación grupal)
 * @access  Leader+, Director+, Admin
 * @validation validateBulkIndicators
 * @rateLimit bulkIndicatorLimit
 */
router.post('/bulk/:groupId',
  verifyToken,
  isLeader,
  bulkIndicatorLimit,
  validateBulkIndicators,
  bulkCreateIndicators
);

module.exports = router;