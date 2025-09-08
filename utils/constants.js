/**
 * CONSTANTS.JS - Constantes del Sistema de Gestión Misionera
 * Definiciones centralizadas de roles, estados, tipos y configuraciones
 */

// =============================================
// ROLES Y JERARQUÍAS
// =============================================
const ROLES = {
  ADMIN: 'admin',
  DIRECTOR: 'director',
  LEADER: 'leader',
  READER: 'reader'
};

const ROLE_HIERARCHY = {
  admin: 4,
  director: 3,
  leader: 2,
  reader: 1
};

const ROLE_PERMISSIONS = {
  admin: [
    'user.create', 'user.read', 'user.update', 'user.delete', 'user.approve',
    'church.create', 'church.read', 'church.update', 'church.delete',
    'group.create', 'group.read', 'group.update', 'group.delete',
    'member.create', 'member.read', 'member.update', 'member.delete',
    'student.create', 'student.read', 'student.update', 'student.delete',
    'metric.create', 'metric.read', 'metric.update', 'metric.delete', 'metric.approve',
    'indicator.create', 'indicator.read', 'indicator.update', 'indicator.delete',
    'report.generate', 'report.export', 'dashboard.view'
  ],
  director: [
    'church.read', 'church.update',
    'group.create', 'group.read', 'group.update', 'group.delete',
    'member.read', 'student.read', 'metric.read', 'metric.approve',
    'indicator.read', 'report.generate', 'dashboard.view'
  ],
  leader: [
    'group.read', 'group.update',
    'member.create', 'member.read', 'member.update', 'member.delete',
    'student.create', 'student.read', 'student.update', 'student.delete',
    'metric.create', 'metric.read', 'metric.update',
    'indicator.create', 'indicator.read', 'indicator.update', 'indicator.delete',
    'report.view', 'dashboard.view'
  ],
  reader: [
    'group.read', 'member.read', 'student.read', 
    'metric.read', 'indicator.read', 'dashboard.view'
  ]
};

// =============================================
// ESTADOS DEL SISTEMA
// =============================================
const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending'
};

const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

const CHURCH_STATUS = {
  ACTIVE: 'active',
  CONSTRUCTION: 'construction',
  PLANNING: 'planning',
  INACTIVE: 'inactive'
};

const GROUP_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

const MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  TRANSFERRED: 'transferred',
  GRADUATED: 'graduated'
};

const STUDENT_STATUS = {
  ENROLLED: 'enrolled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  SUSPENDED: 'suspended',
  GRADUATED: 'graduated'
};

const METRIC_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// =============================================
// TIPOS Y CATEGORÍAS
// =============================================
const GROUP_TYPES = {
  YOUTH: 'youth',
  ADULTS: 'adults',
  CHILDREN: 'children',
  SENIORS: 'seniors',
  COUPLES: 'couples',
  SINGLES: 'singles',
  WOMEN: 'women',
  MEN: 'men',
  STUDENTS: 'students',
  PROFESSIONALS: 'professionals',
  MIXED: 'mixed'
};

const GROUP_CATEGORIES = {
  BIBLE_STUDY: 'bible_study',
  PRAYER: 'prayer',
  EVANGELISM: 'evangelism',
  DISCIPLESHIP: 'discipleship',
  WORSHIP: 'worship',
  SERVICE: 'service',
  FELLOWSHIP: 'fellowship',
  TRAINING: 'training',
  MISSION: 'mission'
};

const MEETING_DAYS = {
  MONDAY: 'monday',
  TUESDAY: 'tuesday',
  WEDNESDAY: 'wednesday',
  THURSDAY: 'thursday',
  FRIDAY: 'friday',
  SATURDAY: 'saturday',
  SUNDAY: 'sunday'
};

const GENDER_OPTIONS = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other',
  PREFER_NOT_TO_SAY: 'prefer_not_to_say'
};

const MARITAL_STATUS = {
  SINGLE: 'single',
  MARRIED: 'married',
  DIVORCED: 'divorced',
  WIDOWED: 'widowed',
  OTHER: 'other'
};

