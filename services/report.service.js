/**
 * REPORT.SERVICE.JS - Servicio Unificado de Reportes Consolidados
 * Sistema de Gestión Misionera
 */
const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const { NotFoundError } = require('../middlewares/error.middleware');

// Destructuring corregido de modelos integrados de la base de datos
const { 
  Group, 
  Member, 
  Indicator,      // Mapeado de forma única para indicadores espirituales
  Metric, 
  Student,        // Estandarizado (en vez de BibleStudent)
  Church, 
  User, 
  Semester,
  GroupMetric
} = db;

// =============================================================================
// IMPORTACIÓN Y ADAPTACIÓN DE TU HELPER DE UTILS
// =============================================================================
const baseHelpers = require('../utils/helpers');

// Enlazamos tus helpers reales adaptando los métodos exactos que pide el servicio
const calculationHelpers = baseHelpers.calculationHelpers;
const arrayHelpers = {
  ...baseHelpers.arrayHelpers,
  indexBy: baseHelpers.arrayHelpers.arrayToMap // Mapea tu función arrayToMap al nombre esperado
};

const dateHelpers = {
  ...baseHelpers.dateHelpers,
  // Agregamos este método rápido para que entienda los trimestres numéricos del reporte
  getQuarterRange: (year, quarter) => {
    const quartersMap = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };
    const period = quartersMap[quarter] || 'first';
    const range = baseHelpers.dateHelpers.getDateRange(period, year);
    return {
      start: new Date(`${range.start}T00:00:00.000Z`),
      end: new Date(`${range.end}T23:59:59.999Z`)
    };
  }
};

// Modificamos responseHelpers para que no choque con las respuestas HTTP del controlador
const responseHelpers = {
  success: (data) => data
};
class ReportService {

  // =============================================================================
  // LÓGICA OPERATIVA / DETALLADA POR ENTIDADES
  // =============================================================================

  async getGroupReportData(groupId, queryParams, authUser) {
    const { semesterId, includeInactive = false } = queryParams;

    const group = await Group.findByPk(groupId, {
      include: [
        { model: Church, attributes: ['id', 'name', 'address', 'city'] },
        { model: User, as: 'Leader', attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] }
      ]
    });

    if (!group) throw new NotFoundError('Grupo');

    // Validación de permisos integrada
    await this._verifyGroupAccess(authUser, group);

    const memberWhere = { 
      groupId,
      ...(includeInactive === 'true' ? {} : { isActive: true })
    };
    const semesterFilter = semesterId ? { semesterId } : {};

    // Ejecución paralela de las secciones del reporte detallado
    const [
      memberStats, 
      spiritualIndicators, 
      performanceMetrics, 
      bibleStudents, 
      growthAnalysis
    ] = await Promise.all([
      this._getMemberStatistics(groupId, memberWhere),
      this._getSpiritualIndicatorsReport(groupId, memberWhere, semesterFilter),
      this._getPerformanceMetricsReport(groupId, semesterFilter),
      this._getBibleStudentsReport(groupId, includeInactive),
      this._getGrowthAnalysis(groupId)
    ]);

    const executiveSummary = this._generateExecutiveSummary({
      memberStats,
      spiritualIndicators,
      performanceMetrics,
      bibleStudents,
      growthAnalysis
    });

