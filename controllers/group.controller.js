/**
 * GROUP.CONTROLLER.JS - Controlador de gestión de grupos
 * Sistema de Gestión Misionera
 */

const groupService = require('../services/group.service');
const logger = require('../utils/logger');
const { catchAsync, sendSuccess, sendPaginatedSuccess, AuthorizationError } = require('../middlewares/error.middleware');

/**
 * LISTAR GRUPOS CON FILTROS Y PAGINACIÓN
 */
const getAllGroups = catchAsync(async (req, res) => {
  const permissions = await groupService.checkGroupPermissions(req.user.id, req.user.role);
  if (!permissions.hasAccess) {
    throw new AuthorizationError('No tienes permisos para ver grupos', 'ACCESS_DENIED');
  }

  const { count, groups } = await groupService.queryAllGroups(req.user, req.query);
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const formattedGroups = groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description,
    location: group.location,
    meetingDay: group.meetingDay,
    meetingTime: group.meetingTime,
    isActive: group.isActive,
    churchId: group.churchId,
    church: group.church ? {
      id: group.church.id,
      name: group.church.name,
      location: `${group.church.city}, ${group.church.country}`
    } : null,
    leaderId: group.leaderId,
    leader: group.leader ? {
      id: group.leader.id,
      name: `${group.leader.firstName} ${group.leader.lastName}`,
      email: group.leader.email,
      phone: group.leader.phone
    } : null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    ...(req.query.includeStats === 'true' && {
      stats: {
        memberCount: parseInt(group.dataValues.memberCount || 0),
        studentCount: parseInt(group.dataValues.studentCount || 0)
      }
    })
  }));

  logger.info('Lista de grupos obtenida', { userId: req.user.id, totalGroups: count, ip: req.ip });

  return sendPaginatedSuccess(res, formattedGroups, {
    currentPage: page,
    totalItems: count,
    itemsPerPage: limit,
    message: 'Grupos obtenidos exitosamente'
  });
});

/**
 * OBTENER GRUPO POR ID
 */
const getGroupById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const permissions = await groupService.checkGroupPermissions(req.user.id, req.user.role, id);
  if (!permissions.hasAccess) {
    throw new AuthorizationError('No tienes permisos para ver este grupo', 'ACCESS_DENIED');
  }

  const { group, stats } = await groupService.queryGroupById(id, req.query);

  const groupDetails = {
    id: group.id,
    name: group.name,
    description: group.description,
    location: group.location,
    meetingDay: group.meetingDay,
    meetingTime: group.meetingTime,
    isActive: group.isActive,
    churchId: group.churchId,
    church: group.church,
    leaderId: group.leaderId,
    leader: group.leader,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    stats: {
      totalMembers: stats[0],
      totalStudents: stats[1],
      totalMetrics: stats[2],
      totalIndicators: stats[3]
    },
    ...(req.query.includeMembers === 'true' && {
      members: (group.members || []).map(m => ({
        id: m.id, firstName: m.firstName, lastName: m.lastName, email: m.email,
        phone: m.phone, birthDate: m.birthDate, gender: m.gender,
        membershipDate: m.membershipDate, isActive: m.isActive, indicators: m.indicators || []
      }))
    }),
    ...(req.query.includeStudents === 'true' && { bibleStudents: group.bibleStudents || [] }),
    ...(req.query.includeMetrics === 'true' && { metrics: group.metrics || [] })
  };

  logger.info('Detalles de grupo obtenidos', { userId: req.user.id, groupId: group.id, ip: req.ip });

  return sendSuccess(res, {
    group: groupDetails,
    permissions: {
      canEdit: permissions.isOwner || req.user.role === 'admin',
      canDelete: permissions.isOwner || req.user.role === 'admin',
      isOwner: permissions.isOwner
    }
  }, 'Grupo obtenido exitosamente');
});

/**
 * CREAR NUEVO GRUPO
 */
const createGroup = catchAsync(async (req, res) => {
  const createdGroup = await groupService.saveGroup(req.body, req.user.id, req.user.role, req.user.churchId);

  logger.info('Grupo creado exitosamente', { userId: req.user.id, groupId: createdGroup.id, ip: req.ip });

  return sendSuccess(res, {
    group: {
      id: createdGroup.id,
      name: createdGroup.name,
      description: createdGroup.description,
      location: createdGroup.location,
      meetingDay: createdGroup.meetingDay,
      meetingTime: createdGroup.meetingTime,
      isActive: createdGroup.isActive,
      church: createdGroup.church,
      leader: createdGroup.leader,
      createdAt: createdGroup.createdAt
    }
  }, 'Grupo creado exitosamente', 201);
});

