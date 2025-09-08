/**
 * VALIDATE.MIDDLEWARE.JS - Middleware de validación de datos
 * Sistema de Gestión Misionera
 * 
 * Valida datos de entrada para todas las entidades
 * Evita duplicados, valida formatos y sanitiza datos
 */

const db = require('../models');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// =============================================
// FUNCIONES DE VALIDACIÓN COMUNES
// =============================================

// Manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Errores de validación', {
      userId: req.user?.id,
      url: req.originalUrl,
      method: req.method,
      errors: errorMessages,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      message: 'Datos de entrada inválidos',
      errors: errorMessages
    });
  }
  
  next();
};

// Validar UUID
const isValidUUID = (value) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};

// Validar email único
const checkUniqueEmail = async (email, userId = null) => {
  const whereClause = { email };
  if (userId) {
    whereClause.id = { [db.Sequelize.Op.ne]: userId };
  }

  const existingUser = await db.User.findOne({ where: whereClause });
  return !existingUser;
};

// =============================================
// VALIDACIONES PARA AUTENTICACIÓN
// =============================================
const validateSignup = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .custom(async (value) => {
      const isUnique = await checkUniqueEmail(value);
      if (!isUnique) {
        throw new Error('El email ya está registrado');
      }
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios'),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]{8,20}$/)
    .withMessage('Teléfono inválido'),
  
  body('churchId')
    .optional()
    .custom((value) => {
      if (value && !isValidUUID(value)) {
        throw new Error('ID de iglesia inválido');
      }
      return true;
    }),
  
  body('role')
    .optional()
    .isIn(['admin', 'director', 'leader', 'reader'])
    .withMessage('Rol inválido'),

  handleValidationErrors
];

const validateSignin = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Contraseña requerida'),

  handleValidationErrors
];

