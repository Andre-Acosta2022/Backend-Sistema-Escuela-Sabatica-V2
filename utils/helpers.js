/**
 * HELPERS.JS - Funciones Auxiliares Reutilizables
 * Sistema de Gestión Misionera
 * 
 * Contiene utilidades para fechas, validaciones, formateo y manipulación de datos
 */

const crypto = require('crypto');
const { REGEX_PATTERNS, SYSTEM_CONFIG } = require('./constants');

// =============================================
// UTILIDADES DE FECHAS
// =============================================
const dateHelpers = {
  /**
   * Formatea una fecha a formato legible en español
   */
  formatDate: (date, includeTime = false) => {
    if (!date) return null;
    
    const d = new Date(date);
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/Lima'
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return d.toLocaleDateString('es-PE', options);
  },

  /**
   * Formatea fecha para base de datos (YYYY-MM-DD)
   */
  formatDateForDB: (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Obtiene el rango de fechas de un período
   */
  getDateRange: (period, year = new Date().getFullYear()) => {
    const ranges = {
      first: { start: `${year}-01-01`, end: `${year}-03-31` },
      second: { start: `${year}-04-01`, end: `${year}-06-30` },
      third: { start: `${year}-07-01`, end: `${year}-09-30` },
      fourth: { start: `${year}-10-01`, end: `${year}-12-31` },
      annual: { start: `${year}-01-01`, end: `${year}-12-31` }
    };
    return ranges[period] || null;
  },

  /**
   * Calcula la edad a partir de la fecha de nacimiento
   */
  calculateAge: (birthDate) => {
    if (!birthDate) return null;
    
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  },

  /**
   * Verifica si una fecha es válida
   */
  isValidDate: (date) => {
    const d = new Date(date);
    return d instanceof Date && !isNaN(d);
  },

  /**
   * Obtiene el primer y último día del mes
   */
  getMonthRange: (year, month) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  },

  /**
   * Calcula días entre dos fechas
   */
  daysBetween: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  /**
   * Obtiene el semestre actual
   */
  getCurrentSemester: () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    
    if (month >= 1 && month <= 3) return 'first';
    if (month >= 4 && month <= 6) return 'second';
    if (month >= 7 && month <= 9) return 'third';
    return 'fourth';
  }
};

// =============================================
// UTILIDADES DE VALIDACIÓN
// =============================================
const validationHelpers = {
  /**
   * Valida email
   */
  isValidEmail: (email) => {
    return email && REGEX_PATTERNS.EMAIL.test(email);
  },

  /**
   * Valida teléfono
   */
  isValidPhone: (phone) => {
    return phone && REGEX_PATTERNS.PHONE.test(phone);
  },

  /**
   * Valida UUID
   */
  isValidUUID: (uuid) => {
    return uuid && REGEX_PATTERNS.UUID.test(uuid);
  },

  /**
   * Valida contraseña fuerte
   */
  isStrongPassword: (password) => {
    return password && 
           password.length >= SYSTEM_CONFIG.PASSWORD_MIN_LENGTH &&
           REGEX_PATTERNS.PASSWORD.test(password);
  },

  /**
   * Valida rango numérico
   */
  isInRange: (value, min, max) => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= min && num <= max;
  },

  /**
   * Valida que un valor esté en un array de opciones
   */
  isValidOption: (value, validOptions) => {
    return validOptions.includes(value);
  },

  /**
   * Sanitiza string removiendo caracteres especiales
   */
  sanitizeString: (str) => {
    if (!str) return '';
    return str.trim().replace(/<[^>]*>?/gm, ''); // Remover HTML tags
  },

  /**
   * Valida estructura de contacto de emergencia
   */
  isValidEmergencyContact: (contact) => {
    if (!contact || typeof contact !== 'object') return false;
    return contact.name && contact.phone && 
           validationHelpers.isValidPhone(contact.phone);
  }
};

