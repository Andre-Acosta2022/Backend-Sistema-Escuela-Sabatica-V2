/**
 * REPORT.SERVICE.JS - Servicio de Generación de Reportes
 * Sistema de Gestión Misionera
 * 
 * Genera reportes complejos, exporta a Excel/PDF y realiza análisis estadísticos
 * Maneja reportes personalizados según rol de usuario con optimización de consultas
 */

const { Op, Sequelize } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const db = require('../models');
const { 
  calculationHelpers, 
  dateHelpers, 
  arrayHelpers, 
  responseHelpers,
  formatHelpers
} = require('./helpers');
const { CHART_COLORS, ROLES, ROLE_HIERARCHY, REPORT_TYPES, MESSAGES } = require('./constants');

// Destructuring de modelos
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

class ReportService {

  // =============================================
  // REPORTES PRINCIPALES
  // =============================================

  /**
   * Genera reporte completo de grupo
   * @param {number} groupId - ID del grupo
   * @param {string} userRole - Rol del usuario
   * @param {number} userId - ID del usuario
   * @param {Object} options - Opciones del reporte
   * @returns {Object} Reporte completo del grupo
   */
  async generateGroupReport(groupId, userRole, userId, options = {}) {
    try {
      // Validar permisos
      await this._validateReportPermissions(groupId, userRole, userId);

      const dateRange = this._getReportDateRange(options.period);
      
      // Obtener datos base del grupo
      const groupData = await this._getGroupBaseData(groupId);
      if (!groupData) {
        throw new Error(MESSAGES.ERRORS.GROUP_NOT_FOUND);
      }

      // Obtener todos los componentes del reporte
      const [
        membersData,
        studentsData,
        metricsData,
        indicatorsData,
        statisticalAnalysis
      ] = await Promise.all([
        this._getGroupMembersData(groupId, dateRange),
        this._getGroupStudentsData(groupId, dateRange),
        this._getGroupMetricsData(groupId, dateRange),
        this._getSpiritualIndicatorsData(groupId, dateRange),
        this._generateStatisticalAnalysis(groupId, dateRange)
      ]);

      // Generar resumen ejecutivo
      const executiveSummary = this._generateExecutiveSummary({
        group: groupData,
        members: membersData,
        students: studentsData,
        metrics: metricsData,
        indicators: indicatorsData,
        analysis: statisticalAnalysis
      });

      const report = {
        metadata: {
          reportId: this._generateReportId(),
          groupId,
          groupName: groupData.name,
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
          period: options.period || 'current_quarter',
          dateRange,
          reportType: 'complete_group_report'
        },
        executiveSummary,
        groupInfo: groupData,
        members: membersData,
        bibleStudents: studentsData,
        metrics: metricsData,
        spiritualIndicators: indicatorsData,
        statisticalAnalysis,
        recommendations: this._generateRecommendations(statisticalAnalysis)
      };

      return responseHelpers.success(report);
    } catch (error) {
      console.error('Error generando reporte de grupo:', error);
      throw new Error(`Error generando reporte: ${error.message}`);
    }
  }

  /**
   * Genera reporte consolidado por iglesia
   */
  async generateChurchReport(churchId, userRole, userId, options = {}) {
    try {
      await this._validateChurchReportPermissions(churchId, userRole, userId);

      const dateRange = this._getReportDateRange(options.period);

      // Datos base de la iglesia
      const churchData = await Church.findByPk(churchId, {
        attributes: ['id', 'name', 'address', 'phone', 'email', 'capacity', 'pastor']
      });

      if (!churchData) {
        throw new Error(MESSAGES.ERRORS.CHURCH_NOT_FOUND);
      }

      // Grupos de la iglesia
      const groupsData = await Group.findAll({
        where: { churchId, status: 'active' },
        include: [
          {
            model: User,
            as: 'leader',
            attributes: ['firstName', 'lastName', 'email', 'phone']
          }
        ],
        attributes: ['id', 'name', 'type', 'category', 'currentCapacity', 'maxCapacity']
      });

      // Métricas consolidadas
      const consolidatedMetrics = await this._getConsolidatedChurchMetrics(churchId, dateRange);

      // Análisis comparativo entre grupos
      const groupComparison = await this._generateGroupComparison(
        groupsData.map(g => g.id), 
        dateRange
      );

      const report = {
        metadata: {
          reportId: this._generateReportId(),
          churchId,
          churchName: churchData.name,
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
          period: options.period || 'current_quarter',
          dateRange,
          reportType: 'church_consolidated_report'
        },
        churchInfo: churchData,
        groups: groupsData,
        consolidatedMetrics,
        groupComparison,
        trends: await this._getChurchTrends(churchId, dateRange),
        executiveSummary: this._generateChurchExecutiveSummary(consolidatedMetrics, groupsData)
      };

      return responseHelpers.success(report);
    } catch (error) {
      console.error('Error generando reporte de iglesia:', error);
      throw new Error(`Error generando reporte de iglesia: ${error.message}`);
    }
  }

