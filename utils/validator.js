/**
 * VALIDATORS.JS - Validaciones Personalizadas del Sistema
 * Sistema de Gestión Misionera
 * 
 * Contiene validaciones específicas del negocio y reglas personalizadas
 */

const { validationHelpers, dateHelpers } = require('./helpers');
const { 
  ROLES, USER_STATUS, GROUP_STATUS, MEMBER_STATUS, STUDENT_STATUS,
  GROUP_TYPES, GROUP_CATEGORIES, MEETING_DAYS, GENDER_OPTIONS,
  MARITAL_STATUS, SPIRITUAL_STATUS, STUDY_PROGRAMS, ACADEMIC_LEVELS,
  SEMESTER_PERIODS, METRIC_PERIODS, PRAYER_FREQUENCY, MESSAGES
} = require('./constants');

// =============================================
// VALIDADORES DE USUARIO
// =============================================
const userValidators = {
  /**
   * Valida datos de registro de usuario
   */
  validateUserRegistration: (userData) => {
    const errors = [];

    // Validaciones requeridas
    if (!userData.firstName) {
      errors.push({ field: 'firstName', message: MESSAGES.VALIDATION.REQUIRED });
    }
    
    if (!userData.lastName) {
      errors.push({ field: 'lastName', message: MESSAGES.VALIDATION.REQUIRED });
    }
    
    if (!userData.email) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.REQUIRED });
    } else if (!validationHelpers.isValidEmail(userData.email)) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }
    
    if (!userData.password) {
      errors.push({ field: 'password', message: MESSAGES.VALIDATION.REQUIRED });
    } else if (!validationHelpers.isStrongPassword(userData.password)) {
      errors.push({ field: 'password', message: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT });
    }

    // Validaciones opcionales
    if (userData.phone && !validationHelpers.isValidPhone(userData.phone)) {
      errors.push({ field: 'phone', message: MESSAGES.VALIDATION.INVALID_PHONE });
    }
    
    if (userData.role && !Object.values(ROLES).includes(userData.role)) {
      errors.push({ field: 'role', message: 'Rol inválido' });
    }

    if (userData.churchId && !validationHelpers.isValidUUID(userData.churchId)) {
      errors.push({ field: 'churchId', message: 'ID de iglesia inválido' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida actualización de perfil
   */
  validateProfileUpdate: (userData, userId) => {
    const errors = [];

    if (!validationHelpers.isValidUUID(userId)) {
      errors.push({ field: 'userId', message: 'ID de usuario inválido' });
    }

    if (userData.email && !validationHelpers.isValidEmail(userData.email)) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }

    if (userData.phone && !validationHelpers.isValidPhone(userData.phone)) {
      errors.push({ field: 'phone', message: MESSAGES.VALIDATION.INVALID_PHONE });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida cambio de contraseña
   */
  validatePasswordChange: (passwordData) => {
    const errors = [];

    if (!passwordData.currentPassword) {
      errors.push({ field: 'currentPassword', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!passwordData.newPassword) {
      errors.push({ field: 'newPassword', message: MESSAGES.VALIDATION.REQUIRED });
    } else if (!validationHelpers.isStrongPassword(passwordData.newPassword)) {
      errors.push({ field: 'newPassword', message: MESSAGES.VALIDATION.PASSWORD_TOO_SHORT });
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Las contraseñas no coinciden' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE IGLESIA
// =============================================
const churchValidators = {
  /**
   * Valida datos de iglesia
   */
  validateChurch: (churchData) => {
    const errors = [];

    if (!churchData.name) {
      errors.push({ field: 'name', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!churchData.address) {
      errors.push({ field: 'address', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!churchData.city) {
      errors.push({ field: 'city', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!churchData.state) {
      errors.push({ field: 'state', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (churchData.email && !validationHelpers.isValidEmail(churchData.email)) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }

    if (churchData.phone && !validationHelpers.isValidPhone(churchData.phone)) {
      errors.push({ field: 'phone', message: MESSAGES.VALIDATION.INVALID_PHONE });
    }

    if (churchData.pastorEmail && !validationHelpers.isValidEmail(churchData.pastorEmail)) {
      errors.push({ field: 'pastorEmail', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }

    if (churchData.capacity && (!Number.isInteger(churchData.capacity) || churchData.capacity < 1)) {
      errors.push({ field: 'capacity', message: 'Capacidad debe ser un número entero positivo' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE GRUPO
// =============================================
const groupValidators = {
  /**
   * Valida datos de grupo
   */
  validateGroup: (groupData) => {
    const errors = [];

    if (!groupData.name) {
      errors.push({ field: 'name', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!groupData.churchId || !validationHelpers.isValidUUID(groupData.churchId)) {
      errors.push({ field: 'churchId', message: 'ID de iglesia requerido y válido' });
    }

    if (!groupData.leaderId || !validationHelpers.isValidUUID(groupData.leaderId)) {
      errors.push({ field: 'leaderId', message: 'ID de líder requerido y válido' });
    }

    if (!Object.values(GROUP_TYPES).includes(groupData.type)) {
      errors.push({ field: 'type', message: 'Tipo de grupo inválido' });
    }

    if (!Object.values(GROUP_CATEGORIES).includes(groupData.category)) {
      errors.push({ field: 'category', message: 'Categoría de grupo inválida' });
    }

    if (!Object.values(MEETING_DAYS).includes(groupData.meetingDay)) {
      errors.push({ field: 'meetingDay', message: 'Día de reunión inválido' });
    }

    if (!groupData.meetingTime) {
      errors.push({ field: 'meetingTime', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (groupData.maxCapacity && (!Number.isInteger(groupData.maxCapacity) || groupData.maxCapacity < 1)) {
      errors.push({ field: 'maxCapacity', message: 'Capacidad máxima debe ser un número entero positivo' });
    }

    if (groupData.startDate && groupData.endDate) {
      if (new Date(groupData.startDate) >= new Date(groupData.endDate)) {
        errors.push({ field: 'endDate', message: 'Fecha de fin debe ser posterior a fecha de inicio' });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida que un grupo pueda aceptar nuevos miembros
   */
  validateGroupCapacity: (group, newMembersCount = 1) => {
    const errors = [];

    if (!group.isActive) {
      errors.push({ field: 'group', message: 'El grupo no está activo' });
    }

    if (group.status !== 'active') {
      errors.push({ field: 'group', message: 'El grupo no está en estado activo' });
    }

    if (!group.isOpenToNewMembers) {
      errors.push({ field: 'group', message: 'El grupo no acepta nuevos miembros' });
    }

    if (group.maxCapacity && (group.currentSize + newMembersCount) > group.maxCapacity) {
      errors.push({ field: 'group', message: 'El grupo ha alcanzado su capacidad máxima' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE MIEMBRO
// =============================================
const memberValidators = {
  /**
   * Valida datos de miembro
   */
  validateMember: (memberData) => {
    const errors = [];

    if (!memberData.firstName) {
      errors.push({ field: 'firstName', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!memberData.lastName) {
      errors.push({ field: 'lastName', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!memberData.groupId || !validationHelpers.isValidUUID(memberData.groupId)) {
      errors.push({ field: 'groupId', message: 'ID de grupo requerido y válido' });
    }

    if (memberData.email && !validationHelpers.isValidEmail(memberData.email)) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }

    if (memberData.phone && !validationHelpers.isValidPhone(memberData.phone)) {
      errors.push({ field: 'phone', message: MESSAGES.VALIDATION.INVALID_PHONE });
    }

    if (memberData.dateOfBirth) {
      if (!dateHelpers.isValidDate(memberData.dateOfBirth)) {
        errors.push({ field: 'dateOfBirth', message: MESSAGES.VALIDATION.INVALID_DATE });
      } else if (new Date(memberData.dateOfBirth) > new Date()) {
        errors.push({ field: 'dateOfBirth', message: MESSAGES.VALIDATION.FUTURE_DATE_NOT_ALLOWED });
      }
    }

    if (memberData.gender && !Object.values(GENDER_OPTIONS).includes(memberData.gender)) {
      errors.push({ field: 'gender', message: 'Género inválido' });
    }

    if (memberData.maritalStatus && !Object.values(MARITAL_STATUS).includes(memberData.maritalStatus)) {
      errors.push({ field: 'maritalStatus', message: 'Estado civil inválido' });
    }

    if (memberData.spiritualStatus && !Object.values(SPIRITUAL_STATUS).includes(memberData.spiritualStatus)) {
      errors.push({ field: 'spiritualStatus', message: 'Estado espiritual inválido' });
    }

    if (memberData.baptismDate) {
      if (!dateHelpers.isValidDate(memberData.baptismDate)) {
        errors.push({ field: 'baptismDate', message: MESSAGES.VALIDATION.INVALID_DATE });
      } else if (!memberData.baptized) {
        errors.push({ field: 'baptismDate', message: 'No puede tener fecha de bautismo sin estar bautizado' });
      }
    }

    if (memberData.emergencyContact && !validationHelpers.isValidEmergencyContact(memberData.emergencyContact)) {
      errors.push({ field: 'emergencyContact', message: 'Contacto de emergencia inválido' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE ESTUDIANTE BÍBLICO
// =============================================
const studentValidators = {
  /**
   * Valida datos de estudiante bíblico
   */
  validateStudent: (studentData) => {
    const errors = [];

    if (!studentData.firstName) {
      errors.push({ field: 'firstName', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!studentData.lastName) {
      errors.push({ field: 'lastName', message: MESSAGES.VALIDATION.REQUIRED });
    }

    if (!studentData.groupId || !validationHelpers.isValidUUID(studentData.groupId)) {
      errors.push({ field: 'groupId', message: 'ID de grupo requerido y válido' });
    }

    if (!Object.values(STUDY_PROGRAMS).includes(studentData.program)) {
      errors.push({ field: 'program', message: 'Programa de estudio inválido' });
    }

    if (!Object.values(ACADEMIC_LEVELS).includes(studentData.level)) {
      errors.push({ field: 'level', message: 'Nivel académico inválido' });
    }

    if (studentData.teacherId && !validationHelpers.isValidUUID(studentData.teacherId)) {
      errors.push({ field: 'teacherId', message: 'ID de maestro inválido' });
    }

    if (studentData.email && !validationHelpers.isValidEmail(studentData.email)) {
      errors.push({ field: 'email', message: MESSAGES.VALIDATION.INVALID_EMAIL });
    }

    if (studentData.currentGrade && !validationHelpers.isInRange(studentData.currentGrade, 0, 20)) {
      errors.push({ field: 'currentGrade', message: 'Nota actual debe estar entre 0 y 20' });
    }

    if (studentData.attendancePercentage && !validationHelpers.isInRange(studentData.attendancePercentage, 0, 100)) {
      errors.push({ field: 'attendancePercentage', message: 'Porcentaje de asistencia debe estar entre 0 y 100' });
    }

    if (studentData.totalLessons && studentData.completedLessons > studentData.totalLessons) {
      errors.push({ field: 'completedLessons', message: 'Lecciones completadas no puede ser mayor a total de lecciones' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida progreso del estudiante
   */
  validateStudentProgress: (progressData) => {
    const errors = [];

    if (!progressData.studentId || !validationHelpers.isValidUUID(progressData.studentId)) {
      errors.push({ field: 'studentId', message: 'ID de estudiante requerido y válido' });
    }

    if (progressData.completedLessons < 0) {
      errors.push({ field: 'completedLessons', message: 'Lecciones completadas no puede ser negativo' });
    }

    if (progressData.currentGrade && !validationHelpers.isInRange(progressData.currentGrade, 0, 20)) {
      errors.push({ field: 'currentGrade', message: 'Nota debe estar entre 0 y 20' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE MÉTRICAS
// =============================================
const metricValidators = {
  /**
   * Valida datos de métrica
   */
  validateMetric: (metricData) => {
    const errors = [];

    if (!metricData.groupId || !validationHelpers.isValidUUID(metricData.groupId)) {
      errors.push({ field: 'groupId', message: 'ID de grupo requerido y válido' });
    }

    if (!Object.values(METRIC_PERIODS).includes(metricData.periodType)) {
      errors.push({ field: 'periodType', message: 'Tipo de período inválido' });
    }

    if (!metricData.periodStart || !dateHelpers.isValidDate(metricData.periodStart)) {
      errors.push({ field: 'periodStart', message: 'Fecha de inicio requerida y válida' });
    }

    if (!metricData.periodEnd || !dateHelpers.isValidDate(metricData.periodEnd)) {
      errors.push({ field: 'periodEnd', message: 'Fecha de fin requerida y válida' });
    }

    if (metricData.periodStart && metricData.periodEnd) {
      if (new Date(metricData.periodStart) >= new Date(metricData.periodEnd)) {
        errors.push({ field: 'periodEnd', message: 'Fecha de fin debe ser posterior a fecha de inicio' });
      }
    }

    // Validaciones numéricas
    const numericFields = [
      'totalMeetings', 'averageAttendance', 'maxAttendance', 'minAttendance',
      'newMembers', 'leftMembers', 'totalMembersStart', 'totalMembersEnd',
      'newConversions', 'baptisms', 'newStudents', 'graduatedStudents', 'activeStudents'
    ];

    numericFields.forEach(field => {
      if (metricData[field] !== undefined && metricData[field] < 0) {
        errors.push({ field, message: `${field} no puede ser negativo` });
      }
    });

    if (metricData.minAttendance > metricData.maxAttendance) {
      errors.push({ field: 'minAttendance', message: 'Asistencia mínima no puede ser mayor a máxima' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES DE INDICADORES ESPIRITUALES
// =============================================
const indicatorValidators = {
  /**
   * Valida indicadores espirituales
   */
  validateSpiritualIndicator: (indicatorData) => {
    const errors = [];

    if (!indicatorData.memberId || !validationHelpers.isValidUUID(indicatorData.memberId)) {
      errors.push({ field: 'memberId', message: 'ID de miembro requerido y válido' });
    }

    if (!validationHelpers.isInRange(indicatorData.attendancePercentage, 0, 100)) {
      errors.push({ field: 'attendancePercentage', message: 'Porcentaje de asistencia debe estar entre 0 y 100' });
    }

    if (indicatorData.bibleReadingDays < 0 || indicatorData.bibleReadingDays > 31) {
      errors.push({ field: 'bibleReadingDays', message: 'Días de lectura bíblica debe estar entre 0 y 31' });
    }

    if (!Object.values(PRAYER_FREQUENCY).includes(indicatorData.prayerFrequency)) {
      errors.push({ field: 'prayerFrequency', message: 'Frecuencia de oración inválida' });
    }

    if (!validationHelpers.isInRange(indicatorData.spiritualGrowthLevel, 1, 10)) {
      errors.push({ field: 'spiritualGrowthLevel', message: 'Nivel de crecimiento espiritual debe estar entre 1 y 10' });
    }

    if (indicatorData.evaluationDate && !dateHelpers.isValidDate(indicatorData.evaluationDate)) {
      errors.push({ field: 'evaluationDate', message: MESSAGES.VALIDATION.INVALID_DATE });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// VALIDADORES GENERALES
// =============================================
const generalValidators = {
  /**
   * Valida parámetros de paginación
   */
  validatePagination: (page, size) => {
    const errors = [];

    if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
      errors.push({ field: 'page', message: 'Página debe ser un número entero positivo' });
    }

    if (size && (!Number.isInteger(Number(size)) || Number(size) < 1 || Number(size) > 100)) {
      errors.push({ field: 'size', message: 'Tamaño de página debe estar entre 1 y 100' });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida filtros de búsqueda
   */
  validateSearchFilters: (filters, allowedFields) => {
    const errors = [];

    if (typeof filters !== 'object') {
      errors.push({ field: 'filters', message: 'Filtros deben ser un objeto' });
      return { isValid: false, errors };
    }

    Object.keys(filters).forEach(field => {
      if (!allowedFields.includes(field)) {
        errors.push({ field: 'filters', message: `Campo de filtro '${field}' no permitido` });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Valida rango de fechas
   */
  validateDateRange: (startDate, endDate, maxRangeDays = 365) => {
    const errors = [];

    if (startDate && !dateHelpers.isValidDate(startDate)) {
      errors.push({ field: 'startDate', message: MESSAGES.VALIDATION.INVALID_DATE });
    }

    if (endDate && !dateHelpers.isValidDate(endDate)) {
      errors.push({ field: 'endDate', message: MESSAGES.VALIDATION.INVALID_DATE });
    }

    if (startDate && endDate) {
      if (new Date(startDate) >= new Date(endDate)) {
        errors.push({ field: 'endDate', message: 'Fecha de fin debe ser posterior a fecha de inicio' });
      }

      const daysDiff = dateHelpers.daysBetween(startDate, endDate);
      if (daysDiff > maxRangeDays) {
        errors.push({ field: 'dateRange', message: `Rango de fechas no puede exceder ${maxRangeDays} días` });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
};

// =============================================
// EXPORTACIÓN DEL MÓDULO
// =============================================
module.exports = {
  userValidators,
  churchValidators,
  groupValidators,
  memberValidators,
  studentValidators,
  metricValidators,
  indicatorValidators,
  generalValidators,

  // Funciones de conveniencia
  validateUser: userValidators.validateUserRegistration,
  validateGroup: groupValidators.validateGroup,
  validateMember: memberValidators.validateMember,
  validateStudent: studentValidators.validateStudent,
  validateMetric: metricValidators.validateMetric,
  validateIndicator: indicatorValidators.validateSpiritualIndicator,
  validatePagination: generalValidators.validatePagination
};