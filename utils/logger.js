/**
 * LOGGER.JS - Sistema de logging con Winston
 * Sistema de Gestión Misionera
 * 
 * Configuración centralizada para logging de la aplicación
 * con diferentes niveles y salidas
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Crear directorio de logs si no existe
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Formato personalizado para logs
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

/**
 * Formato simple para consola
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(info => {
    const { timestamp, level, message, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Agregar metadata si existe
    if (Object.keys(meta).length > 0) {
      log += '\n' + JSON.stringify(meta, null, 2);
    }
    
    return log;
  })
);

/**
 * Configuración de transports (salidas de logs)
 */
const transports = [
  // Logs de error separados
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // Logs generales
  new winston.transports.File({
    filename: path.join(logDir, 'app.log'),
    format: logFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  })
];

// En desarrollo, agregar consola
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
} else {
  // En producción, solo errores en consola
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'error'
    })
  );
}

/**
 * Crear logger principal
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
  
  // Manejo de promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  ]
});

/**
 * Funciones helper para logging específico
 */
const logHelpers = {
  
  /**
   * Log de autenticación
   */
  auth: (action, userId, email, ip, success = true) => {
    logger.info('Auth Event', {
      action,
      userId,
      email,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de operaciones de base de datos
   */
  database: (operation, table, recordId, userId) => {
    logger.info('Database Operation', {
      operation,
      table,
      recordId,
      userId,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de errores de API
   */
  apiError: (req, error, statusCode) => {
    logger.error('API Error', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      error: error.message,
      stack: error.stack,
      statusCode,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de requests de API
   */
  apiRequest: (req, res, responseTime) => {
    logger.info('API Request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de reportes generados
   */
  report: (type, format, userId, filters) => {
    logger.info('Report Generated', {
      type,
      format,
      userId,
      filters,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de operaciones administrativas
   */
  admin: (action, adminId, targetId, details) => {
    logger.warn('Admin Operation', {
      action,
      adminId,
      targetId,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Log de seguridad
   */
  security: (event, ip, userAgent, details) => {
    logger.warn('Security Event', {
      event,
      ip,
      userAgent,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Agregar helpers al logger principal
Object.assign(logger, logHelpers);

/**
 * Middleware para logging de requests
 */
logger.requestMiddleware = () => {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      logger.apiRequest(req, res, responseTime);
    });
    
    next();
  };
};

/**
 * Stream para Morgan (opcional)
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;