/**
 * ACTUALIZAR GRUPO
 */
const updateGroup = catchAsync(async (req, res) => {
  const { id } = req.params;
  const permissions = await groupService.checkGroupPermissions(req.user.id, req.user.role, id);
  if (!permissions.hasAccess) {
    throw new AuthorizationError('No tienes permisos para editar este grupo', 'ACCESS_DENIED');
  }

  const updatedGroup = await groupService.editGroup(id, req.body, req.user.id, req.user.role);

  logger.info('Grupo actualizado exitosamente', { userId: req.user.id, groupId: id, ip: req.ip });

  return sendSuccess(res, {
    group: {
      id: updatedGroup.id,
      name: updatedGroup.name,
      description: updatedGroup.description,
      location: updatedGroup.location,
      meetingDay: updatedGroup.meetingDay,
      meetingTime: updatedGroup.meetingTime,
      isActive: updatedGroup.isActive,
      church: updatedGroup.church,
      leader: updatedGroup.leader,
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt
    }
  }, 'Grupo actualizado exitosamente');
});

/**
 * ELIMINAR GRUPO (SOFT DELETE)
 */
const deleteGroup = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { force = false } = req.query;

  const permissions = await groupService.checkGroupPermissions(req.user.id, req.user.role, id);
  if (!permissions.hasAccess) {
    throw new AuthorizationError('No tienes permisos para eliminar este grupo', 'ACCESS_DENIED');
  }

  const result = await groupService.destroyGroup(id, force, req.user.id);

  logger.info('Grupo eliminado exitosamente', { userId: req.user.id, groupId: id, force, ip: req.ip });

  return sendSuccess(res, {
    group: { id: result.group.id, name: result.group.name, isActive: false, deletedAt: result.group.deletedAt },
    affectedRecords: {
      members: force === 'true' ? result.memberCount : 0,
      students: force === 'true' ? result.studentCount : 0,
      preservedMetrics: result.metricCount,
      preservedIndicators: result.indicatorCount
    }
  }, 'Grupo eliminado exitosamente');
});

/**
 * OBTENER GRUPOS DEL USUARIO ACTUAL
 */
const getMyGroups = catchAsync(async (req, res) => {
  const groups = await groupService.queryMyGroups(req.user);

  const formattedGroups = groups.map(group => ({
    id: group.id,
    name: group.name,
    description: group.description,
    location: group.location,
    meetingDay: group.meetingDay,
    meetingTime: group.meetingTime,
    church: group.church,
    leader: group.leader || null,
    stats: {
      memberCount: parseInt(group.dataValues.memberCount || 0),
      studentCount: parseInt(group.dataValues.studentCount || 0)
    },
    createdAt: group.createdAt
  }));

  logger.info('Grupos del usuario obtenidos', { userId: req.user.id, groupCount: formattedGroups.length, ip: req.ip });

  return sendSuccess(res, { groups: formattedGroups, total: formattedGroups.length }, 'Grupos obtenidos exitosamente');
});

/**
 * ESTADÍSTICAS DE GRUPOS
 */
const getGroupStats = catchAsync(async (req, res) => {
  const data = await groupService.queryGroupStats(req.user);

  const responseStats = {
    general: {
      totalGroups: data.totalGroups,
      activeGroups: data.activeGroups,
      inactiveGroups: data.totalGroups - data.activeGroups
    },
    topGroupsByMembers: data.groupsByMembers.map(g => ({
      id: g.id, name: g.name, church: g.churchName,
      leader: g.leaderFirstName && g.leaderLastName ? `${g.leaderFirstName} ${g.leaderLastName}` : 'Sin líder',
      memberCount: parseInt(g.memberCount || 0)
    })),
    monthlyCreations: data.monthlyCreations.map(m => ({ month: m.month, count: parseInt(m.count) })),
    meetingDayDistribution: data.meetingDayDistribution.reduce((acc, current) => {
      acc[current.meetingDay] = parseInt(current.count);
      return acc;
    }, {})
  };

  if (req.user.role === 'admin') {
    responseStats.byChurch = data.churchStats.reduce((acc, current) => {
      acc[current.churchName || 'Sin iglesia'] = parseInt(current.count);
      return acc;
    }, {});
  }

  logger.info('Estadísticas de grupos obtenidas', { userId: req.user.id, role: req.user.role, ip: req.ip });

  return sendSuccess(res, { stats: responseStats }, 'Estadísticas obtenidas exitosamente');
});

module.exports = {
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getMyGroups,
  getGroupStats
};