// =============================================
// UTILIDADES DE FORMATEO
// =============================================
const formatHelpers = {
  /**
   * Formatea nombre completo
   */
  formatFullName: (firstName, lastName) => {
    return `${firstName || ''} ${lastName || ''}`.trim();
  },

  /**
   * Formatea número de teléfono
   */
  formatPhone: (phone) => {
    if (!phone) return null;
    
    // Formato peruano: +51 999 999 999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
      return `+51 ${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    return phone;
  },

  /**
   * Formatea moneda en soles peruanos
   */
  formatCurrency: (amount) => {
    if (!amount && amount !== 0) return 'S/ 0.00';
    return `S/ ${parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  },

  /**
   * Formatea porcentaje
   */
  formatPercentage: (value, decimals = 1) => {
    if (!value && value !== 0) return '0%';
    return `${parseFloat(value).toFixed(decimals)}%`;
  },

  /**
   * Capitaliza primera letra
   */
  capitalize: (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Convierte a título (cada palabra capitalizada)
   */
  toTitleCase: (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
  },

  /**
   * Trunca texto con elipsis
   */
  truncateText: (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * Formatea dirección completa
   */
  formatAddress: (address, city, district) => {
    const parts = [address, district, city].filter(Boolean);
    return parts.join(', ');
  }
};

// =============================================
// UTILIDADES DE CÁLCULO
// =============================================
const calculationHelpers = {
  /**
   * Calcula promedio
   */
  average: (numbers) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return 0;
    const validNumbers = numbers.filter(n => !isNaN(n) && n !== null);
    if (validNumbers.length === 0) return 0;
    return validNumbers.reduce((sum, n) => sum + parseFloat(n), 0) / validNumbers.length;
  },

  /**
   * Calcula porcentaje
   */
  percentage: (part, total) => {
    if (!total || total === 0) return 0;
    return (parseFloat(part) / parseFloat(total)) * 100;
  },

  /**
   * Calcula crecimiento porcentual
   */
  growthRate: (current, previous) => {
    if (!previous || previous === 0) return current > 0 ? 100 : 0;
    return ((parseFloat(current) - parseFloat(previous)) / parseFloat(previous)) * 100;
  },

  /**
   * Redondea a decimales específicos
   */
  roundTo: (number, decimals = 2) => {
    return Math.round(parseFloat(number) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  },

  /**
   * Suma segura de arrays (ignora valores nulos)
   */
  safeSum: (numbers) => {
    if (!Array.isArray(numbers)) return 0;
    return numbers.reduce((sum, n) => sum + (parseFloat(n) || 0), 0);
  },

  /**
   * Encuentra valor máximo en array
   */
  safeMax: (numbers) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return 0;
    const validNumbers = numbers.filter(n => !isNaN(n) && n !== null);
    return validNumbers.length > 0 ? Math.max(...validNumbers) : 0;
  },

  /**
   * Encuentra valor mínimo en array
   */
  safeMin: (numbers) => {
    if (!Array.isArray(numbers) || numbers.length === 0) return 0;
    const validNumbers = numbers.filter(n => !isNaN(n) && n !== null);
    return validNumbers.length > 0 ? Math.min(...validNumbers) : 0;
  }
};

// =============================================
// UTILIDADES DE SEGURIDAD
// =============================================
const securityHelpers = {
  /**
   * Genera token aleatorio
   */
  generateToken: (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Genera código aleatorio numérico
   */
  generateCode: (length = 6) => {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  /**
   * Hash simple (no para contraseñas)
   */
  simpleHash: (text) => {
    return crypto.createHash('md5').update(text).digest('hex');
  },

  /**
   * Sanitiza input para prevenir XSS
   */
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  },

  /**
   * Valida IP
   */
  isValidIP: (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
};

// =============================================
// UTILIDADES DE ARRAY Y OBJETO
// =============================================
const arrayHelpers = {
  /**
   * Agrupa array por propiedad
   */
  groupBy: (array, key) => {
    return array.reduce((groups, item) => {
      const group = item[key];
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {});
  },

  /**
   * Elimina duplicados por propiedad
   */
  uniqueBy: (array, key) => {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  },

  /**
   * Ordena array por múltiples criterios
   */
  multiSort: (array, sortBy) => {
    return array.sort((a, b) => {
      for (let { key, direction = 'asc' } of sortBy) {
        const aVal = a[key];
        const bVal = b[key];
        const modifier = direction === 'desc' ? -1 : 1;
        
        if (aVal < bVal) return -1 * modifier;
        if (aVal > bVal) return 1 * modifier;
      }
      return 0;
    });
  },

  /**
   * Pagina array
   */
  paginate: (array, page = 1, size = SYSTEM_CONFIG.DEFAULT_PAGE_SIZE) => {
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return {
      data: array.slice(startIndex, endIndex),
      pagination: {
        currentPage: page,
        pageSize: size,
        totalItems: array.length,
        totalPages: Math.ceil(array.length / size),
        hasNext: endIndex < array.length,
        hasPrev: startIndex > 0
      }
    };
  },

  /**
   * Convierte array a objeto mapa
   */
  arrayToMap: (array, keyField) => {
    return array.reduce((map, item) => {
      map[item[keyField]] = item;
      return map;
    }, {});
  }
};

// =============================================
// UTILIDADES DE RESPUESTA HTTP
// =============================================
const responseHelpers = {
  /**
   * Respuesta exitosa estándar
   */
  success: (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Respuesta de error estándar
   */
  error: (res, message = 'Error interno', statusCode = 500, errors = null) => {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Respuesta paginada
   */
  paginated: (res, data, pagination, message = 'Datos obtenidos') => {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Respuesta de validación fallida
   */
  validationError: (res, errors) => {
    return res.status(400).json({
      success: false,
      message: 'Errores de validación',
      errors,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Respuesta no autorizado
   */
  unauthorized: (res, message = 'No autorizado') => {
    return res.status(401).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Respuesta no encontrado
   */
  notFound: (res, message = 'Recurso no encontrado') => {
    return res.status(404).json({
      success: false,
      message,
      timestamp: new Date().toISOString()
    });
  }
};

// =============================================
// UTILIDADES DE ARCHIVO
// =============================================
const fileHelpers = {
  /**
   * Valida tipo de archivo
   */
  isValidFileType: (mimetype, allowedTypes) => {
    return allowedTypes.includes(mimetype);
  },

  /**
   * Valida tamaño de archivo
   */
  isValidFileSize: (size, maxSize = SYSTEM_CONFIG.MAX_FILE_SIZE) => {
    return size <= maxSize;
  },

  /**
   * Genera nombre único para archivo
   */
  generateUniqueFileName: (originalName) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const extension = originalName.split('.').pop();
    return `${timestamp}_${random}.${extension}`;
  },

  /**
   * Obtiene extensión de archivo
   */
  getFileExtension: (filename) => {
    return filename.split('.').pop().toLowerCase();
  },

  /**
   * Convierte bytes a formato legible
   */
  formatFileSize: (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

// =============================================
// UTILIDADES DE LOG
// =============================================
const logHelpers = {
  /**
   * Formatea log de auditoría
   */
  formatAuditLog: (userId, action, resource, resourceId, details = null) => {
    return {
      userId,
      action,
      resource,
      resourceId,
      details,
      timestamp: new Date().toISOString(),
      ip: null // Se asigna en el middleware
    };
  },

  /**
   * Sanitiza datos sensibles para logs
   */
  sanitizeForLog: (data) => {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...data };
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
};

// =============================================
// EXPORTACIÓN DEL MÓDULO
// =============================================
module.exports = {
  // Utilidades principales
  dateHelpers,
  validationHelpers,
  formatHelpers,
  calculationHelpers,
  securityHelpers,
  arrayHelpers,
  responseHelpers,
  fileHelpers,
  logHelpers,

  // Funciones de conveniencia (acceso directo)
  formatDate: dateHelpers.formatDate,
  formatCurrency: formatHelpers.formatCurrency,
  isValidEmail: validationHelpers.isValidEmail,
  isValidPhone: validationHelpers.isValidPhone,
  calculateAge: dateHelpers.calculateAge,
  percentage: calculationHelpers.percentage,
  success: responseHelpers.success,
  error: responseHelpers.error,
  paginate: arrayHelpers.paginate,
  groupBy: arrayHelpers.groupBy
};