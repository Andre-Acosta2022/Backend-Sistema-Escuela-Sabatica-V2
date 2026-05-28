/**
 * AUTH.MIDDLEWARE.JS - Middleware de autenticación y autorización
 * Sistema de Gestión Misionera
 * 
 * Maneja verificación JWT, roles jerárquicos y permisos
 * Roles: admin > director > leader > reader
 */

const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const db = require('../models');
const User = db.User;
const logger = require('../utils/logger');
const rateLimit = require('express-rate-limit');

// =============================================
// CONSTANTES DE ROLES Y JERARQUÍA
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

// =============================================
// VERIFICACIÓN DE TOKEN JWT
// =============================================
const verifyToken = async (req, res, next) => {
  try {
    // 1. Obtener token del header
    let token = req.headers['x-access-token'] || 
                req.headers['authorization'] ||
                req.headers.Authorization;

    // Extraer token si viene con Bearer
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    // 2. Validar que existe token
    if (!token) {
      logger.warn('Intento de acceso sin token', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        method: req.method
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido',
        error: 'MISSING_TOKEN'
      });
    }

    // 3. Verificar y decodificar token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    
    // 4. Validar estructura del token
    if (!decoded.id || !decoded.role) {
      logger.warn('Token con estructura inválida', {
        decodedData: decoded,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token inválido - estructura incorrecta',
        error: 'INVALID_TOKEN_STRUCTURE'
      });
    }

    // 5. Buscar usuario en BD
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'isApproved'],
      include: [{
        model: db.Church,
        as: 'church',
        attributes: ['id', 'name']
      }]
    });

    // 6. Validar que usuario existe
    if (!user) {
      logger.warn('Usuario no encontrado para token válido', {
        userId: decoded.id,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // 7. Validar que usuario está activo
    if (!user.isActive) {
      logger.warn('Usuario inactivo intentando acceder', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo',
        error: 'USER_INACTIVE'
      });
    }

    // 8. Validar que usuario está aprobado
    if (!user.isApproved) {
      logger.warn('Usuario no aprobado intentando acceder', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Usuario pendiente de aprobación',
        error: 'USER_NOT_APPROVED'
      });
    }

    // 9. Validar coherencia de rol entre token y BD
    if (decoded.role !== user.role) {
      logger.error('Inconsistencia de rol entre token y BD', {
        userId: user.id,
        tokenRole: decoded.role,
        dbRole: user.role,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token desactualizado - inicie sesión nuevamente',
        error: 'TOKEN_ROLE_MISMATCH'
      });
    }

    // 10. Agregar datos del usuario a la request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      churchId: user.churchId,
      church: user.church
    };

    // 11. Log de acceso exitoso
    logger.info('Acceso autenticado exitoso', {
      userId: user.id,
      role: user.role,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    next();

  } catch (error) {
    logger.error('Error en verificación de token', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      url: req.originalUrl
    });

    // Errores específicos de JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        error: 'EXPIRED_TOKEN'
      });
    }

    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Token no válido aún',
        error: 'TOKEN_NOT_ACTIVE'
      });
    }

    // Error genérico
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// VERIFICACIÓN DE ROLES JERÁRQUICOS
// =============================================

// Verificar si tiene rol específico o superior
const hasRoleOrAbove = (requiredRole) => {
  return (req, res, next) => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole) {
        logger.error('Usuario sin rol definido', {
          userId: req.user?.id,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: 'Usuario sin rol definido',
          error: 'NO_ROLE_DEFINED'
        });
      }

      const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
      const requiredRoleLevel = ROLE_HIERARCHY[requiredRole] || 0;

      if (userRoleLevel < requiredRoleLevel) {
        logger.warn('Acceso denegado por rol insuficiente', {
          userId: req.user.id,
          userRole,
          requiredRole,
          url: req.originalUrl,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: `Acceso denegado. Se requiere rol ${requiredRole} o superior`,
          error: 'INSUFFICIENT_ROLE',
          required: requiredRole,
          current: userRole
        });
      }

      logger.debug('Acceso autorizado por rol', {
        userId: req.user.id,
        userRole,
        requiredRole,
        url: req.originalUrl
      });

      next();

    } catch (error) {
      logger.error('Error en verificación de rol', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'INTERNAL_ERROR'
      });
    }
  };
};

// =============================================
// MIDDLEWARE DE ROLES ESPECÍFICOS
// =============================================

const isAdmin = (req, res, next) => {
  return hasRoleOrAbove(ROLES.ADMIN)(req, res, next);
};

const isDirector = (req, res, next) => {
  return hasRoleOrAbove(ROLES.DIRECTOR)(req, res, next);
};

const isLeader = (req, res, next) => {
  return hasRoleOrAbove(ROLES.LEADER)(req, res, next);
};

