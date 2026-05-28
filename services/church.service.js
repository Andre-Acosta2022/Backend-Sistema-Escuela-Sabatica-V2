/**
 * CHURCH.SERVICE.JS - Servicio de lógica de negocio para Iglesias
 * Sistema de Gestión Misionera
 */

const { Op } = require('sequelize');
const db = require('../models');
const NodeCache = require('node-cache');

// Caché con tiempo de vida (TTL) de 5 minutos y chequeo cada 60 segundos
const churchCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const Church = db.Church;
const User = db.User;
const Group = db.Group;

/**
 * Helper para limpiar el caché cuando ocurren cambios de escritura
 */
const clearChurchCache = () => {
  const keys = churchCache.keys();
  const keysToDel = keys.filter(key => key.startsWith('churches:'));
  if (keysToDel.length > 0) {
    churchCache.del(keysToDel);
  }
};

// =============================================
// LOGICA DE NEGOCIO
// =============================================

const findAll = async (queryParams) => {
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
  } = queryParams;

  // Intentar recuperar de caché usando los query params como llave única
  const cacheKey = `churches:list:${JSON.stringify(queryParams)}`;
  const cachedData = churchCache.get(cacheKey);
  if (cachedData) return cachedData;

  const offset = (parseInt(page) - 1) * parseInt(limit);
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
  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { address: { [Op.iLike]: `%${search}%` } },
      { city: { [Op.iLike]: `%${search}%` } },
      { country: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const validSortFields = ['id', 'name', 'city', 'country', 'createdAt', 'updatedAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  const attributes = { exclude: [] };
  if (includeStats === 'true') {
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

  const { count, rows: churches } = await Church.findAndCountAll({
    where: whereClause,
    attributes,
    order: [[sortField, sortDirection]],
    limit: parseInt(limit),
    offset: offset,
    distinct: true
  });

  const totalPages = Math.ceil(count / parseInt(limit));

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

    if (includeStats === 'true') {
      churchData.stats = {
        userCount: parseInt(church.dataValues.userCount || 0),
        groupCount: parseInt(church.dataValues.groupCount || 0)
      };
    }
    return churchData;
  });

  const result = {
    churches: formattedChurches,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      totalChurches: count,
      churchesPerPage: parseInt(limit),
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1
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
  };

  // Guardar en caché antes de retornar
  churchCache.set(cacheKey, result);
  return result;
};

const findById = async (id, queryOptions) => {
  const { includeUsers = false, includeGroups = false } = queryOptions;
  const cacheKey = `churches:id:${id}:${includeUsers}:${includeGroups}`;
  
  const cachedData = churchCache.get(cacheKey);
  if (cachedData) return cachedData;

  const include = [];
  if (includeUsers === 'true') {
    include.push({
      model: User,
      as: 'users',
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'isApproved', 'lastLoginAt'],
      where: { isActive: true },
      required: false
    });
  }

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
  if (!church) return null;

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

  churchCache.set(cacheKey, churchDetails);
  return churchDetails;
};

