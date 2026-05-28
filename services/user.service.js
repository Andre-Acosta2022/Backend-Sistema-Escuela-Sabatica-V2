/**
 * USER.SERVICE.JS - Lógica de Negocio Centralizada de Usuarios
 * Sistema de Gestión Misionera
 */

const { Op, Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const db = require('../models');
const { 
  NotFoundError, 
  ValidationError, 
  ConflictError 
} = require('../middlewares/error.middleware');

const User = db.User;
const Church = db.Church;
const Group = db.Group;

class UserService {

  async getAllUsers(query) {
    const {
      page = 1, limit = 10, role, churchId,
      isActive, isApproved, search,
      sortBy = 'createdAt', sortOrder = 'DESC'
    } = query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const whereClause = {};

    if (role && role !== 'all') whereClause.role = role;
    if (churchId && churchId !== 'all') whereClause.churchId = parseInt(churchId);
    if (isActive !== undefined && isActive !== 'all') whereClause.isActive = isActive === 'true';
    if (isApproved !== undefined && isApproved !== 'all') whereClause.isApproved = isApproved === 'true';

    if (search) {
      whereClause[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const validSortFields = ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt', 'lastLoginAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      include: [{ model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }],
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry'] },
      order: [[sortField, sortDirection]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / parseInt(limit));

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      churchId: user.churchId,
      church: user.church,
      isActive: user.isActive,
      isApproved: user.isApproved,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }));

    return {
      users: formattedUsers,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers: count,
        usersPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
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
    };
  }

  async getUserById(id) {
    const user = await User.findByPk(id, {
      include: [
        { model: Church, as: 'church', attributes: ['id', 'name', 'address', 'city', 'country', 'phone', 'email'] },
        { model: Group, as: 'groups', attributes: ['id', 'name', 'description', 'isActive'], where: { isActive: true }, required: false }
      ],
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry'] }
    });

    if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');

    return {
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
  }

  async createUser(userData) {
    if (userData.email) {
      const emailExists = await User.findOne({ where: { email: userData.email.toLowerCase() } });
      if (emailExists) throw new ConflictError('El email ya está registrado', 'EMAIL_ALREADY_EXISTS');
    }

    if (userData.churchId) {
      const church = await Church.findByPk(userData.churchId);
      if (!church || !church.isActive) throw new ValidationError('Iglesia no encontrada o inactiva', 'INVALID_CHURCH');
    }

    return await db.sequelize.transaction(async (t) => {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = await User.create({
        ...userData,
        email: userData.email.trim().toLowerCase(),
        password: hashedPassword,
        isActive: userData.isActive !== undefined ? userData.isActive : true,
        isApproved: userData.isApproved !== undefined ? userData.isApproved : true
      }, { transaction: t });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        churchId: user.churchId,
        isActive: user.isActive,
        isApproved: user.isApproved,
        createdAt: user.createdAt
      };
    });
  }

  async updateUser(id, updates, currentUserId) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');

    if (user.id === currentUserId && updates.isActive === false) {
      throw new ValidationError('No puedes desactivar tu propia cuenta', 'CANNOT_SELF_DEACTIVATE');
    }

    if (updates.churchId && updates.churchId !== user.churchId) {
      const church = await Church.findByPk(updates.churchId);
      if (!church || !church.isActive) throw new ValidationError('Iglesia no encontrada o inactiva', 'INVALID_CHURCH');
    }

    if (updates.email && updates.email.toLowerCase() !== user.email) {
      const emailExists = await User.findOne({ where: { email: updates.email.toLowerCase(), id: { [Op.ne]: id } } });
      if (emailExists) throw new ConflictError('El email ya está en uso por otro usuario', 'EMAIL_ALREADY_EXISTS');
    }

    return await db.sequelize.transaction(async (t) => {
      const updateData = { ...updates };
      if (updates.email) updateData.email = updates.email.trim().toLowerCase();
      if (updates.firstName) updateData.firstName = updates.firstName.trim();
      if (updates.lastName) updateData.lastName = updates.lastName.trim();

      if (updates.password && updates.password.trim()) {
        updateData.password = await bcrypt.hash(updates.password.trim(), 12);
        updateData.passwordChangedAt = new Date();
      }

      await user.update(updateData, { transaction: t });
      return await this.getUserById(id);
    });
  }

  async approveUser(id, approvalData, adminId) {
    const { isApproved, reason } = approvalData;

    const user = await User.findByPk(id);
    if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');

    if (user.isApproved === isApproved) {
      const status = isApproved ? 'aprobado' : 'rechazado';
      throw new ValidationError(`El usuario ya está ${status}`, 'ALREADY_PROCESSED');
    }

    await user.update({
      isApproved,
      approvedAt: isApproved ? new Date() : null,
      approvedBy: adminId,
      rejectionReason: !isApproved ? reason : null
    });

    return user;
  }

  async deleteUser(id, force, adminId) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');

    if (user.id === adminId) {
      throw new ValidationError('No puedes eliminar tu propia cuenta', 'CANNOT_SELF_DELETE');
    }

    return await db.sequelize.transaction(async (t) => {
      if (user.role === 'leader') {
        const groupCount = await Group.count({ where: { leaderId: user.id, isActive: true }, transaction: t });

        if (groupCount > 0 && force !== 'true') {
          throw new ValidationError(`El usuario tiene ${groupCount} grupo(s) activo(s) asignado(s). Use force=true`, 'USER_HAS_ACTIVE_GROUPS');
        }

        if (groupCount > 0 && force === 'true') {
          await Group.update({ leaderId: null }, { where: { leaderId: user.id }, transaction: t });
        }
      }

      await user.update({
        isActive: false,
        deletedAt: new Date(),
        deletedBy: adminId
      }, { transaction: t });

      return {
        id: user.id,
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        isActive: false,
        deletedAt: user.deletedAt
      };
    });
  }

  async resetUserPassword(id, newPassword) {
    const user = await User.findByPk(id);
    if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND');

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await user.update({
      password: hashedPassword,
      passwordChangedAt: new Date(),
      resetPasswordToken: null,
      resetPasswordExpiry: null
    });

    return {
      id: user.id,
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      passwordChangedAt: user.passwordChangedAt
    };
  }

  async getUserStats() {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const approvedUsers = await User.count({ where: { isApproved: true } });
    const pendingApproval = await User.count({ where: { isApproved: false, isActive: true } });

    const roleStats = await User.findAll({
      attributes: ['role', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      where: { isActive: true },
      group: ['role'],
      raw: true
    });

    const churchStats = await User.findAll({
      attributes: [
        [db.sequelize.col('church.name'), 'churchName'],
        [db.sequelize.fn('COUNT', db.sequelize.col('User.id')), 'count']
      ],
      include: [{ model: Church, as: 'church', attributes: [] }],
      where: { isActive: true },
      group: ['church.id', 'church.name'],
      raw: true
    });

    const monthlyRegistrations = await User.findAll({
      attributes: [
        [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'month'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: {
        createdAt: { [Op.gte]: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) }
      },
      group: [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt'))],
      order: [[db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    const recentLogins = await User.count({
      where: {
        lastLoginAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        isActive: true
      }
    });

    return {
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
    };
  }
}

module.exports = new UserService();