/**
 * METRIC.CONTROLLER.JS - Controlador Esbelto de Métricas del Sistema
 * Sistema de Gestión Misionera
 */
const metricService = require('../services/metric.service');
const logger = require('../utils/logger');
const { catchAsync, sendSuccess } = require('../middlewares/error.middleware');

const createMetric = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const newMetric = await metricService.createMetric(groupId, req.body, req.userId, req.userRole);

  logger.info(`Nueva métrica registrada para el grupo ID: ${groupId}`, {
    metricId: newMetric.id,
    groupId,
    userId: req.userId
  });

  return sendSuccess(res, 'Métrica registrada exitosamente', newMetric, 201);
});

const getMetricsByGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { metrics, total, group } = await metricService.getMetricsByGroup(groupId, req.query, req.userId, req.userRole);

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  return res.json({
    success: true,
    message: 'Métricas obtenidas exitosamente',
    data: {
      metrics,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      group: {
        id: group.id,
        name: group.name,
        church: group.Church.name
      }
    }
  });
});

const getMetricById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const metric = await metricService.getMetricById(id, req.userId, req.userRole);

  return sendSuccess(res, 'Métrica obtenida exitosamente', metric);
});

const updateMetric = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedMetric = await metricService.updateMetric(id, req.body, req.userId, req.userRole);

  logger.info(`Métrica modificada ID: ${id}`, {
    metricId: id,
    userId: req.userId
  });

  return sendSuccess(res, 'Métrica actualizada exitosamente', updatedMetric);
});

const deleteMetric = catchAsync(async (req, res) => {
  const { id } = req.params;
  await metricService.deleteMetric(id, req.userId, req.userRole);

  logger.info(`Registro de métrica purgado ID: ${id}`, {
    metricId: id,
    userId: req.userId
  });

  return sendSuccess(res, 'Métrica eliminada exitosamente');
});

const getMetricStats = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const stats = await metricService.getMetricStats(groupId, req.query);

  return sendSuccess(res, 'Estadísticas e informes obtenidos exitosamente', {
    totalRecords: stats.totalRecords,
    period: req.query.period || 'semester',
    averages: stats.averages,
    totals: stats.totals,
    trends: stats.trends,
    recentMetrics: stats.recentMetrics,
    highestAttendance: stats.highestAttendance,
    lowestAttendance: stats.lowestAttendance
  });
});

const compareGroupMetrics = catchAsync(async (req, res) => {
  const comparison = await metricService.compareGroupMetrics(req.query, req.userId, req.userRole);

  return sendSuccess(res, 'Comparativa de crecimiento intergrupal generada', {
    totalGroups: comparison.length,
    comparison,
    summary: {
      totalAttendance: comparison.reduce((sum, g) => sum + g.averageAttendance, 0),
      totalConversions: comparison.reduce((sum, g) => sum + g.totalConversions, 0),
      totalBaptisms: comparison.reduce((sum, g) => sum + g.totalBaptisms, 0)
    }
  });
});

module.exports = {
  createMetric,
  getMetricsByGroup,
  getMetricById,
  updateMetric,
  deleteMetric,
  getMetricStats,
  compareGroupMetrics
};