const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Contraseña actual requerida'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA USUARIOS
// =============================================
const validateUser = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail()
    .custom(async (value, { req }) => {
      if (value) {
        const isUnique = await checkUniqueEmail(value, req.params.id);
        if (!isUnique) {
          throw new Error('El email ya está registrado');
        }
      }
      return true;
    }),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  
  body('role')
    .optional()
    .isIn(['admin', 'director', 'leader', 'reader'])
    .withMessage('Rol inválido'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive debe ser booleano'),
  
  body('isApproved')
    .optional()
    .isBoolean()
    .withMessage('isApproved debe ser booleano'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA IGLESIAS
// =============================================
const validateChurch = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('La dirección no puede exceder 200 caracteres'),
  
  body('city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('La ciudad no puede exceder 50 caracteres'),
  
  body('country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('El país no puede exceder 50 caracteres'),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]{8,20}$/)
    .withMessage('Teléfono inválido'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('website')
    .optional()
    .isURL()
    .withMessage('Website inválido'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA GRUPOS
// =============================================
const validateGroup = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres'),
  
  body('code')
    .optional()
    .trim()
    .isLength({ min: 2, max: 20 })
    .withMessage('El código debe tener entre 2 y 20 caracteres')
    .matches(/^[A-Za-z0-9\-_]+$/)
    .withMessage('El código solo puede contener letras, números, guiones y guiones bajos'),
  
  body('type')
    .isIn(['pequeno_grupo', 'escuela_sabatica', 'ministerio_joven', 'ministerio_ninos', 'ministerio_damas', 'ministerio_caballeros', 'otro'])
    .withMessage('Tipo de grupo inválido'),
  
  body('category')
    .optional()
    .isIn(['evangelismo', 'discipulado', 'servicio', 'adoracion', 'comunion'])
    .withMessage('Categoría inválida'),
  
  body('meetingDay')
    .optional()
    .isIn(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])
    .withMessage('Día de reunión inválido'),
  
  body('meetingTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Hora de reunión inválida (formato HH:MM)'),
  
  body('maxCapacity')
    .optional()
    .isInt({ min: 1, max: 500 })
    .withMessage('La capacidad máxima debe estar entre 1 y 500'),
  
  body('leaderId')
    .optional()
    .custom((value) => {
      if (value && !isValidUUID(value)) {
        throw new Error('ID de líder inválido');
      }
      return true;
    }),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA MIEMBROS
// =============================================
const validateMember = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]{8,20}$/)
    .withMessage('Teléfono inválido'),
  
  body('birthDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de nacimiento inválida')
    .custom((value) => {
      const birthDate = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      
      if (age < 0 || age > 120) {
        throw new Error('Fecha de nacimiento inválida');
      }
      return true;
    }),
  
  body('gender')
    .optional()
    .isIn(['masculino', 'femenino', 'otro'])
    .withMessage('Género inválido'),
  
  body('maritalStatus')
    .optional()
    .isIn(['soltero', 'casado', 'divorciado', 'viudo'])
    .withMessage('Estado civil inválido'),
  
  body('membershipStatus')
    .optional()
    .isIn(['visitante', 'simpatizante', 'candidato', 'miembro', 'ex_miembro'])
    .withMessage('Estado de membresía inválido'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA ESTUDIANTES BÍBLICOS
// =============================================
const validateStudent = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^[+]?[\d\s\-\(\)]{8,20}$/)
    .withMessage('Teléfono inválido'),
  
  body('program')
    .isIn(['la_fe_de_jesus', 'descubre', 'esperanza_viva', 'estudios_biblicos', 'otro'])
    .withMessage('Programa inválido'),
  
  body('status')
    .optional()
    .isIn(['activo', 'completado', 'suspendido', 'abandonado'])
    .withMessage('Estado inválido'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  
  body('expectedEndDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha esperada de finalización inválida')
    .custom((value, { req }) => {
      if (value && req.body.startDate) {
        const start = new Date(req.body.startDate);
        const end = new Date(value);
        
        if (end <= start) {
          throw new Error('La fecha de finalización debe ser posterior a la fecha de inicio');
        }
      }
      return true;
    }),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA MÉTRICAS
// =============================================
const validateMetric = [
  body('periodType')
    .isIn(['weekly', 'monthly', 'quarterly', 'semester', 'annual'])
    .withMessage('Tipo de período inválido'),
  
  body('periodStart')
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  
  body('periodEnd')
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      const start = new Date(req.body.periodStart);
      const end = new Date(value);
      
      if (end <= start) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),
  
  body('totalMeetings')
    .isInt({ min: 0, max: 100 })
    .withMessage('Total de reuniones debe estar entre 0 y 100'),
  
  body('averageAttendance')
    .isInt({ min: 0 })
    .withMessage('Asistencia promedio debe ser mayor o igual a 0'),
  
  body('maxAttendance')
    .isInt({ min: 0 })
    .withMessage('Asistencia máxima debe ser mayor o igual a 0')
    .custom((value, { req }) => {
      if (req.body.averageAttendance && value < req.body.averageAttendance) {
        throw new Error('La asistencia máxima no puede ser menor que el promedio');
      }
      return true;
    }),
  
  body('minAttendance')
    .isInt({ min: 0 })
    .withMessage('Asistencia mínima debe ser mayor o igual a 0')
    .custom((value, { req }) => {
      if (req.body.averageAttendance && value > req.body.averageAttendance) {
        throw new Error('La asistencia mínima no puede ser mayor que el promedio');
      }
      return true;
    }),
  
  body('newMembers')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Nuevos miembros debe ser mayor o igual a 0'),
  
  body('leftMembers')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Miembros que se fueron debe ser mayor o igual a 0'),
  
  body('totalMembersStart')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total miembros al inicio debe ser mayor o igual a 0'),
  
  body('totalMembersEnd')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total miembros al final debe ser mayor o igual a 0'),
  
  body('newConversions')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Nuevas conversiones debe ser mayor o igual a 0'),
  
  body('baptisms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Bautismos debe ser mayor o igual a 0'),
  
  body('attendanceGoal')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Meta de asistencia debe ser mayor a 0'),
  
  body('membershipGoal')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Meta de membresía debe ser mayor a 0'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA INDICADORES ESPIRITUALES
// =============================================
const validateIndicator = [
  body('type')
    .isIn(['lectura_biblica', 'oracion', 'testificacion', 'estudio_leccion', 'ofrenda'])
    .withMessage('Tipo de indicador inválido'),
  
  body('period')
    .isIn(['daily', 'weekly', 'monthly', 'quarterly'])
    .withMessage('Período inválido'),
  
  body('goal')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Meta debe ser mayor a 0'),
  
  body('achieved')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Logrado debe ser mayor o igual a 0'),
  
  body('startDate')
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  
  body('endDate')
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      const start = new Date(req.body.startDate);
      const end = new Date(value);
      
      if (end <= start) {
        throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      return true;
    }),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA PARÁMETROS
// =============================================
const validateUUIDParam = (paramName) => [
  param(paramName)
    .custom((value) => {
      if (!isValidUUID(value)) {
        throw new Error(`${paramName} inválido`);
      }
      return true;
    }),
  handleValidationErrors
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser mayor a 0'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe estar entre 1 y 100'),
  
  query('sortBy')
    .optional()
    .matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .withMessage('Campo de ordenamiento inválido'),
  
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Orden debe ser ASC o DESC'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA FILTROS
// =============================================
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Fecha de fin inválida')
    .custom((value, { req }) => {
      if (value && req.query.startDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(value);
        
        if (end <= start) {
          throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
        }
      }
      return true;
    }),

  handleValidationErrors
];

const validateStatusFilter = [
  query('status')
    .optional()
    .isIn(['active', 'inactive', 'pending', 'approved', 'rejected'])
    .withMessage('Estado inválido'),

  handleValidationErrors
];

// =============================================
// VALIDACIONES PARA REPORTES
// =============================================
const validateReportRequest = [
  query('format')
    .optional()
    .isIn(['json', 'excel', 'pdf'])
    .withMessage('Formato de reporte inválido'),
  
  query('includeMetrics')
    .optional()
    .isBoolean()
    .withMessage('includeMetrics debe ser booleano'),
  
  query('includeMembers')
    .optional()
    .isBoolean()
    .withMessage('includeMembers debe ser booleano'),
  
  query('includeStudents')
    .optional()
    .isBoolean()
    .withMessage('includeStudents debe ser booleano'),
  
  query('includeIndicators')
    .optional()
    .isBoolean()
    .withMessage('includeIndicators debe ser booleano'),

  handleValidationErrors
];

// =============================================
// SANITIZACIÓN DE DATOS
// =============================================
const sanitizeInput = (req, res, next) => {
  // Sanitizar strings en el body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Remover caracteres potencialmente peligrosos
        req.body[key] = req.body[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .trim();
      }
    }
  }

  // Sanitizar query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .trim();
      }
    }
  }

  next();
};

