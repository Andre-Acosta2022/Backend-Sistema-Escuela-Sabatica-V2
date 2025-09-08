/**
 * GROUP.CONTROLLER.JS - Controlador de gestión de grupos
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD de grupos misioneros
 * Accesible por admin, directores y líderes (con restricciones)
 */

const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger');

const Group = db.Group;
const User = db.User;
const Church = db.Church;
const Member = db.Member;
const BibleStudent = db.BibleStudent;
const GroupMetric = db.GroupMetric;
const SpiritualIndicator = db.SpiritualIndicator;
const Semester = db.Semester;

// =============================================
// HELPER: VERIFICAR PERMISOS DE GRUPO
// =============================================
const checkGroupPermissions = async (userId, userRole, groupId = null, churchId = null) => {
  // Admin tiene acceso total
  if (userRole === 'admin') {
    return { hasAccess: true, isOwner: true };
  }

  // Director tiene acceso a grupos de su iglesia
  if (userRole === 'director') {
    if (groupId) {
      const group = await Group.findByPk(groupId, { 
        attributes: ['id', 'churchId', 'leaderId'] 
      });
      if (!group) return { hasAccess: false, isOwner: false };
      
      const user = await User.findByPk(userId, { attributes: ['churchId'] });
      return { 
        hasAccess: group.churchId === user.churchId, 
        isOwner: group.leaderId === userId 
      };
    }
    return { hasAccess: true, isOwner: false };
  }

  // Leader solo tiene acceso a sus propios grupos
  if (userRole === 'leader') {
    if (groupId) {
      const group = await Group.findByPk(groupId, { 
        attributes: ['id', 'leaderId'] 
      });
      if (!group) return { hasAccess: false, isOwner: false };
      
      return { 
        hasAccess: group.leaderId === userId, 
        isOwner: group.leaderId === userId 
      };
    }
    return { hasAccess: true, isOwner: false };
  }

  return { hasAccess: false, isOwner: false };
};

