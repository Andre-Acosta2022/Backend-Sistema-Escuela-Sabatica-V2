/**
 * REPORT.CONTROLLER.JS - Controlador de reportes consolidados
 * Sistema de Gestión Misionera
 * 
 * Genera reportes completos con datos consolidados de:
 * - Grupos y miembros
 * - Indicadores espirituales
 * - Métricas de desempeño
 * - Estudiantes bíblicos
 * - Análisis de crecimiento
 */

const { 
  Group, Member, Indicator, Metric, Student, Church, User, Semester 
} = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// =============================================================================
// REPORTE CONSOLIDADO DE GRUPO
// =============================================================================
const getGroupReport = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { semesterId, includeInactive = false } = req.query;

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId, {
      include: [
        {
          model: Church,
          attributes: ['id', 'name', 'address', 'city']
        },
        {
          model: User,
          as: 'Leader',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar permisos
    await verifyGroupAccess(req, group);

    // Filtros base
    const memberWhere = { 
      groupId,
      ...(includeInactive === 'true' ? {} : { isActive: true })
    };

    const semesterFilter = semesterId ? { semesterId } : {};

    // 1. INFORMACIÓN BÁSICA DEL GRUPO
    const groupInfo = {
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      schedule: group.schedule,
      capacity: group.capacity,
      location: group.location,
      church: {
        name: group.Church.name,
        address: group.Church.address,
        city: group.Church.city
      },
      leader: {
        name: `${group.Leader.firstName} ${group.Leader.lastName}`,
        email: group.Leader.email,
        phone: group.Leader.phone
      },
      isActive: group.isActive,
      createdAt: group.createdAt
    };

    // 2. ESTADÍSTICAS DE MIEMBROS
    const memberStats = await getMemberStatistics(groupId, memberWhere);

    // 3. INDICADORES ESPIRITUALES
    const spiritualIndicators = await getSpiritualIndicatorsReport(groupId, memberWhere, semesterFilter);

    // 4. MÉTRICAS DE DESEMPEÑO
    const performanceMetrics = await getPerformanceMetricsReport(groupId, semesterFilter);

    // 5. ESTUDIANTES BÍBLICOS
    const bibleStudents = await getBibleStudentsReport(groupId, includeInactive);

    // 6. ANÁLISIS DE CRECIMIENTO
    const growthAnalysis = await getGrowthAnalysis(groupId);

    // 7. RESUMEN EJECUTIVO
    const executiveSummary = generateExecutiveSummary({
      memberStats,
      spiritualIndicators,
      performanceMetrics,
      bibleStudents,
      growthAnalysis
    });

    const report = {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: {
          id: req.userId,
          name: `${req.userFirstName} ${req.userLastName}`
        },
        parameters: {
          groupId,
          semesterId: semesterId || 'Todos los semestres',
          includeInactive
        }
      },
      groupInfo,
      executiveSummary,
      memberStatistics: memberStats,
      spiritualIndicators,
      performanceMetrics,
      bibleStudents,
      growthAnalysis
    };

    logger.info(`Reporte consolidado generado para grupo ${group.name}`, {
      groupId,
      userId: req.userId,
      semesterId,
      includeInactive
    });

    res.json({
      success: true,
      message: 'Reporte consolidado generado exitosamente',
      data: report
    });

  } catch (error) {
    logger.error('Error al generar reporte consolidado:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// REPORTE CONSOLIDADO DE IGLESIA
// =============================================================================
const getChurchReport = async (req, res) => {
  try {
    const { churchId } = req.params;
    const { semesterId, includeInactive = false } = req.query;

    // Verificar iglesia y permisos
    const church = await Church.findByPk(churchId);
    if (!church) {
      return res.status(404).json({
        success: false,
        message: 'Iglesia no encontrada'
      });
    }

    // Solo directores y admins pueden ver reportes de iglesia completa
    if (req.userRole === 'leader') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver reportes de iglesia completa'
      });
    }

    if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (userChurch.churchId !== parseInt(churchId)) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver reportes de tu iglesia'
        });
      }
    }

    // Obtener todos los grupos de la iglesia
    const groups = await Group.findAll({
      where: { 
        churchId,
        ...(includeInactive === 'true' ? {} : { isActive: true })
      },
      include: [
        {
          model: User,
          as: 'Leader',
          attributes: ['firstName', 'lastName']
        }
      ]
    });

    // Generar reportes por grupo
    const groupReports = await Promise.all(
      groups.map(async (group) => {
        const memberWhere = { 
          groupId: group.id,
          ...(includeInactive === 'true' ? {} : { isActive: true })
        };
        const semesterFilter = semesterId ? { semesterId } : {};

        const memberStats = await getMemberStatistics(group.id, memberWhere);
        const spiritualIndicators = await getSpiritualIndicatorsReport(group.id, memberWhere, semesterFilter);
        const performanceMetrics = await getPerformanceMetricsReport(group.id, semesterFilter);
        const bibleStudents = await getBibleStudentsReport(group.id, includeInactive);

        return {
          groupId: group.id,
          groupName: group.name,
          leader: `${group.Leader.firstName} ${group.Leader.lastName}`,
          category: group.category,
          memberStats,
          spiritualIndicators: spiritualIndicators.summary,
          performanceMetrics: performanceMetrics.summary,
          bibleStudents: bibleStudents.summary
        };
      })
    );

    // Consolidar estadísticas de iglesia
    const churchSummary = consolidateChurchStatistics(groupReports);

    const report = {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: {
          id: req.userId,
          name: `${req.userFirstName} ${req.userLastName}`
        },
        parameters: {
          churchId,
          semesterId: semesterId || 'Todos los semestres',
          includeInactive
        }
      },
      churchInfo: {
        id: church.id,
        name: church.name,
        address: church.address,
        city: church.city,
        totalGroups: groups.length
      },
      churchSummary,
      groupReports
    };

    logger.info(`Reporte de iglesia generado: ${church.name}`, {
      churchId,
      userId: req.userId,
      totalGroups: groups.length
    });

    res.json({
      success: true,
      message: 'Reporte de iglesia generado exitosamente',
      data: report
    });

  } catch (error) {
    logger.error('Error al generar reporte de iglesia:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// REPORTE DE COMPARATIVA ENTRE GRUPOS
// =============================================================================
const getComparativeReport = async (req, res) => {
  try {
    const { groupIds } = req.body; // Array de IDs de grupos
    const { semesterId } = req.query;

    if (!Array.isArray(groupIds) || groupIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren al menos 2 grupos para comparar'
      });
    }

    if (groupIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Máximo 10 grupos para comparar'
      });
    }

    // Verificar que todos los grupos existen y el usuario tiene acceso
    const groups = await Group.findAll({
      where: { id: { [Op.in]: groupIds } },
      include: [
        {
          model: Church,
          attributes: ['id', 'name']
        },
        {
          model: User,
          as: 'Leader',
          attributes: ['firstName', 'lastName']
        }
      ]
    });

    if (groups.length !== groupIds.length) {
      return res.status(404).json({
        success: false,
        message: 'Algunos grupos no fueron encontrados'
      });
    }

    // Verificar permisos para cada grupo
    for (const group of groups) {
      try {
        await verifyGroupAccess(req, group);
      } catch (error) {
        return res.status(403).json({
          success: false,
          message: `No tienes permisos para acceder al grupo: ${group.name}`
        });
      }
    }

    // Generar datos comparativos
    const comparativeData = await Promise.all(
      groups.map(async (group) => {
        const memberWhere = { groupId: group.id, isActive: true };
        const semesterFilter = semesterId ? { semesterId } : {};

        const memberStats = await getMemberStatistics(group.id, memberWhere);
        const spiritualIndicators = await getSpiritualIndicatorsReport(group.id, memberWhere, semesterFilter);
        const performanceMetrics = await getPerformanceMetricsReport(group.id, semesterFilter);
        const bibleStudents = await getBibleStudentsReport(group.id, false);

        return {
          groupId: group.id,
          groupName: group.name,
          church: group.Church.name,
          leader: `${group.Leader.firstName} ${group.Leader.lastName}`,
          category: group.category,
          capacity: group.capacity,
          memberStats,
          spiritualIndicators: spiritualIndicators.summary,
          performanceMetrics: performanceMetrics.summary,
          bibleStudents: bibleStudents.summary,
          scores: {
            memberEngagement: calculateMemberEngagementScore(memberStats, spiritualIndicators.summary),
            spiritualGrowth: spiritualIndicators.summary.overallAverage,
            academicProgress: bibleStudents.summary.averageProgress,
            groupEfficiency: calculateGroupEfficiencyScore(memberStats, group.capacity, performanceMetrics.summary)
          }
        };
      })
    );

    // Generar rankings
    const rankings = generateGroupRankings(comparativeData);

    const report = {
      reportInfo: {
        generatedAt: new Date(),
        generatedBy: {
          id: req.userId,
          name: `${req.userFirstName} ${req.userLastName}`
        },
        parameters: {
          groupCount: groups.length,
          semesterId: semesterId || 'Todos los semestres'
        }
      },
      comparativeData,
      rankings,
      insights: generateComparativeInsights(comparativeData, rankings)
    };

    logger.info(`Reporte comparativo generado para ${groups.length} grupos`, {
      userId: req.userId,
      groupIds
    });

    res.json({
      success: true,
      message: 'Reporte comparativo generado exitosamente',
      data: report
    });

  } catch (error) {
    logger.error('Error al generar reporte comparativo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// FUNCIONES AUXILIARES PARA REPORTES
// =============================================================================

// Verificar acceso a grupo
const verifyGroupAccess = async (req, group) => {
  if (req.userRole === 'admin') return true;
  
  if (req.userRole === 'leader' && group.leaderId !== req.userId) {
    throw new Error('No tienes permisos para acceder a este grupo');
  }
  
  if (req.userRole === 'director') {
    const userChurch = await User.findByPk(req.userId, {
      attributes: ['churchId']
    });
    
    if (group.churchId !== userChurch.churchId) {
      throw new Error('No tienes permisos para acceder a grupos de otras iglesias');
    }
  }
  
  return true;
};

// Estadísticas de miembros
const getMemberStatistics = async (groupId, memberWhere) => {
  const totalMembers = await Member.count({ where: memberWhere });
  
  const activeMembers = await Member.count({
    where: { ...memberWhere, isActive: true }
  });

  const genderStats = await Member.findAll({
    where: memberWhere,
    attributes: [
      'gender',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
    ],
    group: ['gender'],
    raw: true
  });

  const ageGroups = await Member.findAll({
    where: memberWhere,
    attributes: [
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.literal(`
        CASE 
          WHEN EXTRACT(YEAR FROM AGE(birthDate)) < 18 THEN 'Menores de 18'
          WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 31 AND 50 THEN '31-50'
          ELSE 'Mayores de 50'
        END
      `), 'ageGroup']
    ],
    group: [Sequelize.literal(`
      CASE 
        WHEN EXTRACT(YEAR FROM AGE(birthDate)) < 18 THEN 'Menores de 18'
        WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 18 AND 30 THEN '18-30'
        WHEN EXTRACT(YEAR FROM AGE(birthDate)) BETWEEN 31 AND 50 THEN '31-50'
        ELSE 'Mayores de 50'
      END
    `)],
    raw: true
  });

  return {
    totalMembers,
    activeMembers,
    inactiveMembers: totalMembers - activeMembers,
    genderDistribution: genderStats.reduce((acc, item) => {
      acc[item.gender || 'No especificado'] = parseInt(item.count);
      return acc;
    }, {}),
    ageDistribution: ageGroups.reduce((acc, item) => {
      acc[item.ageGroup] = parseInt(item.count);
      return acc;
    }, {})
  };
};

// Reporte de indicadores espirituales
const getSpiritualIndicatorsReport = async (groupId, memberWhere, semesterFilter) => {
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
    indicatorTypes.map(async (type) => {
      const stats = await Indicator.findAll({
        include: [{
          model: Member,
          where: memberWhere,
          attributes: []
        }],
        where: {
          type,
          ...semesterFilter
        },
        attributes: [
          [Sequelize.fn('AVG', Sequelize.col('value')), 'average'],
          [Sequelize.fn('COUNT', Sequelize.col('Indicator.id')), 'count']
        ],
        raw: true
      });

      return {
        type,
        average: parseFloat(stats[0].average || 0).toFixed(1),
        count: parseInt(stats[0].count || 0)
      };
    })
  );

  const overallAverage = typeStats.length > 0 
    ? (typeStats.reduce((sum, stat) => sum + parseFloat(stat.average), 0) / typeStats.filter(stat => stat.count > 0).length).toFixed(1)
    : '0.0';

  return {
    summary: {
      overallAverage: parseFloat(overallAverage),
      totalEvaluations: typeStats.reduce((sum, stat) => sum + stat.count, 0)
    },
    byType: typeStats
  };
};

