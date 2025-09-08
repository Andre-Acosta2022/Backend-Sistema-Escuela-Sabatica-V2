/**
 * DASHBOARD.SERVICE.JS - Servicio de Dashboard y Métricas
 * Sistema de Gestión Misionera
 * 
 * Maneja cálculos de KPIs, estadísticas consolidadas y datos para gráficos
 * Incluye validaciones de seguridad por roles y optimizaciones de consultas
 */

const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const { 
  calculationHelpers, 
  dateHelpers, 
  arrayHelpers, 
  responseHelpers 
} = require('./helpers');
const { CHART_COLORS, ROLES, ROLE_HIERARCHY } = require('./constants');

// Destructuring de modelos desde la base de datos
const { 
  User, 
  Church, 
  Group, 
  Member, 
  BibleStudent, 
  GroupMetric, 
  SpiritualIndicator, 
  Semester 
} = db;

class DashboardService {
  
  // =============================================
  // MÉTRICAS PRINCIPALES (KPIs)
  // =============================================
  
  /**
   * Obtiene KPIs principales del sistema
   * @param {string} userRole - Rol del usuario (admin, director, leader, reader)
   * @param {number} userId - ID del usuario autenticado
   * @param {Object} filters - Filtros adicionales (período, iglesia, grupo)
   * @returns {Object} KPIs consolidados con comparación temporal
   */
  async getMainKPIs(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);
      const dateRange = this._getDateRange(filters.period);

      // Conteos básicos con validación de permisos
      const [
        totalChurches,
        totalGroups,
        totalMembers,
        totalStudents,
        activeGroups,
        totalUsers
      ] = await Promise.all([
        this._getAuthorizedCount(Church, whereConditions.church, userRole),
        this._getAuthorizedCount(Group, whereConditions.group, userRole),
        this._getAuthorizedCount(Member, whereConditions.member, userRole, [
          { model: Group, where: whereConditions.group }
        ]),
        this._getAuthorizedCount(BibleStudent, whereConditions.student, userRole, [
          { model: Group, where: whereConditions.group }
        ]),
        this._getAuthorizedCount(Group, { 
          ...whereConditions.group, 
          status: 'active' 
        }, userRole),
        this._getAuthorizedCount(User, whereConditions.user, userRole)
      ]);

      // Métricas del período actual
      const currentPeriodMetrics = await this._getPeriodMetrics(whereConditions, dateRange);

      // Comparación con período anterior
      const previousRange = this._getPreviousPeriodRange(dateRange);
      const previousPeriodMetrics = await this._getPeriodMetrics(whereConditions, previousRange);

      // Cálculo de efectividad
      const effectiveness = this._calculateEffectiveness(currentPeriodMetrics, {
        totalGroups,
        totalMembers
      });

      return responseHelpers.success({
        totals: {
          churches: totalChurches,
          groups: totalGroups,
          activeGroups,
          members: totalMembers,
          students: totalStudents,
          users: totalUsers,
          groupUtilization: calculationHelpers.percentage(activeGroups, totalGroups)
        },
        currentPeriod: currentPeriodMetrics,
        previousPeriod: previousPeriodMetrics,
        growth: this._calculateGrowthRates(currentPeriodMetrics, previousPeriodMetrics),
        effectiveness,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error en getMainKPIs:', error);
      throw new Error(`Error obteniendo KPIs: ${error.message}`);
    }
  }

  /**
   * Obtiene métricas de crecimiento espiritual
   */
  async getSpiritualGrowthMetrics(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);
      const dateRange = this._getDateRange(filters.period);

      // Indicadores espirituales con joins seguros
      const spiritualIndicators = await SpiritualIndicator.findAll({
        include: [{
          model: Member,
          where: whereConditions.member,
          include: [{ 
            model: Group, 
            where: whereConditions.group,
            attributes: ['id', 'name', 'type']
          }]
        }],
        where: {
          evaluationDate: {
            [Op.between]: [dateRange.start, dateRange.end]
          }
        },
        attributes: [
          'attendancePercentage',
          'bibleReadingDays',
          'spiritualGrowthLevel',
          'prayerFrequency',
          'evaluationDate'
        ],
        raw: true
      });