// =============================================
// LISTAR GRUPOS CON FILTROS Y PAGINACIÓN
// =============================================
const getAllGroups = async (req, res) => {
  try {
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
    } = req.query;

    // Verificar permisos
    const permissions = await checkGroupPermissions(req.user.id, req.user.role);
    if (!permissions.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver grupos',
        error: 'ACCESS_DENIED'
      });
    }

    // Calcular offset para paginación
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Construir filtros según el rol del usuario
    const whereClause = {};

    // Filtros basados en rol
    if (req.user.role === 'leader') {
      whereClause.leaderId = req.user.id;
    } else if (req.user.role === 'director') {
      whereClause.churchId = req.user.churchId;
    }

    // Filtros adicionales
    if (churchId && churchId !== 'all' && req.user.role === 'admin') {
      whereClause.churchId = parseInt(churchId);
    }

    if (leaderId && leaderId !== 'all') {
      whereClause.leaderId = parseInt(leaderId);
    }

    if (isActive !== undefined && isActive !== 'all') {
      whereClause.isActive = isActive === 'true';
    }

    // Búsqueda por texto
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Validar campos de ordenación
    const validSortFields = ['id', 'name', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Incluir relaciones
    const include = [
      {
        model: User,
        as: 'leader',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
      },
      {
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'city', 'country']
      }
    ];

    // Agregar conteos si se solicitan
    const attributes = {};
    if (includeStats === 'true') {
      attributes.include = [
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
          'memberCount'
        ],
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "BibleStudents" WHERE "BibleStudents"."groupId" = "Group"."id" AND "BibleStudents"."isActive" = true)'),
          'studentCount'
        ]
      ];
    }

    // Consulta principal
    const { count, rows: groups } = await Group.findAndCountAll({
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

    // Formatear grupos
    const formattedGroups = groups.map(group => {
      const groupData = {
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
        updatedAt: group.updatedAt
      };

      // Agregar estadísticas si se solicitaron
      if (includeStats === 'true') {
        groupData.stats = {
          memberCount: parseInt(group.dataValues.memberCount || 0),
          studentCount: parseInt(group.dataValues.studentCount || 0)
        };
      }

      return groupData;
    });

    logger.info('Lista de grupos obtenida', {
      userId: req.user.id,
      userRole: req.user.role,
      filters: { churchId, leaderId, isActive, search },
      totalGroups: count,
      page: parseInt(page),
      limit: parseInt(limit),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Grupos obtenidos exitosamente',
      data: {
        groups: formattedGroups,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalGroups: count,
          groupsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        },
        filters: {
          churchId: churchId || 'all',
          leaderId: leaderId || 'all',
          isActive: isActive || 'all',
          search: search || '',
          sortBy: sortField,
          sortOrder: sortDirection,
          includeStats: includeStats === 'true'
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo lista de grupos', {
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
// OBTENER GRUPO POR ID
// =============================================
const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      includeMembers = false, 
      includeStudents = false, 
      includeMetrics = false,
      includeIndicators = false 
    } = req.query;

    // Verificar permisos
    const permissions = await checkGroupPermissions(req.user.id, req.user.role, id);
    if (!permissions.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este grupo',
        error: 'ACCESS_DENIED'
      });
    }

    const include = [
      {
        model: User,
        as: 'leader',
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
      },
      {
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'address', 'city', 'country', 'phone', 'email']
      }
    ];

    // Incluir miembros si se solicita
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
          include: [{
            model: Semester,
            as: 'semester',
            attributes: ['id', 'name', 'year', 'startDate', 'endDate']
          }]
        }]
      });
    }

    // Incluir estudiantes bíblicos si se solicita
    if (includeStudents === 'true') {
      include.push({
        model: BibleStudent,
        as: 'bibleStudents',
        where: { isActive: true },
        required: false
      });
    }

    // Incluir métricas si se solicita
    if (includeMetrics === 'true') {
      include.push({
        model: GroupMetric,
        as: 'metrics',
        required: false,
        include: [{
          model: Semester,
          as: 'semester',
          attributes: ['id', 'name', 'year', 'startDate', 'endDate']
        }],
        order: [['createdAt', 'DESC']]
      });
    }

    const group = await Group.findByPk(id, { include });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error: 'GROUP_NOT_FOUND'
      });
    }

    // Obtener estadísticas básicas
    const stats = await Promise.all([
      Member.count({ where: { groupId: group.id, isActive: true } }),
      BibleStudent.count({ where: { groupId: group.id, isActive: true } }),
      GroupMetric.count({ where: { groupId: group.id } }),
      SpiritualIndicator.count({ 
        include: [{
          model: Member,
          where: { groupId: group.id, isActive: true }
        }]
      })
    ]);

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
      }
    };

    // Agregar datos relacionados si se solicitaron
    if (includeMembers === 'true') {
      groupDetails.members = (group.members || []).map(member => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        birthDate: member.birthDate,
        gender: member.gender,
        membershipDate: member.membershipDate,
        isActive: member.isActive,
        indicators: member.indicators || []
      }));
    }

    if (includeStudents === 'true') {
      groupDetails.bibleStudents = group.bibleStudents || [];
    }

    if (includeMetrics === 'true') {
      groupDetails.metrics = group.metrics || [];
    }

    logger.info('Detalles de grupo obtenidos', {
      userId: req.user.id,
      groupId: group.id,
      isOwner: permissions.isOwner,
      includeMembers,
      includeStudents,
      includeMetrics,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Grupo obtenido exitosamente',
      group: groupDetails,
      permissions: {
        canEdit: permissions.isOwner || req.user.role === 'admin',
        canDelete: permissions.isOwner || req.user.role === 'admin',
        isOwner: permissions.isOwner
      }
    });

  } catch (error) {
    logger.error('Error obteniendo grupo por ID', {
      error: error.message,
      groupId: req.params?.id,
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
// CREAR NUEVO GRUPO
// =============================================
const createGroup = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const {
      name,
      description,
      location,
      meetingDay,
      meetingTime,
      churchId,
      leaderId,
      isActive = true
    } = req.body;

    // Verificar permisos para crear grupo
    if (req.user.role === 'leader' && leaderId && leaderId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Los líderes solo pueden crear grupos para sí mismos',
        error: 'INVALID_LEADER_ASSIGNMENT'
      });
    }

    if (req.user.role === 'director' && churchId !== req.user.churchId) {
      return res.status(403).json({
        success: false,
        message: 'Los directores solo pueden crear grupos en su iglesia',
        error: 'INVALID_CHURCH_ASSIGNMENT'
      });
    }

    // Validar que la iglesia existe y está activa
    const church = await Church.findByPk(churchId);
    if (!church || !church.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Iglesia no encontrada o inactiva',
        error: 'INVALID_CHURCH'
      });
    }

    // Validar que el líder existe, está activo y pertenece a la iglesia
    if (leaderId) {
      const leader = await User.findByPk(leaderId);
      if (!leader || !leader.isActive || leader.role !== 'leader') {
        return res.status(400).json({
          success: false,
          message: 'Líder no encontrado, inactivo o con rol incorrecto',
          error: 'INVALID_LEADER'
        });
      }

      if (leader.churchId !== churchId) {
        return res.status(400).json({
          success: false,
          message: 'El líder debe pertenecer a la misma iglesia que el grupo',
          error: 'LEADER_CHURCH_MISMATCH'
        });
      }
    }

    // Crear grupo
    const group = await Group.create({
      name: name.trim(),
      description: description ? description.trim() : null,
      location: location ? location.trim() : null,
      meetingDay,
      meetingTime,
      churchId,
      leaderId: leaderId || null,
      isActive,
      createdBy: req.user.id
    }, { transaction });

    await transaction.commit();

    // Obtener grupo creado con relaciones
    const createdGroup = await Group.findByPk(group.id, {
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Church,
          as: 'church',
          attributes: ['id', 'name', 'city', 'country']
        }
      ]
    });

    logger.info('Grupo creado exitosamente', {
      userId: req.user.id,
      groupId: group.id,
      groupName: group.name,
      churchId: group.churchId,
      leaderId: group.leaderId,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Grupo creado exitosamente',
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
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error creando grupo', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      groupName: req.body?.name,
      ip: req.ip
    });

    // Errores específicos
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un grupo con ese nombre en la iglesia',
        error: 'DUPLICATE_GROUP_NAME'
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
// ACTUALIZAR GRUPO
// =============================================
const updateGroup = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      name,
      description,
      location,
      meetingDay,
      meetingTime,
      leaderId,
      isActive
    } = req.body;

    // Verificar permisos
    const permissions = await checkGroupPermissions(req.user.id, req.user.role, id);
    if (!permissions.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para editar este grupo',
        error: 'ACCESS_DENIED'
      });
    }

    // Buscar grupo
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error: 'GROUP_NOT_FOUND'
      });
    }

    // Verificar cambio de líder
    if (leaderId !== undefined && leaderId !== group.leaderId) {
      if (req.user.role === 'leader' && leaderId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Los líderes no pueden cambiar la asignación de liderazgo',
          error: 'CANNOT_CHANGE_LEADER'
        });
      }

      if (leaderId) {
        const newLeader = await User.findByPk(leaderId);
        if (!newLeader || !newLeader.isActive || newLeader.role !== 'leader') {
          return res.status(400).json({
            success: false,
            message: 'Nuevo líder no válido',
            error: 'INVALID_LEADER'
          });
        }

        if (newLeader.churchId !== group.churchId) {
          return res.status(400).json({
            success: false,
            message: 'El nuevo líder debe pertenecer a la misma iglesia',
            error: 'LEADER_CHURCH_MISMATCH'
          });
        }
      }
    }

    // Preparar datos de actualización
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (location !== undefined) updateData.location = location ? location.trim() : null;
    if (meetingDay !== undefined) updateData.meetingDay = meetingDay;
    if (meetingTime !== undefined) updateData.meetingTime = meetingTime;
    if (leaderId !== undefined) updateData.leaderId = leaderId;
    if (isActive !== undefined) updateData.isActive = isActive;

    updateData.updatedBy = req.user.id;

    // Actualizar grupo
    await group.update(updateData, { transaction });
    await transaction.commit();

    // Obtener grupo actualizado con relaciones
    const updatedGroup = await Group.findByPk(id, {
      include: [
        {
          model: User,
          as: 'leader',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Church,
          as: 'church',
          attributes: ['id', 'name', 'city', 'country']
        }
      ]
    });

    logger.info('Grupo actualizado exitosamente', {
      userId: req.user.id,
      groupId: group.id,
      updatedFields: Object.keys(updateData),
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Grupo actualizado exitosamente',
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
      },
      updatedFields: Object.keys(updateData)
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error actualizando grupo', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      groupId: req.params?.id,
      ip: req.ip
    });

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
// ELIMINAR GRUPO (SOFT DELETE)
// =============================================
const deleteGroup = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    const { force = false } = req.query;

    // Verificar permisos
    const permissions = await checkGroupPermissions(req.user.id, req.user.role, id);
    if (!permissions.hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este grupo',
        error: 'ACCESS_DENIED'
      });
    }

    // Buscar grupo
    const group = await Group.findByPk(id);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error: 'GROUP_NOT_FOUND'
      });
    }

    // Verificar dependencias
    const [memberCount, studentCount, metricCount, indicatorCount] = await Promise.all([
      Member.count({ where: { groupId: group.id, isActive: true } }),
      BibleStudent.count({ where: { groupId: group.id, isActive: true } }),
      GroupMetric.count({ where: { groupId: group.id } }),
      SpiritualIndicator.count({ 
        include: [{
          model: Member,
          where: { groupId: group.id, isActive: true }
        }]
      })
    ]);

    const totalDependencies = memberCount + studentCount + metricCount + indicatorCount;

    if (totalDependencies > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `El grupo tiene ${memberCount} miembro(s), ${studentCount} estudiante(s), ${metricCount} métrica(s) y ${indicatorCount} indicador(es). Use force=true para eliminar de todas formas`,
        error: 'GROUP_HAS_DEPENDENCIES',
        dependencies: {
          members: memberCount,
          students: studentCount,
          metrics: metricCount,
          indicators: indicatorCount
        }
      });
    }

    // Si force=true, desactivar todas las dependencias
    if (force && totalDependencies > 0) {
      // Desactivar miembros
      await Member.update(
        { 
          isActive: false, 
          deletedAt: new Date(),
          deletedBy: req.user.id 
        },
        { 
          where: { groupId: group.id, isActive: true },
          transaction 
        }
      );

      // Desactivar estudiantes bíblicos
      await BibleStudent.update(
        { 
          isActive: false, 
          deletedAt: new Date(),
          deletedBy: req.user.id 
        },
        { 
          where: { groupId: group.id, isActive: true },
          transaction 
        }
      );

      // No eliminamos métricas ni indicadores ya que son datos históricos importantes
    }

    // Soft delete del grupo
    await group.update({
      isActive: false,
      deletedAt: new Date(),
      deletedBy: req.user.id
    }, { transaction });

    await transaction.commit();

    logger.info('Grupo eliminado exitosamente', {
      userId: req.user.id,
      groupId: group.id,
      groupName: group.name,
      force: force,
      affectedMembers: force ? memberCount : 0,
      affectedStudents: force ? studentCount : 0,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Grupo eliminado exitosamente',
      group: {
        id: group.id,
        name: group.name,
        isActive: false,
        deletedAt: group.deletedAt
      },
      affectedRecords: {
        members: force ? memberCount : 0,
        students: force ? studentCount : 0,
        preservedMetrics: metricCount,
        preservedIndicators: indicatorCount
      }
    });

  } catch (error) {
    await transaction.rollback();

    logger.error('Error eliminando grupo', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
      groupId: req.params?.id,
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
// ESTADÍSTICAS DE GRUPOS
// =============================================
const getGroupStats = async (req, res) => {
  try {
    // Verificar permisos y construir filtros según rol
    let whereClause = {};
    
    if (req.user.role === 'leader') {
      whereClause.leaderId = req.user.id;
    } else if (req.user.role === 'director') {
      whereClause.churchId = req.user.churchId;
    }

    // Estadísticas generales
    const totalGroups = await Group.count({ where: whereClause });
    const activeGroups = await Group.count({ 
      where: { ...whereClause, isActive: true } 
    });

    // Estadísticas por iglesia (solo para admin)
    let churchStats = [];
    if (req.user.role === 'admin') {
      churchStats = await Group.findAll({
        attributes: [
          [db.sequelize.col('church.name'), 'churchName'],
          [db.sequelize.fn('COUNT', db.sequelize.col('Group.id')), 'count']
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
    }

    // Top grupos por número de miembros
    const groupsByMembers = await Group.findAll({
      attributes: [
        'id',
        'name',
        [db.sequelize.col('church.name'), 'churchName'],
        [db.sequelize.col('leader.firstName'), 'leaderFirstName'],
        [db.sequelize.col('leader.lastName'), 'leaderLastName'],
        [
          db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
          'memberCount'
        ]
      ],
      include: [
        {
          model: Church,
          as: 'church',
          attributes: []
        },
        {
          model: User,
          as: 'leader',
          attributes: []
        }
      ],
      where: { ...whereClause, isActive: true },
      order: [[db.sequelize.literal('memberCount'), 'DESC']],
      limit: 10,
      raw: true
    });

    // Grupos creados por mes (últimos 12 meses)
    const monthlyCreations = await Group.findAll({
      attributes: [
        [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'month'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: {
        ...whereClause,
        createdAt: {
          [Op.gte]: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
        }
      },
      group: [db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt'))],
      order: [[db.sequelize.fn('DATE_TRUNC', 'month', db.sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // Distribución por día de reunión
    const meetingDayDistribution = await Group.findAll({
      attributes: [
        'meetingDay',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: { ...whereClause, isActive: true, meetingDay: { [Op.not]: null } },
      group: ['meetingDay'],
      raw: true
    });

    logger.info('Estadísticas de grupos obtenidas', {
      userId: req.user.id,
      userRole: req.user.role,
      ip: req.ip
    });

    const stats = {
      general: {
        totalGroups,
        activeGroups,
        inactiveGroups: totalGroups - activeGroups
      },
      topGroupsByMembers: groupsByMembers.map(group => ({
        id: group.id,
        name: group.name,
        church: group.churchName,
        leader: group.leaderFirstName && group.leaderLastName 
          ? `${group.leaderFirstName} ${group.leaderLastName}` 
          : 'Sin líder',
        memberCount: parseInt(group.memberCount || 0)
      })),
      monthlyCreations: monthlyCreations.map(stat => ({
        month: stat.month,
        count: parseInt(stat.count)
      })),
      meetingDayDistribution: meetingDayDistribution.reduce((acc, stat) => {
        acc[stat.meetingDay] = parseInt(stat.count);
        return acc;
      }, {})
    };

    // Agregar estadísticas por iglesia solo para admin
    if (req.user.role === 'admin') {
      stats.byChurch = churchStats.reduce((acc, stat) => {
        acc[stat.churchName || 'Sin iglesia'] = parseInt(stat.count);
        return acc;
      }, {});
    }

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      stats
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de grupos', {
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
// OBTENER GRUPOS DEL USUARIO ACTUAL
// =============================================
const getMyGroups = async (req, res) => {
  try {
    let groups = [];

    if (req.user.role === 'leader') {
      // Líderes obtienen sus grupos asignados
      groups = await Group.findAll({
        where: { 
          leaderId: req.user.id, 
          isActive: true 
        },
        include: [
          {
            model: Church,
            as: 'church',
            attributes: ['id', 'name', 'city', 'country']
          }
        ],
        attributes: {
          include: [
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
              'memberCount'
            ],
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "BibleStudents" WHERE "BibleStudents"."groupId" = "Group"."id" AND "BibleStudents"."isActive" = true)'),
              'studentCount'
            ]
          ]
        },
        order: [['name', 'ASC']]
      });
    } else if (req.user.role === 'director') {
      // Directores obtienen grupos de su iglesia
      groups = await Group.findAll({
        where: { 
          churchId: req.user.churchId, 
          isActive: true 
        },
        include: [
          {
            model: User,
            as: 'leader',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: Church,
            as: 'church',
            attributes: ['id', 'name', 'city', 'country']
          }
        ],
        attributes: {
          include: [
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
              'memberCount'
            ],
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "BibleStudents" WHERE "BibleStudents"."groupId" = "Group"."id" AND "BibleStudents"."isActive" = true)'),
              'studentCount'
            ]
          ]
        },
        order: [['name', 'ASC']]
      });
    } else if (req.user.role === 'admin') {
      // Admin obtiene todos los grupos activos (limitado a 50 para rendimiento)
      groups = await Group.findAll({
        where: { isActive: true },
        include: [
          {
            model: User,
            as: 'leader',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: Church,
            as: 'church',
            attributes: ['id', 'name', 'city', 'country']
          }
        ],
        attributes: {
          include: [
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "Members" WHERE "Members"."groupId" = "Group"."id" AND "Members"."isActive" = true)'),
              'memberCount'
            ],
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "BibleStudents" WHERE "BibleStudents"."groupId" = "Group"."id" AND "BibleStudents"."isActive" = true)'),
              'studentCount'
            ]
          ]
        },
        order: [['name', 'ASC']],
        limit: 50
      });
    }

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

    logger.info('Grupos del usuario obtenidos', {
      userId: req.user.id,
      userRole: req.user.role,
      groupCount: formattedGroups.length,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Grupos obtenidos exitosamente',
      groups: formattedGroups,
      total: formattedGroups.length
    });

  } catch (error) {
    logger.error('Error obteniendo grupos del usuario', {
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
  getAllGroups,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  
  // Funciones especiales
  getMyGroups,
  getGroupStats,
  
  // Helper para otros controladores
  checkGroupPermissions
};