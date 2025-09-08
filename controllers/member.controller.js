/**
 * MEMBER.CONTROLLER.JS - Controlador de miembros del sistema
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD completo de miembros con validaciones de permisos
 * Líderes solo pueden gestionar miembros de sus grupos
 * Incluye estadísticas, búsquedas avanzadas y gestión de indicadores
 */

const { Member, User, Group, Church, Indicator, Semester } = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// =============================================================================
// CREAR NUEVO MIEMBRO
// =============================================================================
const createMember = async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, birthDate, gender,
      address, city, country, occupation, maritalStatus,
      baptizedDate, membershipDate, spiritualGifts, 
      emergencyContact, notes, isActive 
    } = req.body;
    
    const { groupId } = req.params;

    // Verificar que el grupo existe
    const group = await Group.findByPk(groupId, {
      include: [{ model: Church }]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar permisos según rol
    if (req.userRole === 'leader') {
      // Líderes solo pueden agregar miembros a sus grupos
      if (group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes agregar miembros a tus propios grupos'
        });
      }
    } else if (req.userRole === 'director') {
      // Directores solo en grupos de su iglesia
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes agregar miembros a grupos de tu iglesia'
        });
      }
    }

    // Verificar capacidad del grupo
    const currentMembers = await Member.count({
      where: { groupId, isActive: true }
    });

    if (currentMembers >= group.capacity) {
      return res.status(400).json({
        success: false,
        message: `El grupo ha alcanzado su capacidad máxima de ${group.capacity} miembros`
      });
    }

    // Verificar email único en el grupo
    if (email) {
      const existingMember = await Member.findOne({
        where: { 
          groupId,
          email: email.toLowerCase(),
          isActive: true
        }
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un miembro con este email en el grupo'
        });
      }
    }

    // Crear miembro
    const member = await Member.create({
      groupId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email ? email.toLowerCase() : null,
      phone,
      birthDate,
      gender,
      address,
      city,
      country,
      occupation,
      maritalStatus,
      baptizedDate,
      membershipDate,
      spiritualGifts,
      emergencyContact,
      notes,
      isActive: isActive !== undefined ? isActive : true
    });

    // Obtener miembro completo con relaciones
    const newMember = await Member.findByPk(member.id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    logger.info(`Miembro creado: ${member.firstName} ${member.lastName} en grupo ${group.name}`, {
      memberId: member.id,
      groupId,
      userId: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Miembro creado exitosamente',
      data: newMember
    });

  } catch (error) {
    logger.error('Error al crear miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// OBTENER TODOS LOS MIEMBROS DE UN GRUPO
// =============================================================================
const getMembersByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      isActive,
      gender,
      maritalStatus,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Verificar que el grupo existe y permisos
    const group = await Group.findByPk(groupId, {
      include: [{ model: Church }]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes ver miembros de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver miembros de grupos de tu iglesia'
        });
      }
    }

    // Construir filtros
    const where = { groupId };

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (gender) {
      where.gender = gender;
    }

    if (maritalStatus) {
      where.maritalStatus = maritalStatus;
    }

    // Calcular offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Obtener miembros con paginación
    const { count, rows: members } = await Member.findAndCountAll({
      where,
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        },
        {
          model: Indicator,
          attributes: ['id', 'type', 'value', 'date'],
          include: [{
            model: Semester,
            attributes: ['id', 'name', 'year']
          }],
          separate: true,
          limit: 5,
          order: [['date', 'DESC']]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    res.json({
      success: true,
      message: 'Miembros obtenidos exitosamente',
      data: {
        members,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        group: {
          id: group.id,
          name: group.name,
          church: group.Church.name
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener miembros:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// OBTENER MIEMBRO POR ID
// =============================================================================
const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name', 'leaderId'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }, {
            model: User,
            as: 'Leader',
            attributes: ['id', 'firstName', 'lastName']
          }]
        },
        {
          model: Indicator,
          include: [{
            model: Semester,
            attributes: ['id', 'name', 'year']
          }],
          order: [['date', 'DESC']]
        }
      ]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este miembro'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (member.Group.Church.id !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este miembro'
        });
      }
    }

    res.json({
      success: true,
      message: 'Miembro obtenido exitosamente',
      data: member
    });

  } catch (error) {
    logger.error('Error al obtener miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ACTUALIZAR MIEMBRO
// =============================================================================
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Buscar miembro
    const member = await Member.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
      }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes editar miembros de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes editar miembros de grupos de tu iglesia'
        });
      }
    }

    // Verificar email único si se está actualizando
    if (updates.email && updates.email !== member.email) {
      const existingMember = await Member.findOne({
        where: { 
          groupId: member.groupId,
          email: updates.email.toLowerCase(),
          isActive: true,
          id: { [Op.ne]: id }
        }
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un miembro con este email en el grupo'
        });
      }
    }

    // Limpiar y procesar updates
    if (updates.firstName) updates.firstName = updates.firstName.trim();
    if (updates.lastName) updates.lastName = updates.lastName.trim();
    if (updates.email) updates.email = updates.email.toLowerCase();

    // Actualizar miembro
    await member.update(updates);

    // Obtener miembro actualizado
    const updatedMember = await Member.findByPk(id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    logger.info(`Miembro actualizado: ${member.firstName} ${member.lastName}`, {
      memberId: id,
      updates: Object.keys(updates),
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Miembro actualizado exitosamente',
      data: updatedMember
    });

  } catch (error) {
    logger.error('Error al actualizar miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ELIMINAR MIEMBRO
// =============================================================================
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Buscar miembro
    const member = await Member.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
      }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes eliminar miembros de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes eliminar miembros de grupos de tu iglesia'
        });
      }
    }

    if (permanent === 'true') {
      // Eliminación permanente (solo admin)
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar permanentemente'
        });
      }

      // Eliminar indicadores relacionados
      await Indicator.destroy({
        where: { memberId: id }
      });

      // Eliminar miembro
      await member.destroy();

      logger.warn(`Miembro eliminado permanentemente: ${member.firstName} ${member.lastName}`, {
        memberId: id,
        userId: req.userId
      });

      res.json({
        success: true,
        message: 'Miembro eliminado permanentemente'
      });

    } else {
      // Eliminación lógica (desactivar)
      await member.update({ isActive: false });

      logger.info(`Miembro desactivado: ${member.firstName} ${member.lastName}`, {
        memberId: id,
        userId: req.userId
      });

      res.json({
        success: true,
        message: 'Miembro desactivado exitosamente'
      });
    }

  } catch (error) {
    logger.error('Error al eliminar miembro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ESTADÍSTICAS DE MIEMBROS
// =============================================================================
const getMemberStats = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verificar grupo y permisos (similar a otros métodos)
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Estadísticas básicas
    const totalMembers = await Member.count({
      where: { groupId, isActive: true }
    });

    const genderStats = await Member.findAll({
      where: { groupId, isActive: true },
      attributes: [
        'gender',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['gender']
    });

    const maritalStats = await Member.findAll({
      where: { groupId, isActive: true },
      attributes: [
        'maritalStatus',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['maritalStatus']
    });

    const ageGroups = await Member.findAll({
      where: { 
        groupId, 
        isActive: true,
        birthDate: { [Op.ne]: null }
      },
      attributes: [
        [Sequelize.literal(`
          CASE 
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 18 THEN 'Menores (0-17)'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 30 THEN 'Jóvenes (18-29)'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 50 THEN 'Adultos (30-49)'
            WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 65 THEN 'Adultos Mayores (50-64)'
            ELSE 'Ancianos (65+)'
          END
        `), 'ageGroup'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: [Sequelize.literal('age_group')],
      raw: true
    });

    const recentMembers = await Member.findAll({
      where: { 
        groupId, 
        isActive: true,
        membershipDate: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Último mes
        }
      },
      attributes: ['id', 'firstName', 'lastName', 'membershipDate'],
      order: [['membershipDate', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: {
        totalMembers,
        capacity: group.capacity,
        occupancyRate: ((totalMembers / group.capacity) * 100).toFixed(1),
        genderDistribution: genderStats,
        maritalDistribution: maritalStats,
        ageDistribution: ageGroups,
        recentMembers
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de miembros:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// EXPORTAR FUNCIONES
// =============================================================================
module.exports = {
  createMember,
  getMembersByGroup,
  getMemberById,
  updateMember,
  deleteMember,
  getMemberStats
};