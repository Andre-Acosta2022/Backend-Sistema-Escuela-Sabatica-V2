/**
 * USER.CONTROLLER.JS - Controlador de gestión de usuarios
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD de usuarios - Solo accesible por administradores
 * Incluye aprobación, activación/desactivación y gestión de roles
 */

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');

const User = db.User;
const Church = db.Church;
const Group = db.Group;

// =============================================
// LISTAR USUARIOS CON FILTROS Y PAGINACIÓN
// =============================================
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      churchId,
      isActive,
      isApproved,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros dinámicamente
    const whereClause = {};

    // Filtros específicos
    if (role && role !== 'all') {
      whereClause.role = role;
    }
    
    if (churchId && churchId !== 'all') {
      whereClause.churchId = parseInt(churchId);
    }

    if (isActive !== undefined && isActive !== 'all') {
      whereClause.isActive = isActive === 'true';
    }

    if (isApproved !== undefined && isApproved !== 'all') {
      whereClause.isApproved = isApproved === 'true';
    }

    // Búsqueda por texto
    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Validar campos de ordenación
    const validSortFields = ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLoginAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Consulta principal
    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'city', 'country']
      }],
      attributes: {
        exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry']
      },
      order: [[sortField, sortDirection]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    // Calcular información de paginación
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Formatear usuarios
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      churchId: user.churchId,
      church: user.church ? {
        id: user.church.id,
        name: user.church.name,
        city: user.church.city,
        country: user.church.country
      } : null,
      isActive: user.isActive,
      isApproved: user.isApproved,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    logger.info('Lista de usuarios obtenida', {
      adminId: req.user.id,
      filters: { role, churchId, isActive, isApproved, search },
      totalUsers: count,
      page: parseInt(page),
      limit: parseInt(limit),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Usuarios obtenidos exitosamente',
      data: {
        users: formattedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalUsers: count,
          usersPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        filters: {
          role: role || 'all',
          churchId: churchId || 'all',
          isActive: isActive || 'all',
          isApproved: isApproved || 'all',
          search: search || '',
          sortBy: sortField,
          sortOrder: sortDirection
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo lista de usuarios', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// OBTENER USUARIO POR ID
// =============================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'address', 'city', 'country', 'phone', 'email']
      }, {
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description', 'isActive'],
        where: { isActive: true },
        required: false
      }],
      attributes: {
        exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry']
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    const userDetails = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      churchId: user.churchId,
      church: user.church,
      groups: user.groups || [],
      isActive: user.isActive,
      isApproved: user.isApproved,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    logger.info('Detalles de usuario obtenidos', {
      adminId: req.user.id,
      targetUserId: user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Usuario obtenido exitosamente',
      user: userDetails
    });

  } catch (error) {
    logger.error('Error obteniendo usuario por ID', {
      error: error.message,
      userId: req.params?.id,
      adminId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// CREAR NUEVO USUARIO (ADMIN)
// =============================================
const createUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      churchId,
      isActive = true,
      isApproved = true
    } = req.body;

    // Validar iglesia si se especifica
    let church = null;
    if (churchId) {
      church = await Church.findByPk(churchId);
      if (!church || !church.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Iglesia no encontrada o inactiva',
          error: 'INVALID_CHURCH'
        });
      }
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role,
      churchId: churchId || null,
      isActive,
      isApproved
    }, { transaction });

    await transaction.commit();

    // Log de creación
    logger.info('Usuario creado por administrador', {
      adminId: req.user.id,
      newUserId: user.id,
      email: user.email,
      role: user.role,
      churchId: user.churchId,
      ip: req.ip
    });

    // Respuesta sin contraseña
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      churchId: user.churchId,
      church: church ? { id: church.id, name: church.name } : null,
      isActive: user.isActive,
      isApproved: user.isApproved,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: userResponse
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error creando usuario', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id,
      email: req.body?.email,
      ip: req.ip
    });

    // Errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// ACTUALIZAR USUARIO
