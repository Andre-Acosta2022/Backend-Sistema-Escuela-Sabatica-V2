/**
 * USER.CONTROLLER.JS - Controlador Delgado de Gestión de Usuarios
 * Sistema de Gestión Misionera
 */

const userService = require('../services/user.service');
const logger = require('../utils/logger');
const { catchAsync, sendSuccess } = require('../middlewares/error.middleware');

const getAllUsers = catchAsync(async (req, res) => {
  const result = await userService.getAllUsers(req.query);
  
  logger.info('Lista de usuarios obtenida por administrador', { adminId: req.user.id, ip: req.ip });
  
  // Usamos sendSuccess estructurado de tus helpers globales
  return sendSuccess(res, result, 'Usuarios obtenidos exitosamente');
});

const getUserById = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  
  logger.info('Detalles de usuario obtenidos por administrador', { adminId: req.user.id, targetUserId: req.params.id });
  return sendSuccess(res, user, 'Usuario obtenido exitosamente');
});

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);

  logger.info('Usuario creado por administrador', { adminId: req.user.id, newUserId: user.id, email: user.email });
  return sendSuccess(res, user, 'Usuario creado exitosamente', 201);
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user.id);

  logger.info('Usuario actualizado por administrador', { adminId: req.user.id, targetUserId: req.params.id });
  return sendSuccess(res, user, 'Usuario actualizado exitosamente');
});

const approveUser = catchAsync(async (req, res) => {
  const user = await userService.approveUser(req.params.id, req.body, req.user.id);
  const action = req.body.isApproved ? 'aprobado' : 'rechazado';

  logger.info(`Usuario ${action} por administrador`, { adminId: req.user.id, targetUserId: req.params.id });
  return sendSuccess(res, user, `Usuario ${action} exitosamente`);
});

const deleteUser = catchAsync(async (req, res) => {
  const { force = false } = req.query;
  const result = await userService.deleteUser(req.params.id, force, req.user.id);

  logger.info('Usuario eliminado por administrador', { adminId: req.user.id, targetUserId: req.params.id, force });
  return sendSuccess(res, result, 'Usuario eliminado exitosamente');
});

const resetUserPassword = catchAsync(async (req, res) => {
  const result = await userService.resetUserPassword(req.params.id, req.body.newPassword);

  logger.info('Contraseña restablecida por administrador', { adminId: req.user.id, targetUserId: req.params.id });
  return sendSuccess(res, result, 'Contraseña restablecida exitosamente');
});

const getUserStats = catchAsync(async (req, res) => {
  const stats = await userService.getUserStats();
  
  logger.info('Estadísticas de usuarios obtenidas', { adminId: req.user.id });
  return sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente');
});

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  approveUser,
  deleteUser,
  resetUserPassword,
  getUserStats
};