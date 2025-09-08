/**
 * EXPORT.SERVICE.JS - Servicio de exportación a Excel y PDF
 * Sistema de Gestión Misionera
 * 
 * Maneja la exportación de datos a diferentes formatos:
 * - Excel (.xlsx) - Para análisis de datos
 * - PDF - Para reportes formales
 * - CSV - Para intercambio de datos
 */

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

// =============================================================================
// EXPORTACIÓN A EXCEL
// =============================================================================

// Exportar reporte de grupo a Excel
const exportGroupReportToExcel = async (reportData) => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Metadatos del archivo
    workbook.creator = 'Sistema de Gestión Misionera';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. HOJA DE RESUMEN EJECUTIVO
    const summarySheet = workbook.addWorksheet('Resumen Ejecutivo');
    
    // Configurar columnas
    summarySheet.columns = [
      { header: 'Métrica', key: 'metric', width: 25 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Observaciones', key: 'notes', width: 40 }
    ];

    // Encabezado del reporte
    summarySheet.addRow(['REPORTE CONSOLIDADO DE GRUPO', '', '']);
    summarySheet.addRow([`Grupo: ${reportData.groupInfo.name}`, '', '']);
    summarySheet.addRow([`Iglesia: ${reportData.groupInfo.church.name}`, '', '']);
    summarySheet.addRow([`Líder: ${reportData.groupInfo.leader.name}`, '', '']);
    summarySheet.addRow([`Generado: ${new Date(reportData.reportInfo.generatedAt).toLocaleString('es-ES')}`, '', '']);
    summarySheet.addRow(['', '', '']); // Línea vacía

    // Datos del resumen ejecutivo
    const summaryData = [
      ['Total de Miembros', reportData.executiveSummary.totalMembers, 'Miembros registrados en el grupo'],
      ['Miembros Activos', reportData.executiveSummary.activeMembers, 'Miembros con participación regular'],
      ['Tasa de Retención', `${reportData.executiveSummary.memberRetentionRate}%`, 'Porcentaje de miembros que permanecen activos'],
      ['Puntuación Espiritual', reportData.executiveSummary.spiritualHealthScore, 'Promedio de indicadores espirituales (escala 1-5)'],
      ['Asistencia Promedio', reportData.executiveSummary.averageAttendance, 'Asistencia promedio a reuniones'],
      ['Estudiantes Bíblicos', reportData.executiveSummary.totalStudents, 'Total de estudiantes en programas bíblicos'],
      ['Tasa de Graduación', `${reportData.executiveSummary.graduationRate}%`, 'Porcentaje de estudiantes que han completado estudios'],
      ['Crecimiento Mensual', reportData.executiveSummary.monthlyGrowth, 'Nuevos miembros en los últimos 6 meses']
    ];

    summaryData.forEach(row => summarySheet.addRow(row));

    // Formatear encabezados
    summarySheet.getRow(1).font = { bold: true, size: 16 };
    summarySheet.getRow(7).font = { bold: true };

    // 2. HOJA DE ESTADÍSTICAS DE MIEMBROS
    const membersSheet = workbook.addWorksheet('Estadísticas Miembros');
    
    membersSheet.addRow(['ESTADÍSTICAS DE MIEMBROS']);
    membersSheet.addRow(['']); // Línea vacía

    // Distribución por género
    membersSheet.addRow(['Distribución por Género']);
    Object.entries(reportData.memberStatistics.genderDistribution).forEach(([gender, count]) => {
      membersSheet.addRow([gender, count]);
    });
    
    membersSheet.addRow(['']); // Línea vacía
    
    // Distribución por edad
    membersSheet.addRow(['Distribución por Edad']);
    Object.entries(reportData.memberStatistics.ageDistribution).forEach(([ageGroup, count]) => {
      membersSheet.addRow([ageGroup, count]);
    });

    // 3. HOJA DE INDICADORES ESPIRITUALES
    const spiritualSheet = workbook.addWorksheet('Indicadores Espirituales');
    
    spiritualSheet.columns = [
      { header: 'Tipo de Indicador', key: 'type', width: 25 },
      { header: 'Promedio', key: 'average', width: 12 },
      { header: 'Total Evaluaciones', key: 'count', width: 18 }
    ];

    spiritualSheet.addRow(['INDICADORES ESPIRITUALES']);
    spiritualSheet.addRow(['']);

    reportData.spiritualIndicators.byType.forEach(indicator => {
      if (indicator.count > 0) {
        spiritualSheet.addRow([
          getIndicatorTypeName(indicator.type),
          indicator.average,
          indicator.count
        ]);
      }
    });

    // Resumen general
    spiritualSheet.addRow(['']);
    spiritualSheet.addRow(['Promedio General', reportData.spiritualIndicators.summary.overallAverage, reportData.spiritualIndicators.summary.totalEvaluations]);

    // 4. HOJA DE MÉTRICAS DE DESEMPEÑO
    const metricsSheet = workbook.addWorksheet('Métricas Desempeño');
    
    metricsSheet.columns = [
      { header: 'Métrica', key: 'metric', width: 20 },
      { header: 'Valor', key: 'value', width: 15 },
      { header: 'Descripción', key: 'description', width: 35 }
    ];

    metricsSheet.addRow(['MÉTRICAS DE DESEMPEÑO']);
    metricsSheet.addRow(['']);

    const metricsData = [
      ['Asistencia Promedio', reportData.performanceMetrics.summary.averageAttendance, 'Asistencia promedio por reunión'],
      ['Visitantes Promedio', reportData.performanceMetrics.summary.averageNewVisitors, 'Nuevos visitantes promedio por reunión'],
      ['Conversiones Promedio', reportData.performanceMetrics.summary.averageConversions, 'Conversiones promedio registradas'],
      ['Total Ofrendas', `${reportData.performanceMetrics.summary.totalOfferings}`, 'Total de ofrendas registradas'],
      ['Total Reportes', reportData.performanceMetrics.summary.totalReports, 'Cantidad de reportes registrados']
    ];

    metricsData.forEach(row => metricsSheet.addRow(row));

    // 5. HOJA DE ESTUDIANTES BÍBLICOS
    const studentsSheet = workbook.addWorksheet('Estudiantes Bíblicos');
    
    studentsSheet.columns = [
      { header: 'Programa', key: 'program', width: 25 },
      { header: 'Estudiantes', key: 'count', width: 15 },
      { header: 'Progreso Promedio', key: 'progress', width: 18 }
    ];

    studentsSheet.addRow(['ESTUDIANTES BÍBLICOS']);
    studentsSheet.addRow(['']);

    reportData.bibleStudents.byProgram.forEach(program => {
      studentsSheet.addRow([
        program.program,
        program.count,
        `${program.averageProgress}%`
      ]);
    });

    // Resumen general
    studentsSheet.addRow(['']);
    studentsSheet.addRow(['RESUMEN GENERAL']);
    studentsSheet.addRow(['Total Estudiantes', reportData.bibleStudents.summary.totalStudents]);
    studentsSheet.addRow(['Graduados', reportData.bibleStudents.summary.graduatedStudents]);
    studentsSheet.addRow(['Progreso Promedio General', `${reportData.bibleStudents.summary.averageProgress}%`]);

    // Aplicar estilos generales
    workbook.worksheets.forEach(worksheet => {
      // Estilo para encabezados principales
      worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '366092' }
      };

      // Auto-ajustar filas
      worksheet.getRow(1).height = 20;
      
      // Bordes para todas las celdas con datos
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 2) {
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          });
        }
      });
    });

    // Generar buffer del archivo
    const buffer = await workbook.xlsx.writeBuffer();
    
    logger.info(`Reporte Excel generado para grupo ${reportData.groupInfo.name}`, {
      groupId: reportData.groupInfo.id,
      sheets: workbook.worksheets.length,
      size: buffer.length
    });

    return {
      success: true,
      buffer,
      filename: `reporte_grupo_${reportData.groupInfo.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    logger.error('Error al generar reporte Excel:', error);
    throw error;
  }
};

// Exportar lista de miembros a Excel
const exportMembersToExcel = async (members, groupInfo) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lista de Miembros');

    // Configurar columnas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Código', key: 'memberCode', width: 12 },
      { header: 'Nombres', key: 'firstName', width: 15 },
      { header: 'Apellidos', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Teléfono', key: 'phone', width: 15 },
      { header: 'Fecha Nacimiento', key: 'birthDate', width: 15 },
      { header: 'Género', key: 'gender', width: 10 },
      { header: 'Estado Civil', key: 'maritalStatus', width: 12 },
      { header: 'Ocupación', key: 'occupation', width: 20 },
      { header: 'Fecha Bautismo', key: 'baptismDate', width: 15 },
      { header: 'Estado', key: 'isActive', width: 10 },
      { header: 'Fecha Registro', key: 'createdAt', width: 15 }
    ];

    // Encabezado del reporte
    worksheet.insertRow(1, [`LISTA DE MIEMBROS - ${groupInfo.name}`]);
    worksheet.insertRow(2, [`Iglesia: ${groupInfo.church.name}`]);
    worksheet.insertRow(3, [`Generado: ${new Date().toLocaleString('es-ES')}`]);
    worksheet.insertRow(4, []);

    // Mover los encabezados de columnas a la fila 5
    const headerRow = worksheet.getRow(5);
    worksheet.columns.forEach((col, index) => {
      headerRow.getCell(index + 1).value = col.header;
    });

    // Agregar datos de miembros
    members.forEach((member, index) => {
      worksheet.addRow({
        id: member.id,
        memberCode: member.memberCode,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        birthDate: member.birthDate ? new Date(member.birthDate).toLocaleDateString('es-ES') : '',
        gender: member.gender,
        maritalStatus: member.maritalStatus,
        occupation: member.occupation,
        baptismDate: member.baptismDate ? new Date(member.baptismDate).toLocaleDateString('es-ES') : '',
        isActive: member.isActive ? 'Activo' : 'Inactivo',
        createdAt: new Date(member.createdAt).toLocaleDateString('es-ES')
      });
    });

    // Aplicar estilos
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '366092' }
    };

    // Estilo para el título
    worksheet.getRow(1).font = { bold: true, size: 16 };
    
    // Auto-filtro para los datos
    worksheet.autoFilter = {
      from: 'A5',
      to: worksheet.getColumn(worksheet.columns.length).letter + (5 + members.length)
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return {
      success: true,
      buffer,
      filename: `miembros_${groupInfo.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

  } catch (error) {
    logger.error('Error al exportar miembros a Excel:', error);
    throw error;
  }
};

