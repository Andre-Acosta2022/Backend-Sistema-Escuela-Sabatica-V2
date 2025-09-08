/**
 * CHURCH.CONTROLLER.JS - Controlador de gestión de iglesias
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD de iglesias - Accesible por admin y directores
 * Incluye gestión de usuarios y grupos asociados
 */

const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');

const Church = db.Church;
const User = db.User;
const Group = db.Group;

// =============================================
// LISTAR IGLESIAS CON FILTROS Y PAGINACIÓN
// =============================================
const getAllChurches = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      isActive,
      country,
      city,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      includeStats = false
    } = req.query;

    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros
    const whereClause = {};

    if (isActive !== undefined && isActive !== 'all') {
      whereClause.isActive = isActive === 'true';
    }

    if (country && country !== 'all') {
      whereClause.country = { [Op.iLike]: `%${country}%` };
    }

    if (city && city !== 'all') {
      whereClause.city = { [Op.iLike]: `%${city}%` };
    }

    // Búsqueda por texto
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { address: { [Op.iLike]: `%${search}%` } },
        { city: { [Op.iLike]: `%${search}%` } },
        { country: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Validar campos de ordenación
    const validSortFields = ['id', 'name', 'city', 'country', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Incluir estadísticas si se solicita
    const include = [];
    const attributes = { exclude: [] };

    if (includeStats === 'true') {
      // Agregar conteos como atributos virtuales
      attributes.include = [
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "Users" WHERE "Users"."churchId" = "Church"."id" AND "Users"."isActive" = true)'),
          'userCount'
        ],
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "Groups" WHERE "Groups"."churchId" = "Church"."id" AND "Groups"."isActive" = true)'),
          'groupCount'
        ]
      ];
    }

    // Consulta principal
    const { count, rows: churches } = await Church.findAndCountAll({
      where: whereClause,
      include,
      attributes,
      order: [[sortField, sortDirection]],
      limit: parseInt(limit),
      offset: offset,
      distinct: true
    });

    // Calcular información de paginación
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Formatear iglesias
    const formattedChurches = churches.map(church => {
      const churchData = {
        id: church.id,
        name: church.name,
        address: church.address,
        city: church.city,
        country: church.country,
        phone: church.phone,
        email: church.email,
        website: church.website,
        description: church.description,
        isActive: church.isActive,
        createdAt: church.createdAt,
        updatedAt: church.updatedAt
      };

      // Agregar estadísticas si se solicitaron
      if (includeStats === 'true') {
        churchData.stats = {
          userCount: parseInt(church.dataValues.userCount || 0),
          groupCount: parseInt(church.dataValues.groupCount || 0)
        };
      }

      return churchData;
    });

    logger.info('Lista de iglesias obtenida', {
      userId: req.user.id,
      userRole: req.user.role,
      filters: { isActive, country, city, search },
      totalChurches: count,
      page: parseInt(page),
      limit: parseInt(limit),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Iglesias obtenidas exitosamente',
      data: {
        churches: formattedChurches,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalChurches: count,
          churchesPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        filters: {
          isActive: isActive || 'all',
          country: country || 'all',
          city: city || 'all',
          search: search || '',
          sortBy: sortField,
          sortOrder: sortDirection,
          includeStats: includeStats === 'true'
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo lista de iglesias', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
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
// OBTENER IGLESIA POR ID
// =============================================
const getChurchById = async (req, res) => {
  try {
    const { id } = req.params;
    const { includeUsers = false, includeGroups = false } = req.query;

    const include = [];

    // Incluir usuarios si se solicita
    if (includeUsers === 'true') {
      include.push({
        model: User,
        as: 'users',
        attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'isApproved', 'lastLoginAt'],
        where: { isActive: true },
        required: false
      });
    }

    // Incluir grupos si se solicita
    if (includeGroups === 'true') {
      include.push({
        model: Group,
        as: 'groups',
        attributes: ['id', 'name', 'description', 'isActive', 'createdAt'],
        include: [{
          model: User,
          as: 'leader',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }],
        where: { isActive: true },
        required: false
      });
    }

    const church = await Church.findByPk(id, { include });

    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Iglesia no encontrada',
        error: 'CHURCH_NOT_FOUND'
      });
    }

    // Obtener estadísticas básicas
    const stats = await Promise.all([
      User.count({ where: { churchId: church.id, isActive: true } }),
      Group.count({ where: { churchId: church.id, isActive: true } }),
      User.count({ where: { churchId: church.id, isActive: true, role: 'leader' } }),
      User.count({ where: { churchId: church.id, isActive: true, isApproved: false } })
    ]);

    const churchDetails = {
      id: church.id,
      name: church.name,
      address: church.address,
      city: church.city,
      country: church.country,
      phone: church.phone,
      email: church.email,
      website: church.website,
      description: church.description,
      isActive: church.isActive,
      createdAt: church.createdAt,
      updatedAt: church.updatedAt,
      stats: {
        totalUsers: stats[0],
        totalGroups: stats[1],
        totalLeaders: stats[2],
        pendingApprovals: stats[3]
      }
    };

    // Agregar datos relacionados si se solicitaron
    if (includeUsers === 'true') {
      churchDetails.users = church.users || [];
    }

    if (includeGroups === 'true') {
      churchDetails.groups = (church.groups || []).map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        isActive: group.isActive,
        createdAt: group.createdAt,
        leader: group.leader ? {
          id: group.leader.id,
          name: `${group.leader.firstName} ${group.leader.lastName}`,
          email: group.leader.email
        } : null
      }));
    }

    logger.info('Detalles de iglesia obtenidos', {
      userId: req.user.id,
      churchId: church.id,
      includeUsers,
      includeGroups,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Iglesia obtenida exitosamente',
      church: churchDetails
    });

  } catch (error) {
    logger.error('Error obteniendo iglesia por ID', {
      error: error.message,
      churchId: req.params?.id,
      userId: req.user?.id,
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
// CREAR NUEVA IGLESIA
// =============================================
const createChurch = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      name,
      address,
      city,
      country,
      phone,
      email,
      website,
      description,
      isActive = true
    } = req.body;

    // Crear iglesia
    const church = await Church.create({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      website: website ? website.trim() : null,
      description: description ? description.trim() : null,
      isActive,
      createdBy: req.user.id
    }, { transaction });

    await transaction.commit();

    logger.info('Iglesia creada exitosamente', {
      userId: req.user.id,
      churchId: church.id,
      churchName: church.name,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Iglesia creada exitosamente',
      church: {
        id: church.id,
        name: church.name,
        address: church.address,
        city: church.city,
        country: church.country,
        phone: church.phone,
        email: church.email,
        website: church.website,
        description: church.description,
        isActive: church.isActive,
        createdAt: church.createdAt
      }
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error creando iglesia', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      churchName: req.body?.name,
      ip: req.ip
    });

    // Errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      return res.status(400).json({
        success: false,
        message: `Ya existe una iglesia con ese ${field === 'email' ? 'email' : 'nombre'}`,
        error: 'DUPLICATE_VALUE',
        field
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
// ACTUALIZAR IGLESIA
// =============================================
const updateChurch = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      name,
      address,
      city,
      country,
      phone,
      email,
      website,
      description,
      isActive
    } = req.body;

    // Buscar iglesia
    const church = await Church.findByPk(id);
    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Iglesia no encontrada',
        error: 'CHURCH_NOT_FOUND'
      });
    }

    // Preparar datos de actualización
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (address !== undefined) updateData.address = address.trim();
    if (city !== undefined) updateData.city = city.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (phone !== undefined) updateData.phone = phone.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (website !== undefined) updateData.website = website ? website.trim() : null;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (isActive !== undefined) updateData.isActive = isActive;

    updateData.updatedBy = req.user.id;

    // Si se está desactivando, verificar dependencias
    if (isActive === false && church.isActive === true) {
      const activeUsersCount = await User.count({
        where: { churchId: church.id, isActive: true }
      });

      const activeGroupsCount = await Group.count({
        where: { churchId: church.id, isActive: true }
      });

      if (activeUsersCount > 0 || activeGroupsCount > 0) {
        return res.status(400).json({
          success: false,
          message: `No se puede desactivar la iglesia porque tiene ${activeUsersCount} usuario(s) y ${activeGroupsCount} grupo(s) activo(s)`,
          error: 'CHURCH_HAS_DEPENDENCIES',
          dependencies: {
            activeUsers: activeUsersCount,
            activeGroups: activeGroupsCount
          }
        });
      }
    }

    // Actualizar iglesia
    await church.update(updateData, { transaction });
    await transaction.commit();

    logger.info('Iglesia actualizada exitosamente', {
      userId: req.user.id,
      churchId: church.id,
      updatedFields: Object.keys(updateData),
      ip: req.ip
    });

    // Obtener iglesia actualizada
    const updatedChurch = await Church.findByPk(id);

    res.json({
      success: true,
      message: 'Iglesia actualizada exitosamente',
      church: {
        id: updatedChurch.id,
        name: updatedChurch.name,
        address: updatedChurch.address,
        city: updatedChurch.city,
        country: updatedChurch.country,
        phone: updatedChurch.phone,
        email: updatedChurch.email,
        website: updatedChurch.website,
        description: updatedChurch.description,
        isActive: updatedChurch.isActive,
        createdAt: updatedChurch.createdAt,
        updatedAt: updatedChurch.updatedAt
      },
      updatedFields: Object.keys(updateData)
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error actualizando iglesia', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      churchId: req.params?.id,
      ip: req.ip
    });

    // Errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      const field = error.errors[0].path;
      return res.status(400).json({
        success: false,
        message: `Ya existe una iglesia con ese ${field === 'email' ? 'email' : 'nombre'}`,
        error: 'DUPLICATE_VALUE',
        field
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
// ELIMINAR IGLESIA (SOFT DELETE)
// =============================================
const deleteChurch = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Buscar iglesia
    const church = await Church.findByPk(id);
    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Iglesia no encontrada',
        error: 'CHURCH_NOT_FOUND'
      });
    }

    // Verificar dependencias
    const activeUsersCount = await User.count({
      where: { churchId: church.id, isActive: true }
    });

    const activeGroupsCount = await Group.count({
      where: { churchId: church.id, isActive: true }
    });

    if ((activeUsersCount > 0 || activeGroupsCount > 0) && !force) {
      return res.status(400).json({
        success: false,
        message: `La iglesia tiene ${activeUsersCount} usuario(s) y ${activeGroupsCount} grupo(s) activo(s). Use force=true para eliminar de todas formas`,
        error: 'CHURCH_HAS_DEPENDENCIES',
        dependencies: {
          activeUsers: activeUsersCount,
          activeGroups: activeGroupsCount
        }
      });
    }

    // Si force=true, desactivar dependencias
    if (force && (activeUsersCount > 0 || activeGroupsCount > 0)) {
      // Desactivar usuarios
      await User.update(
        { 
          isActive: false, 
          deletedAt: new Date(),
          deletedBy: req.user.id 
        },
        { 
          where: { churchId: church.id, isActive: true },
          transaction 
        }
      );

      // Desactivar grupos
      await Group.update(
        { 
          isActive: false, 
          deletedAt: new Date(),
          deletedBy: req.user.id 
        },
        { 
          where: { churchId: church.id, isActive: true },
          transaction 
        }
      );
    }

    // Soft delete de la iglesia
    await church.update({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: req.user.id
    }, { transaction });

    await transaction.commit();

    logger.info('Iglesia eliminada exitosamente', {
      userId: req.user.id,
      churchId: church.id,
      churchName: church.name,
      force: force,
      affectedUsers: activeUsersCount,
      affectedGroups: activeGroupsCount,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Iglesia eliminada exitosamente',
      church: {
        id: church.id,
        name: church.name,
        isActive: false,
        deletedAt: church.deletedAt
      },
      affectedRecords: {
        users: force ? activeUsersCount : 0,
        groups: force ? activeGroupsCount : 0
      }
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error eliminando iglesia', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      churchId: req.params?.id,
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
// ESTADÍSTICAS DE IGLESIAS
// =============================================
const getChurchStats = async (req, res) => {
  try {
    // Estadísticas generales
    const totalChurches = await Church.count();
    const activeChurches = await Church.count({ where: { isActive: true } });

    // Estadísticas por país
    const countryStats = await Church.findAll({
      attributes: [
        'country',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: { isActive: true },
      group: ['country'],
      order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
      raw: true
    });

    // Top 10 iglesias por número de usuarios
    const churchesByUsers = await Church.findAll({
      attributes: [
        'id',
        'name',
        'city',
        'country',
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "Users" WHERE "Users"."churchId" = "Church"."id" AND "Users"."isActive" = true)'),
          'userCount'
        ]
      ],
      where: { isActive: true },
      order: [[db.sequelize.literal('userCount'), 'DESC']],
      limit: 10,
      raw: true
    });

    // Iglesias creadas por mes (últimos 12 meses)
    const monthlyCreations = await Church.findAll({
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

    logger.info('Estadísticas de iglesias obtenidas', {
      userId: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      stats: {
        general: {
          totalChurches,
          activeChurches,
          inactiveChurches: totalChurches - activeChurches
        },
        byCountry: countryStats.reduce((acc, stat) => {
          acc[stat.country] = parseInt(stat.count);
          return acc;
        }, {}),
        topChurchesByUsers: churchesByUsers.map(church => ({
          id: church.id,
          name: church.name,
          location: `${church.city}, ${church.country}`,
          userCount: parseInt(church.userCount || 0)
        })),
        monthlyCreations: monthlyCreations.map(stat => ({
          month: stat.month,
          count: parseInt(stat.count)
        }))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de iglesias', {
      error: error.message,
      userId: req.user?.id,
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
  getAllChurches,
  getChurchById,
  createChurch,
  updateChurch,
  deleteChurch,
  
  // Estadísticas
  getChurchStats
};