// Reporte de métricas de desempeño
const getPerformanceMetricsReport = async (groupId, semesterFilter) => {
  const metrics = await Metric.findAll({
    where: {
      groupId,
      ...semesterFilter
    },
    attributes: [
      [Sequelize.fn('AVG', Sequelize.col('attendance')), 'avgAttendance'],
      [Sequelize.fn('AVG', Sequelize.col('newVisitors')), 'avgNewVisitors'],
      [Sequelize.fn('AVG', Sequelize.col('conversions')), 'avgConversions'],
      [Sequelize.fn('SUM', Sequelize.col('offerings')), 'totalOfferings'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'reportCount']
    ],
    raw: true
  });

  const result = metrics[0] || {};

  return {
    summary: {
      averageAttendance: parseFloat(result.avgAttendance || 0).toFixed(1),
      averageNewVisitors: parseFloat(result.avgNewVisitors || 0).toFixed(1),
      averageConversions: parseFloat(result.avgConversions || 0).toFixed(1),
      totalOfferings: parseFloat(result.totalOfferings || 0),
      totalReports: parseInt(result.reportCount || 0)
    }
  };
};

// Reporte de estudiantes bíblicos
const getBibleStudentsReport = async (groupId, includeInactive) => {
  const studentWhere = {
    groupId,
    ...(includeInactive === 'true' ? {} : { isActive: true })
  };

  const totalStudents = await Student.count({ where: studentWhere });

  const programStats = await Student.findAll({
    where: studentWhere,
    attributes: [
      'program',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      [Sequelize.fn('AVG', Sequelize.col('progress')), 'avgProgress']
    ],
    group: ['program'],
    raw: true
  });

  const graduatedStudents = await Student.count({
    where: { ...studentWhere, isGraduated: true }
  });

  return {
    summary: {
      totalStudents,
      graduatedStudents,
      averageProgress: programStats.length > 0 
        ? (programStats.reduce((sum, prog) => sum + parseFloat(prog.avgProgress || 0), 0) / programStats.length).toFixed(1)
        : '0.0'
    },
    byProgram: programStats.map(prog => ({
      program: prog.program,
      count: parseInt(prog.count),
      averageProgress: parseFloat(prog.avgProgress || 0).toFixed(1)
    }))
  };
};

