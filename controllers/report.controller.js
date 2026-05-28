/**
 * REPORT.CONTROLLER.JS - Controlador de reportes consolidados y analíticos
 * Sistema de Gestión Misionera
 */
const reportService = require('../services/report.service');
const logger = require('../utils/logger');

/**
 * Helper interno para estandarizar la extracción segura del usuario autenticado
 */
const getAuthUser = (req) => ({
  id: req.userId || req.user?.id,
  firstName: req.userFirstName || req.user?.firstName || 'Usuario',
  lastName: req.userLastName || req.user?.lastName || 'Sistema',
  role: req.userRole || req.user?.role,
  churchId: req.user?.churchId
});

// =============================================================================
// REPORTES OPERATIVOS / DETALLADOS
// =============================================================================

const getGroupReport = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const authUser = getAuthUser(req);

    const report = await reportService.getGroupReportData(groupId, req.query, authUser);

    logger.info(`Reporte operativo de grupo generado ID: ${groupId}`, { groupId, userId: authUser.id });

    return res.json({
      success: true,
      message: 'Reporte de grupo detallado generado exitosamente',
      data: report
    });
  } catch (error) {
    logger.error('Error al generar reporte consolidado de grupo:', error);
    next(error); 
  }
};

const getChurchReport = async (req, res, next) => {
  try {
    const { churchId } = req.params;
    const authUser = getAuthUser(req);

    const report = await reportService.getChurchReportData(churchId, req.query, authUser);

    logger.info(`Reporte operativo de iglesia generado ID: ${churchId}`, { churchId, userId: authUser.id });

    return res.json({
      success: true,
      message: 'Reporte de iglesia estructurado generado exitosamente',
      data: report
    });
  } catch (error) {
    logger.error('Error al generar reporte de iglesia:', error);
    next(error);
  }
};

const getComparativeReport = async (req, res, next) => {
  try {
    const { groupIds } = req.body;
    const { semesterId } = req.query;
    const authUser = getAuthUser(req);

    const report = await reportService.getComparativeReportData(groupIds, semesterId, authUser);

    logger.info(`Reporte comparativo multidimensional generado para ${groupIds?.length} grupos`, { userId: authUser.id, groupIds });

    return res.json({
      success: true,
      message: 'Reporte comparativo generado exitosamente',
      data: report
    });
  } catch (error) {
    logger.error('Error al generar reporte comparativo:', error);
    next(error);
  }
};

// =============================================================================
// MÉTODOS ADICIONALES (AÑADIDOS: REPORTES ANALÍTICOS Y CONSOLIDADOS)
// =============================================================================

const getChurchConsolidated = async (req, res, next) => {
  try {
    const { churchId } = req.params;
    const authUser = getAuthUser(req);

    const report = await reportService.getChurchConsolidatedReport(churchId, req.query);

    logger.info(`Consolidado analítico de iglesia generado para ID: ${churchId}`, { churchId, userId: authUser.id });
    return res.json(report); // El service ya retorna con formato responseHelpers.success
  } catch (error) {
    logger.error('Error al generar reporte consolidado analítico de iglesia:', error);
    next(error);
  }
};

const getGroupDetailed = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const authUser = getAuthUser(req);

    const report = await reportService.getGroupDetailedReport(groupId, req.query);

    logger.info(`Reporte analítico de historial de grupo generado para ID: ${groupId}`, { groupId, userId: authUser.id });
    return res.json(report);
  } catch (error) {
    logger.error('Error al generar reporte detallado analítico de grupo:', error);
    next(error);
  }
};

const getEvangelismComparative = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);

    const report = await reportService.getEvangelismComparativeReport(req.query);

    logger.info(`Reporte comparativo de evangelismo nacional/regional ejecutado`, { userId: authUser.id });
    return res.json(report);
  } catch (error) {
    logger.error('Error al generar reporte comparativo de evangelismo:', error);
    next(error);
  }
};

const getSpiritualAudit = async (req, res, next) => {
  try {
    const authUser = getAuthUser(req);

    const report = await reportService.getSpiritualAuditReport(req.query);

    logger.info(`Auditoría de indicadores espirituales ejecutada exitosamente`, { userId: authUser.id });
    return res.json(report);
  } catch (error) {
    logger.error('Error al generar reporte de auditoría espiritual:', error);
    next(error);
  }
};

const getSemesterHistorical = async (req, res, next) => {
  try {
    const { semesterId } = req.params;
    const authUser = getAuthUser(req);

    const report = await reportService.getSemesterHistoricalReport(semesterId);

    logger.info(`Cierre histórico de semestre generado para ID: ${semesterId}`, { semesterId, userId: authUser.id });
    return res.json(report);
  } catch (error) {
    logger.error('Error al generar reporte histórico del semestre:', error);
    next(error);
  }
};

module.exports = {
  getGroupReport,
  getChurchReport,
  getComparativeReport,
  
  // Nuevos expuestos correctamente
  getChurchConsolidated,
  getGroupDetailed,
  getEvangelismComparative,
  getSpiritualAudit,
  getSemesterHistorical
};