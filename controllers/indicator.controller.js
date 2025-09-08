/**
 * INDICATOR.CONTROLLER.JS - Controlador de indicadores espirituales
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD completo de indicadores espirituales individuales
 * Incluye seguimiento de crecimiento espiritual y evaluaciones periódicas
 */

const { Indicator, User, Group, Church, Member, Semester } = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// =============================================================================
// CREAR NUEVO INDICADOR ESPIRITUAL
// =============================================================================
const createIndicator = async (req, res) => {
  try {
    const { 
      type, value, date, notes, evaluatedBy 
    } = req.body;
    
    const { memberId } = req.params;

    // Verificar que el miembro existe
    const member = await Member.findByPk(memberId, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId'],
        include: [{ model: Church }]
      }]
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Miembro no encontrado'
      });
    }

    // Verificar permisos según rol
    if (req.userRole === 'leader') {
      if (member.Group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes registrar indicadores de miembros de tus grupos'
        });
      }
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes registrar indicadores de miembros de tu iglesia'
        });
      }
    }

    // Obtener o crear semestre actual
    const indicatorDate = new Date(date || Date.now());
    const currentYear = indicatorDate.getFullYear();
    const currentMonth = indicatorDate.getMonth() + 1;
    
    let semesterName, semesterStart, semesterEnd;
    if (currentMonth <= 6) {
      semesterName = `Primer Semestre ${currentYear}`;
      semesterStart = new Date(`${currentYear}-01-01`);
      semesterEnd = new Date(`${currentYear}-06-30`);
    } else {
      semesterName = `Segundo Semestre ${currentYear}`;
      semesterStart = new Date(`${currentYear}-07-01`);
      semesterEnd = new Date(`${currentYear}-12-31`);
    }

    const [semester] = await Semester.findOrCreate({
      where: { name: semesterName, year: currentYear },
      defaults: {
        name: semesterName,
        year: currentYear,
        startDate: semesterStart,
        endDate: semesterEnd,
        isActive: true
      }
    });

    // Verificar si ya existe un indicador del mismo tipo en el período
    const existingIndicator = await Indicator.findOne({
      where: {
        memberId,
        type,
        semesterId: semester.id
      }
    });

    if (existingIndicator) {
      return res.status(400).json({
        success: false,
        message: `Ya existe un indicador de tipo "${type}" para este miembro en el semestre actual`,
        data: {
          existingIndicator: {
            id: existingIndicator.id,
            value: existingIndicator.value,
            date: existingIndicator.date
          }
        }
      });
    }

    // Validar rango de valor según tipo de indicador
    const validationResult = validateIndicatorValue(type, value);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        message: validationResult.message
      });
    }

    // Crear indicador
    const indicator = await Indicator.create({
      memberId,
      semesterId: semester.id,
      type,
      value: validationResult.normalizedValue,
      date: indicatorDate,
      notes,
      evaluatedBy: evaluatedBy || req.userId,
      registeredBy: req.userId
    });

    // Obtener indicador completo con relaciones
    const newIndicator = await Indicator.findByPk(indicator.id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Group,
            attributes: ['id', 'name'],
            include: [{
              model: Church,
              attributes: ['id', 'name']
            }]
          }]
        },
        {
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'EvaluatedBy',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    logger.info(`Indicador espiritual creado para ${member.firstName} ${member.lastName}`, {
      indicatorId: indicator.id,
      memberId,
      type,
      value: indicator.value,
      userId: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Indicador espiritual registrado exitosamente',
      data: newIndicator
    });

  } catch (error) {
    logger.error('Error al crear indicador espiritual:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// OBTENER INDICADORES DE UN MIEMBRO
// =============================================================================
const getIndicatorsByMember = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      type,
      semesterId,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'DESC'
    } = req.query;

    // Verificar miembro y permisos
    const member = await Member.findByPk(memberId, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId'],
        include: [{ model: Church }]
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
        message: 'Solo puedes ver indicadores de miembros de tus grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver indicadores de miembros de tu iglesia'
        });
      }
    }

    // Construir filtros
    const where = { memberId };

    if (type) {
      where.type = type;
    }

    if (semesterId) {
      where.semesterId = semesterId;
    }

    if (startDate && endDate) {
      where.date = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // Calcular offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Obtener indicadores con paginación
    const { count, rows: indicators } = await Indicator.findAndCountAll({
      where,
      include: [
        {
          model: Member,
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'EvaluatedBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    res.json({
      success: true,
      message: 'Indicadores obtenidos exitosamente',
      data: {
        indicators,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        member: {
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          group: member.Group.name,
          church: member.Group.Church.name
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// OBTENER INDICADOR POR ID
// =============================================================================
const getIndicatorById = async (req, res) => {
  try {
    const { id } = req.params;

    const indicator = await Indicator.findByPk(id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Group,
            attributes: ['id', 'name', 'leaderId'],
            include: [{
              model: Church,
              attributes: ['id', 'name']
            }]
          }]
        },
        {
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'EvaluatedBy',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && indicator.Member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este indicador'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (indicator.Member.Group.Church.id !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este indicador'
        });
      }
    }

    res.json({
      success: true,
      message: 'Indicador obtenido exitosamente',
      data: indicator
    });

  } catch (error) {
    logger.error('Error al obtener indicador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ACTUALIZAR INDICADOR
// =============================================================================
const updateIndicator = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Buscar indicador
    const indicator = await Indicator.findByPk(id, {
      include: [{
        model: Member,
        include: [{
          model: Group,
          attributes: ['id', 'leaderId', 'churchId']
        }]
      }]
    });

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && indicator.Member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes editar indicadores de miembros de tus grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (indicator.Member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes editar indicadores de miembros de tu iglesia'
        });
      }
    }

    // Validar valor si se está actualizando
    if (updates.value !== undefined) {
      const validationResult = validateIndicatorValue(updates.type || indicator.type, updates.value);
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: validationResult.message
        });
      }
      updates.value = validationResult.normalizedValue;
    }

    // No permitir cambios en indicadores muy antiguos
    const daysDiff = Math.floor((new Date() - new Date(indicator.date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 60 && req.userRole !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden editar indicadores de más de 60 días'
      });
    }

    // Actualizar indicador
    await indicator.update(updates);

    // Obtener indicador actualizado
    const updatedIndicator = await Indicator.findByPk(id, {
      include: [
        {
          model: Member,
          attributes: ['id', 'firstName', 'lastName'],
          include: [{
            model: Group,
            attributes: ['id', 'name'],
            include: [{
              model: Church,
              attributes: ['id', 'name']
            }]
          }]
        },
        {
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'EvaluatedBy',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    logger.info(`Indicador espiritual actualizado: ${updatedIndicator.Member.firstName} ${updatedIndicator.Member.lastName}`, {
      indicatorId: id,
      updates: Object.keys(updates),
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Indicador actualizado exitosamente',
      data: updatedIndicator
    });

  } catch (error) {
    logger.error('Error al actualizar indicador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ELIMINAR INDICADOR
// =============================================================================
const deleteIndicator = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar indicador
    const indicator = await Indicator.findByPk(id, {
      include: [{
        model: Member,
        attributes: ['firstName', 'lastName'],
        include: [{
          model: Group,
          attributes: ['id', 'leaderId', 'churchId']
        }]
      }]
    });

    if (!indicator) {
      return res.status(404).json({
        success: false,
        message: 'Indicador no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && indicator.Member.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes eliminar indicadores de miembros de tus grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (indicator.Member.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes eliminar indicadores de miembros de tu iglesia'
        });
      }
    }

    // No permitir eliminación de indicadores muy antiguos
    const daysDiff = Math.floor((new Date() - new Date(indicator.date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30 && req.userRole !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden eliminar indicadores de más de 30 días'
      });
    }

    // Eliminar indicador
    await indicator.destroy();

    logger.info(`Indicador espiritual eliminado: ${indicator.Member.firstName} ${indicator.Member.lastName}`, {
      indicatorId: id,
      type: indicator.type,
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Indicador eliminado exitosamente'
    });

  } catch (error) {
    logger.error('Error al eliminar indicador:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ESTADÍSTICAS DE INDICADORES ESPIRITUALES
// =============================================================================
const getIndicatorStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { semesterId, type } = req.query;

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Construir filtros
    const memberWhere = { groupId, isActive: true };
    const indicatorWhere = {};

    if (semesterId) {
      indicatorWhere.semesterId = semesterId;
    }

    if (type) {
      indicatorWhere.type = type;
    }

    // Obtener estadísticas por tipo de indicador
    const indicatorTypes = [
      'asistencia_cultos',
      'participacion_actividades',
      'lectura_biblica',
      'vida_oracion',
      'servicio_cristiano',
      'testimonio_personal',
      'crecimiento_espiritual'
    ];

    const typeStats = await Promise.all(
      indicatorTypes.map(async (indicatorType) => {
        const stats = await Indicator.findAll({
          include: [{
            model: Member,
            where: memberWhere,
            attributes: []
          }],
          where: {
            ...indicatorWhere,
            type: indicatorType
          },
          attributes: [
            [Sequelize.fn('AVG', Sequelize.col('value')), 'average'],
            [Sequelize.fn('COUNT', Sequelize.col('Indicator.id')), 'count'],
            [Sequelize.fn('MAX', Sequelize.col('value')), 'max'],
            [Sequelize.fn('MIN', Sequelize.col('value')), 'min']
          ],
          raw: true
        });

        return {
          type: indicatorType,
          name: getIndicatorTypeName(indicatorType),
          average: parseFloat(stats[0].average || 0).toFixed(1),
          count: parseInt(stats[0].count || 0),
          max: parseInt(stats[0].max || 0),
          min: parseInt(stats[0].min || 0)
        };
      })
    );

    // Obtener miembros con mejor y peor desempeño
    const memberStats = await Member.findAll({
      where: memberWhere,
      include: [{
        model: Indicator,
        where: indicatorWhere,
        attributes: []
      }],
      attributes: [
        'id', 'firstName', 'lastName',
        [Sequelize.fn('AVG', Sequelize.col('Indicators.value')), 'averageScore'],
        [Sequelize.fn('COUNT', Sequelize.col('Indicators.id')), 'indicatorCount']
      ],
      group: ['Member.id'],
      having: Sequelize.where(
        Sequelize.fn('COUNT', Sequelize.col('Indicators.id')), 
        '>', 
        0
      ),
      order: [[Sequelize.fn('AVG', Sequelize.col('Indicators.value')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Tendencias temporales (últimos 6 meses)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trends = await Indicator.findAll({
      include: [{
        model: Member,
        where: memberWhere,
        attributes: []
      }],
      where: {
        ...indicatorWhere,
        date: { [Op.gte]: sixMonthsAgo }
      },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        [Sequelize.fn('AVG', Sequelize.col('value')), 'average'],
        [Sequelize.fn('COUNT', Sequelize.col('Indicator.id')), 'count']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: {
        typeStatistics: typeStats.filter(stat => stat.count > 0),
        memberPerformance: memberStats.map(member => ({
          id: member.id,
          name: `${member.firstName} ${member.lastName}`,
          averageScore: parseFloat(member.averageScore).toFixed(1),
          indicatorCount: parseInt(member.indicatorCount)
        })),
        monthlyTrends: trends.map(trend => ({
          month: trend.month,
          average: parseFloat(trend.average).toFixed(1),
          count: parseInt(trend.count)
        })),
        overallAverage: typeStats.length > 0 
          ? (typeStats.reduce((sum, stat) => sum + parseFloat(stat.average), 0) / typeStats.filter(stat => stat.count > 0).length).toFixed(1)
          : '0.0'
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de indicadores:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// EVALUACIÓN GRUPAL DE INDICADORES
// =============================================================================
const bulkCreateIndicators = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { indicators, semesterId } = req.body;

    if (!Array.isArray(indicators) || indicators.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un arreglo de indicadores'
      });
    }

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    if (req.userRole === 'leader' && group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes evaluar miembros de tus propios grupos'
      });
    }

    // Procesar indicadores en lote
    const results = [];
    const errors = [];

    for (let i = 0; i < indicators.length; i++) {
      const indicatorData = indicators[i];
      
      try {
        // Validar datos
        if (!indicatorData.memberId || !indicatorData.type || indicatorData.value === undefined) {
          errors.push({
            index: i,
            error: 'Faltan campos requeridos: memberId, type, value'
          });
          continue;
        }

        // Verificar que el miembro pertenece al grupo
        const member = await Member.findOne({
          where: { 
            id: indicatorData.memberId, 
            groupId,
            isActive: true 
          }
        });

        if (!member) {
          errors.push({
            index: i,
            error: 'Miembro no encontrado o no pertenece al grupo'
          });
          continue;
        }

        // Validar valor
        const validationResult = validateIndicatorValue(indicatorData.type, indicatorData.value);
        if (!validationResult.isValid) {
          errors.push({
            index: i,
            error: validationResult.message
          });
          continue;
        }

        // Crear indicador
        const indicator = await Indicator.create({
          memberId: indicatorData.memberId,
          semesterId: semesterId,
          type: indicatorData.type,
          value: validationResult.normalizedValue,
          date: new Date(indicatorData.date || Date.now()),
          notes: indicatorData.notes,
          evaluatedBy: req.userId,
          registeredBy: req.userId
        });

        results.push({
          index: i,
          indicatorId: indicator.id,
          success: true
        });

      } catch (error) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }

    logger.info(`Evaluación grupal completada: ${results.length} éxitos, ${errors.length} errores`, {
      groupId,
      userId: req.userId,
      totalIndicators: indicators.length
    });

    res.status(results.length > 0 ? 201 : 400).json({
      success: results.length > 0,
      message: `Evaluación completada: ${results.length} indicadores creados, ${errors.length} errores`,
      data: {
        successful: results,
        errors: errors,
        summary: {
          total: indicators.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    logger.error('Error en evaluación grupal:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================
const validateIndicatorValue = (type, value) => {
  const numValue = parseInt(value);
  
  if (isNaN(numValue)) {
    return {
      isValid: false,
      message: 'El valor debe ser un número'
    };
  }

  // Todos los indicadores usan escala de 1-5
  if (numValue < 1 || numValue > 5) {
    return {
      isValid: false,
      message: 'El valor debe estar entre 1 y 5'
    };
  }

  return {
    isValid: true,
    normalizedValue: numValue
  };
};

const getIndicatorTypeName = (type) => {
  const typeNames = {
    'asistencia_cultos': 'Asistencia a Cultos',
    'participacion_actividades': 'Participación en Actividades',
    'lectura_biblica': 'Lectura Bíblica',
    'vida_oracion': 'Vida de Oración',
    'servicio_cristiano': 'Servicio Cristiano',
    'testimonio_personal': 'Testimonio Personal',
    'crecimiento_espiritual': 'Crecimiento Espiritual'
  };
  
  return typeNames[type] || type;
};

// =============================================================================
// EXPORTAR FUNCIONES
// =============================================================================
module.exports = {
  createIndicator,
  getIndicatorsByMember,
  getIndicatorById,
  updateIndicator,
  deleteIndicator,
  getIndicatorStats,
  bulkCreateIndicators
};