// =============================================================================
// EXPORTACIÓN A PDF
// =============================================================================

// Exportar reporte de grupo a PDF
const exportGroupReportToPDF = async (reportData) => {
  try {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    // Capturar el contenido del PDF en chunks
    doc.on('data', chunk => chunks.push(chunk));

    // PÁGINA 1: PORTADA Y RESUMEN EJECUTIVO
    doc.fontSize(20).font('Helvetica-Bold').text('REPORTE CONSOLIDADO DE GRUPO', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(16).font('Helvetica-Bold').text(`${reportData.groupInfo.name}`, { align: 'center' });
    doc.fontSize(14).font('Helvetica').text(`${reportData.groupInfo.church.name}`, { align: 'center' });
    doc.moveDown();

    // Información del grupo
    doc.fontSize(12).font('Helvetica-Bold').text('Información del Grupo:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Líder: ${reportData.groupInfo.leader.name}`);
    doc.text(`Categoría: ${reportData.groupInfo.category}`);
    doc.text(`Capacidad: ${reportData.groupInfo.capacity} personas`);
    doc.text(`Ubicación: ${reportData.groupInfo.location}`);
    doc.text(`Horario: ${reportData.groupInfo.schedule}`);
    doc.moveDown();

    // Resumen ejecutivo
    doc.fontSize(12).font('Helvetica-Bold').text('Resumen Ejecutivo:', { underline: true });
    doc.font('Helvetica');
    
    const summaryData = [
      ['Total de Miembros:', reportData.executiveSummary.totalMembers],
      ['Miembros Activos:', reportData.executiveSummary.activeMembers],
      ['Tasa de Retención:', `${reportData.executiveSummary.memberRetentionRate}%`],
      ['Puntuación Espiritual:', `${reportData.executiveSummary.spiritualHealthScore}/5.0`],
      ['Asistencia Promedio:', reportData.executiveSummary.averageAttendance],
      ['Estudiantes Bíblicos:', reportData.executiveSummary.totalStudents],
      ['Tasa de Graduación:', `${reportData.executiveSummary.graduationRate}%`],
      ['Crecimiento (6 meses):', `${reportData.executiveSummary.monthlyGrowth} nuevos miembros`]
    ];

    let yPosition = doc.y;
    summaryData.forEach(([label, value]) => {
      doc.text(label, 50, yPosition, { width: 200, continued: true });
      doc.text(String(value), 250, yPosition);
      yPosition += 20;
    });

    // PÁGINA 2: ESTADÍSTICAS DETALLADAS
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('ESTADÍSTICAS DETALLADAS', { align: 'center' });
    doc.moveDown();

    // Distribución por género
    doc.fontSize(12).font('Helvetica-Bold').text('Distribución por Género:', { underline: true });
    doc.font('Helvetica');
    Object.entries(reportData.memberStatistics.genderDistribution).forEach(([gender, count]) => {
      doc.text(`${gender}: ${count} personas`);
    });
    doc.moveDown();

    // Distribución por edad
    doc.fontSize(12).font('Helvetica-Bold').text('Distribución por Edad:', { underline: true });
    doc.font('Helvetica');
    Object.entries(reportData.memberStatistics.ageDistribution).forEach(([ageGroup, count]) => {
      doc.text(`${ageGroup}: ${count} personas`);
    });
    doc.moveDown();

    // Indicadores espirituales
    doc.fontSize(12).font('Helvetica-Bold').text('Indicadores Espirituales:', { underline: true });
    doc.font('Helvetica');
    
    reportData.spiritualIndicators.byType.forEach(indicator => {
      if (indicator.count > 0) {
        const typeName = getIndicatorTypeName(indicator.type);
        doc.text(`${typeName}: ${indicator.average}/5.0 (${indicator.count} evaluaciones)`);
      }
    });
    doc.moveDown();

    // PÁGINA 3: MÉTRICAS Y ANÁLISIS
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('MÉTRICAS Y ANÁLISIS', { align: 'center' });
    doc.moveDown();

    // Métricas de desempeño
    doc.fontSize(12).font('Helvetica-Bold').text('Métricas de Desempeño:', { underline: true });
    doc.font('Helvetica');
    doc.text(`Asistencia Promedio: ${reportData.performanceMetrics.summary.averageAttendance}`);
    doc.text(`Nuevos Visitantes: ${reportData.performanceMetrics.summary.averageNewVisitors}`);
    doc.text(`Conversiones: ${reportData.performanceMetrics.summary.averageConversions}`);
    doc.text(`Total Ofrendas: ${reportData.performanceMetrics.summary.totalOfferings}`);
    doc.moveDown();

    // Estudiantes bíblicos
    doc.fontSize(12).font('Helvetica-Bold').text('Programas de Estudio Bíblico:', { underline: true });
    doc.font('Helvetica');
    
    reportData.bibleStudents.byProgram.forEach(program => {
      doc.text(`${program.program}: ${program.count} estudiantes (${program.averageProgress}% progreso)`);
    });
    doc.moveDown();

    // Análisis de crecimiento
    if (reportData.growthAnalysis.monthlyGrowth.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('Análisis de Crecimiento (Últimos 6 meses):', { underline: true });
      doc.font('Helvetica');
      
      reportData.growthAnalysis.monthlyGrowth.forEach(month => {
        const monthName = new Date(month.month).toLocaleDateString('es-ES', { 
          year: 'numeric', 
          month: 'long' 
        });
        doc.text(`${monthName}: ${month.newMembers} nuevos miembros`);
      });
      doc.text(`Total crecimiento: ${reportData.growthAnalysis.totalGrowthSixMonths} nuevos miembros`);
    }

    // Pie de página
    doc.fontSize(8).font('Helvetica').text(
      `Reporte generado el ${new Date(reportData.reportInfo.generatedAt).toLocaleString('es-ES')} por ${reportData.reportInfo.generatedBy.name}`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();

    // Esperar a que se complete la generación del PDF
    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        logger.info(`Reporte PDF generado para grupo ${reportData.groupInfo.name}`, {
          groupId: reportData.groupInfo.id,
          size: buffer.length
        });

        resolve({
          success: true,
          buffer,
          filename: `reporte_grupo_${reportData.groupInfo.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          mimeType: 'application/pdf'
        });
      });

      doc.on('error', reject);
    });

  } catch (error) {
    logger.error('Error al generar reporte PDF:', error);
    throw error;
  }
};

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

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
  exportGroupReportToExcel,
  exportMembersToExcel,
  exportGroupReportToPDF
};