// =============================================
const updateUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      email,
      firstName,
      lastName,
      phone,
      role,
      churchId,
      isActive,
      isApproved,
      password
    } = req.body;

    // Buscar usuario
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Verificar que no se está auto-desactivando
    if (user.id === req.user.id && isActive === false) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propia cuenta',
        error: 'CANNOT_SELF_DEACTIVATE'
      });
    }

    // Validar iglesia si se especifica
    let church = null;
    if (churchId && churchId !== user.churchId) {
      church = await Church.findByPk(churchId);
      if (!church || !church.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Iglesia no encontrada o inactiva',
          error: 'INVALID_CHURCH'
        });
      }
    }

    // Preparar datos de actualización
    const updateData = {};
    if (email !== undefined && email !== user.email) updateData.email = email.trim().toLowerCase();
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (role !== undefined && role !== user.role) updateData.role = role;
    if (churchId !== undefined) updateData.churchId = churchId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (isApproved !== undefined) updateData.isApproved = isApproved;

    // Hash nueva contraseña si se proporciona
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password.trim(), 12);
      updateData.passwordChangedAt = new Date();
    }

    // Actualizar usuario
    await user.update(updateData, { transaction });
    await transaction.commit();

    // Log de actualización
    logger.info('Usuario actualizado por administrador', {
      adminId: req.user.id,
      targetUserId: user.id,
      updatedFields: Object.keys(updateData),
      ip: req.ip
    });

    // Obtener usuario actualizado con relaciones
    const updatedUser = await User.findByPk(id, {
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'city', 'country']
      }],
      attributes: {
        exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry']
      }
    });

    const userResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      fullName: `${updatedUser.firstName} ${updatedUser.lastName}`,
      phone: updatedUser.phone,
      role: updatedUser.role,
      churchId: updatedUser.churchId,
      church: updatedUser.church,
      isActive: updatedUser.isActive,
      isApproved: updatedUser.isApproved,
      lastLoginAt: updatedUser.lastLoginAt,
      passwordChangedAt: updatedUser.passwordChangedAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    };

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: userResponse,
      updatedFields: Object.keys(updateData)
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error actualizando usuario', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id,
      targetUserId: req.params?.id,
      ip: req.ip
    });

    // Errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'El email ya está en uso por otro usuario',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// APROBAR/RECHAZAR USUARIO