    return {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: { id: authUser.id, name: `${authUser.firstName} ${authUser.lastName}` },
        parameters: { groupId, semesterId: semesterId || 'Todos los semestres', includeInactive }
      },
      groupInfo: {
        id: group.id,
        name: group.name,
        description: group.description,
        category: group.category,
        schedule: group.schedule,
        capacity: group.capacity,
        location: group.location,
        church: { name: group.Church.name, address: group.Church.address, city: group.Church.city },
        leader: { name: `${group.Leader.firstName} ${group.Leader.lastName}`, email: group.Leader.email, phone: group.Leader.phone },
        isActive: group.isActive,
        createdAt: group.createdAt
      },
      executiveSummary,
      memberStatistics: memberStats,
      spiritualIndicators,
      performanceMetrics,
      bibleStudents,
      growthAnalysis
    };
  }

  async getChurchReportData(churchId, queryParams, authUser) {
    const { semesterId, includeInactive = false } = queryParams;

    const church = await Church.findByPk(churchId);
    if (!church) throw new NotFoundError('Iglesia');

    // Reglas de autorización por rol
    if (authUser.role === 'leader') {
      throw new Error('No tienes permisos para ver reportes de iglesia completa');
    }
    if (authUser.role === 'director' && authUser.churchId !== parseInt(churchId)) {
      throw new Error('Solo puedes ver reportes de tu iglesia');
    }

    const groups = await Group.findAll({
      where: { churchId, ...(includeInactive === 'true' ? {} : { isActive: true }) },
      include: [{ model: User, as: 'Leader', attributes: ['firstName', 'lastName'] }]
    });

    const groupReports = await Promise.all(
      groups.map(async (group) => {
        const memberWhere = { groupId: group.id, ...(includeInactive === 'true' ? {} : { isActive: true }) };
        const semesterFilter = semesterId ? { semesterId } : {};

        const [memberStats, spiritualIndicators, performanceMetrics, bibleStudents] = await Promise.all([
          this._getMemberStatistics(group.id, memberWhere),
          this._getSpiritualIndicatorsReport(group.id, memberWhere, semesterFilter),
          this._getPerformanceMetricsReport(group.id, semesterFilter),
          this._getBibleStudentsReport(group.id, includeInactive)
        ]);

        return {
          groupId: group.id,
          groupName: group.name,
          leader: group.Leader ? `${group.Leader.firstName} ${group.Leader.lastName}` : 'Sin Líder',
          category: group.category,
          memberStats,
          spiritualIndicators: spiritualIndicators.summary,
          performanceMetrics: performanceMetrics.summary,
          bibleStudents: bibleStudents.summary
        };
      })
    );

    const churchSummary = this._consolidateChurchStatistics(groupReports);

    return {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: { id: authUser.id, name: `${authUser.firstName} ${authUser.lastName}` },
        parameters: { churchId, semesterId: semesterId || 'Todos los semestres', includeInactive }
      },
      churchInfo: { id: church.id, name: church.name, address: church.address, city: church.city, totalGroups: groups.length },
      churchSummary,
      groupReports
    };
  }

  async getComparativeReportData(groupIds, semesterId, authUser) {
    if (!Array.isArray(groupIds) || groupIds.length < 2) {
      throw new Error('Se requieren al menos 2 grupos para comparar');
    }
    if (groupIds.length > 10) {
      throw new Error('Máximo 10 grupos para comparar');
    }

    const groups = await Group.findAll({
      where: { id: { [Op.in]: groupIds } },
      include: [
        { model: Church, attributes: ['id', 'name'] },
        { model: User, as: 'Leader', attributes: ['firstName', 'lastName'] }
      ]
    });

    if (groups.length !== groupIds.length) {
      throw new NotFoundError('Grupos (algunos IDs proporcionados no existen)');
    }

    for (const group of groups) {
      await this._verifyGroupAccess(authUser, group);
    }

    const comparativeData = await Promise.all(
      groups.map(async (group) => {
        const memberWhere = { groupId: group.id, isActive: true };
        const semesterFilter = semesterId ? { semesterId } : {};

        const [memberStats, spiritualIndicators, performanceMetrics, bibleStudents] = await Promise.all([
          this._getMemberStatistics(group.id, memberWhere),
          this._getSpiritualIndicatorsReport(group.id, memberWhere, semesterFilter),
          this._getPerformanceMetricsReport(group.id, semesterFilter),
          this._getBibleStudentsReport(group.id, false)
        ]);

        return {
          groupId: group.id,
          groupName: group.name,
          church: group.Church.name,
          leader: group.Leader ? `${group.Leader.firstName} ${group.Leader.lastName}` : 'Sin Líder',
          category: group.category,
          capacity: group.capacity,
          memberStats,
          spiritualIndicators: spiritualIndicators.summary,
          performanceMetrics: performanceMetrics.summary,
          bibleStudents: bibleStudents.summary,
          scores: {
            memberEngagement: this._calculateMemberEngagementScore(memberStats, spiritualIndicators.summary),
            spiritualGrowth: spiritualIndicators.summary.overallAverage,
            academicProgress: bibleStudents.summary.averageProgress,
            groupEfficiency: this._calculateGroupEfficiencyScore(memberStats, group.capacity, performanceMetrics.summary)
          }
        };
      })
    );

    const rankings = this._generateGroupRankings(comparativeData);

    return {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: { id: authUser.id, name: `${authUser.firstName} ${authUser.lastName}` },
        parameters: { groupCount: groups.length, semesterId: semesterId || 'Todos los semestres' }
      },
      comparativeData,
      rankings,
      insights: this._generateComparativeInsights(comparativeData, rankings)
    };
  }

  // =============================================================================
  // ANALÍTICA DE REPORTES ANALÍTICOS Y CONSOLIDADOS (CORREGIDOS)
  // =============================================================================

  async getChurchConsolidatedReport(churchId, filters = {}) {
    const dateRange = filters.periodStart && filters.periodEnd ? 
      { start: filters.periodStart, end: filters.periodEnd } : 
      dateHelpers.getQuarterRange(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3));

    const church = await Church.findByPk(churchId, { raw: true });
    if (!church) throw new NotFoundError('Iglesia');

    const [groups, totalMembers, totalStudents, aggregatedMetrics] = await Promise.all([
      Group.findAll({ where: { churchId, isActive: true }, attributes: ['id', 'name', 'category', 'isActive'], raw: true }),
      Member.count({ include: [{ model: Group, where: { churchId } }], where: { isActive: true } }),
      Student.count({ include: [{ model: Group, where: { churchId } }], where: { isActive: true } }), // Corregido a Student
      GroupMetric.findAll({
        include: [{ model: Group, where: { churchId } }],
        where: { periodStart: { [Op.gte]: dateRange.start }, periodEnd: { [Op.lte]: dateRange.end } },
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('newConversions')), 'conversions'],
          [Sequelize.fn('SUM', Sequelize.col('baptisms')), 'baptisms'],
          [Sequelize.fn('AVG', Sequelize.col('averageAttendance')), 'avgAttendance'],
          [Sequelize.fn('SUM', Sequelize.col('totalSessions')), 'sessions']
        ],
        raw: true
      })
    ]);

    const metrics = aggregatedMetrics[0] || {};

    return responseHelpers.success({
      metadata: { churchId, churchName: church.name, generatedAt: new Date().toISOString(), period: `${dateRange.start} al ${dateRange.end}` },
      summary: {
        totalGroups: groups.length,
        totalMembers: totalMembers || 0,
        totalStudents: totalStudents || 0,
        conversions: parseInt(metrics.conversions) || 0,
        baptisms: parseInt(metrics.baptisms) || 0,
        averageAttendance: Math.round((parseFloat(metrics.avgAttendance) || 0) * 100) / 100,
        totalSessions: parseInt(metrics.sessions) || 0
      },
      groupsDetails: groups
    });
  }

  async getGroupDetailedReport(groupId, filters = {}) {
    const dateRange = filters.periodStart && filters.periodEnd ? 
      { start: filters.periodStart, end: filters.periodEnd } : 
      dateHelpers.getQuarterRange(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3));

    const group = await Group.findByPk(groupId, { include: [{ model: Church, attributes: ['name', 'city'] }], raw: true });
    if (!group) throw new NotFoundError('Grupo Misionero');

    const [members, students, metricsHistory] = await Promise.all([
      Member.findAll({ where: { groupId, isActive: true }, attributes: ['id', 'firstName', 'lastName', 'gender', 'isActive'], raw: true }),
      Student.findAll({ where: { groupId, isActive: true }, attributes: ['id', 'firstName', 'lastName', 'program', 'progress'], raw: true }), // Corregido a Student
      GroupMetric.findAll({
        where: { groupId, periodStart: { [Op.gte]: dateRange.start }, periodEnd: { [Op.lte]: dateRange.end } },
        order: [['periodStart', 'ASC']],
        raw: true
      })
    ]);

    return responseHelpers.success({
      groupInfo: { id: group.id, name: group.name, churchName: group['Church.name'], city: group['Church.city'] },
      structure: { memberCount: members.length, studentCount: students.length },
      history: metricsHistory,
      roster: { members, students }
    });
  }

  async getEvangelismComparativeReport(filters = {}) {
    const dateRange = filters.periodStart && filters.periodEnd ? 
      { start: filters.periodStart, end: filters.periodEnd } : 
      dateHelpers.getQuarterRange(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3));

    const churchWhere = filters.country ? { country: filters.country, isActive: true } : { isActive: true };
    const churches = await Church.findAll({ where: churchWhere, attributes: ['id', 'name', 'country'], raw: true });

    const metricsSummary = await GroupMetric.findAll({
      include: [{ model: Group, where: { isActive: true }, attributes: ['churchId'] }],
      where: { periodStart: { [Op.gte]: dateRange.start }, periodEnd: { [Op.lte]: dateRange.end } },
      attributes: [
        [Sequelize.col('Group.churchId'), 'churchId'],
        [Sequelize.fn('SUM', Sequelize.col('newConversions')), 'conversions'],
        [Sequelize.fn('SUM', Sequelize.col('baptisms')), 'baptisms']
      ],
      group: [Sequelize.col('Group.churchId')],
      raw: true
    });

    const metricsMap = arrayHelpers.indexBy(metricsSummary, 'churchId');

    const comparativeData = churches.map(church => {
      const churchMetric = metricsMap[church.id] || {};
      const conversions = parseInt(churchMetric.conversions) || 0;
      const baptisms = parseInt(churchMetric.baptisms) || 0;

      return {
        churchId: church.id,
        name: church.name,
        country: church.country,
        conversions, 
        baptisms,
        baptismRate: conversions > 0 ? calculationHelpers.percentage(baptisms, conversions) : 0
      };
    });

    return responseHelpers.success({
      period: dateRange,
      totalChurchesEvaluated: churches.length,
      ranking: comparativeData.sort((a, b) => b.baptisms - a.baptisms)
    });
  }

  async getSpiritualAuditReport(filters = {}) {
    const dateRange = filters.periodStart && filters.periodEnd ? 
      { start: filters.periodStart, end: filters.periodEnd } : 
      dateHelpers.getQuarterRange(new Date().getFullYear(), Math.ceil((new Date().getMonth() + 1) / 3));

    const memberWhere = { isActive: true };
    const groupWhere = { isActive: true };

    if (filters.churchId) groupWhere.churchId = filters.churchId;
    if (filters.groupId) memberWhere.groupId = filters.groupId;

    // Corregido: Se mapea sobre el modelo Indicator unificado usando el campo 'createdAt' o rango disponible
    const indicators = await Indicator.findAll({
      include: [{
        model: Member, where: memberWhere, attributes: ['id', 'firstName', 'lastName'],
        include: [{ model: Group, where: groupWhere, attributes: ['id', 'name', 'churchId'] }]
      }],
      where: { createdAt: { [Op.between]: [dateRange.start, dateRange.end] } },
      order: [['createdAt', 'DESC']],
      raw: true
    });

    const averageValues = calculationHelpers.average(indicators.map(i => parseFloat(i.value) || 0));

    return responseHelpers.success({
      generatedAt: new Date().toISOString(),
      range: dateRange,
      analysis: { 
        totalEvaluations: indicators.length, 
        globalAverageValue: Math.round(averageValues * 100) / 100 
      },
      records: indicators.map(ind => ({
        evaluationId: ind.id, 
        date: ind.createdAt,
        memberName: `${ind['Member.firstName']} ${ind['Member.lastName']}`,
        groupName: ind['Member.Group.name'], 
        type: ind.type,
        value: ind.value
      }))
    });
  }

  async getSemesterHistoricalReport(semesterId) {
    const semester = await Semester.findByPk(semesterId, { raw: true });
    if (!semester) throw new NotFoundError('Semestre Académico/Misionero');

    const [metricsSum, activeMembersAtEnd] = await Promise.all([
      GroupMetric.findAll({
        where: { periodStart: { [Op.gte]: semester.startDate }, periodEnd: { [Op.lte]: semester.endDate } },
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('newConversions')), 'conversions'],
          [Sequelize.fn('SUM', Sequelize.col('baptisms')), 'baptisms']
        ],
        raw: true
      }),
      Member.count({ where: { isActive: true, createdAt: { [Op.lte]: semester.endDate } } })
    ]);

    const data = metricsSum[0] || {};

    return responseHelpers.success({
      semesterInfo: { id: semester.id, name: semester.name, code: semester.code, duration: `${semester.startDate} al ${semester.endDate}` },
      consolidatedMetrics: { 
        totalConversions: parseInt(data.conversions) || 0, 
        totalBaptisms: parseInt(data.baptisms) || 0, 
        closingMembership: activeMembersAtEnd || 0 
      }
    });
  }

  // =============================================================================
  // MÉTODOS PRIVADOS / AUXILIARES INTERNOS DE CÁLCULO
  // =============================================================================

  async _verifyGroupAccess(authUser, group) {
    if (authUser.role === 'admin') return true;
    if (authUser.role === 'leader' && group.leaderId !== authUser.id) {
      throw new Error('No tienes permisos para acceder a este grupo');
    }
    if (authUser.role === 'director') {
      if (group.churchId !== authUser.churchId) {
        throw new Error('No tienes permisos para acceder a grupos de otras iglesias');
      }
    }
    return true;
  }

  async _getMemberStatistics(groupId, memberWhere) {
    const totalMembers = await Member.count({ where: memberWhere });
    const activeMembers = await Member.count({ where: { ...memberWhere, isActive: true } });

    const [genderStats, ageGroups] = await Promise.all([
      Member.findAll({ where: memberWhere, attributes: ['gender', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']], group: ['gender'], raw: true }),
      Member.findAll({
        where: memberWhere,
        attributes: [
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.literal(`CASE WHEN EXTRACT(YEAR FROM AGE(birthDate)) < 18 THEN 'Menores de 18' WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 18 AND 30 THEN '18-30' WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 31 AND 50 THEN '31-50' ELSE 'Mayores de 50' END`), 'ageGroup']
        ],
        group: [Sequelize.literal(`CASE WHEN EXTRACT(YEAR FROM AGE(birthDate)) < 18 THEN 'Menores de 18' WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 18 AND 30 THEN '18-30' WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 31 AND 50 THEN '31-50' ELSE 'Mayores de 50' END`)],
        raw: true
      })
    ]);

    return {
      totalMembers, activeMembers, inactiveMembers: totalMembers - activeMembers,
      genderDistribution: genderStats.reduce((acc, item) => { acc[item.gender || 'No especificado'] = parseInt(item.count); return acc; }, {}),
      ageDistribution: ageGroups.reduce((acc, item) => { acc[item.ageGroup] = parseInt(item.count); return acc; }, {})
    };
  }

  async _getSpiritualIndicatorsReport(groupId, memberWhere, semesterFilter) {
    const indicatorTypes = ['asistencia_cultos', 'participacion_actividades', 'lectura_biblica', 'vida_oracion', 'servicio_cristiano', 'testimonio_personal', 'crecimiento_espiritual'];

    const typeStats = await Promise.all(
      indicatorTypes.map(async (type) => {
        const stats = await Indicator.findAll({
          include: [{ model: Member, where: memberWhere, attributes: [] }],
          where: { type, ...semesterFilter },
          attributes: [[Sequelize.fn('AVG', Sequelize.col('value')), 'average'], [Sequelize.fn('COUNT', Sequelize.col('Indicator.id')), 'count']],
          raw: true
        });
        return { type, average: parseFloat(stats[0].average || 0).toFixed(1), count: parseInt(stats[0].count || 0) };
      })
    );

    const activeStats = typeStats.filter(stat => stat.count > 0);
    const overallAverage = activeStats.length > 0 
      ? (typeStats.reduce((sum, stat) => sum + parseFloat(stat.average), 0) / activeStats.length).toFixed(1)
      : '0.0';

    return { summary: { overallAverage: parseFloat(overallAverage), totalEvaluations: typeStats.reduce((sum, stat) => sum + stat.count, 0) }, byType: typeStats };
  }

  async _getPerformanceMetricsReport(groupId, semesterFilter) {
    const metrics = await Metric.findAll({
      where: { groupId, ...semesterFilter },
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('attendance')), 'avgAttendance'], [Sequelize.fn('AVG', Sequelize.col('newVisitors')), 'avgNewVisitors'],
        [Sequelize.fn('AVG', Sequelize.col('conversions')), 'avgConversions'], [Sequelize.fn('SUM', Sequelize.col('offerings')), 'totalOfferings'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'reportCount']
      ],
      raw: true
    });
    const result = metrics[0] || {};
    return { summary: { averageAttendance: parseFloat(result.avgAttendance || 0).toFixed(1), averageNewVisitors: parseFloat(result.avgNewVisitors || 0).toFixed(1), averageConversions: parseFloat(result.avgConversions || 0).toFixed(1), totalOfferings: parseFloat(result.totalOfferings || 0), totalReports: parseInt(result.reportCount || 0) } };
  }

  async _getBibleStudentsReport(groupId, includeInactive) {
    const studentWhere = { groupId, ...(includeInactive === 'true' ? {} : { isActive: true }) };
    const [totalStudents, programStats, graduatedStudents] = await Promise.all([
      Student.count({ where: studentWhere }),
      Student.findAll({ where: studentWhere, attributes: ['program', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'], [Sequelize.fn('AVG', Sequelize.col('progress')), 'avgProgress']], group: ['program'], raw: true }),
      Student.count({ where: { ...studentWhere, isGraduated: true } })
    ]);

    return {
      summary: { totalStudents, graduatedStudents, averageProgress: programStats.length > 0 ? (programStats.reduce((sum, prog) => sum + parseFloat(prog.avgProgress || 0), 0) / programStats.length).toFixed(1) : '0.0' },
      byProgram: programStats.map(prog => ({ program: prog.program, count: parseInt(prog.count), averageProgress: parseFloat(prog.avgProgress || 0).toFixed(1) }))
    };
  }

  async _getGrowthAnalysis(groupId) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await Member.findAll({
      where: { groupId, createdAt: { [Op.gte]: sixMonthsAgo } },
      attributes: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt')), 'month'], [Sequelize.fn('COUNT', Sequelize.col('id')), 'newMembers']],
      group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    return { monthlyGrowth: monthlyData.map(data => ({ month: data.month, newMembers: parseInt(data.newMembers) })), totalGrowthSixMonths: monthlyData.reduce((sum, data) => sum + parseInt(data.newMembers), 0) };
  }

  _generateExecutiveSummary(data) {
    const { memberStats, spiritualIndicators, performanceMetrics, bibleStudents, growthAnalysis } = data;
    return {
      totalMembers: memberStats.totalMembers, activeMembers: memberStats.activeMembers,
      memberRetentionRate: memberStats.totalMembers > 0 ? ((memberStats.activeMembers / memberStats.totalMembers) * 100).toFixed(1) : '0.0',
      spiritualHealthScore: spiritualIndicators.summary.overallAverage, averageAttendance: performanceMetrics.summary.averageAttendance,
      totalStudents: bibleStudents.summary.totalStudents,
      graduationRate: bibleStudents.summary.totalStudents > 0 ? ((bibleStudents.summary.graduatedStudents / bibleStudents.summary.totalStudents) * 100).toFixed(1) : '0.0',
      monthlyGrowth: growthAnalysis.totalGrowthSixMonths
    };
  }

  _consolidateChurchStatistics(groupReports) {
    const totals = groupReports.reduce((acc, group) => {
      acc.totalMembers += group.memberStats.totalMembers; acc.activeMembers += group.memberStats.activeMembers;
      acc.totalStudents += group.bibleStudents.totalStudents; acc.graduatedStudents += group.bibleStudents.graduatedStudents;
      acc.spiritualScores.push(group.spiritualIndicators.overallAverage); acc.attendanceRates.push(parseFloat(group.performanceMetrics.averageAttendance));
      return acc;
    }, { totalMembers: 0, activeMembers: 0, totalStudents: 0, graduatedStudents: 0, spiritualScores: [], attendanceRates: [] });

    return {
      totalGroups: groupReports.length, totalMembers: totals.totalMembers, activeMembers: totals.activeMembers, totalStudents: totals.totalStudents, graduatedStudents: totals.graduatedStudents,
      averageSpiritualScore: totals.spiritualScores.length > 0 ? (totals.spiritualScores.reduce((sum, score) => sum + score, 0) / totals.spiritualScores.length).toFixed(1) : '0.0',
      averageAttendance: totals.attendanceRates.length > 0 ? (totals.attendanceRates.reduce((sum, rate) => sum + rate, 0) / totals.attendanceRates.length).toFixed(1) : '0.0'
    };
  }

  _calculateMemberEngagementScore(memberStats, spiritualIndicators) {
    const retentionRate = memberStats.totalMembers > 0 ? (memberStats.activeMembers / memberStats.totalMembers) * 100 : 0;
    const spiritualScore = spiritualIndicators.overallAverage * 20;
    return ((retentionRate + spiritualScore) / 2).toFixed(1);
  }

  _calculateGroupEfficiencyScore(memberStats, capacity, performanceMetrics) {
    const utilizationRate = capacity > 0 ? (memberStats.activeMembers / capacity) * 100 : 0;
    const attendanceScore = parseFloat(performanceMetrics.averageAttendance) * 10;
    return ((utilizationRate + attendanceScore) / 2).toFixed(1);
  }

  _generateGroupRankings(comparativeData) {
    return {
      byMemberEngagement: [...comparativeData].sort((a, b) => parseFloat(b.scores.memberEngagement) - parseFloat(a.scores.memberEngagement)).map((g, i) => ({ rank: i + 1, groupName: g.groupName, score: g.scores.memberEngagement })),
      bySpiritualGrowth: [...comparativeData].sort((a, b) => parseFloat(b.scores.spiritualGrowth) - parseFloat(a.scores.spiritualGrowth)).map((g, i) => ({ rank: i + 1, groupName: g.groupName, score: g.scores.spiritualGrowth })),
      byAcademicProgress: [...comparativeData].sort((a, b) => parseFloat(b.scores.academicProgress) - parseFloat(a.scores.academicProgress)).map((g, i) => ({ rank: i + 1, groupName: g.groupName, score: g.scores.academicProgress })),
      byGroupEfficiency: [...comparativeData].sort((a, b) => parseFloat(b.scores.groupEfficiency) - parseFloat(a.scores.groupEfficiency)).map((g, i) => ({ rank: i + 1, groupName: g.groupName, score: g.scores.groupEfficiency }))
    };
  }

  _generateComparativeInsights(comparativeData, rankings) {
    const insights = [
      { type: 'best_practices', title: 'Mejores Prácticas Identificadas', data: { engagement: rankings.byMemberEngagement[0], spiritual: rankings.bySpiritualGrowth[0], academic: rankings.byAcademicProgress[0], efficiency: rankings.byGroupEfficiency[0] } }
    ];

    const needsAttention = comparativeData.filter(g => parseFloat(g.scores.memberEngagement) < 50 || parseFloat(g.scores.spiritualGrowth) < 3.0 || parseFloat(g.scores.academicProgress) < 50);
    if (needsAttention.length > 0) {
      insights.push({
        type: 'needs_attention',
        title: 'Grupos que Requieren Atención',
        data: needsAttention.map(g => ({ groupName: g.groupName, concerns: [...(parseFloat(g.scores.memberEngagement) < 50 ? ['Baja participación'] : []), ...(parseFloat(g.scores.spiritualGrowth) < 3.0 ? ['Crecimiento limitado'] : []), ...(parseFloat(g.scores.academicProgress) < 50 ? ['Progreso lento'] : [])] }))
      });
    }

    insights.push({
      type: 'trends',
      title: 'Tendencias Generales',
      data: {
        averages: { memberEngagement: (comparativeData.reduce((sum, g) => sum + parseFloat(g.scores.memberEngagement), 0) / comparativeData.length).toFixed(1), spiritualGrowth: (comparativeData.reduce((sum, g) => sum + parseFloat(g.scores.spiritualGrowth), 0) / comparativeData.length).toFixed(1), academicProgress: (comparativeData.reduce((sum, g) => sum + parseFloat(g.scores.academicProgress), 0) / comparativeData.length).toFixed(1) },
        totalGroups: comparativeData.length, highPerformingGroups: comparativeData.filter(g => parseFloat(g.scores.memberEngagement) > 70).length
      }
    });

    return insights;
  }
}

module.exports = new ReportService();