const EDUCATION_LEVELS = {
  ELEMENTARY: 'elementary',
  HIGH_SCHOOL: 'high_school',
  TECHNICAL: 'technical',
  UNIVERSITY: 'university',
  GRADUATE: 'graduate',
  OTHER: 'other',
  NOT_SPECIFIED: 'not_specified'
};

const SPIRITUAL_STATUS = {
  NEW_BELIEVER: 'new_believer',
  GROWING: 'growing',
  MATURE: 'mature',
  LEADER: 'leader',
  TEACHER: 'teacher',
  VISITOR: 'visitor',
  INACTIVE: 'inactive',
  OTHER: 'other'
};

// =============================================
// PROGRAMAS ACADÉMICOS
// =============================================
const STUDY_PROGRAMS = {
  BASIC_BIBLE: 'basic_bible',
  INTERMEDIATE_BIBLE: 'intermediate_bible',
  ADVANCED_BIBLE: 'advanced_bible',
  THEOLOGY: 'theology',
  DISCIPLESHIP: 'discipleship',
  LEADERSHIP: 'leadership',
  MISSIONS: 'missions',
  EVANGELISM: 'evangelism',
  COUNSELING: 'counseling',
  WORSHIP: 'worship',
  CHILDREN_MINISTRY: 'children_ministry',
  YOUTH_MINISTRY: 'youth_ministry',
  OTHER: 'other'
};

const ACADEMIC_LEVELS = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  GRADUATE: 'graduate'
};

// =============================================
// PERÍODOS Y MÉTRICAS
// =============================================
const SEMESTER_PERIODS = {
  FIRST: 'first',
  SECOND: 'second',
  THIRD: 'third',
  FOURTH: 'fourth',
  ANNUAL: 'annual'
};

const METRIC_PERIODS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMESTER: 'semester',
  ANNUAL: 'annual'
};

const PRAYER_FREQUENCY = {
  NEVER: 'never',
  RARELY: 'rarely',
  SOMETIMES: 'sometimes',
  OFTEN: 'often',
  DAILY: 'daily'
};

// =============================================
// CONFIGURACIONES DEL SISTEMA
// =============================================
const SYSTEM_CONFIG = {
  // Paginación
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Archivos
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Autenticación
  JWT_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  PASSWORD_MIN_LENGTH: 8,
  MAX_LOGIN_ATTEMPTS: 5,
  ACCOUNT_LOCK_TIME: 15 * 60 * 1000, // 15 minutos
  
  // Validaciones
  MIN_GROUP_SIZE: 1,
  MAX_GROUP_SIZE: 50,
  DEFAULT_MEETING_DURATION: 90, // minutos
  
  // Reportes
  REPORT_CACHE_TIME: 60 * 60 * 1000, // 1 hora
  MAX_EXPORT_RECORDS: 1000,
  
  // Dashboard
  DASHBOARD_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutos
  KPI_COMPARISON_MONTHS: 3
};

// =============================================
// MENSAJES DEL SISTEMA
// =============================================
const MESSAGES = {
  // Éxito
  SUCCESS: {
    CREATED: 'Registro creado exitosamente',
    UPDATED: 'Registro actualizado exitosamente',
    DELETED: 'Registro eliminado exitosamente',
    LOGIN: 'Inicio de sesión exitoso',
    LOGOUT: 'Sesión cerrada exitosamente',
    PASSWORD_CHANGED: 'Contraseña cambiada exitosamente',
    APPROVED: 'Registro aprobado exitosamente',
    REJECTED: 'Registro rechazado exitosamente'
  },
  
  // Errores
  ERROR: {
    NOT_FOUND: 'Registro no encontrado',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso denegado',
    VALIDATION_FAILED: 'Datos de entrada inválidos',
    DUPLICATE_ENTRY: 'El registro ya existe',
    INTERNAL_ERROR: 'Error interno del servidor',
    INVALID_CREDENTIALS: 'Credenciales inválidas',
    ACCOUNT_LOCKED: 'Cuenta bloqueada por múltiples intentos fallidos',
    TOKEN_EXPIRED: 'Token expirado',
    INVALID_TOKEN: 'Token inválido',
    INSUFFICIENT_PERMISSIONS: 'Permisos insuficientes',
    INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
    FILE_TOO_LARGE: 'Archivo demasiado grande',
    MISSING_REQUIRED_FIELD: 'Campo requerido faltante'
  },
  
  // Validación
  VALIDATION: {
    REQUIRED: 'Este campo es requerido',
    INVALID_EMAIL: 'Email inválido',
    PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 8 caracteres',
    INVALID_PHONE: 'Número de teléfono inválido',
    INVALID_DATE: 'Fecha inválida',
    FUTURE_DATE_NOT_ALLOWED: 'No se permiten fechas futuras',
    INVALID_RANGE: 'Rango de valores inválido'
  }
};

