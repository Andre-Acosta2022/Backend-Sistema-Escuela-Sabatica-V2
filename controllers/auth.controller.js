/**
 * AUTH.CONTROLLER.JS - Controlador de autenticación
 * Sistema de Gestión Misionera
 * 
 * Maneja login, registro, cambio de contraseña y tokens JWT
 * Incluye creación automática de admin si no existe
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models');
const logger = require('../utils/logger');

const User = db.User;
const Church = db.Church;

// =============================================
// CONFIGURACIÓN JWT
// =============================================
const JWT_CONFIG = {
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

// =============================================
// GENERAR TOKENS JWT
// =============================================
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    churchId: user.churchId
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: JWT_CONFIG.expiresIn,
    issuer: 'misionero-system',
    subject: user.id.toString()
  });

  const refreshToken = jwt.sign(
    { id: user.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    {
      expiresIn: JWT_CONFIG.refreshExpiresIn,
      issuer: 'misionero-system',
      subject: user.id.toString()
    }
  );

  return { accessToken, refreshToken };
};

// =============================================
// CREAR ADMIN AUTOMÁTICAMENTE
// =============================================
const createDefaultAdmin = async () => {
  try {
    // Verificar si ya existe un admin
    const adminExists = await User.findOne({ 
      where: { role: 'admin' } 
    });

    if (adminExists) {
      return null; // Admin ya existe
    }

    // Crear iglesia por defecto si no existe
    let defaultChurch = await Church.findOne({
      where: { name: 'Iglesia Principal' }
    });

    if (!defaultChurch) {
      defaultChurch = await Church.create({
        name: 'Iglesia Principal',
        address: 'Dirección por definir',
        city: 'Ciudad por definir',
        country: 'País por definir',
        phone: '+000000000000',
        email: 'iglesia@ejemplo.com',
        isActive: true
      });

      logger.info('Iglesia por defecto creada', { churchId: defaultChurch.id });
    }

    // Crear usuario admin por defecto
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin123@';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    const adminUser = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@misionero.com',
      password: hashedPassword,
      firstName: 'Administrador',
      lastName: 'Sistema',
      role: 'admin',
      churchId: defaultChurch.id,
      isActive: true,
      isApproved: true,
      phone: '+000000000000'
    });

    logger.info('Usuario admin por defecto creado', {
      userId: adminUser.id,
      email: adminUser.email
    });

    return {
      user: adminUser,
      church: defaultChurch,
      defaultPassword: defaultPassword
    };

  } catch (error) {
    logger.error('Error creando admin por defecto', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// =============================================
// REGISTRO DE USUARIOS
// =============================================
const signup = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      churchId,
      role = 'reader'
    } = req.body;

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Validar iglesia si se especifica
    let church = null;
    if (churchId) {
      church = await Church.findByPk(churchId);
      if (!church) {
        return res.status(400).json({
          success: false,
          message: 'Iglesia no encontrada',
          error: 'CHURCH_NOT_FOUND'
        });
      }
    }

    // Crear usuario
    const user = await User.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role,
      churchId: churchId || null,
      isActive: true,
      isApproved: role === 'reader' ? true : false // Readers se aprueban automáticamente
    }, { transaction });

    await transaction.commit();

    // Log del registro
    logger.info('Usuario registrado exitosamente', {
      userId: user.id,
      email: user.email,
      role: user.role,
      churchId: user.churchId,
      isApproved: user.isApproved,
      ip: req.ip
    });

    // Respuesta (sin contraseña)
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      churchId: user.churchId,
      church: church ? { id: church.id, name: church.name } : null,
      isActive: user.isActive,
      isApproved: user.isApproved,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: user.isApproved 
        ? 'Usuario registrado exitosamente'
        : 'Usuario registrado. Pendiente de aprobación por un administrador',
      user: userResponse,
      needsApproval: !user.isApproved
    });

  } catch (error) {
    await transaction.rollback();
    
    logger.error('Error en registro de usuario', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email,
      ip: req.ip
    });

    // Errores específicos de Sequelize
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado',
        error: 'EMAIL_ALREADY_EXISTS'
      });
    }

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// LOGIN DE USUARIOS
// =============================================
const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario con iglesia
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'city', 'country']
      }],
      attributes: ['id', 'email', 'password', 'firstName', 'lastName', 'role', 'churchId', 'isActive', 'isApproved', 'lastLoginAt']
    });

    // Validar que usuario existe
    if (!user) {
      logger.warn('Intento de login con email no registrado', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Validar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn('Intento de login con contraseña incorrecta', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Validar que usuario está activo
    if (!user.isActive) {
      logger.warn('Usuario inactivo intentando hacer login', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo. Contacte al administrador',
        error: 'USER_INACTIVE'
      });
    }

    // Validar que usuario está aprobado
    if (!user.isApproved) {
      logger.warn('Usuario no aprobado intentando hacer login', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Usuario pendiente de aprobación por un administrador',
        error: 'USER_NOT_APPROVED'
      });
    }

    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Actualizar último login
    await user.update({ 
      lastLoginAt: new Date(),
      lastLoginIp: req.ip
    });

    // Log del login exitoso
    logger.info('Login exitoso', {
      userId: user.id,
      email: user.email,
      role: user.role,
      churchId: user.churchId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Respuesta exitosa
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      churchId: user.churchId,
      church: user.church ? {
        id: user.church.id,
        name: user.church.name,
        city: user.church.city,
        country: user.church.country
      } : null,
      lastLoginAt: user.lastLoginAt
    };

    res.json({
      success: true,
      message: 'Login exitoso',
      user: userResponse,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: JWT_CONFIG.expiresIn
    });

  } catch (error) {
    logger.error('Error en login', {
      error: error.message,
      stack: error.stack,
      email: req.body?.email,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// REFRESH TOKEN
// =============================================
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requerido',
        error: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Verificar refresh token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'INVALID_TOKEN_TYPE'
      });
    }

    // Buscar usuario
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'churchId', 'isActive', 'isApproved']
    });

    if (!user || !user.isActive || !user.isApproved) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inválido',
        error: 'INVALID_USER'
      });
    }

    // Generar nuevos tokens
    const tokens = generateTokens(user);

    logger.info('Token renovado exitosamente', {
      userId: user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Token renovado exitosamente',
      ...tokens,
      tokenType: 'Bearer',
      expiresIn: JWT_CONFIG.expiresIn
    });

  } catch (error) {
    logger.error('Error renovando token', {
      error: error.message,
      ip: req.ip
    });

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido o expirado',
        error: 'INVALID_REFRESH_TOKEN'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// CAMBIAR CONTRASEÑA
// =============================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Buscar usuario
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'password']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Validar contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      logger.warn('Intento de cambio de contraseña con contraseña actual incorrecta', {
        userId: user.id,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta',
        error: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Validar que nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual',
        error: 'SAME_PASSWORD'
      });
    }

    // Hash de nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await user.update({ 
      password: hashedNewPassword,
      passwordChangedAt: new Date()
    });

    logger.info('Contraseña cambiada exitosamente', {
      userId: user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente',
      passwordChangedAt: new Date()
    });

  } catch (error) {
    logger.error('Error cambiando contraseña', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// LOGOUT
// =============================================
const logout = async (req, res) => {
  try {
    // En un sistema más avanzado, aquí se agregaría el token a una blacklist
    
    logger.info('Logout exitoso', {
      userId: req.user.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Logout exitoso'
    });

  } catch (error) {
    logger.error('Error en logout', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// VERIFICAR TOKEN (PARA FRONTEND)
// =============================================
const verifyToken = async (req, res) => {
  try {
    // El usuario ya está disponible gracias al middleware verifyToken
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'city', 'country']
      }],
      attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'churchId', 'isActive', 'isApproved', 'lastLoginAt']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      role: user.role,
      churchId: user.churchId,
      church: user.church ? {
        id: user.church.id,
        name: user.church.name,
        city: user.church.city,
        country: user.church.country
      } : null,
      isActive: user.isActive,
      isApproved: user.isApproved,
      lastLoginAt: user.lastLoginAt
    };

    res.json({
      success: true,
      message: 'Token válido',
      user: userResponse,
      isAuthenticated: true
    });

  } catch (error) {
    logger.error('Error verificando token', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// SOLICITAR RESET DE CONTRASEÑA
// =============================================
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Buscar usuario
    const user = await User.findOne({
      where: { email },
      attributes: ['id', 'email', 'firstName', 'lastName', 'isActive']
    });

    // Por seguridad, siempre responder éxito (no revelar si email existe)
    const successResponse = {
      success: true,
      message: 'Si el email está registrado, recibirá instrucciones para restablecer su contraseña'
    };

    if (!user || !user.isActive) {
      logger.warn('Solicitud de reset para email no válido', {
        email,
        found: !!user,
        active: user?.isActive,
        ip: req.ip
      });
      return res.json(successResponse);
    }

    // Generar token de reset
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Guardar token en BD
    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpiry: resetTokenExpiry
    });

    // TODO: Enviar email con token de reset
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    logger.info('Solicitud de reset de contraseña procesada', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.json(successResponse);

  } catch (error) {
    logger.error('Error en solicitud de reset de contraseña', {
      error: error.message,
      email: req.body?.email,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// RESTABLECER CONTRASEÑA
// =============================================
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token y nueva contraseña requeridos',
        error: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Buscar usuario por token
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: {
          [db.Sequelize.Op.gt]: new Date()
        },
        isActive: true
      },
      attributes: ['id', 'email', 'password', 'resetPasswordToken', 'resetPasswordExpiry']
    });

    if (!user) {
      logger.warn('Intento de reset con token inválido o expirado', {
        token,
        ip: req.ip
      });
      
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado',
        error: 'INVALID_OR_EXPIRED_TOKEN'
      });
    }

    // Validar que nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la anterior',
        error: 'SAME_PASSWORD'
      });
    }

    // Hash de nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña y limpiar token
    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      passwordChangedAt: new Date()
    });

    logger.info('Contraseña restablecida exitosamente', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      passwordChangedAt: new Date()
    });

  } catch (error) {
    logger.error('Error restableciendo contraseña', {
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// OBTENER PERFIL DE USUARIO
// =============================================
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{
        model: Church,
        as: 'church',
        attributes: ['id', 'name', 'address', 'city', 'country', 'phone', 'email']
      }],
      attributes: {
        exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry']
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Generar QR code data para el perfil
    const qrData = {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      church: user.church?.name || null,
      generated: new Date().toISOString()
    };

    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      churchId: user.churchId,
      church: user.church,
      isActive: user.isActive,
      isApproved: user.isApproved,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      qrData: Buffer.from(JSON.stringify(qrData)).toString('base64')
    };

    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      user: userProfile
    });

  } catch (error) {
    logger.error('Error obteniendo perfil', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// ACTUALIZAR PERFIL DE USUARIO
// =============================================
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user.id;

    // Buscar usuario
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
        error: 'USER_NOT_FOUND'
      });
    }

    // Actualizar solo campos permitidos
    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (phone !== undefined) updateData.phone = phone.trim();

    await user.update(updateData);

    logger.info('Perfil actualizado exitosamente', {
      userId: user.id,
      updatedFields: Object.keys(updateData),
      ip: req.ip
    });

    // Respuesta sin datos sensibles
    const userResponse = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      phone: user.phone,
      role: user.role,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: userResponse
    });

  } catch (error) {
    logger.error('Error actualizando perfil', {
      error: error.message,
      userId: req.user?.id,
      ip: req.ip
    });

    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: 'VALIDATION_ERROR',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: 'INTERNAL_ERROR'
    });
  }
};

// =============================================
// INICIALIZAR SISTEMA (CREAR ADMIN SI NO EXISTE)
// =============================================
const initializeSystem = async (req, res) => {
  try {
    const adminData = await createDefaultAdmin();

    if (!adminData) {
      return res.json({
        success: true,
        message: 'Sistema ya inicializado',
        initialized: true
      });
    }

    logger.info('Sistema inicializado con admin por defecto', {
      adminId: adminData.user.id,
      adminEmail: adminData.user.email,
      churchId: adminData.church.id,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Sistema inicializado exitosamente',
      initialized: true,
      admin: {
        email: adminData.user.email,
        defaultPassword: adminData.defaultPassword,
        church: {
          id: adminData.church.id,
          name: adminData.church.name
        }
      },
      warning: 'CAMBIE LA CONTRASEÑA POR DEFECTO INMEDIATAMENTE'
    });

  } catch (error) {
    logger.error('Error inicializando sistema', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Error inicializando sistema',
      error: 'INITIALIZATION_ERROR'
    });
  }
};

// =============================================
// EXPORTAR CONTROLADOR
// =============================================
module.exports = {
  // Funciones principales
  signup,
  signin,
  logout,
  refreshToken,
  changePassword,
  verifyToken,
  
  // Reset de contraseña
  requestPasswordReset,
  resetPassword,
  
  // Perfil de usuario
  getProfile,
  updateProfile,
  
  // Inicialización
  initializeSystem,
  createDefaultAdmin,
  
  // Utilidades
  generateTokens
};