  /**
   * Genera reporte estadístico avanzado
   */
  async generateStatisticalReport(filters, userRole, userId, options = {}) {
    try {
      const whereConditions = this._buildReportFilters(filters, userRole, userId);
      const dateRange = this._getReportDateRange(options.period);

      // Análisis demográfico
      const demographicAnalysis = await this._getDemographicAnalysis(whereConditions, dateRange);

      // Análisis de crecimiento
      const growthAnalysis = await this._getGrowthAnalysis(whereConditions, dateRange);

      // Análisis de patrones
      const patternAnalysis = await this._getPatternAnalysis(whereConditions, dateRange);

      // Predicciones y proyecciones
      const projections = await this._generateProjections(whereConditions, dateRange);

      const report = {
        metadata: {
          reportId: this._generateReportId(),
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
          period: options.period || 'current_year',
          dateRange,
          reportType: 'statistical_analysis_report',
          filters
        },
        demographicAnalysis,
        growthAnalysis,
        patternAnalysis,
        projections,
        insights: this._generateStatisticalInsights({
          demographic: demographicAnalysis,
          growth: growthAnalysis,
          patterns: patternAnalysis
        })
      };

      return responseHelpers.success(report);
    } catch (error) {
      console.error('Error generando reporte estadístico:', error);
      throw new Error(`Error generando reporte estadístico: ${error.message}`);
    }
  }

  // =============================================
  // EXPORTACIÓN DE REPORTES
  // =============================================

  /**
   * Exporta reporte a Excel
   */
  async exportToExcel(reportData, options = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Metadatos del libro
      workbook.creator = 'Sistema de Gestión Misionera';
      workbook.lastModifiedBy = 'Sistema de Gestión Misionera';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Hoja de resumen ejecutivo
      const summarySheet = workbook.addWorksheet('Resumen Ejecutivo');
      await this._createExecutiveSummarySheet(summarySheet, reportData);

      // Hojas según tipo de reporte
      if (reportData.reportType === 'complete_group_report') {
        await this._createGroupReportSheets(workbook, reportData);
      } else if (reportData.reportType === 'church_consolidated_report') {
        await this._createChurchReportSheets(workbook, reportData);
      }

      // Hoja de gráficos (si se requiere)
      if (options.includeCharts) {
        await this._createChartsSheet(workbook, reportData);
      }

      // Generar archivo temporal
      const fileName = `reporte_${reportData.metadata.reportId}_${Date.now()}.xlsx`;
      const filePath = path.join(process.cwd(), 'temp', fileName);
      
      // Asegurar que existe el directorio temp
      await this._ensureTempDirectory();
      
      await workbook.xlsx.writeFile(filePath);

      return {
        fileName,
        filePath,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      throw new Error(`Error exportando a Excel: ${error.message}`);
    }
  }

