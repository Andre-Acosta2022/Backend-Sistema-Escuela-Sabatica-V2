/**
 * REPORT.ROUTES.JS - Rutas de reportes consolidados
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas relacionadas con reportes y análisis
 * Incluye restricciones de acceso y rate limiting para reportes complejos
 */

const express = require('express');
const router = express.Router();

// Middlewares
const { verifyToken, isAdmin, isDirector, isLeader } = require('../middlewares/auth.middleware');

// Controladores
const {
  getGroupReport,
  getChurchReport,
  getComparativeReport
} = require('../controllers/report.controller');

// Rate limiting específico para reportes
const rateLimit = require('express-rate-limit');

const reportLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máximo 20 reportes por hora
  message: {
    success: false,
    message: 'Límite de reportes alcanzado. Intenta más tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const comparativeReportLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 reportes comparativos por hora
  message: {
    success: false,
    message: 'Límite de reportes comparativos alcanzado. Intenta más tarde.'
  }
});

// =============================================================================
// RUTAS DE REPORTES
// =============================================================================

/**
 * @route   GET /api/reports/group/:groupId
 * @desc    Generar reporte consolidado de un grupo específico
 * @access  Leader+, Director+, Admin
 * @query   semesterId, includeInactive
 * @rateLimit reportLimit
 * @features 
 *   - Información básica del grupo
 *   - Estadísticas de miembros
 *   - Indicadores espirituales
 *   - Métricas de desempeño
 *   - Estudiantes bíblicos
 *   - Análisis de crecimiento
 *   - Resumen ejecutivo
 */
router.get('/group/:groupId',
  verifyToken,
  isLeader,
  reportLimit,
  getGroupReport
);

/**
 * @route   GET /api/reports/church/:churchId
 * @desc    Generar reporte consolidado de una iglesia completa
 * @access  Director+, Admin
 * @query   semesterId, includeInactive
 * @rateLimit reportLimit
 * @features
 *   - Consolidación de todos los grupos
 *   - Estadísticas generales de la iglesia
 *   - Reportes individuales por grupo
 *   - Análisis comparativo interno
 */
router.get('/church/:churchId',
  verifyToken,
  isDirector,
  reportLimit,
  getChurchReport
);

/**
 * @route   POST /api/reports/comparative
 * @desc    Generar reporte comparativo entre múltiples grupos
 * @access  Leader+, Director+, Admin
 * @body    { groupIds: [array], semesterId?: string }
 * @rateLimit comparativeReportLimit
 * @features
 *   - Comparación de métricas clave
 *   - Rankings por categorías
 *   - Análisis de mejores prácticas
 *   - Identificación de grupos que necesitan atención
 *   - Insights y recomendaciones
 * @restrictions
 *   - Mínimo 2 grupos, máximo 10 grupos
 *   - Usuario debe tener acceso a todos los grupos solicitados
 */
router.post('/comparative',
  verifyToken,
  isLeader,
  comparativeReportLimit,
  getComparativeReport
);

module.exports = router;