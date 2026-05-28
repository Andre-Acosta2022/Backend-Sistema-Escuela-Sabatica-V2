/**
 * GROUP.SERVICE.JS - Servicio de lógica de negocio para Grupos
 * Sistema de Gestión Misionera
 */

const { Op } = require('sequelize');
const db = require('../models');
const { 
  NotFoundError, 
  ConflictError, 
  ValidationError,
  AuthorizationError 
} = require('../middlewares/error.middleware'); // Ajusta la ruta según tu proyecto

const Group = db.Group;
const User = db.User;
const Church = db.Church;
const Member = db.Member;
const BibleStudent = db.BibleStudent;
const GroupMetric = db.GroupMetric;
const SpiritualIndicator = db.SpiritualIndicator;
const Semester = db.Semester;

// Subconsultas reutilizables para conteos en tiempo real
const getStatsLiterals = () => [
  [
    db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
    'memberCount'
  ],
  [
    db.sequelize.literal('(SELECT COUNT(*) FROM "BibleStudents" WHERE "BibleStudents"."groupId" = "Group"."id" AND "BibleStudents"."isActive" = true)'),
    'studentCount'
  ]
];

/**
 * Helper de permisos centralizado y corregido contra accesos globales indefinidos
 */
const checkGroupPermissions = async (userId, userRole, groupId = null) => {
  const allowedRoles = ['admin', 'director', 'leader'];
  
  if (!groupId) {
    return { hasAccess: allowedRoles.includes(userRole), isOwner: false };
  }

  if (userRole === 'admin') return { hasAccess: true, isOwner: true };

  const group = await Group.findByPk(groupId, { attributes: ['id', 'churchId', 'leaderId'] });
  if (!group) throw new NotFoundError('Grupo no encontrado', 'GROUP_NOT_FOUND');

  if (userRole === 'director') {
    const user = await User.findByPk(userId, { attributes: ['churchId'] });
    return { 
      hasAccess: group.churchId === user.churchId, 
      isOwner: group.leaderId === userId 
    };
  }

  if (userRole === 'leader') {
    return { 
      hasAccess: group.leaderId === userId, 
      isOwner: group.leaderId === userId 
    };
  }

  return { hasAccess: false, isOwner: false };
};

/**
 * Obtener todos los grupos con paginación y filtros complejos
 */