  /**
   * Exporta reporte a PDF
   */
  async exportToPDF(reportData, options = {}) {
    try {
      const fileName = `reporte_${reportData.metadata.reportId}_${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'temp', fileName);
      
      await this._ensureTempDirectory();

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Reporte - ${reportData.metadata.reportType}`,
          Author: 'Sistema de Gestión Misionera',
          Creator: 'Sistema de Gestión Misionera',
          CreationDate: new Date()
        }
      });

      const stream = require('fs').createWriteStream(filePath);
      doc.pipe(stream);

      // Generar contenido del PDF
      await this._generatePDFContent(doc, reportData, options);

      doc.end();

      // Esperar a que termine la escritura
      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return {
        fileName,
        filePath,
        mimeType: 'application/pdf'
      };
    } catch (error) {
      console.error('Error exportando a PDF:', error);
      throw new Error(`Error exportando a PDF: ${error.message}`);
    }
  }

  // =============================================
  // MÉTODOS PRIVADOS DE DATOS
  // =============================================

  /**
   * Obtiene datos base del grupo
   */
  async _getGroupBaseData(groupId) {
    return await Group.findByPk(groupId, {
      include: [
        {
          model: Church,
          attributes: ['name', 'address', 'pastor']
        },
        {
          model: User,
          as: 'leader',
          attributes: ['firstName', 'lastName', 'email', 'phone']
        }
      ],
      attributes: [
        'id', 'name', 'type', 'category', 'description',
        'currentCapacity', 'maxCapacity', 'meetingSchedule',
        'location', 'status', 'createdAt'
      ]
    });
  }

  /**
   * Obtiene datos de miembros del grupo
   */
  async _getGroupMembersData(groupId, dateRange) {
    const members = await Member.findAll({
      where: { 
        groupId,
        status: { [Op.in]: ['active', 'inactive'] }
      },
      include: [
        {
          model: SpiritualIndicator,
          where: {
            evaluationDate: {
              [Op.between]: [dateRange.start, dateRange.end]
            }
          },
          required: false
        }
      ],
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    // Estadísticas de miembros
    const stats = {
      total: members.length,
      active: members.filter(m => m.status === 'active').length,
      inactive: members.filter(m => m.status === 'inactive').length,
      baptized: members.filter(m => m.baptized).length,
      byGender: this._getDistribution(members, 'gender'),
      byAgeGroup: this._getDistribution(members, 'ageGroup'),
      bySpiritualStatus: this._getDistribution(members, 'spiritualStatus'),
      averageAge: calculationHelpers.average(
        members.map(m => m.age).filter(age => age !== null)
      )
    };

    return { members, stats };
  }

  /**
   * Obtiene datos de estudiantes bíblicos
   */
  async _getGroupStudentsData(groupId, dateRange) {
    const students = await BibleStudent.findAll({
      where: { 
        groupId,
        status: { [Op.in]: ['active', 'graduated', 'inactive'] },
        createdAt: {
          [Op.lte]: dateRange.end
        }
      },
      order: [['lastName', 'ASC'], ['firstName', 'ASC']]
    });

    const stats = {
      total: students.length,
      active: students.filter(s => s.status === 'active').length,
      graduated: students.filter(s => s.status === 'graduated').length,
      inactive: students.filter(s => s.status === 'inactive').length,
      byProgram: this._getDistribution(students, 'studyProgram'),
      byProgress: this._getDistribution(students, 'progress'),
      averageGrade: calculationHelpers.average(
        students.map(s => s.currentGrade).filter(grade => grade !== null)
      ),
      completionRate: students.length > 0 ? 
        calculationHelpers.percentage(
          students.filter(s => s.status === 'graduated').length,
          students.length
        ) : 0
    };

    return { students, stats };
  }

  /**
   * Obtiene métricas del grupo
   */
  async _getGroupMetricsData(groupId, dateRange) {
    const metrics = await GroupMetric.findAll({
      where: {
        groupId,
        periodStart: { [Op.gte]: dateRange.start },
        periodEnd: { [Op.lte]: dateRange.end }
      },
      order: [['periodStart', 'ASC']]
    });

    const aggregated = {
      totalSessions: calculationHelpers.safeSum(metrics.map(m => m.totalSessions)),
      averageAttendance: calculationHelpers.average(metrics.map(m => m.averageAttendance)),
      totalConversions: calculationHelpers.safeSum(metrics.map(m => m.newConversions)),
      totalBaptisms: calculationHelpers.safeSum(metrics.map(m => m.baptisms)),
      totalEvents: calculationHelpers.safeSum(metrics.map(m => m.evangelisticEvents)),
      totalDecisions: calculationHelpers.safeSum(metrics.map(m => m.decisionsForChrist)),
      maxAttendance: calculationHelpers.safeMax(metrics.map(m => m.maxAttendance)),
      minAttendance: calculationHelpers.safeMin(metrics.map(m => m.minAttendance))
    };

    return { metrics, aggregated };
  }

  /**
   * Obtiene indicadores espirituales
   */
  async _getSpiritualIndicatorsData(groupId, dateRange) {
    const indicators = await SpiritualIndicator.findAll({
      include: [{
        model: Member,
        where: { groupId },
        attributes: ['firstName', 'lastName', 'spiritualStatus']
      }],
      where: {
        evaluationDate: {
          [Op.between]: [dateRange.start, dateRange.end]
        }
      },
      order: [['evaluationDate', 'DESC']]
    });

    const analysis = {
      totalEvaluations: indicators.length,
      averageAttendance: calculationHelpers.average(
        indicators.map(i => i.attendancePercentage)
      ),
      averageBibleReading: calculationHelpers.average(
        indicators.map(i => i.bibleReadingDays)
      ),
      averageSpiritualGrowth: calculationHelpers.average(
        indicators.map(i => i.spiritualGrowthLevel)
      ),
      prayerFrequencyDistribution: this._getDistribution(indicators, 'prayerFrequency'),
      participationDistribution: this._getDistribution(indicators, 'participationLevel')
    };

    return { indicators, analysis };
  }

  /**
   * Genera análisis estadístico
   */
  async _generateStatisticalAnalysis(groupId, dateRange) {
    const currentPeriod = await this._getPeriodData(groupId, dateRange);
    const previousPeriod = await this._getPeriodData(
      groupId, 
      this._getPreviousPeriodRange(dateRange)
    );

    const trends = this._calculateTrends(currentPeriod, previousPeriod);
    const correlations = this._calculateCorrelations(currentPeriod);
    const forecasting = this._generateForecast(currentPeriod);

    return {
      currentPeriod,
      previousPeriod,
      trends,
      correlations,
      forecasting,
      insights: this._generateInsights(trends, correlations)
    };
  }

  /**
   * Genera métricas consolidadas de iglesia
   */
  async _getConsolidatedChurchMetrics(churchId, dateRange) {
    const groups = await Group.findAll({
      where: { churchId, status: 'active' },
      attributes: ['id']
    });

    const groupIds = groups.map(g => g.id);

    const [totalMembers, totalStudents, totalMetrics] = await Promise.all([
      Member.count({
        where: { groupId: { [Op.in]: groupIds }, status: 'active' }
      }),
      BibleStudent.count({
        where: { groupId: { [Op.in]: groupIds }, status: 'active' }
      }),
      GroupMetric.findAll({
        where: {
          groupId: { [Op.in]: groupIds },
          periodStart: { [Op.gte]: dateRange.start },
          periodEnd: { [Op.lte]: dateRange.end }
        }
      })
    ]);

    return {
      totalGroups: groups.length,
      totalMembers,
      totalStudents,
      aggregatedMetrics: {
        totalConversions: calculationHelpers.safeSum(totalMetrics.map(m => m.newConversions)),
        totalBaptisms: calculationHelpers.safeSum(totalMetrics.map(m => m.baptisms)),
        averageAttendance: calculationHelpers.average(totalMetrics.map(m => m.averageAttendance)),
        totalEvents: calculationHelpers.safeSum(totalMetrics.map(m => m.evangelisticEvents))
      }
    };
  }

  // =============================================
  // MÉTODOS DE EXPORTACIÓN
  // =============================================

  /**
   * Crea hoja de resumen ejecutivo en Excel
   */
  async _createExecutiveSummarySheet(worksheet, reportData) {
    // Configurar hoja
    worksheet.name = 'Resumen Ejecutivo';
    
    // Título principal
    worksheet.mergeCells('A1:F1');
    worksheet.getCell('A1').value = 'REPORTE DE GESTIÓN MISIONERA';
    worksheet.getCell('A1').style = {
      font: { size: 16, bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // Información del reporte
    let row = 3;
    const infoData = [
      ['Fecha de Generación:', dateHelpers.formatDateToString(reportData.metadata.generatedAt)],
      ['Período:', reportData.metadata.period],
      ['Tipo de Reporte:', reportData.metadata.reportType]
    ];

    infoData.forEach(([label, value]) => {
      worksheet.getCell(`A${row}`).value = label;
      worksheet.getCell(`B${row}`).value = value;
      worksheet.getCell(`A${row}`).style = { font: { bold: true } };
      row++;
    });

    // Resumen de métricas (si existe)
    if (reportData.executiveSummary) {
      row += 2;
      worksheet.getCell(`A${row}`).value = 'MÉTRICAS PRINCIPALES';
      worksheet.getCell(`A${row}`).style = {
        font: { size: 14, bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } }
      };

      row++;
      Object.entries(reportData.executiveSummary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          worksheet.getCell(`A${row}`).value = formatHelpers.formatLabel(key);
          worksheet.getCell(`B${row}`).value = value;
          row++;
        }
      });
    }

    // Ajustar ancho de columnas
    worksheet.getColumn('A').width = 25;
    worksheet.getColumn('B').width = 20;
  }

  /**
   * Genera contenido PDF
   */
  async _generatePDFContent(doc, reportData, options) {
    // Encabezado
    doc.fontSize(20).text('REPORTE DE GESTIÓN MISIONERA', 50, 50, {
      align: 'center'
    });

    doc.fontSize(12).text(`Generado el: ${dateHelpers.formatDateToString(reportData.metadata.generatedAt)}`, 50, 100);
    doc.text(`Período: ${reportData.metadata.period}`, 50, 115);

    let yPosition = 150;

    // Resumen ejecutivo
    if (reportData.executiveSummary) {
      doc.fontSize(16).text('RESUMEN EJECUTIVO', 50, yPosition);
      yPosition += 30;

      Object.entries(reportData.executiveSummary).forEach(([key, value]) => {
        if (typeof value === 'number') {
          doc.fontSize(12).text(`${formatHelpers.formatLabel(key)}: ${value}`, 50, yPosition);
          yPosition += 20;
        }
      });
    }

    // Información específica según tipo de reporte
    if (reportData.reportType === 'complete_group_report') {
      await this._addGroupReportToPDF(doc, reportData, yPosition);
    }

    // Pie de página
    doc.fontSize(8).text(
      'Sistema de Gestión Misionera - Generado automáticamente',
      50,
      doc.page.height - 50,
      { align: 'center' }
    );
  }

  // =============================================
  // MÉTODOS AUXILIARES
  // =============================================

  /**
   * Valida permisos para generar reporte de grupo
   */
  async _validateReportPermissions(groupId, userRole, userId) {
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[ROLES.ADMIN]) {
      return true; // Admin y director pueden ver todos los reportes
    }

    if (userRole === ROLES.LEADER) {
      const group = await Group.findByPk(groupId, {
        attributes: ['leaderId']
      });
      
      if (!group || group.leaderId !== userId) {
        throw new Error(MESSAGES.ERRORS.INSUFFICIENT_PERMISSIONS);
      }
    }

    return true;
  }

  /**
   * Valida permisos para reporte de iglesia
   */
  async _validateChurchReportPermissions(churchId, userRole, userId) {
    if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[ROLES.DIRECTOR]) {
      return true;
    }
    
    throw new Error(MESSAGES.ERRORS.INSUFFICIENT_PERMISSIONS);
  }

  /**
   * Obtiene rango de fechas para reporte
   */
  _getReportDateRange(period = 'current_quarter') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    switch (period) {
      case 'current_month':
        return dateHelpers.getMonthRange(currentYear, currentMonth);
      case 'current_quarter':
        return dateHelpers.getQuarterRange(currentYear, Math.ceil(currentMonth / 3));
      case 'current_year':
        return dateHelpers.getYearRange(currentYear);
      case 'last_30_days':
        return {
          start: dateHelpers.formatDateForDB(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
          end: dateHelpers.formatDateForDB(now)
        };
      default:
        return dateHelpers.getQuarterRange(currentYear, Math.ceil(currentMonth / 3));
    }
  }

  /**
   * Genera ID único para reporte
   */
  _generateReportId() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `RPT-${timestamp}-${random}`;
  }

  /**
   * Genera resumen ejecutivo
   */
  _generateExecutiveSummary(data) {
    return {
      totalMembers: data.members.stats.total,
      activeMembers: data.members.stats.active,
      totalStudents: data.students.stats.total,
      activeStudents: data.students.stats.active,
      baptizedMembers: data.members.stats.baptized,
      averageAttendance: data.metrics.aggregated.averageAttendance,
      totalConversions: data.metrics.aggregated.totalConversions,
      totalBaptisms: data.metrics.aggregated.totalBaptisms,
      completionRate: data.students.stats.completionRate,
      spiritualGrowthAverage: data.indicators.analysis.averageSpiritualGrowth
    };
  }

  /**
   * Genera recomendaciones basadas en análisis
   */
  _generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.trends.attendance < 0) {
      recommendations.push({
        category: 'Asistencia',
        priority: 'Alta',
        description: 'La asistencia ha disminuido. Considere revisar horarios y métodos de comunicación.',
        actions: [
          'Encuesta de satisfacción a miembros',
          'Revisión de horarios de reunión',
          'Implementar recordatorios automáticos'
        ]
      });
    }

    if (analysis.correlations.conversionRate < 5) {
      recommendations.push({
        category: 'Evangelismo',
        priority: 'Media',
        description: 'La tasa de conversión está por debajo del promedio esperado.',
        actions: [
          'Capacitación en técnicas evangelísticas',
          'Incrementar eventos de alcance',
          'Establecer metas mensuales de evangelismo'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Obtiene distribución de valores
   */
  _getDistribution(data, field) {
    if (!data || data.length === 0) return [];

    const validData = data.filter(item => item[field] !== null && item[field] !== undefined);
    const grouped = arrayHelpers.groupBy(validData, field);
    
    return Object.keys(grouped).map(key => ({
      label: key || 'Sin especificar',
      value: grouped[key].length,
      percentage: calculationHelpers.percentage(grouped[key].length, validData.length)
    }));
  }

  /**
   * Calcula tendencias entre períodos
   */
  _calculateTrends(current, previous) {
    return {
      attendance: calculationHelpers.growthRate(
        current.averageAttendance, 
        previous.averageAttendance
      ),
      members: calculationHelpers.growthRate(
        current.totalMembers, 
        previous.totalMembers
      ),
      conversions: calculationHelpers.growthRate(
        current.totalConversions, 
        previous.totalConversions
      ),
      baptisms: calculationHelpers.growthRate(
        current.totalBaptisms, 
        previous.totalBaptisms
      )
    };
  }

  /**
   * Asegura que existe directorio temporal
   */
  async _ensureTempDirectory() {
    const tempDir = path.join(process.cwd(), 'temp');
    try {
      await fs.access(tempDir);
    } catch {
      await fs.mkdir(tempDir, { recursive: true });
    }
  }

  /**
   * Construye filtros para reportes
   */
  _buildReportFilters(filters, userRole, userId) {
    let conditions = {
      church: { status: 'active' },
      group: { status: 'active' },
      member: { status: 'active' }
    };

    // Aplicar filtros de seguridad por rol
    if (userRole === ROLES.LEADER) {
      conditions.group = { ...conditions.group, leaderId: userId };
    }

    // Aplicar filtros específicos
    if (filters.churchId) {
      conditions.church = { ...conditions.church, id: filters.churchId };
      conditions.group = { ...conditions.group, churchId: filters.churchId };
    }

    if (filters.groupType) {
      conditions.group = { ...conditions.group, type: filters.groupType };
    }

    return conditions;
  }

  /**
   * Obtiene datos de período para análisis
   */
  async _getPeriodData(groupId, dateRange) {
    const [members, students, metrics, indicators] = await Promise.all([
      Member.count({
        where: { 
          groupId, 
          status: 'active',
          createdAt: { [Op.lte]: dateRange.end }
        }
      }),
      BibleStudent.count({
        where: { 
          groupId, 
          status: 'active',
          createdAt: { [Op.lte]: dateRange.end }
        }
      }),
      GroupMetric.findAll({
        where: {
          groupId,
          periodStart: { [Op.gte]: dateRange.start },
          periodEnd: { [Op.lte]: dateRange.end }
        }
      }),
      SpiritualIndicator.findAll({
        include: [{
          model: Member,
          where: { groupId }
        }],
        where: {
          evaluationDate: {
            [Op.between]: [dateRange.start, dateRange.end]
          }
        }
      })
    ]);

    return {
      totalMembers: members,
      totalStudents: students,
      averageAttendance: calculationHelpers.average(metrics.map(m => m.averageAttendance)),
      totalConversions: calculationHelpers.safeSum(metrics.map(m => m.newConversions)),
      totalBaptisms: calculationHelpers.safeSum(metrics.map(m => m.baptisms)),
      spiritualGrowth: calculationHelpers.average(indicators.map(i => i.spiritualGrowthLevel)),
      totalSessions: calculationHelpers.safeSum(metrics.map(m => m.totalSessions))
    };
  }

  /**
   * Obtiene rango del período anterior
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
   * Calcula correlaciones entre métricas
   */
  _calculateCorrelations(data) {
    return {
      conversionRate: data.totalConversions > 0 && data.totalMembers > 0 ?
        calculationHelpers.percentage(data.totalConversions, data.totalMembers) : 0,
      baptismRate: data.totalBaptisms > 0 && data.totalConversions > 0 ?
        calculationHelpers.percentage(data.totalBaptisms, data.totalConversions) : 0,
      attendanceEffectiveness: data.averageAttendance || 0,
      spiritualGrowthIndex: data.spiritualGrowth || 0
    };
  }

  /**
   * Genera pronósticos simples
   */
  _generateForecast(data) {
    // Pronóstico simple basado en tendencias actuales
    const growthFactor = 1.05; // 5% de crecimiento esperado
    
    return {
      projectedMembers: Math.round(data.totalMembers * growthFactor),
      projectedStudents: Math.round(data.totalStudents * growthFactor),
      projectedConversions: Math.round(data.totalConversions * growthFactor),
      confidence: 'medium',
      timeframe: 'next_quarter'
    };
  }

  /**
   * Genera insights estadísticos
   */
  _generateInsights(trends, correlations) {
    const insights = [];

    if (trends.attendance > 10) {
      insights.push({
        type: 'positive',
        metric: 'Asistencia',
        description: 'Excelente crecimiento en asistencia',
        impact: 'high'
      });
    }

    if (correlations.conversionRate > 8) {
      insights.push({
        type: 'positive',
        metric: 'Evangelismo',
        description: 'Tasa de conversión por encima del promedio',
        impact: 'high'
      });
    }

    if (trends.members < -5) {
      insights.push({
        type: 'concern',
        metric: 'Membresía',
        description: 'Disminución en el número de miembros',
        impact: 'medium'
      });
    }

    return insights;
  }

  /**
   * Genera análisis demográfico
   */
  async _getDemographicAnalysis(whereConditions, dateRange) {
    const members = await Member.findAll({
      where: whereConditions.member,
      attributes: ['gender', 'ageGroup', 'maritalStatus', 'educationLevel', 'spiritualStatus']
    });

    return {
      genderDistribution: this._getDistribution(members, 'gender'),
      ageDistribution: this._getDistribution(members, 'ageGroup'),
      maritalStatusDistribution: this._getDistribution(members, 'maritalStatus'),
      educationDistribution: this._getDistribution(members, 'educationLevel'),
      spiritualStatusDistribution: this._getDistribution(members, 'spiritualStatus'),
      totalAnalyzed: members.length
    };
  }

  /**
   * Genera análisis de crecimiento
   */
  async _getGrowthAnalysis(whereConditions, dateRange) {
    const months = this._getLast12Months();
    
    const growthData = await Promise.all(months.map(async (month) => {
      const monthRange = dateHelpers.getMonthRange(month.year, month.month);
      
      const [memberCount, studentCount, baptismCount] = await Promise.all([
        Member.count({
          where: {
            ...whereConditions.member,
            createdAt: { [Op.between]: [monthRange.start, monthRange.end] }
          }
        }),
        BibleStudent.count({
          where: {
            ...whereConditions.student,
            createdAt: { [Op.between]: [monthRange.start, monthRange.end] }
          }
        }),
        Member.count({
          where: {
            ...whereConditions.member,
            baptized: true,
            baptismDate: { [Op.between]: [monthRange.start, monthRange.end] }
          }
        })
      ]);

      return {
        month: month.label,
        newMembers: memberCount,
        newStudents: studentCount,
        baptisms: baptismCount
      };
    }));

    return {
      monthlyData: growthData,
      trends: this._analyzeGrowthTrends(growthData),
      totalGrowth: {
        members: calculationHelpers.safeSum(growthData.map(d => d.newMembers)),
        students: calculationHelpers.safeSum(growthData.map(d => d.newStudents)),
        baptisms: calculationHelpers.safeSum(growthData.map(d => d.baptisms))
      }
    };
  }

  /**
   * Genera análisis de patrones
   */
  async _getPatternAnalysis(whereConditions, dateRange) {
    const indicators = await SpiritualIndicator.findAll({
      include: [{
        model: Member,
        where: whereConditions.member
      }],
      where: {
        evaluationDate: {
          [Op.between]: [dateRange.start, dateRange.end]
        }
      }
    });

    const patterns = {
      attendancePatterns: this._analyzeAttendancePatterns(indicators),
      prayerPatterns: this._getDistribution(indicators, 'prayerFrequency'),
      growthPatterns: this._analyzeGrowthPatterns(indicators),
      participationPatterns: this._getDistribution(indicators, 'participationLevel')
    };

    return patterns;
  }

  /**
   * Genera proyecciones
   */
  async _generateProjections(whereConditions, dateRange) {
    const historicalData = await this._getHistoricalData(whereConditions, dateRange);
    
    return {
      nextQuarter: this._projectNextPeriod(historicalData, 'quarter'),
      nextYear: this._projectNextPeriod(historicalData, 'year'),
      methodology: 'linear_regression',
      confidence: 'medium'
    };
  }

  /**
   * Analiza patrones de asistencia
   */
  _analyzeAttendancePatterns(indicators) {
    const attendanceRanges = {
      excellent: indicators.filter(i => i.attendancePercentage >= 90).length,
      good: indicators.filter(i => i.attendancePercentage >= 70 && i.attendancePercentage < 90).length,
      regular: indicators.filter(i => i.attendancePercentage >= 50 && i.attendancePercentage < 70).length,
      poor: indicators.filter(i => i.attendancePercentage < 50).length
    };

    return {
      distribution: attendanceRanges,
      average: calculationHelpers.average(indicators.map(i => i.attendancePercentage)),
      consistency: this._calculateAttendanceConsistency(indicators)
    };
  }

  /**
   * Calcula consistencia de asistencia
   */
  _calculateAttendanceConsistency(indicators) {
    if (indicators.length < 2) return 0;
    
    const attendances = indicators.map(i => i.attendancePercentage);
    const mean = calculationHelpers.average(attendances);
    const variance = attendances.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / attendances.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, 100 - (stdDev / mean) * 100);
  }

  /**
   * Crea hojas de reporte de grupo en Excel
   */
  async _createGroupReportSheets(workbook, reportData) {
    // Hoja de miembros
    if (reportData.members) {
      const membersSheet = workbook.addWorksheet('Miembros');
      await this._createMembersSheet(membersSheet, reportData.members);
    }

    // Hoja de estudiantes bíblicos
    if (reportData.bibleStudents) {
      const studentsSheet = workbook.addWorksheet('Estudiantes Bíblicos');
      await this._createStudentsSheet(studentsSheet, reportData.bibleStudents);
    }

    // Hoja de métricas
    if (reportData.metrics) {
      const metricsSheet = workbook.addWorksheet('Métricas');
      await this._createMetricsSheet(metricsSheet, reportData.metrics);
    }
  }

  /**
   * Crea hoja de miembros
   */
  async _createMembersSheet(worksheet, membersData) {
    worksheet.name = 'Miembros';
    
    // Encabezados
    const headers = ['Nombre', 'Apellido', 'Género', 'Edad', 'Estado Civil', 'Estado Espiritual', 'Bautizado'];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(1, index + 1);
      cell.value = header;
      cell.style = {
        font: { bold: true },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D9E1F2' } }
      };
    });

    // Datos de miembros
    membersData.members.forEach((member, rowIndex) => {
      const row = rowIndex + 2;
      worksheet.getCell(row, 1).value = member.firstName;
      worksheet.getCell(row, 2).value = member.lastName;
      worksheet.getCell(row, 3).value = member.gender;
      worksheet.getCell(row, 4).value = member.age;
      worksheet.getCell(row, 5).value = member.maritalStatus;
      worksheet.getCell(row, 6).value = member.spiritualStatus;
      worksheet.getCell(row, 7).value = member.baptized ? 'Sí' : 'No';
    });

    // Ajustar anchos
    worksheet.columns.forEach(column => {
      column.width = 15;
    });
  }

  /**
   * Crea hojas de reporte de iglesia en Excel
   */
  async _createChurchReportSheets(workbook, reportData) {
    // Hoja de grupos
    const groupsSheet = workbook.addWorksheet('Grupos');
    await this._createGroupsOverviewSheet(groupsSheet, reportData.groups);

    // Hoja de métricas consolidadas
    const consolidatedSheet = workbook.addWorksheet('Métricas Consolidadas');
    await this._createConsolidatedMetricsSheet(consolidatedSheet, reportData.consolidatedMetrics);
  }

  /**
   * Agrega contenido de reporte de grupo al PDF
   */
  async _addGroupReportToPDF(doc, reportData, yPosition) {
    // Información del grupo
    if (reportData.groupInfo) {
      doc.fontSize(14).text('INFORMACIÓN DEL GRUPO', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(11)
        .text(`Nombre: ${reportData.groupInfo.name}`, 50, yPosition)
        .text(`Tipo: ${reportData.groupInfo.type}`, 50, yPosition + 15)
        .text(`Capacidad: ${reportData.groupInfo.currentCapacity}/${reportData.groupInfo.maxCapacity}`, 50, yPosition + 30)
        .text(`Líder: ${reportData.groupInfo.leader?.firstName} ${reportData.groupInfo.leader?.lastName}`, 50, yPosition + 45);
      
      yPosition += 80;
    }

    // Resumen de estadísticas
    if (reportData.members?.stats) {
      doc.fontSize(14).text('ESTADÍSTICAS DE MIEMBROS', 50, yPosition);
      yPosition += 25;
      
      doc.fontSize(11)
        .text(`Total de miembros: ${reportData.members.stats.total}`, 50, yPosition)
        .text(`Miembros activos: ${reportData.members.stats.active}`, 50, yPosition + 15)
        .text(`Miembros bautizados: ${reportData.members.stats.baptized}`, 50, yPosition + 30);
      
      yPosition += 60;
    }
  }

  /**
   * Obtiene últimos 12 meses
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
   * Analiza tendencias de crecimiento
   */
  _analyzeGrowthTrends(growthData) {
    const memberTrend = this._calculateTrendDirection(growthData.map(d => d.newMembers));
    const studentTrend = this._calculateTrendDirection(growthData.map(d => d.newStudents));
    const baptismTrend = this._calculateTrendDirection(growthData.map(d => d.baptisms));

    return {
      members: memberTrend,
      students: studentTrend,
      baptisms: baptismTrend,
      overall: this._determineOverallTrend(memberTrend, studentTrend, baptismTrend)
    };
  }

  /**
   * Calcula dirección de tendencia
   */
  _calculateTrendDirection(values) {
    if (values.length < 3) return 'insufficient_data';
    
    const recent = values.slice(-3);
    const earlier = values.slice(0, 3);
    
    const recentAvg = calculationHelpers.average(recent);
    const earlierAvg = calculationHelpers.average(earlier);
    
    const change = calculationHelpers.growthRate(recentAvg, earlierAvg);
    
    if (change > 10) return 'ascending';
    if (change < -10) return 'descending';
    return 'stable';
  }

  /**
   * Determina tendencia general
   */
  _determineOverallTrend(memberTrend, studentTrend, baptismTrend) {
    const trends = [memberTrend, studentTrend, baptismTrend];
    const ascendingCount = trends.filter(t => t === 'ascending').length;
    const descendingCount = trends.filter(t => t === 'descending').length;
    
    if (ascendingCount >= 2) return 'positive';
    if (descendingCount >= 2) return 'concerning';
    return 'stable';
  }
}

module.exports = new ReportService();