// =============================================
// COLORES Y TEMAS (para gráficos)
// =============================================
const CHART_COLORS = {
  PRIMARY: ['#3B82F6', '#1D4ED8', '#2563EB'],
  SUCCESS: ['#10B981', '#059669', '#047857'],
  WARNING: ['#F59E0B', '#D97706', '#B45309'],
  DANGER: ['#EF4444', '#DC2626', '#B91C1C'],
  INFO: ['#06B6D4', '#0891B2', '#0E7490'],
  NEUTRAL: ['#6B7280', '#4B5563', '#374151'],
  GRADIENT: [
    '#8B5CF6', '#A855F7', '#C084FC', '#DDD6FE',
    '#3B82F6', '#60A5FA', '#93C5FD', '#DBEAFE',
    '#10B981', '#34D399', '#6EE7B7', '#D1FAE5'
  ]
};

// =============================================
// CONFIGURACIONES DE REPORTES
// =============================================
const REPORT_TYPES = {
  GROUP_SUMMARY: 'group_summary',
  MEMBER_REPORT: 'member_report',
  STUDENT_PROGRESS: 'student_progress',
  METRICS_ANALYSIS: 'metrics_analysis',
  SPIRITUAL_GROWTH: 'spiritual_growth',
  ATTENDANCE_REPORT: 'attendance_report',
  EVANGELISM_REPORT: 'evangelism_report',
  FINANCIAL_REPORT: 'financial_report'
};

const EXPORT_FORMATS = {
  PDF: 'pdf',
  EXCEL: 'excel',
  CSV: 'csv',
  JSON: 'json'
};

// =============================================
// EXPRESIONES REGULARES
// =============================================
const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ALPHA_NUMERIC: /^[a-zA-Z0-9]+$/,
  ALPHA_ONLY: /^[a-zA-ZÁáÉéÍíÓóÚúÑñ\s]+$/,
  NUMERIC_ONLY: /^\d+$/,
  DECIMAL: /^\d+(\.\d{1,2})?$/
};

// =============================================
// EXPORTACIÓN DEL MÓDULO
// =============================================
module.exports = {
  // Roles y permisos
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  
  // Estados
  USER_STATUS,
  APPROVAL_STATUS,
  CHURCH_STATUS,
  GROUP_STATUS,
  MEMBER_STATUS,
  STUDENT_STATUS,
  METRIC_STATUS,
  
  // Tipos y categorías
  GROUP_TYPES,
  GROUP_CATEGORIES,
  MEETING_DAYS,
  GENDER_OPTIONS,
  MARITAL_STATUS,
  EDUCATION_LEVELS,
  SPIRITUAL_STATUS,
  
  // Académico
  STUDY_PROGRAMS,
  ACADEMIC_LEVELS,
  
  // Períodos
  SEMESTER_PERIODS,
  METRIC_PERIODS,
  PRAYER_FREQUENCY,
  
  // Configuración
  SYSTEM_CONFIG,
  MESSAGES,
  CHART_COLORS,
  REPORT_TYPES,
  EXPORT_FORMATS,
  REGEX_PATTERNS,
  
  // Funciones auxiliares para roles
  hasPermission: (userRole, permission) => {
    return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
  },
  
  canAccess: (userRole, requiredRole) => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
  },
  
  getRoleLevel: (role) => {
    return ROLE_HIERARCHY[role] || 0;
  }
};