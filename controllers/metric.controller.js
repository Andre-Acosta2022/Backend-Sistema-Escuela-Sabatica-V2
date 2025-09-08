/**
 * METRIC.CONTROLLER.JS - Controlador de métricas del sistema
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD completo de métricas de grupos con análisis estadístico
 * Incluye seguimiento trimestral, comparativas y tendencias
 */

const { Metric, User, Group, Church, Semester } = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// =============================================================================
// CREAR NUEVA MÉTRICA
// =============================================================================
const createMetric = async (req, res) => {
  try {
    const { 
      weeklyAttendance, monthlyVisitors, newMembers, baptisms,
      conversions, bibleStudies, prayerRequests, communityEvents,
      offerings, tithe, specialOfferings, notes, recordDate 
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
      if (group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes registrar métricas de tus propios grupos'
        });
      }
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes registrar métricas de grupos de tu iglesia'
        });
      }
    }

    // Obtener o crear semestre actual
    const currentDate = new Date(recordDate || Date.now());
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
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

    // Verificar si ya existe una métrica para el mismo período (semana)
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const existingMetric = await Metric.findOne({
      where: {
        groupId,
        recordDate: {
          [Op.between]: [weekStart, weekEnd]
        }
      }
    });

    if (existingMetric) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe una métrica registrada para esta semana',
        data: {
          existingDate: existingMetric.recordDate,
          weekStart,
          weekEnd
        }
      });
    }

    // Crear métrica
    const metric = await Metric.create({
      groupId,
      semesterId: semester.id,
      weeklyAttendance: weeklyAttendance || 0,
      monthlyVisitors: monthlyVisitors || 0,
      newMembers: newMembers || 0,
      baptisms: baptisms || 0,
      conversions: conversions || 0,
      bibleStudies: bibleStudies || 0,
      prayerRequests: prayerRequests || 0,
      communityEvents: communityEvents || 0,
      offerings: offerings || 0,
      tithe: tithe || 0,
      specialOfferings: specialOfferings || 0,
      notes,
      recordDate: currentDate,
      registeredBy: req.userId
    });

    // Obtener métrica completa con relaciones
    const newMetric = await Metric.findByPk(metric.id, {
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
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    logger.info(`Métrica creada para grupo ${group.name}`, {
      metricId: metric.id,
      groupId,
      weeklyAttendance,
      recordDate: currentDate,
      userId: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Métrica registrada exitosamente',
      data: newMetric
    });

  } catch (error) {
    logger.error('Error al crear métrica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// OBTENER MÉTRICAS DE UN GRUPO
// =============================================================================
const getMetricsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      semesterId,
      startDate,
      endDate,
      sortBy = 'recordDate',
      sortOrder = 'DESC'
    } = req.query;

    // Verificar grupo y permisos
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
        message: 'Solo puedes ver métricas de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver métricas de grupos de tu iglesia'
        });
      }
    }

    // Construir filtros
    const where = { groupId };

    if (semesterId) {
      where.semesterId = semesterId;
    }

    if (startDate && endDate) {
      where.recordDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    // Calcular offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Obtener métricas con paginación
    const { count, rows: metrics } = await Metric.findAndCountAll({
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
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'RegisteredBy',
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
      message: 'Métricas obtenidas exitosamente',
      data: {
        metrics,
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
    logger.error('Error al obtener métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// OBTENER MÉTRICA POR ID
// =============================================================================
const getMetricById = async (req, res) => {
  try {
    const { id } = req.params;

    const metric = await Metric.findByPk(id, {
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
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'Métrica no encontrada'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && metric.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta métrica'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (metric.Group.Church.id !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver esta métrica'
        });
      }
    }

    res.json({
      success: true,
      message: 'Métrica obtenida exitosamente',
      data: metric
    });

  } catch (error) {
    logger.error('Error al obtener métrica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ACTUALIZAR MÉTRICA
// =============================================================================
const updateMetric = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Buscar métrica
    const metric = await Metric.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
      }]
    });

    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'Métrica no encontrada'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && metric.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes editar métricas de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (metric.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes editar métricas de grupos de tu iglesia'
        });
      }
    }

    // No permitir cambios en métricas muy antiguas (más de 30 días)
    const daysDiff = Math.floor((new Date() - new Date(metric.recordDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30 && req.userRole !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden editar métricas de más de 30 días'
      });
    }

    // Registrar quien actualiza
    updates.lastUpdatedBy = req.userId;
    updates.updatedAt = new Date();

    // Actualizar métrica
    await metric.update(updates);

    // Obtener métrica actualizada
    const updatedMetric = await Metric.findByPk(id, {
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
          model: Semester,
          attributes: ['id', 'name', 'year']
        },
        {
          model: User,
          as: 'RegisteredBy',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });

    logger.info(`Métrica actualizada: ${metric.Group.name}`, {
      metricId: id,
      updates: Object.keys(updates),
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Métrica actualizada exitosamente',
      data: updatedMetric
    });

  } catch (error) {
    logger.error('Error al actualizar métrica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ELIMINAR MÉTRICA
// =============================================================================
const deleteMetric = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar métrica
    const metric = await Metric.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
      }]
    });

    if (!metric) {
      return res.status(404).json({
        success: false,
        message: 'Métrica no encontrada'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && metric.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes eliminar métricas de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (metric.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes eliminar métricas de grupos de tu iglesia'
        });
      }
    }

    // No permitir eliminación de métricas muy antiguas
    const daysDiff = Math.floor((new Date() - new Date(metric.recordDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7 && req.userRole !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No se pueden eliminar métricas de más de 7 días'
      });
    }

    // Eliminar métrica
    await metric.destroy();

    logger.info(`Métrica eliminada: ${metric.Group.name}`, {
      metricId: id,
      recordDate: metric.recordDate,
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Métrica eliminada exitosamente'
    });

  } catch (error) {
    logger.error('Error al eliminar métrica:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ESTADÍSTICAS Y ANÁLISIS DE MÉTRICAS
// =============================================================================
const getMetricStats = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { period = 'semester', semesterId } = req.query;

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    let dateFilter = {};
    if (semesterId) {
      dateFilter.semesterId = semesterId;
    } else {
      // Filtro por período actual
      const now = new Date();
      switch (period) {
        case 'month':
          dateFilter.recordDate = {
            [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1)
          };
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          dateFilter.recordDate = {
            [Op.gte]: new Date(now.getFullYear(), quarter * 3, 1)
          };
          break;
        default: // semester
          const semesterStart = now.getMonth() < 6 ? 0 : 6;
          dateFilter.recordDate = {
            [Op.gte]: new Date(now.getFullYear(), semesterStart, 1)
          };
      }
    }

    // Obtener métricas del período
    const metrics = await Metric.findAll({
      where: {
        groupId,
        ...dateFilter
      },
      order: [['recordDate', 'ASC']]
    });

    if (metrics.length === 0) {
      return res.json({
        success: true,
        message: 'No hay métricas para el período seleccionado',
        data: {
          totalRecords: 0,
          averages: {},
          trends: {},
          growth: {}
        }
      });
    }

    // Calcular estadísticas
    const totalRecords = metrics.length;
    
    const averages = {
      weeklyAttendance: Math.round(metrics.reduce((sum, m) => sum + m.weeklyAttendance, 0) / totalRecords),
      monthlyVisitors: Math.round(metrics.reduce((sum, m) => sum + m.monthlyVisitors, 0) / totalRecords),
      newMembers: Math.round(metrics.reduce((sum, m) => sum + m.newMembers, 0) / totalRecords),
      baptisms: Math.round(metrics.reduce((sum, m) => sum + m.baptisms, 0) / totalRecords),
      conversions: Math.round(metrics.reduce((sum, m) => sum + m.conversions, 0) / totalRecords),
      bibleStudies: Math.round(metrics.reduce((sum, m) => sum + m.bibleStudies, 0) / totalRecords)
    };

    const totals = {
      weeklyAttendance: metrics.reduce((sum, m) => sum + m.weeklyAttendance, 0),
      monthlyVisitors: metrics.reduce((sum, m) => sum + m.monthlyVisitors, 0),
      newMembers: metrics.reduce((sum, m) => sum + m.newMembers, 0),
      baptisms: metrics.reduce((sum, m) => sum + m.baptisms, 0),
      conversions: metrics.reduce((sum, m) => sum + m.conversions, 0),
      bibleStudies: metrics.reduce((sum, m) => sum + m.bibleStudies, 0),
      offerings: metrics.reduce((sum, m) => sum + parseFloat(m.offerings || 0), 0),
      tithe: metrics.reduce((sum, m) => sum + parseFloat(m.tithe || 0), 0)
    };

    // Calcular tendencias (comparar primera mitad vs segunda mitad)
    const midPoint = Math.floor(totalRecords / 2);
    const firstHalf = metrics.slice(0, midPoint);
    const secondHalf = metrics.slice(midPoint);

    const trends = {};
    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.weeklyAttendance, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.weeklyAttendance, 0) / secondHalf.length;
      trends.attendance = secondAvg > firstAvg ? 'crecimiento' : secondAvg < firstAvg ? 'declive' : 'estable';
      trends.attendanceChange = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
    }

    // Métricas recientes (últimas 4 semanas)
    const recentMetrics = metrics.slice(-4).map(m => ({
      date: m.recordDate,
      attendance: m.weeklyAttendance,
      visitors: m.monthlyVisitors,
      newMembers: m.newMembers
    }));

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: {
        totalRecords,
        period,
        averages,
        totals,
        trends,
        recentMetrics,
        highestAttendance: Math.max(...metrics.map(m => m.weeklyAttendance)),
        lowestAttendance: Math.min(...metrics.map(m => m.weeklyAttendance))
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de métricas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// COMPARATIVA ENTRE GRUPOS
// =============================================================================
const compareGroupMetrics = async (req, res) => {
  try {
    const { churchId, semesterId } = req.query;

    // Solo admin y directores pueden hacer comparativas
    if (!['admin', 'director'].includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para realizar comparativas'
      });
    }

    let whereClause = {};
    
    // Para directores, filtrar por su iglesia
    if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      whereClause.churchId = userChurch.churchId;
    } else if (churchId) {
      whereClause.churchId = churchId;
    }

    // Obtener grupos con sus métricas
    const groups = await Group.findAll({
      where: whereClause,
      include: [
        {
          model: Church,
          attributes: ['id', 'name']
        },
        {
          model: Metric,
          where: semesterId ? { semesterId } : {},
          required: false,
          include: [{
            model: Semester,
            attributes: ['id', 'name', 'year']
          }]
        }
      ]
    });

    // Procesar datos para comparativa
    const comparison = groups.map(group => {
      const metrics = group.Metrics || [];
      const totalMetrics = metrics.length;

      if (totalMetrics === 0) {
        return {
          groupId: group.id,
          groupName: group.name,
          churchName: group.Church.name,
          totalRecords: 0,
          averageAttendance: 0,
          totalConversions: 0,
          totalBaptisms: 0
        };
      }

      return {
        groupId: group.id,
        groupName: group.name,
        churchName: group.Church.name,
        totalRecords: totalMetrics,
        averageAttendance: Math.round(metrics.reduce((sum, m) => sum + m.weeklyAttendance, 0) / totalMetrics),
        totalConversions: metrics.reduce((sum, m) => sum + m.conversions, 0),
        totalBaptisms: metrics.reduce((sum, m) => sum + m.baptisms, 0),
        totalNewMembers: metrics.reduce((sum, m) => sum + m.newMembers, 0)
      };
    });

    // Ordenar por asistencia promedio
    comparison.sort((a, b) => b.averageAttendance - a.averageAttendance);

    res.json({
      success: true,
      message: 'Comparativa generada exitosamente',
      data: {
        totalGroups: comparison.length,
        comparison,
        summary: {
          totalAttendance: comparison.reduce((sum, g) => sum + g.averageAttendance, 0),
          totalConversions: comparison.reduce((sum, g) => sum + g.totalConversions, 0),
          totalBaptisms: comparison.reduce((sum, g) => sum + g.totalBaptisms, 0)
        }
      }
    });

  } catch (error) {
    logger.error('Error en comparativa de métricas:', error);
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
  createMetric,
  getMetricsByGroup,
  getMetricById,
  updateMetric,
  deleteMetric,
  getMetricStats,
  compareGroupMetrics
};