const queryAllGroups = async (user, query) => {
  const {
    page = 1,
    limit = 10,
    churchId,
    leaderId,
    isActive,
    search,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    includeStats = false
  } = query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const whereClause = {};

  // Restricciones de ámbito por Rol
  if (user.role === 'leader') whereClause.leaderId = user.id;
  else if (user.role === 'director') whereClause.churchId = user.churchId;
  else if (churchId && churchId !== 'all' && user.role === 'admin') whereClause.churchId = parseInt(churchId);

  if (leaderId && leaderId !== 'all') whereClause.leaderId = parseInt(leaderId);
  if (isActive !== undefined && isActive !== 'all') whereClause.isActive = isActive === 'true';

  if (search) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } },
      { location: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const validSortFields = ['id', 'name', 'createdAt', 'updatedAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  const attributes = {};
  if (includeStats === 'true') {
    attributes.include = getStatsLiterals();
  }

  const { count, rows: groups } = await Group.findAndCountAll({
    where: whereClause,
    include: [
      { model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
      { model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }
    ],
    attributes,
    order: [[sortField, sortDirection]],
    limit: parseInt(limit),
    offset: offset,
    distinct: true
  });

  return { count, groups };
};

/**
 * Obtener detalles completos de un grupo específico por ID
 */
const queryGroupById = async (id, query) => {
  const { includeMembers, includeStudents, includeMetrics } = query;
  
  const include = [
    { model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
    { model: Church, as: 'church', attributes: ['id', 'name', 'address', 'city', 'country', 'phone', 'email'] }
  ];

  if (includeMembers === 'true') {
    include.push({
      model: Member,
      as: 'members',
      where: { isActive: true },
      required: false,
      include: [{
        model: SpiritualIndicator,
        as: 'indicators',
        required: false,
        include: [{ model: Semester, as: 'semester', attributes: ['id', 'name', 'year'] }]
      }]
    });
  }

  if (includeStudents === 'true') {
    include.push({ model: BibleStudent, as: 'bibleStudents', where: { isActive: true }, required: false });
  }

  if (includeMetrics === 'true') {
    include.push({
      model: GroupMetric,
      as: 'metrics',
      required: false,
      include: [{ model: Semester, as: 'semester', attributes: ['id', 'name', 'year'] }],
      order: [['createdAt', 'DESC']]
    });
  }

  const group = await Group.findByPk(id, { include });
  if (!group) throw new NotFoundError('Grupo no encontrado', 'GROUP_NOT_FOUND');

  const stats = await Promise.all([
    Member.count({ where: { groupId: group.id, isActive: true } }),
    BibleStudent.count({ where: { groupId: group.id, isActive: true } }),
    GroupMetric.count({ where: { groupId: group.id } }),
    SpiritualIndicator.count({ 
      include: [{ model: Member, where: { groupId: group.id, isActive: true } }] 
    })
  ]);

  return { group, stats };
};

/**
 * Crear un grupo validando reglas de negocio e iglesias
 */
const saveGroup = async (body, userId, userRole, userChurchId) => {
  const { name, description, location, meetingDay, meetingTime, churchId, leaderId, isActive = true } = body;

  if (userRole === 'leader' && leaderId && leaderId !== userId) {
    throw new AuthorizationError('Los líderes solo pueden crear grupos para sí mismos', 'INVALID_LEADER_ASSIGNMENT');
  }
  if (userRole === 'director' && churchId !== userChurchId) {
    throw new AuthorizationError('Los directores solo pueden crear grupos en su iglesia', 'INVALID_CHURCH_ASSIGNMENT');
  }

  const church = await Church.findByPk(churchId);
  if (!church || !church.isActive) throw new ValidationError('Iglesia no encontrada o inactiva', 'INVALID_CHURCH');

  if (leaderId) {
    const leader = await User.findByPk(leaderId);
    if (!leader || !leader.isActive || leader.role !== 'leader') {
      throw new ValidationError('Líder no encontrado, inactivo o con rol incorrecto', 'INVALID_LEADER');
    }
    if (leader.churchId !== churchId) {
      throw new ValidationError('El líder debe pertenecer a la misma iglesia que el grupo', 'LEADER_CHURCH_MISMATCH');
    }
  }

  try {
    return await db.sequelize.transaction(async (t) => {
      const group = await Group.create({
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        meetingDay,
        meetingTime,
        churchId,
        leaderId: leaderId || null,
        isActive,
        createdBy: userId
      }, { transaction: t });

      return await Group.findByPk(group.id, {
        include: [
          { model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }
        ],
        transaction: t
      });
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new ConflictError('Ya existe un grupo con ese nombre en la iglesia', 'DUPLICATE_GROUP_NAME');
    }
    throw error;
  }
};

/**
 * Modificar parámetros de un grupo existente
 */
const editGroup = async (id, body, userId, userRole) => {
  const group = await Group.findByPk(id);
  if (!group) throw new NotFoundError('Grupo no encontrado', 'GROUP_NOT_FOUND');

  const { name, description, location, meetingDay, meetingTime, leaderId, isActive } = body;

  if (leaderId !== undefined && leaderId !== group.leaderId) {
    if (userRole === 'leader' && leaderId !== userId) {
      throw new AuthorizationError('Los líderes no pueden cambiar la asignación de liderazgo', 'CANNOT_CHANGE_LEADER');
    }
    if (leaderId) {
      const newLeader = await User.findByPk(leaderId);
      if (!newLeader || !newLeader.isActive || newLeader.role !== 'leader') {
        throw new ValidationError('Nuevo líder no válido', 'INVALID_LEADER');
      }
      if (newLeader.churchId !== group.churchId) {
        throw new ValidationError('El nuevo líder debe pertenecer a la misma iglesia', 'LEADER_CHURCH_MISMATCH');
      }
    }
  }

  const updateData = {
    ...(name !== undefined && { name: name.trim() }),
    ...(description !== undefined && { description: description ? description.trim() : null }),
    ...(location !== undefined && { location: location ? location.trim() : null }),
    ...(meetingDay !== undefined && { meetingDay }),
    ...(meetingTime !== undefined && { meetingTime }),
    ...(leaderId !== undefined && { leaderId }),
    ...(isActive !== undefined && { isActive }),
    updatedBy: userId
  };

  return await db.sequelize.transaction(async (t) => {
    await group.update(updateData, { transaction: t });
    return await Group.findByPk(id, {
      include: [
        { model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }
      ],
      transaction: t
    });
  });
};

/**
 * Desactivación o borrado lógico de un grupo y sus dependencias activas
 */
const destroyGroup = async (id, force, userId) => {
  const group = await Group.findByPk(id);
  if (!group) throw new NotFoundError('Grupo no encontrado', 'GROUP_NOT_FOUND');

  const [memberCount, studentCount, metricCount, indicatorCount] = await Promise.all([
    Member.count({ where: { groupId: group.id, isActive: true } }),
    BibleStudent.count({ where: { groupId: group.id, isActive: true } }),
    GroupMetric.count({ where: { groupId: group.id } }),
    SpiritualIndicator.count({ include: [{ model: Member, where: { groupId: group.id, isActive: true } }] })
  ]);

  const totalDependencies = memberCount + studentCount;

  if (totalDependencies > 0 && force !== 'true') {
    throw new ConflictError(
      `El grupo tiene dependencias activas. Use force=true para confirmar la baja total.`, 
      'GROUP_HAS_DEPENDENCIES'
    );
  }

  await db.sequelize.transaction(async (t) => {
    if (force === 'true' && totalDependencies > 0) {
      const cascadeMeta = { isActive: false, deletedAt: new Date(), deletedBy: userId };
      await Member.update(cascadeMeta, { where: { groupId: group.id, isActive: true }, transaction: t });
      await BibleStudent.update(cascadeMeta, { where: { groupId: group.id, isActive: true }, transaction: t });
    }
    await group.update({ isActive: false, deletedAt: new Date(), deletedBy: userId }, { transaction: t });
  });

  return { group, memberCount, studentCount, metricCount, indicatorCount };
};

/**
 * Obtener grupos del contexto del perfil del usuario actual (getMyGroups)
 */
const queryMyGroups = async (user) => {
  const whereClause = { isActive: true };
  const include = [{ model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }];

  if (user.role === 'leader') {
    whereClause.leaderId = user.id;
  } else if (user.role === 'director') {
    whereClause.churchId = user.churchId;
    include.push({ model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email'] });
  } else if (user.role !== 'admin') {
    throw new AuthorizationError('Rol no autorizado para visualizar grupos personales', 'ROLE_NOT_SUPPORTED');
  } else {
    // Caso Admin
    include.push({ model: User, as: 'leader', attributes: ['id', 'firstName', 'lastName', 'email'] });
  }

  return await Group.findAll({
    where: whereClause,
    include,
    attributes: { include: getStatsLiterals() },
    order: [['name', 'ASC']],
    ...(user.role === 'admin' && { limit: 50 }) // Guardrail de rendimiento original
  });
};

/**
 * Generar panel analítico de métricas de grupos
 */
const queryGroupStats = async (user) => {
  const whereClause = {};
  if (user.role === 'leader') whereClause.leaderId = user.id;
  else if (user.role === 'director') whereClause.churchId = user.churchId;

  const totalGroups = await Group.count({ where: whereClause });
  const activeGroups = await Group.count({ where: { ...whereClause, isActive: true } });

  let churchStats = [];
  if (user.role === 'admin') {
    churchStats = await Group.findAll({
      attributes: [
        [db.sequelize.col('church.name'), 'churchName'],
        [db.sequelize.fn('COUNT', db.sequelize.col('Group.id')), 'count']
      ],
      include: [{ model: Church, as: 'church', attributes: [] }],
      where: { isActive: true },
      group: ['church.id', 'church.name'],
      raw: true
    });
  }

  const groupsByMembers = await Group.findAll({
    attributes: [
      'id', 'name',
      [db.sequelize.col('church.name'), 'churchName'],
      [db.sequelize.col('leader.firstName'), 'leaderFirstName'],
      [db.sequelize.col('leader.lastName'), 'leaderLastName'],
      [db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'), 'memberCount']
    ],
    include: [
      { model: Church, as: 'church', attributes: [] },
      { model: User, as: 'leader', attributes: [] }
    ],
    where: { ...whereClause, isActive: true },
    order: [[db.sequelize.literal('memberCount'), 'DESC']],
    limit: 10,
    raw: true
  });

  const monthlyCreations = await Group.findAll({
    attributes: [
      [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'month'],
      [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
    ],
    where: {
      ...whereClause,
      createdAt: { [Op.gte]: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) }
    },
    group: [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt'))],
    order: [[db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'ASC']],
    raw: true
  });

  const meetingDayDistribution = await Group.findAll({
    attributes: ['meetingDay', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
    where: { ...whereClause, isActive: true, meetingDay: { [Op.not]: null } },
    group: ['meetingDay'],
    raw: true
  });

  return { totalGroups, activeGroups, churchStats, groupsByMembers, monthlyCreations, meetingDayDistribution };
};

module.exports = {
  checkGroupPermissions,
  queryAllGroups,
  queryGroupById,
  saveGroup,
  editGroup,
  destroyGroup,
  queryMyGroups,
  queryGroupStats
};