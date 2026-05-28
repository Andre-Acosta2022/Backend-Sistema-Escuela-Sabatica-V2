/**
 * CHURCH.CONTROLLER.JS - Controlador de gestión de iglesias
 * Sistema de Gestión Misionera
 */

const churchService = require('../services/church.service');
const logger = require('../utils/logger');

const getAllChurches = async (req, res) => {
  try {
    const data = await churchService.findAll(req.query);

    logger.info('Lista de iglesias obtenida', {
      userId: req.user.id,
      userRole: req.user.role,
      filters: req.query,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Iglesias obtenidas exitosamente',
      data
    });
  } catch (error) {
    logger.error('Error obteniendo lista de iglesias', { error: error.message, stack: error.stack, userId: req.user?.id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

const getChurchById = async (req, res) => {
  try {
    const church = await churchService.findById(req.params.id, req.query);

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Iglesia no encontrada',
        error: 'CHURCH_NOT_FOUND'
      });
    }

    logger.info('Detalles de iglesia obtenidos', { userId: req.user.id, churchId: req.params.id, ip: req.ip });
    res.json({ success: true, message: 'Iglesia obtenida exitosamente', church });
  } catch (error) {
    logger.error('Error obteniendo iglesia por ID', { error: error.message, churchId: req.params?.id, userId: req.user?.id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

const createChurch = async (req, res) => {
  try {
    const church = await churchService.create(req.body, req.user.id);

    logger.info('Iglesia creada exitosamente', { userId: req.user.id, churchId: church.id, churchName: church.name, ip: req.ip });
    
    res.status(201).json({
      success: true,
      message: 'Iglesia creada exitosamente',
      church
    });
  } catch (error) {
    logger.error('Error creando iglesia', { error: error.message, stack: error.stack, userId: req.user?.id, ip: req.ip });

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: `Ya existe una iglesia con ese ${error.errors[0].path === 'email' ? 'email' : 'nombre'}`,
        error: 'DUPLICATE_VALUE',
        field: error.errors[0].path
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({ field: err.path, message: err.message }))
      });
    }

    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

const updateChurch = async (req, res) => {
  try {
    const result = await churchService.update(req.params.id, req.body, req.user.id);

    if (result.status === 404) {
      return res.status(404).json({ success: false, message: 'Iglesia no encontrada', error: result.message });
    }

    if (result.status === 400) {
      return res.status(400).json({
        success: false,
        message: `No se puede desactivar la iglesia porque tiene ${result.dependencies.activeUsers} usuario(s) y ${result.dependencies.activeGroups} grupo(s) activo(s)`,
        error: result.message,
        dependencies: result.dependencies
      });
    }

    logger.info('Iglesia actualizada exitosamente', { userId: req.user.id, churchId: req.params.id, updatedFields: result.updatedFields, ip: req.ip });

    res.json({
      success: true,
      message: 'Iglesia actualizada exitosamente',
      church: result.church,
      updatedFields: result.updatedFields
    });
  } catch (error) {
    logger.error('Error actualizando iglesia', { error: error.message, stack: error.stack, userId: req.user?.id, churchId: req.params?.id, ip: req.ip });

    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: `Ya existe una iglesia con ese ${error.errors[0].path === 'email' ? 'email' : 'nombre'}`,
        error: 'DUPLICATE_VALUE',
        field: error.errors[0].path
      });
    }

    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

const deleteChurch = async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await churchService.remove(req.params.id, force, req.user.id);

    if (result.status === 404) {
      return res.status(404).json({ success: false, message: 'Iglesia no encontrada', error: result.message });
    }

    if (result.status === 400) {
      return res.status(400).json({
        success: false,
        message: `La iglesia tiene ${result.dependencies.activeUsers} usuario(s) y ${result.dependencies.activeGroups} grupo(s) activo(s). Use force=true para eliminar de todas formas`,
        error: result.message,
        dependencies: result.dependencies
      });
    }

    logger.info('Iglesia eliminada exitosamente', { 
      userId: req.user.id, 
      churchId: req.params.id, 
      force, 
      ip: req.ip 
    });

    res.json({
      success: true,
      message: 'Iglesia eliminada exitosamente',
      church: result.church,
      affectedRecords: result.affectedRecords
    });
  } catch (error) {
    logger.error('Error eliminando iglesia', { error: error.message, stack: error.stack, userId: req.user?.id, churchId: req.params?.id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

const getChurchStats = async (req, res) => {
  try {
    const stats = await churchService.getStats();

    logger.info('Estadísticas de iglesias obtenidas', { userId: req.user.id, ip: req.ip });
    res.json({ success: true, message: 'Estadísticas obtenidas exitosamente', stats });
  } catch (error) {
    logger.error('Error obteniendo estadísticas de iglesias', { error: error.message, userId: req.user?.id, ip: req.ip });
    res.status(500).json({ success: false, message: 'Error interno del servidor', error: 'INTERNAL_ERROR' });
  }
};

module.exports = {
  getAllChurches,
  getChurchById,
  createChurch,
  updateChurch,
  deleteChurch,
  getChurchStats
};