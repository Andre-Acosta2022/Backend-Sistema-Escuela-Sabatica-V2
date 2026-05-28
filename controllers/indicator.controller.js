/**
 * INDICATOR.CONTROLLER.JS - Controlador Esbelto de Indicadores Espirituales
 * Sistema de Gestión Misionera
 */
const indicatorService = require('../services/indicator.service');
const logger = require('../utils/logger');
const { catchAsync, sendSuccess, sendPaginatedSuccess } = require('../middlewares/error.middleware');

const createIndicator = catchAsync(async (req, res) => {
  const { memberId } = req.params;
  const newIndicator = await indicatorService.createIndicator(memberId, req.body, req.userId, req.userRole);

  logger.info(`Indicador espiritual creado de manera exitosa`, {
    indicatorId: newIndicator.id,
    memberId,
    type: newIndicator.type,
    userId: req.userId
  });

  return sendSuccess(res, 'Indicador espiritual registrado exitosamente', newIndicator, 201);
});

const getIndicatorsByMember = catchAsync(async (req, res) => {
  const { memberId } = req.params;
  const { indicators, total, member } = await indicatorService.getIndicatorsByMember(memberId, req.query, req.userId, req.userRole);

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;

  // Adaptado a la respuesta de paginación extendida para la UI
  return res.json({
    success: true,
    message: 'Indicadores obtenidos exitosamente',
    data: {
      indicators,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      member: {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        group: member.Group.name,
        church: member.Group.Church.name
      }
    }
  });
});

const getIndicatorById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const indicator = await indicatorService.getIndicatorById(id, req.userId, req.userRole);

  return sendSuccess(res, 'Indicador obtenido exitosamente', indicator);
});

const updateIndicator = catchAsync(async (req, res) => {
  const { id } = req.params;
  const updatedIndicator = await indicatorService.updateIndicator(id, req.body, req.userId, req.userRole);

  logger.info(`Indicador espiritual actualizado id: ${id}`, {
    indicatorId: id,
    userId: req.userId
  });

  return sendSuccess(res, 'Indicador actualizado exitosamente', updatedIndicator);
});

const deleteIndicator = catchAsync(async (req, res) => {
  const { id } = req.params;
  const deletedIndicator = await indicatorService.deleteIndicator(id, req.userId, req.userRole);

  logger.info(`Registro de indicador eliminado: ${id}`, {
    indicatorId: id,
    type: deletedIndicator.type,
    userId: req.userId
  });

  return sendSuccess(res, 'Indicador eliminado exitosamente');
});

const getIndicatorStats = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { typeStats, memberStats, trends, overallAverage } = await indicatorService.getGroupStats(groupId, req.query);

  return sendSuccess(res, 'Métricas analíticas obtenidas exitosamente', {
    typeStatistics: typeStats,
    memberPerformance: memberStats.map(m => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      averageScore: parseFloat(m.averageScore).toFixed(1),
      indicatorCount: parseInt(m.indicatorCount, 10)
    })),
    monthlyTrends: trends.map(t => ({
      month: t.month,
      average: parseFloat(t.average).toFixed(1),
      count: parseInt(t.count, 10)
    })),
    overallAverage
  });
});

const bulkCreateIndicators = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { results, errors, total } = await indicatorService.bulkCreate(groupId, req.body, req.userId, req.userRole);

  logger.info(`Evaluación por lote consolidada para el grupo: ${groupId}`, {
    groupId,
    successCount: results.length,
    failedCount: errors.length,
    userId: req.userId
  });

  return res.status(results.length > 0 ? 201 : 400).json({
    success: results.length > 0,
    message: `Evaluación en bloque completada: ${results.length} creados, ${errors.length} fallidos`,
    data: {
      successful: results,
      errors: errors,
      summary: {
        total,
        successful: results.length,
        failed: errors.length
      }
    }
  });
});

module.exports = {
  createIndicator,
  getIndicatorsByMember,
  getIndicatorById,
  updateIndicator,
  deleteIndicator,
  getIndicatorStats,
  bulkCreateIndicators
};