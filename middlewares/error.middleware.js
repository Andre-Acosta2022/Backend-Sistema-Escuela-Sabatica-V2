/**
 * ERROR.MIDDLEWARE.JS - Manejo centralizado de errores
 * Sistema de Gestión Misionera
 * 
 * Middleware para capturar y manejar todos los errores
 * de la aplicación de manera consistente
 */

const logger = require('../utils/logger');

/**
 * Clase personalizada para errores de API
 */
class APIError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errores específicos del sistema
 */
class ValidationError extends APIError {
  constructor(message, field = null) {
    super(message, 400);
    this.field = field;
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'No autorizado') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Acceso denegado') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends APIError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends APIError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class DatabaseError extends APIError {
  constructor(message = 'Error en la base de datos') {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}

/**
 * Función para determinar si el error es operacional
 */
const isOperationalError = (error) => {
  if (error instanceof APIError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Función para convertir errores de Sequelize
 */
const handleSequelizeError = (error) => {
  switch (error.name) {
    case 'SequelizeValidationError':
      const validationErrors = error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return new ValidationError('Errores de validación', validationErrors);
      
    case 'SequelizeUniqueConstraintError':
      const field = error.errors[0]?.path || 'campo';
      return new ConflictError(`El ${field} ya está en uso`);
      
    case 'SequelizeForeignKeyConstraintError':
      return new ValidationError('Referencia a recurso inexistente');
      
    case 'SequelizeConnectionError':
    case 'SequelizeConnectionRefusedError':
    case 'SequelizeHostNotFoundError':
    case 'SequelizeHostNotReachableError':
    case 'SequelizeInvalidConnectionError':
    case 'SequelizeConnectionTimedOutError':
      return new DatabaseError('Error de conexión a la base de datos');
      
    case 'SequelizeDatabaseError':
      return new DatabaseError('Error en la consulta de base de datos');
      
    default:
      return new DatabaseError('Error en la base de datos');
  }
};

/**
 * Función para convertir errores de JWT
 */
const handleJWTError = (error) => {
  switch (error.name) {
    case 'JsonWebTokenError':
      return new AuthenticationError('Token inválido');
    case 'TokenExpiredError':
      return new AuthenticationError('Token expirado');
    case 'NotBeforeError':
      return new AuthenticationError('Token no válido aún');
    default:
      return new AuthenticationError('Error de autenticación');
  }
};

/**
 * Función para crear respuesta de error
 */
const createErrorResponse = (error, req) => {
  const response = {
    success: false,
    error: {
      message: error.message,
      type: error.name,
      timestamp: new Date().toISOString()
    }
  };
  
  // En desarrollo, incluir más detalles
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.path = req.path;
    response.error.method = req.method;
  }
  
  // Agregar detalles específicos según el tipo de error
  if (error instanceof ValidationError && error.field) {
    response.error.validation = error.field;
  }
  
  if (error.statusCode >= 500) {
    response.error.code = 'INTERNAL_ERROR';
    response.error.message = process.env.NODE_ENV === 'production' 
      ? 'Error interno del servidor' 
      : error.message;
  }
  
  return response;
};

/**
 * Middleware principal de manejo de errores
 */
const errorHandler = (error, req, res, next) => {
  let processedError = error;
  
  // Convertir errores conocidos
  if (error.name?.startsWith('Sequelize')) {
    processedError = handleSequelizeError(error);
  } else if (error.name?.includes('JsonWebToken') || error.name?.includes('TokenExpired')) {
    processedError = handleJWTError(error);
  } else if (!(error instanceof APIError)) {
    // Error desconocido, convertir a APIError genérico
    processedError = new APIError(
      process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : error.message,
      500,
      false
    );
  }
  
  // Log del error
  if (processedError.statusCode >= 500 || !isOperationalError(processedError)) {
    logger.apiError(req, processedError, processedError.statusCode);
  } else {
    logger.warn('API Warning', {
      message: processedError.message,
      statusCode: processedError.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id
    });
  }
  
  // Crear respuesta
  const errorResponse = createErrorResponse(processedError, req);
  
  // Enviar respuesta
  return res.status(processedError.statusCode || 500).json(errorResponse);
};

/**
 * Middleware para manejar rutas no encontradas
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Ruta ${req.originalUrl}`);
  next(error);
};

/**
 * Función para envolver controladores async
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Helper para respuestas de éxito
 */
const sendSuccess = (res, data, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Helper para respuestas de éxito con paginación
 */
const sendPaginatedSuccess = (res, data, pagination, message = 'Consulta exitosa') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  // Clases de error
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  
  // Middlewares
  errorHandler,
  notFoundHandler,
  
  // Helpers
  catchAsync,
  sendSuccess,
  sendPaginatedSuccess,
  isOperationalError
};