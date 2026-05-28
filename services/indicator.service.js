/**
 * INDICATOR.SERVICE.JS - Servicio de Indicadores Espirituales
 * Sistema de Gestión Misionera
 */
const { Indicator, Group, Church, Member, Semester, User } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError,
  ConflictError 
} = require('../middlewares/error.middleware');

class IndicatorService {

  /**
   * Valida los permisos de un usuario sobre un miembro específico
   */
  async checkPermissions(member, userId, userRole) {
    if (userRole === 'leader') {
      if (member.Group.leaderId !== userId) {
        throw new AuthorizationError('Solo tienes acceso a los miembros de tus propios grupos');
      }
    } else if (userRole === 'director') {
      const user = await User.findByPk(userId, { attributes: ['churchId'] });
      if (!user || member.Group.churchId !== user.churchId) {
        throw new AuthorizationError('Solo tienes acceso a los miembros de tu propia iglesia');
      }
    }
  }

  /**
   * Obtiene o calcula el semestre correspondiente a una fecha
   */
  async getOrCreateSemester(dateInput) {
    const indicatorDate = new Date(dateInput || Date.now());
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

    return semester;
  }

  /**
   * Normaliza y valida el rango escalar del indicador
   */
  validateIndicatorValue(type, value) {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) {
      throw new ValidationError('El valor del indicador debe ser un número válido');
    }
    if (numValue < 1 || numValue > 5) {
      throw new ValidationError('El valor de la evaluación espiritual debe estar en la escala del 1 al 5');
    }
    return numValue;
  }

  async createIndicator(memberId, data, actorId, actorRole) {
    const { type, value, date, notes, evaluatedBy } = data;

    const member = await Member.findByPk(memberId, {
      include: [{ model: Group, attributes: ['id', 'leaderId', 'churchId'] }]
    });
    if (!member) throw new NotFoundError('Miembro no encontrado');

    await this.checkPermissions(member, actorId, actorRole);
    
    const normalizedValue = this.validateIndicatorValue(type, value);
    const semester = await this.getOrCreateSemester(date);

    // Verificar duplicados en el mismo periodo semestral
    const existingIndicator = await Indicator.findOne({
      where: { memberId, type, semesterId: semester.id }
    });
    if (existingIndicator) {
      throw new ConflictError(`Ya se ha registrado un indicador de tipo "${type}" para este miembro en el semestre actual`);
    }

    const indicator = await Indicator.create({
      memberId,
      semesterId: semester.id,
      type,
      value: normalizedValue,
      date: date ? new Date(date) : new Date(),
      notes,
      evaluatedBy: evaluatedBy || actorId,
      registeredBy: actorId
    });

    return this.getDetailedIndicator(indicator.id);
  }

  async getIndicatorsByMember(memberId, queryFilters, actorId, actorRole) {
    const { page = 1, limit = 10, type, semesterId, startDate, endDate, sortBy = 'date', sortOrder = 'DESC' } = queryFilters;

    const member = await Member.findByPk(memberId, {
      include: [{ model: Group, include: [{ model: Church }] }]
    });
    if (!member) throw new NotFoundError('Miembro no encontrado');
    
    await this.checkPermissions(member, actorId, actorRole);

    const where = { memberId };
    if (type) where.type = type;
    if (semesterId) where.semesterId = semesterId;
    if (startDate && endDate) {
      where.date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: indicators } = await Indicator.findAndCountAll({
      where,
      include: [
        { model: Member, attributes: ['id', 'firstName', 'lastName'] },
        { model: Semester, attributes: ['id', 'name', 'year'] },
        { model: User, as: 'EvaluatedBy', attributes: ['id', 'firstName', 'lastName'] }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    return { indicators, total: count, member };
  }

  async getIndicatorById(id, actorId, actorRole) {
    const indicator = await this.getDetailedIndicator(id);
    if (!indicator) throw new NotFoundError('Indicador espiritual no encontrado');

    await this.checkPermissions(indicator.Member, actorId, actorRole);
    return indicator;
  }

  async updateIndicator(id, updates, actorId, actorRole) {
    const indicator = await Indicator.findByPk(id, {
      include: [{ model: Member, include: [{ model: Group }] }]
    });
    if (!indicator) throw new NotFoundError('Indicador espiritual no encontrado');

    await this.checkPermissions(indicator.Member, actorId, actorRole);

    if (updates.value !== undefined) {
      updates.value = this.validateIndicatorValue(updates.type || indicator.type, updates.value);
    }

    // Regla de negocio histórica: Bloqueo de modificaciones antiguas
    const daysDiff = Math.floor((new Date() - new Date(indicator.date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 60 && actorRole !== 'admin') {
      throw new ValidationError('Restricción de Auditoría: No se pueden alterar registros con más de 60 días de antigüedad');
    }

    await indicator.update(updates);
    return this.getDetailedIndicator(id);
  }

  async deleteIndicator(id, actorId, actorRole) {
    const indicator = await Indicator.findByPk(id, {
      include: [{ model: Member, include: [{ model: Group }] }]
    });
    if (!indicator) throw new NotFoundError('Indicador espiritual no encontrado');

    await this.checkPermissions(indicator.Member, actorId, actorRole);

    const daysDiff = Math.floor((new Date() - new Date(indicator.date)) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30 && actorRole !== 'admin') {
      throw new ValidationError('Restricción de Auditoría: No se permite la remoción de registros históricos con más de 30 días');
    }

    await indicator.destroy();
    return indicator;
  }

  async getGroupStats(groupId, query) {
    const { semesterId, type } = query;
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundError('Grupo misional no encontrado');

    const memberWhere = { groupId, isActive: true };
    const indicatorWhere = {};
    if (semesterId) indicatorWhere.semesterId = semesterId;
    if (type) indicatorWhere.type = type;

    const indicatorTypes = [
      'asistencia_cultos', 'participacion_actividades', 'lectura_biblica',
      'vida_oracion', 'servicio_cristiano', 'testimonio_personal', 'crecimiento_espiritual'
    ];

    // Ejecución paralela controlada de métricas agregadas
    const typeStats = await Promise.all(
      indicatorTypes.map(async (indicatorType) => {
        const stats = await Indicator.findAll({
          include: [{ model: Member, where: memberWhere, attributes: [] }],
          where: { ...indicatorWhere, type: indicatorType },
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
          name: this.getIndicatorTypeName(indicatorType),
          average: parseFloat(stats[0].average || 0).toFixed(1),
          count: parseInt(stats[0].count || 0),
          max: parseInt(stats[0].max || 0),
          min: parseInt(stats[0].min || 0)
        };
      })
    );

    const memberStats = await Member.findAll({
      where: memberWhere,
      include: [{ model: Indicator, where: indicatorWhere, attributes: [] }],
      attributes: [
        'id', 'firstName', 'lastName',
        [Sequelize.fn('AVG', Sequelize.col('Indicators.value')), 'averageScore'],
        [Sequelize.fn('COUNT', Sequelize.col('Indicators.id')), 'indicatorCount']
      ],
      group: ['Member.id'],
      having: Sequelize.where(Sequelize.fn('COUNT', Sequelize.col('Indicators.id')), '>', 0),
      order: [[Sequelize.fn('AVG', Sequelize.col('Indicators.value')), 'DESC']],
      limit: 10,
      raw: true
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const trends = await Indicator.findAll({
      include: [{ model: Member, where: memberWhere, attributes: [] }],
      where: { ...indicatorWhere, date: { [Op.gte]: sixMonthsAgo } },
      attributes: [
        [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'month'],
        [Sequelize.fn('AVG', Sequelize.col('value')), 'average'],
        [Sequelize.fn('COUNT', Sequelize.col('Indicator.id')), 'count']
      ],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('date')), 'ASC']],
      raw: true
    });

    const activeStats = typeStats.filter(stat => stat.count > 0);
    const overallAverage = activeStats.length > 0
      ? (activeStats.reduce((sum, stat) => sum + parseFloat(stat.average), 0) / activeStats.length).toFixed(1)
      : '0.0';

    return { typeStats: activeStats, memberStats, trends, overallAverage };
  }

  async bulkCreate(groupId, data, actorId, actorRole) {
    const { indicators, semesterId } = data;
    if (!Array.isArray(indicators) || indicators.length === 0) {
      throw new ValidationError('Se requiere una colección indexada (Array) de evaluaciones');
    }

    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundError('Grupo misional no encontrado');
    if (actorRole === 'leader' && group.leaderId !== actorId) {
      throw new AuthorizationError('Denegado: No posees privilegios de líder sobre esta unidad de la iglesia');
    }

    // RESARCIDO: Si no envían el semestre se procesa el periodo dinámico por fallback unificado
    const fallbackSemester = await this.getOrCreateSemester(new Date());
    const targetSemesterId = semesterId || fallbackSemester.id;

    const results = [];
    const errors = [];

    for (let i = 0; i < indicators.length; i++) {
      const item = indicators[i];
      try {
        if (!item.memberId || !item.type || item.value === undefined) {
          errors.push({ index: i, error: 'Faltan parámetros estructurales (memberId, type o value)' });
          continue;
        }

        const member = await Member.findOne({
          where: { id: item.memberId, groupId, isActive: true }
        });
        if (!member) {
          errors.push({ index: i, error: 'El miembro especificado no está activo o no pertenece a este grupo' });
          continue;
        }

        const normalizedValue = this.validateIndicatorValue(item.type, item.value);

        const indicator = await Indicator.create({
          memberId: item.memberId,
          semesterId: targetSemesterId,
          type: item.type,
          value: normalizedValue,
          date: item.date ? new Date(item.date) : new Date(),
          notes: item.notes,
          evaluatedBy: actorId,
          registeredBy: actorId
        });

        results.push({ index: i, indicatorId: indicator.id, success: true });
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    return { results, errors, total: indicators.length };
  }

  // Métodos Utilitarios Internos
  async getDetailedIndicator(id) {
    return Indicator.findByPk(id, {
      include: [
        { model: Member, attributes: ['id', 'firstName', 'lastName'], include: [{ model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'], include: [{ model: Church, attributes: ['id', 'name'] }] }] },
        { model: Semester, attributes: ['id', 'name', 'year'] },
        { model: User, as: 'EvaluatedBy', attributes: ['id', 'firstName', 'lastName'] },
        { model: User, as: 'RegisteredBy', attributes: ['id', 'firstName', 'lastName'] }
      ]
    });
  }

  getIndicatorTypeName(type) {
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
  }
}

module.exports = new IndicatorService();