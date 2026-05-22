/**
 * LOGGER.JS - Sistema de logging con Winston
 * Adaptado para Despliegues en la Nube (Render)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';
const logDir = 'logs';

// Solo crear directorios físicos si NO estamos en producción
if (!isProduction && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Formato personalizado para logs
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

/**
 * Formato simple para consola
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(info => {
    const { timestamp, level, message, ...meta } = info;
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += '\n' + JSON.stringify(meta, null, 2);
    }
    
    return log;
  })
);

/**
 * Definición Dinámica de Transports
 */
const transports = [];
const exceptionHandlers = [];
const rejectionHandlers = [];

if (isProduction) {
  // ==========================================
  // CONFIGURACIÓN PARA PRODUCCIÓN (RENDER)
  // ==========================================
  // En la nube, todo va directo a la consola para que Render lo procese
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info'
    })
  );
  
  exceptionHandlers.push(
    new winston.transports.Console({ format: consoleFormat })
  );
  
  rejectionHandlers.push(
    new winston.transports.Console({ format: consoleFormat })
  );
} else {
  // ==========================================
  // CONFIGURACIÓN PARA DESARROLLO LOCAL
  // ==========================================
  // En local guardamos archivos de texto de manera normal
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: logFormat,
      maxsize: 5242880,
      maxFiles: 10,
    }),
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );

  exceptionHandlers.push(
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  );

  rejectionHandlers.push(
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 3
    })
  );
}

/**
 * Crear logger principal utilizando las configuraciones dinámicas
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exceptionHandlers,
  rejectionHandlers
});

/**
 * Funciones helper para logging específico (Exactamente iguales)
 */
const logHelpers = {
  auth: (action, userId, email, ip, success = true) => {
    logger.info('Auth Event', { action, userId, email, ip, success, timestamp: new Date().toISOString() });
  },
  database: (operation, table, recordId, userId) => {
    logger.info('Database Operation', { operation, table, recordId, userId, timestamp: new Date().toISOString() });
  },
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
  report: (type, format, userId, filters) => {
    logger.info('Report Generated', { type, format, userId, filters, timestamp: new Date().toISOString() });
  },
  admin: (action, adminId, targetId, details) => {
    logger.warn('Admin Operation', { action, adminId, targetId, details, timestamp: new Date().toISOString() });
  },
  security: (event, ip, userAgent, details) => {
    logger.warn('Security Event', { event, ip, userAgent, details, timestamp: new Date().toISOString() });
  }
};

// Adjuntar helpers al objeto instanciado
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
 * Stream para Morgan
 */
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;