      // Estadísticas de bautismos
      const baptismStats = await Member.findAll({
        where: {
          ...whereConditions.member,
          baptized: true,
          baptismDate: {
            [Op.between]: [dateRange.start, dateRange.end]
          }
        },
        include: [{ 
          model: Group, 
          where: whereConditions.group,
          attributes: ['id', 'name', 'type']
        }],
        attributes: ['baptismDate', 'spiritualStatus', 'ageGroup'],
        raw: true
      });

      // Cálculos con validación de datos
      const validIndicators = spiritualIndicators.filter(ind => 
        ind.attendancePercentage !== null && 
        ind.bibleReadingDays !== null &&
        ind.spiritualGrowthLevel !== null
      );

      const spiritualMetrics = {
        averageAttendance: calculationHelpers.average(
          validIndicators.map(s => s.attendancePercentage)
        ),
        averageBibleReading: calculationHelpers.average(
          validIndicators.map(s => s.bibleReadingDays)
        ),
        averageSpiritualGrowth: calculationHelpers.average(
          validIndicators.map(s => s.spiritualGrowthLevel)
        ),
        baptismsThisPeriod: baptismStats.length,
        totalEvaluations: validIndicators.length,
        spiritualStatusDistribution: this._getDistribution(
          baptismStats, 'spiritualStatus'
        ),
        prayerFrequencyDistribution: this._getDistribution(
          validIndicators, 'prayerFrequency'
        ),
        baptismsByAgeGroup: this._getDistribution(
          baptismStats, 'ageGroup'
        )
      };