const create = async (churchData, userId) => {
  const transaction = await db.sequelize.transaction();
  try {
    const church = await Church.create({
      name: churchData.name.trim(),
      address: churchData.address.trim(),
      city: churchData.city.trim(),
      country: churchData.country.trim(),
      phone: churchData.phone.trim(),
      email: churchData.email.toLowerCase().trim(),
      website: churchData.website ? churchData.website.trim() : null,
      description: churchData.description ? churchData.description.trim() : null,
      isActive: churchData.isActive !== undefined ? churchData.isActive : true,
      createdBy: userId
    }, { transaction });

    await transaction.commit();
    clearChurchCache(); // Datos nuevos invalidan la lista del caché
    return church;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const update = async (id, churchData, userId) => {
  const transaction = await db.sequelize.transaction();
  try {
    const church = await Church.findByPk(id);
    if (!church) return { status: 404, message: 'CHURCH_NOT_FOUND' };

    // Validación de negocio intacta: Dependencias al desactivar
    if (churchData.isActive === false && church.isActive === true) {
      const activeUsersCount = await User.count({ where: { churchId: church.id, isActive: true } });
      const activeGroupsCount = await Group.count({ where: { churchId: church.id, isActive: true } });

      if (activeUsersCount > 0 || activeGroupsCount > 0) {
        await transaction.rollback();
        return {
          status: 400,
          message: 'CHURCH_HAS_DEPENDENCIES',
          dependencies: { activeUsers: activeUsersCount, activeGroups: activeGroupsCount }
        };
      }
    }

    const updateFields = {};
    const fields = ['name', 'address', 'city', 'country', 'phone', 'email', 'website', 'description', 'isActive'];
    
    fields.forEach(field => {
      if (churchData[field] !== undefined) {
        if (typeof churchData[field] === 'string') {
          updateFields[field] = field === 'email' ? churchData[field].toLowerCase().trim() : churchData[field].trim();
        } else {
          updateFields[field] = churchData[field];
        }
      }
    });

    updateFields.updatedBy = userId;

    await church.update(updateFields, { transaction });
    await transaction.commit();

    clearChurchCache(); // Datos mutados invalidan el caché viejo
    
    const updatedChurch = await Church.findByPk(id);
    return { status: 200, church: updatedChurch, updatedFields: Object.keys(updateFields) };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const remove = async (id, forceDelete, userId) => {
  const transaction = await db.sequelize.transaction();
  try {
    const church = await Church.findByPk(id);
    if (!church) return { status: 404, message: 'CHURCH_NOT_FOUND' };

    const activeUsersCount = await User.count({ where: { churchId: church.id, isActive: true } });
    const activeGroupsCount = await Group.count({ where: { churchId: church.id, isActive: true } });

    // Validación de dependencias crítica
    if ((activeUsersCount > 0 || activeGroupsCount > 0) && !forceDelete) {
      await transaction.rollback();
      return {
        status: 400,
        message: 'CHURCH_HAS_DEPENDENCIES',
        dependencies: { activeUsers: activeUsersCount, activeGroups: activeGroupsCount }
      };
    }

    // Lógica Cascada condicional (Force Delete lógico)
    if (forceDelete && (activeUsersCount > 0 || activeGroupsCount > 0)) {
      await User.update(
        { isActive: false, deletedAt: new Date(), deletedBy: userId },
        { where: { churchId: church.id, isActive: true }, transaction }
      );

      await Group.update(
        { isActive: false, deletedAt: new Date(), deletedBy: userId },
        { where: { churchId: church.id, isActive: true }, transaction }
      );
    }

    await church.update({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: userId
    }, { transaction });

    await transaction.commit();
    clearChurchCache();

    return {
      status: 200,
      church: { id: church.id, name: church.name, isActive: false, deletedAt: new Date() },
      affectedRecords: {
        users: forceDelete ? activeUsersCount : 0,
        groups: forceDelete ? activeGroupsCount : 0
      }
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getStats = async () => {
  const cacheKey = 'churches:global_stats';
  const cachedStats = churchCache.get(cacheKey);
  if (cachedStats) return cachedStats;

  const totalChurches = await Church.count();
  const activeChurches = await Church.count({ where: { isActive: true } });

  const countryStats = await Church.findAll({
    attributes: ['country', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
    where: { isActive: true },
    group: ['country'],
    order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
    raw: true
  });

  const churchesByUsers = await Church.findAll({
    attributes: [
      'id', 'name', 'city', 'country',
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

  const monthlyCreations = await Church.findAll({
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

  const result = {
    general: {
      totalChurches,
      activeChurches,
      inactiveChurches: totalChurches - activeChurches
    },
    byCountry: countryStats.reduce((acc, stat) => {
      acc[stat.country] = parseInt(stat.count);
      acc;
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
  };

  // Almacenar estadísticas complejas por 10 minutos (600s) ya que no cambian a cada segundo
  churchCache.set(cacheKey, result, 600);
  return result;
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  getStats
};