// =============================================
const approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { isApproved, reason } = req.body;

    // Buscar usuario
    const user = await User.findByPk(id, {
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name']
      }],
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isApproved', 'isActive']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Verificar que no está ya aprobado/rechazado
    if (user.isApproved === isApproved) {
      const status = isApproved ? 'aprobado' : 'rechazado';
      return res.status(400).json({
        success: false,
        message: `El usuario ya está ${status}`,
        error: 'ALREADY_PROCESSED'
      });
    }

    // Actualizar estado
    await user.update({
      isApproved,
      approvedAt: isApproved ? new Date() : null,
      approvedBy: req.user.id,
      rejectionReason: !isApproved ? reason : null
    });

    // Log de la acción
    const action = isApproved ? 'aprobado' : 'rechazado';
    logger.info(`Usuario ${action} por administrador`, {
      adminId: req.user.id,
      targetUserId: user.id,
      targetEmail: user.email,
      isApproved,
      reason: reason || null,
      ip: req.ip
    });

    // TODO: Enviar email de notificación al usuario
    // if (isApproved) {
    //   await emailService.sendApprovalEmail(user.email, user.firstName);
    // } else {
    //   await emailService.sendRejectionEmail(user.email, user.firstName, reason);
    // }

    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      church: user.church,
      isActive: user.isActive,
      isApproved: user.isApproved,
      approvedAt: user.approvedAt,
      rejectionReason: user.rejectionReason
    };

    res.json({
      success: true,
      message: `Usuario ${action} exitosamente`,
      user: userResponse,
      action: isApproved ? 'approved' : 'rejected'
    });

  } catch (error) {
    logger.error('Error aprobando/rechazando usuario', {
      error: error.message,
      adminId: req.user?.id,
      targetUserId: req.params?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// ELIMINAR USUARIO (SOFT DELETE)
// =============================================
const deleteUser = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Buscar usuario
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Verificar que no se está auto-eliminando
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propia cuenta',
        error: 'CANNOT_SELF_DELETE'
      });
    }

    // Verificar si tiene grupos asignados (si es líder)
    if (user.role === 'leader') {
      const groupCount = await Group.count({
        where: { leaderId: user.id, isActive: true }
      });

      if (groupCount > 0 && !force) {
        return res.status(400).json({
          success: false,
          message: `El usuario tiene ${groupCount} grupo(s) activo(s) asignado(s). Use force=true para eliminar de todas formas`,
          error: 'USER_HAS_ACTIVE_GROUPS',
          groupCount
        });
      }

      // Si force=true, desasignar grupos
      if (groupCount > 0 && force) {
        await Group.update(
          { leaderId: null },
          { where: { leaderId: user.id }, transaction }
        );
      }
    }

    // Soft delete (desactivar)
    await user.update({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: req.user.id
    }, { transaction });

    await transaction.commit();

    logger.info('Usuario eliminado por administrador', {
      adminId: req.user.id,
      targetUserId: user.id,
      targetEmail: user.email,
      force: force,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        isActive: false,
        deletedAt: user.deletedAt
      }
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error eliminando usuario', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?.id,
      targetUserId: req.params?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// RESTABLECER CONTRASEÑA DE USUARIO (ADMIN)
// =============================================
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    // Buscar usuario
    const user = await User.findByPk(id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'password']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Hash nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await user.update({
      password: hashedPassword,
      passwordChangedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordExpiry: null
    });

    logger.info('Contraseña restablecida por administrador', {
      adminId: req.user.id,
      targetUserId: user.id,
      targetEmail: user.email,
      ip: req.ip
    });

    // TODO: Enviar email al usuario notificando el cambio
    // await emailService.sendPasswordResetByAdminEmail(user.email, user.firstName);

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      user: {
        id: user.id,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        passwordChangedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error restableciendo contraseña', {
      error: error.message,
      adminId: req.user?.id,
      targetUserId: req.params?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// ESTADÍSTICAS DE USUARIOS
// =============================================
const getUserStats = async (req, res) => {
  try {
    // Estadísticas generales
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const approvedUsers = await User.count({ where: { isApproved: true } });
    const pendingApproval = await User.count({ where: { isApproved: false, isActive: true } });

    // Estadísticas por rol
    const roleStats = await User.findAll({
      attributes: [
        'role',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: { isActive: true },
      group: ['role'],
      raw: true
    });

    // Estadísticas por iglesia
    const churchStats = await User.findAll({
      attributes: [
        [db.sequelize.col('church.name'), 'churchName'],
        [db.sequelize.fn('COUNT', db.sequelize.col('User.id')), 'count']
      ],
      include: [{
        model: Church,
        as: 'church',
        attributes: []
      }],
      where: { isActive: true },
      group: ['church.id', 'church.name'],
      raw: true
    });

    // Usuarios registrados por mes (últimos 12 meses)
    const monthlyRegistrations = await User.findAll({
      attributes: [
        [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'month'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: {
          [Op.gte]: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        }
      },
      group: [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt'))],
      order: [[db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Últimos logins (usuarios activos recientes)
    const recentLogins = await User.count({
      where: {
        lastLoginAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
        },
        isActive: true
      }
    });

    logger.info('Estadísticas de usuarios obtenidas', {
      adminId: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      stats: {
        general: {
          totalUsers,
          activeUsers,
          approvedUsers,
          pendingApproval,
          inactiveUsers: totalUsers - activeUsers,
          recentLogins
        },
        byRole: roleStats.reduce((acc, stat) => {
          acc[stat.role] = parseInt(stat.count);
          return acc;
        }, {}),
        byChurch: churchStats.reduce((acc, stat) => {
          acc[stat.churchName || 'Sin iglesia'] = parseInt(stat.count);
          return acc;
        }, {}),
        monthlyRegistrations: monthlyRegistrations.map(stat => ({
          month: stat.month,
          count: parseInt(stat.count)
        }))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de usuarios', {
      error: error.message,
      adminId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// EXPORTAR CONTROLADOR
// =============================================
module.exports = {
  // CRUD básico
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  
  // Acciones especiales
  approveUser,
  resetUserPassword,
  
  // Estadísticas
  getUserStats
};