// Análisis de crecimiento
const getGrowthAnalysis = async (groupId) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyData = await Member.findAll({
    where: {
      groupId,
      createdAt: { [Op.gte]: sixMonthsAgo }
    },
    attributes: [
      [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt')), 'month'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'newMembers']
    ],
    group: [Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt'))],
    order: [[Sequelize.fn('DATE_TRUNC', 'month', Sequelize.col('createdAt')), 'ASC']],
    raw: true
  });

  return {
    monthlyGrowth: monthlyData.map(data => ({
      month: data.month,
      newMembers: parseInt(data.newMembers)
    })),
    totalGrowthSixMonths: monthlyData.reduce((sum, data) => sum + parseInt(data.newMembers), 0)
  };
};

// Generar resumen ejecutivo
const generateExecutiveSummary = (data) => {
  const { memberStats, spiritualIndicators, performanceMetrics, bibleStudents, growthAnalysis } = data;
  
  return {
    totalMembers: memberStats.totalMembers,
    activeMembers: memberStats.activeMembers,
    memberRetentionRate: memberStats.totalMembers > 0 ? 
      ((memberStats.activeMembers / memberStats.totalMembers) * 100).toFixed(1) : '0.0',
    spiritualHealthScore: spiritualIndicators.summary.overallAverage,
    averageAttendance: performanceMetrics.summary.averageAttendance,
    totalStudents: bibleStudents.summary.totalStudents,
    graduationRate: bibleStudents.summary.totalStudents > 0 ?
      ((bibleStudents.summary.graduatedStudents / bibleStudents.summary.totalStudents) * 100).toFixed(1) : '0.0',
    monthlyGrowth: growthAnalysis.totalGrowthSixMonths
  };
};

// Consolidar estadísticas de iglesia
const consolidateChurchStatistics = (groupReports) => {
  const totals = groupReports.reduce((acc, group) => {
    acc.totalMembers += group.memberStats.totalMembers;
    acc.activeMembers += group.memberStats.activeMembers;
    acc.totalStudents += group.bibleStudents.totalStudents;
    acc.graduatedStudents += group.bibleStudents.graduatedStudents;
    acc.spiritualScores.push(group.spiritualIndicators.overallAverage);
    acc.attendanceRates.push(parseFloat(group.performanceMetrics.averageAttendance));
    return acc;
  }, {
    totalMembers: 0,
    activeMembers: 0,
    totalStudents: 0,
    graduatedStudents: 0,
    spiritualScores: [],
    attendanceRates: []
  });

  return {
    totalGroups: groupReports.length,
    totalMembers: totals.totalMembers,
    activeMembers: totals.activeMembers,
    totalStudents: totals.totalStudents,
    graduatedStudents: totals.graduatedStudents,
    averageSpiritualScore: totals.spiritualScores.length > 0 ?
      (totals.spiritualScores.reduce((sum, score) => sum + score, 0) / totals.spiritualScores.length).toFixed(1) : '0.0',
    averageAttendance: totals.attendanceRates.length > 0 ?
      (totals.attendanceRates.reduce((sum, rate) => sum + rate, 0) / totals.attendanceRates.length).toFixed(1) : '0.0'
  };
};

// Calcular puntuaciones compuestas
const calculateMemberEngagementScore = (memberStats, spiritualIndicators) => {
  const retentionRate = memberStats.totalMembers > 0 ? 
    (memberStats.activeMembers / memberStats.totalMembers) * 100 : 0;
  const spiritualScore = spiritualIndicators.overallAverage * 20; // Escalar de 1-5 a 0-100
  
  return ((retentionRate + spiritualScore) / 2).toFixed(1);
};

const calculateGroupEfficiencyScore = (memberStats, capacity, performanceMetrics) => {
  const utilizationRate = capacity > 0 ? 
    (memberStats.activeMembers / capacity) * 100 : 0;
  const attendanceScore = parseFloat(performanceMetrics.averageAttendance) * 10; // Escalar
  
  return ((utilizationRate + attendanceScore) / 2).toFixed(1);
};

// Generar rankings
const generateGroupRankings = (comparativeData) => {
  const rankings = {
    byMemberEngagement: [...comparativeData].sort((a, b) => 
      parseFloat(b.scores.memberEngagement) - parseFloat(a.scores.memberEngagement)
    ).map((group, index) => ({
      rank: index + 1,
      groupName: group.groupName,
      score: group.scores.memberEngagement
    })),
    
    bySpiritualGrowth: [...comparativeData].sort((a, b) => 
      parseFloat(b.scores.spiritualGrowth) - parseFloat(a.scores.spiritualGrowth)
    ).map((group, index) => ({
      rank: index + 1,
      groupName: group.groupName,
      score: group.scores.spiritualGrowth
    })),
    
    byAcademicProgress: [...comparativeData].sort((a, b) => 
      parseFloat(b.scores.academicProgress) - parseFloat(a.scores.academicProgress)
    ).map((group, index) => ({
      rank: index + 1,
      groupName: group.groupName,
      score: group.scores.academicProgress
    })),
    
    byGroupEfficiency: [...comparativeData].sort((a, b) => 
      parseFloat(b.scores.groupEfficiency) - parseFloat(a.scores.groupEfficiency)
    ).map((group, index) => ({
      rank: index + 1,
      groupName: group.groupName,
      score: group.scores.groupEfficiency
    }))
  };

  return rankings;
};

// Generar insights comparativos
const generateComparativeInsights = (comparativeData, rankings) => {
  const insights = [];
  
  // Mejores prácticas
  const topPerformers = {
    engagement: rankings.byMemberEngagement[0],
    spiritual: rankings.bySpiritualGrowth[0],
    academic: rankings.byAcademicProgress[0],
    efficiency: rankings.byGroupEfficiency[0]
  };
  
  insights.push({
    type: 'best_practices',
    title: 'Mejores Prácticas Identificadas',
    data: topPerformers
  });
  
  // Grupos que necesitan atención
  const needsAttention = comparativeData.filter(group => 
    parseFloat(group.scores.memberEngagement) < 50 ||
    parseFloat(group.scores.spiritualGrowth) < 3.0 ||
    parseFloat(group.scores.academicProgress) < 50
  );
  
  if (needsAttention.length > 0) {
    insights.push({
      type: 'needs_attention',
      title: 'Grupos que Requieren Atención',
      data: needsAttention.map(group => ({
        groupName: group.groupName,
        concerns: [
          ...(parseFloat(group.scores.memberEngagement) < 50 ? ['Baja participación de miembros'] : []),
          ...(parseFloat(group.scores.spiritualGrowth) < 3.0 ? ['Crecimiento espiritual limitado'] : []),
          ...(parseFloat(group.scores.academicProgress) < 50 ? ['Progreso académico lento'] : [])
        ]
      }))
    });
  }
  
  // Análisis de tendencias
  const averages = {
    memberEngagement: (comparativeData.reduce((sum, group) => 
      sum + parseFloat(group.scores.memberEngagement), 0) / comparativeData.length).toFixed(1),
    spiritualGrowth: (comparativeData.reduce((sum, group) => 
      sum + parseFloat(group.scores.spiritualGrowth), 0) / comparativeData.length).toFixed(1),
    academicProgress: (comparativeData.reduce((sum, group) => 
      sum + parseFloat(group.scores.academicProgress), 0) / comparativeData.length).toFixed(1)
  };
  
  insights.push({
    type: 'trends',
    title: 'Tendencias Generales',
    data: {
      averages,
      totalGroups: comparativeData.length,
      highPerformingGroups: comparativeData.filter(group => 
        parseFloat(group.scores.memberEngagement) > 70
      ).length
    }
  });

  return insights;
};

// =============================================================================
// EXPORTAR FUNCIONES
// =============================================================================
module.exports = {
  getGroupReport,
  getChurchReport,
  getComparativeReport
};