const isReader = (req, res, next) => {
  return hasRoleOrAbove(ROLES.READER)(req, res, next);
};

// =============================================
// VERIFICACIÓN DE PERTENENCIA A IGLESIA
// =============================================
const belongsToChurch = async (req, res, next) => {
  try {
    const { churchId } = req.params;
    const userChurchId = req.user.churchId;

    // Admin puede acceder a cualquier iglesia
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    // Otros roles solo pueden acceder a su iglesia
    if (!churchId || !userChurchId || churchId !== userChurchId) {
      logger.warn('Acceso denegado a iglesia diferente', {
        userId: req.user.id,
        userChurchId,
        requestedChurchId: churchId,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para acceder a esta iglesia',
        error: 'CHURCH_ACCESS_DENIED'
      });
    }

    next();

  } catch (error) {
    logger.error('Error verificando pertenencia a iglesia', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// VERIFICACIÓN DE PERTENENCIA A GRUPO
// =============================================
const belongsToGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin y Director pueden acceder a cualquier grupo
    if ([ROLES.ADMIN, ROLES.DIRECTOR].includes(userRole)) {
      return next();
    }

    // Buscar el grupo
    const group = await db.Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado',
        error: 'GROUP_NOT_FOUND'
      });
    }

    // Leader solo puede acceder a sus grupos
    if (userRole === ROLES.LEADER) {
      if (group.leaderId !== userId) {
        logger.warn('Leader intentando acceder a grupo que no lidera', {
          userId,
          groupId,
          groupLeaderId: group.leaderId,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para acceder a este grupo',
          error: 'GROUP_ACCESS_DENIED'
        });
      }
    }

    // Reader puede ver pero verificar si tiene acceso específico
    if (userRole === ROLES.READER) {
      // Verificar si es miembro del grupo o tiene permisos específicos
      const isMember = await db.Member.findOne({
        where: {
          groupId,
          email: req.user.email // Asumiendo que puede ser miembro
        }
      });

      if (!isMember && group.leaderId !== userId) {
        logger.warn('Reader sin permisos intentando acceder a grupo', {
          userId,
          groupId,
          ip: req.ip
        });
        
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para acceder a este grupo',
          error: 'GROUP_ACCESS_DENIED'
        });
      }
    }

    // Agregar información del grupo a la request
    req.group = {
      id: group.id,
      name: group.name,
      leaderId: group.leaderId,
      churchId: group.churchId
    };

    next();

  } catch (error) {
    logger.error('Error verificando pertenencia a grupo', {
      error: error.message,
      userId: req.user?.id,
      groupId: req.params?.groupId,
      ip: req.ip
    });
    
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// MIDDLEWARE OPCIONAL (SOFT AUTH)
// =============================================
const optionalAuth = async (req, res, next) => {
  try {
    // Intentar autenticar, pero no fallar si no hay token
    let token = req.headers['x-access-token'] || 
                req.headers['authorization'] ||
                req.headers.Authorization;

    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7, token.length);
    }

    if (!token) {
      // No hay token, continuar sin usuario
      req.user = null;
      return next();
    }

    // Si hay token, intentar verificar
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'isApproved']
    });

    if (user && user.isActive && user.isApproved) {
      req.user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        churchId: user.churchId
      };
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    // En caso de error, continuar sin usuario
    req.user = null;
    next();
  }
};

// =============================================
// UTILIDADES
// =============================================
const getRoleLevel = (role) => {
  return ROLE_HIERARCHY[role] || 0;
};

const canAccess = (userRole, requiredRole) => {
  return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
};

// =============================================
// LIMITADORES DE PETICIONES (RATE LIMITERS)
// =============================================
const rateLimiter = {
  // Limita la creación de usuarios a 5 por cada 15 minutos por IP
  createUser: rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: { 
      success: false, 
      message: 'Demasiadas solicitudes de creación de cuenta. Intente más tarde.' 
    }
  }),

  // Limita el reseteo de contraseñas a 3 intentos por hora
  resetPassword: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3, 
    message: { 
      success: false, 
      message: 'Demasiados intentos de reseteo de contraseña. Intente en una hora.' 
    }
  })
};


// =============================================
// EXPORTAR MIDDLEWARE
// =============================================
module.exports = {
  // Middleware principales
  verifyToken,
  hasRoleOrAbove,
  rateLimiter, // <- AGREGAR AQUÍ
  optionalAuth,
  
  
  // Middleware de roles específicos
  isAdmin,
  isDirector,
  isLeader,
  isReader,
  
  // Middleware de pertenencia
  belongsToChurch,
  belongsToGroup,
  
  // Constantes
  ROLES,
  ROLE_HIERARCHY,
  
  // Utilidades
  getRoleLevel,
  canAccess
};