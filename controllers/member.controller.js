/**
 * MEMBER.CONTROLLER.JS - Controlador delgado de Miembros
 * Sistema de Gestión Misionera
 */
const memberService = require('../services/member.service');
const groupService = require('../services/group.service'); // Asumiendo infraestructura existente para grupos
const { Group, User } = require('../models'); // Requerido únicamente para validaciones de contexto de permisos locales
const logger = require('../utils/logger');

/**
 * Helper interno para verificar autorización basada en contextos organizacionales
 */
const verifyAccessPermission = async (req, groupId) => {
  if (req.userRole === 'admin') return true;

  const group = await Group.findByPk(groupId, { attributes: ['id', 'leaderId', 'churchId'] });
  if (!group) return false;

  if (req.userRole === 'leader' && group.leaderId !== req.userId) {
    return false;
  }

  if (req.userRole === 'director') {
    const userChurch = await User.findByPk(req.userId, { attributes: ['churchId'] });
    if (group.churchId !== userChurch?.churchId) return false;
  }

  return true;
};

const createMember = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    const hasAccess = await verifyAccessPermission(req, groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para agregar miembros a este grupo' });
    }

    const newMember = await memberService.create(groupId, req.body);

    logger.info(`Miembro creado de forma exitosa en el grupo ID: ${groupId}`, { memberId: newMember.id, userId: req.userId });
    
    return res.status(201).json({
      success: true,
      message: 'Miembro creado exitosamente',
      data: newMember
    });
  } catch (error) {
    next(error);
  }
};

const getMembersByGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const hasAccess = await verifyAccessPermission(req, groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para ver los miembros de este grupo' });
    }

    const result = await memberService.getByGroup(groupId, req.query);
    
    return res.json({
      success: true,
      message: 'Miembros obtenidos exitosamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await memberService.getById(id);

    const hasAccess = await verifyAccessPermission(req, member.groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para visualizar este miembro' });
    }

    return res.json({
      success: true,
      message: 'Miembro obtenido exitosamente',
      data: member
    });
  } catch (error) {
    next(error);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetMember = await memberService.getById(id);

    const hasAccess = await verifyAccessPermission(req, targetMember.groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No tienes privilegios para editar este miembro' });
    }

    const updatedMember = await memberService.update(id, req.body);

    logger.info(`Miembro modificado de forma exitosa ID: ${id}`, { memberId: id, userId: req.userId });

    return res.json({
      success: true,
      message: 'Miembro actualizado exitosamente',
      data: updatedMember
    });
  } catch (error) {
    next(error);
  }
};

const deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    
    const targetMember = await memberService.getById(id);
    const hasAccess = await verifyAccessPermission(req, targetMember.groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No tienes privilegios para eliminar este miembro' });
    }

    if (permanent === 'true' && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo los administradores globales pueden ejecutar purgas permanentes' });
    }

    const output = await memberService.delete(id, permanent === 'true');

    if (output.permanent) {
      logger.warn(`Miembro purgado del almacenamiento persistente ID: ${id}`, { userId: req.userId });
    } else {
      logger.info(`Miembro dado de baja (Lógica) exitosamente ID: ${id}`, { userId: req.userId });
    }

    return res.json({
      success: true,
      message: output.permanent ? 'Miembro eliminado permanentemente de la base de datos' : 'Miembro desactivado exitosamente'
    });
  } catch (error) {
    next(error);
  }
};

const getMemberStats = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const hasAccess = await verifyAccessPermission(req, groupId);
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'No posees permisos para consultar métricas de este grupo' });
    }

    const stats = await memberService.getStats(groupId);

    return res.json({
      success: true,
      message: 'Métricas analíticas consolidadas obtenidas exitosamente',
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createMember,
  getMembersByGroup,
  getMemberById,
  updateMember,
  deleteMember,
  getMemberStats
};