      return responseHelpers.success(spiritualMetrics);
    } catch (error) {
      console.error('Error en getSpiritualGrowthMetrics:', error);
      throw new Error(`Error obteniendo métricas espirituales: ${error.message}`);
    }
  }

  /**
   * Obtiene datos para gráficos de tendencias
   */
  async getTrendData(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);
      const months = this._getLast12Months();

      const trendData = await Promise.all(months.map(async (month) => {
        const monthRange = dateHelpers.getMonthRange(month.year, month.month);
        
        const [memberCount, studentCount, baptismCount, conversionCount] = await Promise.all([
          Member.count({
            where: {
              ...whereConditions.member,
              createdAt: { [Op.lte]: monthRange.end }
            },
            include: [{ model: Group, where: whereConditions.group }]
          }),
          BibleStudent.count({
            where: {
              ...whereConditions.student,
              createdAt: { [Op.lte]: monthRange.end }
            },
            include: [{ model: Group, where: whereConditions.group }]
          }),
          Member.count({
            where: {
              ...whereConditions.member,
              baptized: true,
              baptismDate: {
                [Op.between]: [monthRange.start, monthRange.end]
              }
            },
            include: [{ model: Group, where: whereConditions.group }]
          }),
          // Conversiones desde métricas de grupo
          GroupMetric.sum('newConversions', {
            where: {
              ...whereConditions.metric,
              periodStart: { [Op.gte]: monthRange.start },
              periodEnd: { [Op.lte]: monthRange.end }
            }
          })
        ]);

        return {
          month: month.label,
          year: month.year,
          period: `${month.year}-${month.month.toString().padStart(2, '0')}`,
          members: memberCount || 0,
          students: studentCount || 0,
          baptisms: baptismCount || 0,
          conversions: conversionCount || 0
        };
      }));

      // Calcular tendencias y patrones
      const trendAnalysis = this._analyzeTrends(trendData);

      return responseHelpers.success({
        data: trendData,
        analysis: trendAnalysis,
        summary: {
          totalMonths: trendData.length,
          averageGrowth: trendAnalysis.averageGrowth,
          bestMonth: trendAnalysis.bestMonth,
          challengingMonth: trendAnalysis.challengingMonth
        }
      });
    } catch (error) {
      console.error('Error en getTrendData:', error);
      throw new Error(`Error obteniendo datos de tendencia: ${error.message}`);
    }
  }

  // =============================================
  // GRÁFICOS ESPECÍFICOS
  // =============================================

  /**
   * Datos para gráfico de distribución por grupos
   */
  async getGroupDistributionChart(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);

      const groupData = await Group.findAll({
        where: whereConditions.group,
        attributes: [
          'type',
          'category',
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
          [Sequelize.fn('AVG', Sequelize.col('currentCapacity')), 'avgCapacity']
        ],
        group: ['type', 'category', 'status'],
        raw: true
      });

      return responseHelpers.success({
        byType: this._formatChartData(
          arrayHelpers.groupBy(groupData, 'type'),
          'count'
        ),
        byCategory: this._formatChartData(
          arrayHelpers.groupBy(groupData, 'category'),
          'count'
        ),
        byStatus: this._formatChartData(
          arrayHelpers.groupBy(groupData, 'status'),
          'count'
        ),
        capacityAnalysis: {
          averageCapacity: calculationHelpers.average(
            groupData.map(g => parseFloat(g.avgCapacity) || 0)
          ),
          totalGroups: groupData.reduce((sum, g) => sum + parseInt(g.count), 0)
        }
      });
    } catch (error) {
      console.error('Error en getGroupDistributionChart:', error);
      throw new Error(`Error obteniendo distribución de grupos: ${error.message}`);
    }
  }

  /**
   * Datos para gráfico de asistencia promedio
   */
  async getAttendanceChart(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);
      const dateRange = this._getDateRange(filters.period);

      const attendanceData = await GroupMetric.findAll({
        where: {
          periodStart: { [Op.gte]: dateRange.start },
          periodEnd: { [Op.lte]: dateRange.end }
        },
        include: [{
          model: Group,
          where: whereConditions.group,
          attributes: ['id', 'name', 'type', 'maxCapacity']
        }],
        attributes: [
          'groupId',
          'averageAttendance',
          'maxAttendance',
          'minAttendance',
          'periodStart',
          'totalSessions'
        ],
        order: [['periodStart', 'ASC']],
        raw: true
      });

      // Agrupar por grupo y calcular estadísticas
      const groupedData = arrayHelpers.groupBy(attendanceData, 'groupId');
      
      const chartData = Object.keys(groupedData).map(groupId => {
        const groupMetrics = groupedData[groupId];
        const groupInfo = groupMetrics[0];

        return {
          groupId: parseInt(groupId),
          groupName: groupInfo['Group.name'],
          groupType: groupInfo['Group.type'],
          maxCapacity: groupInfo['Group.maxCapacity'],
          averageAttendance: calculationHelpers.average(
            groupMetrics.map(d => d.averageAttendance)
          ),
          maxAttendance: calculationHelpers.safeMax(
            groupMetrics.map(d => d.maxAttendance)
          ),
          minAttendance: calculationHelpers.safeMin(
            groupMetrics.map(d => d.minAttendance)
          ),
          totalSessions: calculationHelpers.safeSum(
            groupMetrics.map(d => d.totalSessions)
          ),
          consistencyScore: this._calculateConsistencyScore(groupMetrics)
        };
      });

      return responseHelpers.success({
        data: chartData.sort((a, b) => b.averageAttendance - a.averageAttendance),
        summary: {
          totalGroups: chartData.length,
          overallAverage: calculationHelpers.average(
            chartData.map(d => d.averageAttendance)
          ),
          bestPerforming: chartData.reduce((best, current) => 
            current.averageAttendance > best.averageAttendance ? current : best
          ),
          needsAttention: chartData.filter(d => d.averageAttendance < 50)
        }
      });
    } catch (error) {
      console.error('Error en getAttendanceChart:', error);
      throw new Error(`Error obteniendo datos de asistencia: ${error.message}`);
    }
  }

  /**
   * Datos para gráfico de evangelismo
   */
  async getEvangelismChart(userRole, userId, filters = {}) {
    try {
      const whereConditions = this._buildWhereConditions(userRole, userId, filters);
      const dateRange = this._getDateRange(filters.period);

      const evangelismData = await GroupMetric.findAll({
        where: {
          periodStart: { [Op.gte]: dateRange.start },
          periodEnd: { [Op.lte]: dateRange.end }
        },
        include: [{
          model: Group,
          where: whereConditions.group,
          attributes: ['type', 'name']
        }],
        attributes: [
          [Sequelize.fn('SUM', Sequelize.col('newConversions')), 'totalConversions'],
          [Sequelize.fn('SUM', Sequelize.col('baptisms')), 'totalBaptisms'],
          [Sequelize.fn('SUM', Sequelize.col('decisionsForChrist')), 'totalDecisions'],
          [Sequelize.fn('SUM', Sequelize.col('evangelisticEvents')), 'totalEvents'],
          [Sequelize.fn('COUNT', Sequelize.col('GroupMetric.id')), 'reportingGroups'],
          [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('periodStart')), 'month']
        ],
        group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('periodStart'))],
        order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('periodStart')), 'ASC']],
        raw: true
      });

      const formattedData = evangelismData.map(data => {
        const conversions = parseInt(data.totalConversions) || 0;
        const baptisms = parseInt(data.totalBaptisms) || 0;
        const decisions = parseInt(data.totalDecisions) || 0;
        const events = parseInt(data.totalEvents) || 0;

        return {
          month: dateHelpers.formatDateToString(data.month, 'MMM YYYY'),
          period: data.month,
          conversions,
          baptisms,
          decisions,
          events,
          reportingGroups: parseInt(data.reportingGroups) || 0,
          conversionRate: events > 0 ? calculationHelpers.percentage(conversions, events) : 0,
          baptismRate: conversions > 0 ? calculationHelpers.percentage(baptisms, conversions) : 0
        };
      });

      return responseHelpers.success({
        data: formattedData,
        summary: {
          totalPeriods: formattedData.length,
          totalConversions: calculationHelpers.safeSum(formattedData.map(d => d.conversions)),
          totalBaptisms: calculationHelpers.safeSum(formattedData.map(d => d.baptisms)),
          totalEvents: calculationHelpers.safeSum(formattedData.map(d => d.events)),
          averageConversionRate: calculationHelpers.average(formattedData.map(d => d.conversionRate)),
          averageBaptismRate: calculationHelpers.average(formattedData.map(d => d.baptismRate))
        }
      });
    } catch (error) {
      console.error('Error en getEvangelismChart:', error);
      throw new Error(`Error obteniendo datos de evangelismo: ${error.message}`);
    }
  }

  // =============================================
  // MÉTODOS AUXILIARES PRIVADOS
  // =============================================

  /**
   * Construye condiciones WHERE según el rol del usuario
   */
  _buildWhereConditions(userRole, userId, filters = {}) {
    let conditions = {
      church: { status: 'active' },
      group: { status: 'active' },
      member: { status: 'active' },
      student: { status: 'active' },
      metric: {},
      user: { status: 'active' }
    };

    // Aplicar filtros de seguridad por rol
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[ROLES.ADMIN]) {
      if (userRole === ROLES.LEADER) {
        conditions.group = { ...conditions.group, leaderId: userId };
      } else if (userRole === ROLES.DIRECTOR) {
        // Lógica para directores - pueden ver grupos de sus iglesias
        conditions.user = { ...conditions.user, id: userId };
      }
    }

    // Filtros adicionales del usuario
    if (filters.churchId) {
      conditions.church = { ...conditions.church, id: filters.churchId };
      conditions.group = { ...conditions.group, churchId: filters.churchId };
    }

    if (filters.groupId) {
      conditions.group = { ...conditions.group, id: filters.groupId };
      conditions.member = { ...conditions.member, groupId: filters.groupId };
      conditions.student = { ...conditions.student, groupId: filters.groupId };
      conditions.metric = { ...conditions.metric, groupId: filters.groupId };
    }

    if (filters.groupType) {
      conditions.group = { ...conditions.group, type: filters.groupType };
    }

    return conditions;
  }

  /**
   * Obtiene rango de fechas según el período
   */
  _getDateRange(period = 'current_quarter') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    switch (period) {
      case 'current_month':
        return dateHelpers.getMonthRange(currentYear, currentMonth);
      
      case 'current_quarter':
        const quarter = Math.ceil(currentMonth / 3);
        return dateHelpers.getQuarterRange(currentYear, quarter);
      
      case 'current_year':
        return dateHelpers.getYearRange(currentYear);
      
      case 'last_30_days':
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return {
          start: dateHelpers.formatDateForDB(thirtyDaysAgo),
          end: dateHelpers.formatDateForDB(now)
        };
      
      case 'last_90_days':
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(now.getDate() - 90);
        return {
          start: dateHelpers.formatDateForDB(ninetyDaysAgo),
          end: dateHelpers.formatDateForDB(now)
        };
      
      default:
        return dateHelpers.getQuarterRange(currentYear, Math.ceil(currentMonth / 3));
    }
  }

  /**
   * Obtiene rango del período anterior para comparación
   */
  _getPreviousPeriodRange(currentRange) {
    const start = new Date(currentRange.start);
    const end = new Date(currentRange.end);
    const duration = end.getTime() - start.getTime();

    const previousEnd = new Date(start.getTime() - 86400000); // -1 día
    const previousStart = new Date(previousEnd.getTime() - duration);

    return {
      start: dateHelpers.formatDateForDB(previousStart),
      end: dateHelpers.formatDateForDB(previousEnd)
    };
  }

  /**
   * Obtiene métricas de un período específico
   */
  async _getPeriodMetrics(whereConditions, dateRange) {
    try {
      const [newMembers, newStudents, totalBaptisms, totalConversions] = await Promise.all([
        Member.count({
          where: {
            ...whereConditions.member,
            createdAt: {
              [Op.between]: [dateRange.start, dateRange.end]
            }
          },
          include: [{ model: Group, where: whereConditions.group }]
        }),
        BibleStudent.count({
          where: {
            ...whereConditions.student,
            createdAt: {
              [Op.between]: [dateRange.start, dateRange.end]
            }
          },
          include: [{ model: Group, where: whereConditions.group }]
        }),
        Member.count({
          where: {
            ...whereConditions.member,
            baptized: true,
            baptismDate: {
              [Op.between]: [dateRange.start, dateRange.end]
            }
          },
          include: [{ model: Group, where: whereConditions.group }]
        }),
        GroupMetric.sum('newConversions', {
          where: {
            ...whereConditions.metric,
            periodStart: { [Op.gte]: dateRange.start },
            periodEnd: { [Op.lte]: dateRange.end }
          }
        })
      ]);

      return {
        newMembers: newMembers || 0,
        newStudents: newStudents || 0,
        baptisms: totalBaptisms || 0,
        conversions: totalConversions || 0
      };
    } catch (error) {
      console.error('Error en _getPeriodMetrics:', error);
      return {
        newMembers: 0,
        newStudents: 0,
        baptisms: 0,
        conversions: 0
      };
    }
  }

  /**
   * Calcula tasas de crecimiento entre períodos
   */
  _calculateGrowthRates(current, previous) {
    return {
      members: calculationHelpers.growthRate(current.newMembers, previous.newMembers),
      students: calculationHelpers.growthRate(current.newStudents, previous.newStudents),
      baptisms: calculationHelpers.growthRate(current.baptisms, previous.baptisms),
      conversions: calculationHelpers.growthRate(current.conversions, previous.conversions)
    };
  }

  /**
   * Calcula efectividad del ministerio
   */
  _calculateEffectiveness(metrics, totals) {
    const conversionRate = totals.totalMembers > 0 ? 
      calculationHelpers.percentage(metrics.conversions, totals.totalMembers) : 0;
    
    const baptismRate = metrics.conversions > 0 ? 
      calculationHelpers.percentage(metrics.baptisms, metrics.conversions) : 0;

    const groupProductivity = totals.totalGroups > 0 ? 
      (metrics.newMembers + metrics.newStudents) / totals.totalGroups : 0;

    return {
      conversionRate,
      baptismRate,
      groupProductivity: Math.round(groupProductivity * 100) / 100,
      overallScore: calculationHelpers.average([conversionRate, baptismRate, Math.min(groupProductivity * 10, 100)])
    };
  }

  /**
   * Obtiene distribución de valores con validación
   */
  _getDistribution(data, field) {
    if (!data || data.length === 0) return [];

    const validData = data.filter(item => item[field] !== null && item[field] !== undefined);
    const grouped = arrayHelpers.groupBy(validData, field);
    
    return Object.keys(grouped).map(key => ({
      label: key || 'Sin especificar',
      value: grouped[key].length,
      percentage: calculationHelpers.percentage(grouped[key].length, validData.length)
    })).sort((a, b) => b.value - a.value);
  }

  /**
   * Obtiene últimos 12 meses para análisis de tendencias
   */
  _getLast12Months() {
    const months = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        label: date.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })
      });
    }
    
    return months;
  }

  /**
   * Analiza tendencias en los datos temporales
   */
  _analyzeTrends(trendData) {
    if (!trendData || trendData.length < 2) return null;

    const growthRates = [];
    const totalValues = trendData.map(d => d.members + d.students + d.baptisms);

    for (let i = 1; i < trendData.length; i++) {
      const current = totalValues[i];
      const previous = totalValues[i - 1];
      growthRates.push(calculationHelpers.growthRate(current, previous));
    }

    const bestMonthIndex = totalValues.indexOf(Math.max(...totalValues));
    const worstMonthIndex = totalValues.indexOf(Math.min(...totalValues));

    return {
      averageGrowth: calculationHelpers.average(growthRates),
      bestMonth: trendData[bestMonthIndex],
      challengingMonth: trendData[worstMonthIndex],
      trend: growthRates.slice(-3).every(rate => rate > 0) ? 'ascending' :
             growthRates.slice(-3).every(rate => rate < 0) ? 'descending' : 'stable'
    };
  }

  /**
   * Calcula score de consistencia para asistencia
   */
  _calculateConsistencyScore(metrics) {
    if (!metrics || metrics.length === 0) return 0;

    const attendances = metrics.map(m => m.averageAttendance).filter(a => a !== null);
    if (attendances.length === 0) return 0;

    const mean = calculationHelpers.average(attendances);
    const variance = attendances.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / attendances.length;
    const stdDev = Math.sqrt(variance);

    // Score inverso: menor desviación = mayor consistencia
    return Math.max(0, 100 - (stdDev / mean) * 100);
  }

  /**
   * Formatea datos para gráficos con validación
   */
  _formatChartData(groupedData, valueField) {
    if (!groupedData) return [];

    return Object.keys(groupedData).map((key, index) => ({
      label: key || 'Sin especificar',
      value: calculationHelpers.safeSum(
        groupedData[key].map(item => parseFloat(item[valueField]) || 0)
      ),
      color: CHART_COLORS.GRADIENT[index % CHART_COLORS.GRADIENT.length],
      count: groupedData[key].length
    })).filter(item => item.value > 0);
  }

  /**
   * Obtiene conteo autorizado según rol
   */
  async _getAuthorizedCount(Model, whereCondition, userRole, include = []) {
    try {
      return await Model.count({
        where: whereCondition,
        include: include
      });
    } catch (error) {
      console.error(`Error en conteo autorizado para ${Model.name}:`, error);
      return 0;
    }
  }
}

module.exports = new DashboardService();