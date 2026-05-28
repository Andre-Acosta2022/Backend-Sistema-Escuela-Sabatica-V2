/**
 * METRIC.SERVICE.JS - Servicio de Métricas e Indicadores de Grupo
 * Sistema de Gestión Misionera
 */
const { Metric, User, Group, Church, Semester } = require('../models');
const { Op } = require('sequelize');
const { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  ConflictError 
} = require('../middlewares/error.middleware');

class MetricService {

  /**
   * Verifica los permisos de acceso y edición del actor sobre un grupo específico
   */
  async checkGroupPermissions(group, userId, userRole) {
    if (userRole === 'leader') {
      if (group.leaderId !== userId) {
        throw new AuthorizationError('Solo tienes acceso a las métricas de tus propios grupos');
      }
    } else if (userRole === 'director') {
      const user = await User.findByPk(userId, { attributes: ['churchId'] });
      if (!user || group.churchId !== user.churchId) {
        throw new AuthorizationError('Solo tienes acceso a las métricas de los grupos de tu iglesia');
      }
    }
  }

  /**
   * Obtiene o calcula dinámicamente el semestre basado en la fecha del registro
   */
  async getOrCreateSemester(recordDate) {
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

    return semester;
  }

  async createMetric(groupId, data, actorId, actorRole) {
    const group = await Group.findByPk(groupId, { include: [{ model: Church }] });
    if (!group) throw new NotFoundError('Grupo misional no encontrado');

    await this.checkGroupPermissions(group, actorId, actorRole);

    const currentDate = new Date(data.recordDate || Date.now());
    const semester = await this.getOrCreateSemester(currentDate);

    // Calcular inicio y fin de la semana para evitar duplicados
    const weekStart = new Date(currentDate);
    weekStart.setDate(currentDate.getDate() - currentDate.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const existingMetric = await Metric.findOne({
      where: {
        groupId,
        recordDate: { [Op.between]: [weekStart, weekEnd] }
      }
    });

    if (existingMetric) {
      throw new ConflictError('Ya existe una métrica semanal registrada dentro de este rango de fechas');
    }

    const metric = await Metric.create({
      groupId,
      semesterId: semester.id,
      weeklyAttendance: data.weeklyAttendance || 0,
      monthlyVisitors: data.monthlyVisitors || 0,
      newMembers: data.newMembers || 0,
      baptisms: data.baptisms || 0,
      conversions: data.conversions || 0,
      bibleStudies: data.bibleStudies || 0,
      prayerRequests: data.prayerRequests || 0,
      communityEvents: data.communityEvents || 0,
      offerings: data.offerings || 0,
      tithe: data.tithe || 0,
      specialOfferings: data.specialOfferings || 0,
      notes: data.notes,
      recordDate: currentDate,
      registeredBy: actorId
    });

    return this.getDetailedMetric(metric.id);
  }

  async getMetricsByGroup(groupId, queryFilters, actorId, actorRole) {
    const { page = 1, limit = 10, semesterId, startDate, endDate, sortBy = 'recordDate', sortOrder = 'DESC' } = queryFilters;

    const group = await Group.findByPk(groupId, { include: [{ model: Church }] });
    if (!group) throw new NotFoundError('Grupo misional no encontrado');

    await this.checkGroupPermissions(group, actorId, actorRole);

    const where = { groupId };
    if (semesterId) where.semesterId = semesterId;
    if (startDate && endDate) {
      where.recordDate = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: metrics } = await Metric.findAndCountAll({
      where,
      include: [
        { model: Group, attributes: ['id', 'name'], include: [{ model: Church, attributes: ['id', 'name'] }] },
        { model: Semester, attributes: ['id', 'name', 'year'] },
        { model: User, as: 'RegisteredBy', attributes: ['id', 'firstName', 'lastName'] }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    return { metrics, total: count, group };
  }

  async getMetricById(id, actorId, actorRole) {
    const metric = await this.getDetailedMetric(id);
    if (!metric) throw new NotFoundError('Métrica semanal no encontrada');

    await this.checkGroupPermissions(metric.Group, actorId, actorRole);
    return metric;
  }

  async updateMetric(id, updates, actorId, actorRole) {
    const metric = await Metric.findByPk(id, {
      include: [{ model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'] }]
    });
    if (!metric) throw new NotFoundError('Métrica semanal no encontrada');

    await this.checkGroupPermissions(metric.Group, actorId, actorRole);

    // Restricción de auditoría histórica (máximo 30 días)
    const daysDiff = Math.floor((new Date() - new Date(metric.recordDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30 && actorRole !== 'admin') {
      throw new ValidationError('Restricción de Auditoría: No se admiten cambios en métricas consolidadas con más de 30 días');
    }

    updates.lastUpdatedBy = actorId;
    updates.updatedAt = new Date();

    await metric.update(updates);
    return this.getDetailedMetric(id);
  }

  async deleteMetric(id, actorId, actorRole) {
    const metric = await Metric.findByPk(id, {
      include: [{ model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'] }]
    });
    if (!metric) throw new NotFoundError('Métrica semanal no encontrada');

    await this.checkGroupPermissions(metric.Group, actorId, actorRole);

    const daysDiff = Math.floor((new Date() - new Date(metric.recordDate)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 7 && actorRole !== 'admin') {
      throw new ValidationError('Restricción de Seguridad: Las métricas solo se pueden purgar dentro de los primeros 7 días');
    }

    await metric.destroy();
    return metric;
  }

  async getMetricStats(groupId, query) {
    const { period = 'semester', semesterId } = query;
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundError('Grupo misional no encontrado');

    let dateFilter = {};
    if (semesterId) {
      dateFilter.semesterId = semesterId;
    } else {
      const now = new Date();
      switch (period) {
        case 'month':
          dateFilter.recordDate = { [Op.gte]: new Date(now.getFullYear(), now.getMonth(), 1) };
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          dateFilter.recordDate = { [Op.gte]: new Date(now.getFullYear(), quarter * 3, 1) };
          break;
        default: // semester
          const semesterStart = now.getMonth() < 6 ? 0 : 6;
          dateFilter.recordDate = { [Op.gte]: new Date(now.getFullYear(), semesterStart, 1) };
      }
    }

    const metrics = await Metric.findAll({
      where: { groupId, ...dateFilter },
      order: [['recordDate', 'ASC']]
    });

    if (metrics.length === 0) {
      return { totalRecords: 0, averages: {}, totals: {}, trends: {}, recentMetrics: [], highestAttendance: 0, lowestAttendance: 0 };
    }

    const totalRecords = metrics.length;
    
    const sumField = (field) => metrics.reduce((sum, m) => sum + (parseFloat(m[field]) || 0), 0);
    const avgField = (field) => Math.round(sumField(field) / totalRecords);

    const averages = {
      weeklyAttendance: avgField('weeklyAttendance'),
      monthlyVisitors: avgField('monthlyVisitors'),
      newMembers: avgField('newMembers'),
      baptisms: avgField('baptisms'),
      conversions: avgField('conversions'),
      bibleStudies: avgField('bibleStudies')
    };

    const totals = {
      weeklyAttendance: sumField('weeklyAttendance'),
      monthlyVisitors: sumField('monthlyVisitors'),
      newMembers: sumField('newMembers'),
      baptisms: sumField('baptisms'),
      conversions: sumField('conversions'),
      bibleStudies: sumField('bibleStudies'),
      offerings: sumField('offerings'),
      tithe: sumField('tithe')
    };

    // Análisis de tendencias algebraicas (mitad vs mitad)
    const trends = {};
    const midPoint = Math.floor(totalRecords / 2);
    const firstHalf = metrics.slice(0, midPoint);
    const secondHalf = metrics.slice(midPoint);

    if (firstHalf.length > 0 && secondHalf.length > 0) {
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.weeklyAttendance, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.weeklyAttendance, 0) / secondHalf.length;
      trends.attendance = secondAvg > firstAvg ? 'crecimiento' : secondAvg < firstAvg ? 'declive' : 'estable';
      trends.attendanceChange = (((secondAvg - firstAvg) / (firstAvg || 1)) * 100).toFixed(1);
    }

    const recentMetrics = metrics.slice(-4).map(m => ({
      date: m.recordDate,
      attendance: m.weeklyAttendance,
      visitors: m.monthlyVisitors,
      newMembers: m.newMembers
    }));

    return {
      totalRecords,
      averages,
      totals,
      trends,
      recentMetrics,
      highestAttendance: Math.max(...metrics.map(m => m.weeklyAttendance)),
      lowestAttendance: Math.min(...metrics.map(m => m.weeklyAttendance))
    };
  }

  async compareGroupMetrics(query, actorId, actorRole) {
    const { churchId, semesterId } = query;

    if (!['admin', 'director'].includes(actorRole)) {
      throw new AuthorizationError('Acceso denegado: Tus credenciales no permiten auditorías comparativas intergrupales');
    }

    let whereClause = {};
    if (actorRole === 'director') {
      const user = await User.findByPk(actorId, { attributes: ['churchId'] });
      whereClause.churchId = user.churchId;
    } else if (churchId) {
      whereClause.churchId = churchId;
    }

    const groups = await Group.findAll({
      where: whereClause,
      include: [
        { model: Church, attributes: ['id', 'name'] },
        { 
          model: Metric, 
          where: semesterId ? { semesterId } : {}, 
          required: false,
          include: [{ model: Semester, attributes: ['id', 'name', 'year'] }]
        }
      ]
    });

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
          totalBaptisms: 0,
          totalNewMembers: 0
        };
      }

      const sumM = (field) => metrics.reduce((sum, m) => sum + (m[field] || 0), 0);

      return {
        groupId: group.id,
        groupName: group.name,
        churchName: group.Church.name,
        totalRecords: totalMetrics,
        averageAttendance: Math.round(sumM('weeklyAttendance') / totalMetrics),
        totalConversions: sumM('conversions'),
        totalBaptisms: sumM('baptisms'),
        totalNewMembers: sumM('newMembers')
      };
    });

    comparison.sort((a, b) => b.averageAttendance - a.averageAttendance);

    return comparison;
  }

  // Helper Interno de Eager Loading unificado
  async getDetailedMetric(id) {
    return Metric.findByPk(id, {
      include: [
        { model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'], include: [{ model: Church, attributes: ['id', 'name'] }] },
        { model: Semester, attributes: ['id', 'name', 'year'] },
        { model: User, as: 'RegisteredBy', attributes: ['id', 'firstName', 'lastName'] }
      ]
    });
  }
}

module.exports = new MetricService();