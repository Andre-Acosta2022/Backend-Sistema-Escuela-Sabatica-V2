/**
 * AUTH.CONTROLLER.JS - Controlador delgado de Autenticación
 * Sistema de Gestión Misionera
 */
const authService = require('../services/auth.service');
const { User, Church } = require('../models');
const logger = require('../utils/logger');

const signup = async (req, res, next) => {
  try {
    const user = await authService.signup(req.body);

    logger.info('Usuario registrado exitosamente', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip
    });

    return res.status(201).json({
      success: true,
      message: user.isApproved 
        ? 'Usuario registrado exitosamente'
        : 'Usuario registrado. Pendiente de aprobación por un administrador',
      needsApproval: !user.isApproved
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ success: false, message: 'El email ya está registrado', error: 'EMAIL_ALREADY_EXISTS' });
    }
    next(error);
  }
};

const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, accessToken, refreshToken, expiresIn } = await authService.signin(email, password, req.ip);

    logger.info('Login exitoso', { userId: user.id, email: user.email, role: user.role, ip: req.ip });

    return res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        role: user.role,
        church: user.church
      },
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    const tokens = await authService.refreshSession(token);

    return res.json({
      success: true,
      message: 'Token renovado exitosamente',
      ...tokens,
      tokenType: 'Bearer'
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id; // Proveniente del middleware de sesión

    const passwordChangedAt = await authService.changePassword(userId, currentPassword, newPassword);

    logger.info('Contraseña cambiada exitosamente', { userId, ip: req.ip });

    return res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente',
      passwordChangedAt
    });
  } catch (error) {
    next(error);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);

    // Por vectores de seguridad difusa, siempre respondemos con la misma estructura informativa
    return res.json({
      success: true,
      message: 'Si el email está registrado, recibirá instrucciones para restablecer su contraseña'
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const passwordChangedAt = await authService.resetPassword(token, newPassword);

    return res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      passwordChangedAt
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Church, as: 'church' }],
      attributes: { exclude: ['password', 'resetPasswordToken', 'resetPasswordExpiry'] }
    });

    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const qrData = { userId: user.id, email: user.email, role: user.role, generated: new Date().toISOString() };

    return res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      user: {
        ...user.toJSON(),
        fullName: `${user.firstName} ${user.lastName}`,
        qrData: Buffer.from(JSON.stringify(qrData)).toString('base64')
      }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName.trim();
    if (lastName !== undefined) updateData.lastName = lastName.trim();
    if (phone !== undefined) updateData.phone = phone.trim();

    await user.update(updateData);

    return res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone }
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    logger.info('Logout exitoso', { userId: req.user.id, ip: req.ip });
    return res.json({ success: true, message: 'Logout exitoso' });
  } catch (error) {
    next(error);
  }
};
// =============================================
// NUEVO MÉTODO CORREGIDO PARA LA LÍNEA 95
// =============================================
const verifyToken = async (req, res, next) => {
  try {
    // El middleware 'verifyToken' ya validó el JWT e inyectó req.user
    return res.json({
      success: true,
      message: 'Token válido y sesión activa',
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};
const initializeSystem = async (req, res, next) => {
  try {
    const adminData = await authService.createDefaultAdmin();

    if (!adminData) {
      return res.json({ success: true, message: 'Sistema ya inicializado', initialized: true });
    }

    return res.status(201).json({
      success: true,
      message: 'Sistema inicializado exitosamente',
      initialized: true,
      admin: {
        email: adminData.user.email,
        defaultPassword: adminData.defaultPassword,
        church: { id: adminData.church.id, name: adminData.church.name }
      },
      warning: 'CAMBIE LA CONTRASEÑA POR DEFECTO INMEDIATAMENTE'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  signin,
  logout,
  refreshToken,
  verifyToken, 
  changePassword,
  requestPasswordReset,
  resetPassword,
  getProfile,
  updateProfile,
  initializeSystem
};