// =============================================
// VALIDACIÓN DE ARCHIVOS
// =============================================
const validateFile = (allowedTypes, maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    // Validar tipo de archivo
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de archivo no permitido',
        allowedTypes: allowedTypes
      });
    }

    // Validar tamaño
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'Archivo demasiado grande',
        maxSize: maxSize,
        currentSize: req.file.size
      });
    }

    next();
  };
};

// =============================================
// VALIDACIONES CONDICIONALES
// =============================================
const conditionalValidation = (condition, validations) => {
  return (req, res, next) => {
    if (condition(req)) {
      // Aplicar validaciones
      return Promise.all(
        validations.map(validation => validation.run(req))
      ).then(() => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return handleValidationErrors(req, res, next);
        }
        next();
      });
    }
    next();
  };
};

// =============================================
// EXPORTAR VALIDACIONES
// =============================================
module.exports = {
  // Validaciones de autenticación
  validateSignup,
  validateSignin,
  validateChangePassword,
  
  // Validaciones de entidades
  validateUser,
  validateChurch,
  validateGroup,
  validateMember,
  validateStudent,
  validateMetric,
  validateIndicator,
  
  // Validaciones de parámetros
  validateUUIDParam,
  validatePagination,
  validateDateRange,
  validateStatusFilter,
  validateReportRequest,
  
  // Utilidades
  sanitizeInput,
  validateFile,
  conditionalValidation,
  handleValidationErrors,
  isValidUUID,
  checkUniqueEmail
};