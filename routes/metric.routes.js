/**
 * METRIC.ROUTES.JS - Rutas para gestión de métricas
 * Sistema de Gestión Misionera
 * 
 * Define todas las rutas API para operaciones CRUD de métricas
 * con validaciones, autenticación y control de permisos por rol
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { authJwt, validate } = require('../middlewares');
const metricController = require('../controllers/metric.controller');

const router = express.Router();

// =============================================================================
// RATE LIMITING
// =============================================================================
const metricRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requests por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta nuevamente en 15 minutos'
  }
});

const createMetricRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 creaciones por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas creaciones, intenta nuevamente en 5 minutos'
  }
});

// =============================================================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================================================
router.use(metricRateLimit);
router.use([authJwt.verifyToken]);

// =============================================================================
// RUTAS DE MÉTRICAS POR GRUPO
// =============================================================================

/**
 * @route   POST /api/groups/:groupId/metrics
 * @desc    Crear nueva métrica para un grupo
 * @access  Private (Leader+)
 * @params  groupId - ID del grupo
 * @body    Datos de la métrica
 */
router.post(
  '/:groupId/metrics',
  [
    createMetricRateLimit,
    authJwt.hasRole(['admin', 'director', 'leader']),
    validate.validateMetric
  ],
  metricController.createMetric
);

/**
 * @route   GET /api/groups/:groupId/metrics
 * @desc    Obtener todas las métricas de un grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 * @query   page, limit, semesterId, startDate, endDate, sortBy, sortOrder
 */
router.get(
  '/:groupId/metrics',
  [authJwt.hasRole(['admin', 'director', 'leader', 'reader'])],
  metricController.getMetricsByGroup
);

/**
 * @route   GET /api/groups/:groupId/metrics/stats
 * @desc    Obtener estadísticas de métricas del grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 * @query   period (month|quarter|semester), semesterId
 */
router.get(
  '/:groupId/metrics/stats',
  [authJwt.hasRole(['admin', 'director', 'leader', 'reader'])],
  metricController.getMetricStats
);

// =============================================================================
// RUTAS DE MÉTRICAS INDIVIDUALES
// =============================================================================

/**
 * @route   GET /api/metrics/:id
 * @desc    Obtener métrica por ID
 * @access  Private (Reader+)
 * @params  id - ID de la métrica
 */
router.get(
  '/metrics/:id',
  [authJwt.hasRole(['admin', 'director', 'leader', 'reader'])],
  metricController.getMetricById
);

/**
 * @route   PUT /api/metrics/:id
 * @desc    Actualizar métrica por ID
 * @access  Private (Leader+)
 * @params  id - ID de la métrica
 * @body    Datos a actualizar
 */
router.put(
  '/metrics/:id',
  [
    authJwt.hasRole(['admin', 'director', 'leader']),
    validate.validateMetricUpdate
  ],
  metricController.updateMetric
);

/**
 * @route   DELETE /api/metrics/:id
 * @desc    Eliminar métrica
 * @access  Private (Leader+)
 * @params  id - ID de la métrica
 */
router.delete(
  '/metrics/:id',
  [authJwt.hasRole(['admin', 'director', 'leader'])],
  metricController.deleteMetric
);

// =============================================================================
// RUTAS DE ANÁLISIS Y COMPARATIVAS
// =============================================================================

/**
 * @route   GET /api/metrics/compare/groups
 * @desc    Comparativa de métricas entre grupos
 * @access  Private (Director+)
 * @query   churchId, semesterId
 */
router.get(
  '/metrics/compare/groups',
  [authJwt.hasRole(['admin', 'director'])],
  metricController.compareGroupMetrics
);

/**
 * @route   GET /api/metrics/reports/trends
 * @desc    Reporte de tendencias de métricas
 * @access  Private (Director+)
 * @query   groupId, churchId, period, startDate, endDate
 */
router.get(
  '/metrics/reports/trends',
  [authJwt.hasRole(['admin', 'director'])],
  async (req, res) => {
    try {
      const { Metric, Group, Church, Semester } = require('../models');
      const { Op, Sequelize } = require('sequelize');
      const { groupId, churchId, period = 'month', startDate, endDate } = req.query;

      let dateRange = {};
      if (startDate && endDate) {
        dateRange = {
          recordDate: {
            [Op.between]: [new Date(startDate), new Date(endDate)]
          }
        };
      } else {
        // Por defecto últimos 6 meses
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        dateRange = {
          recordDate: { [Op.gte]: sixMonthsAgo }
        };
      }

      const include = [{
        model: Group,
        attributes: ['id', 'name', 'churchId'],
        include: [{
          model: Church,
          attributes: ['id', 'name']
        }]
      }];

      let where = { ...dateRange };

      // Filtros
      if (groupId) {
        where.groupId = groupId;
      }

      if (churchId) {
        include[0].where = { churchId };
      }

      // Para directores, filtrar por su iglesia
      if (req.userRole === 'director') {
        const { User } = require('../models');
        const userChurch = await User.findByPk(req.userId, {
          attributes: ['churchId']
        });
        include[0].where = { churchId: userChurch.churchId };
      }

      // Obtener métricas agrupadas por período
      let dateFormat;
      switch (period) {
        case 'week':
          dateFormat = 'YYYY-"W"WW';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'quarter':
          dateFormat = 'YYYY-Q';
          break;
        default:
          dateFormat = 'YYYY-MM';
      }

      const trends = await Metric.findAll({
        where,
        include,
        attributes: [
          [Sequelize.fn('TO_CHAR', Sequelize.col('record_date'), dateFormat), 'period'],
          [Sequelize.fn('AVG', Sequelize.col('weekly_attendance')), 'avgAttendance'],
          [Sequelize.fn('SUM', Sequelize.col('new_members')), 'totalNewMembers'],
          [Sequelize.fn('SUM', Sequelize.col('conversions')), 'totalConversions'],
          [Sequelize.fn('SUM', Sequelize.col('baptisms')), 'totalBaptisms'],
          [Sequelize.fn('COUNT', Sequelize.col('Metric.id')), 'recordCount']
        ],
        group: [Sequelize.fn('TO_CHAR', Sequelize.col('record_date'), dateFormat)],
        order: [[Sequelize.fn('TO_CHAR', Sequelize.col('record_date'), dateFormat), 'ASC']],
        raw: true
      });

      // Calcular crecimiento período a período
      const trendsWithGrowth = trends.map((trend, index) => {
        let attendanceGrowth = 0;
        if (index > 0) {
          const prevAttendance = parseFloat(trends[index - 1].avgAttendance);
          const currentAttendance = parseFloat(trend.avgAttendance);
          attendanceGrowth = prevAttendance > 0 
            ? ((currentAttendance - prevAttendance) / prevAttendance * 100).toFixed(1)
            : 0;
        }

        return {
          ...trend,
          avgAttendance: parseFloat(trend.avgAttendance).toFixed(1),
          attendanceGrowth: `${attendanceGrowth}%`
        };
      });

      res.json({
        success: true,
        message: 'Reporte de tendencias generado exitosamente',
        data: {
          period,
          trends: trendsWithGrowth,
          summary: {
            totalPeriods: trends.length,
            overallGrowth: trendsWithGrowth.length > 1 
              ? ((parseFloat(trendsWithGrowth[trendsWithGrowth.length - 1].avgAttendance) 
                  - parseFloat(trendsWithGrowth[0].avgAttendance)) 
                 / parseFloat(trendsWithGrowth[0].avgAttendance) * 100).toFixed(1) + '%'
              : '0%'
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// =============================================================================
// EXPORTAR ROUTER
// =============================================================================
module.exports = router;