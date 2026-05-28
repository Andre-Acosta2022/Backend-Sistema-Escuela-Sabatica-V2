/**
 * AUTH.SERVICE.JS - Servicio de Autenticación y Criptografía
 * Sistema de Gestión Misionera
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../models');
const { User, Church } = db;
const { BadRequestError, UnauthorizedError, NotFoundError } = require('../middlewares/error.middleware');

// Configuración centralizada de variables de entorno con fallbacks seguros
const JWT_SECRET_KEY = process.env.JWT_SECRET || 'fallback-super-secret-key-misionero-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET_KEY;
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;

const JWT_CONFIG = {
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
};

class AuthService {
  
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      churchId: user.churchId
    };

    const accessToken = jwt.sign(payload, JWT_SECRET_KEY, {
      expiresIn: JWT_CONFIG.expiresIn,
      issuer: 'misionero-system',
      subject: user.id.toString()
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_REFRESH_SECRET,
      {
        expiresIn: JWT_CONFIG.refreshExpiresIn,
        issuer: 'misionero-system',
        subject: user.id.toString()
      }
    );

    return { accessToken, refreshToken, expiresIn: JWT_CONFIG.expiresIn };
  }

  async signup(data) {
    const { email, password, firstName, lastName, phone, churchId, role = 'reader' } = data;

    // RESARCIDO: Bcrypt se ejecuta ANTES de iniciar la transacción de BD
    const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    if (churchId) {
      const churchExists = await Church.findByPk(churchId, { attributes: ['id'] });
      if (!churchExists) throw new BadRequestError('La iglesia especificada no existe');
    }

    const transaction = await db.sequelize.transaction();
    try {
      const user = await User.create({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone,
        role,
        churchId: churchId || null,
        isActive: true,
        isApproved: role === 'reader' // Readers auto-aprobados
      }, { transaction });

      await transaction.commit();
      return user;
    } catch (error) {
      await transaction.rollback();
      throw error; // El controlador o el manejador de errores capturarán restricciones únicas
    }
  }

  async signin(email, password, ip) {
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      include: [{ model: Church, as: 'church', attributes: ['id', 'name', 'city', 'country'] }]
    });

    if (!user) throw new UnauthorizedError('Credenciales inválidas');
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedError('Credenciales inválidas');
    
    if (!user.isActive) throw new UnauthorizedError('Usuario inactivo. Contacte al administrador');
    if (!user.isApproved) throw new UnauthorizedError('Usuario pendiente de aprobación por un administrador');

    await user.update({
      lastLoginAt: new Date(),
      lastLoginIp: ip
    });

    const tokens = this.generateTokens(user);
    return { user, ...tokens };
  }

  async refreshSession(token) {
    if (!token) throw new UnauthorizedError('Refresh token requerido');

    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
      if (decoded.type !== 'refresh') throw new UnauthorizedError('Tipo de token inválido');

      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'firstName', 'lastName', 'role', 'churchId', 'isActive', 'isApproved']
      });

      if (!user || !user.isActive || !user.isApproved) {
        throw new UnauthorizedError('Acceso revocado o usuario inválido');
      }

      return this.generateTokens(user);
    } catch (err) {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) throw new NotFoundError('Usuario');

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) throw new BadRequestError('La contraseña actual es incorrecta');

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) throw new BadRequestError('La nueva contraseña debe ser diferente a la actual');

    const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    
    await user.update({
      password: hashedNewPassword,
      passwordChangedAt: new Date()
    });

    return user.passwordChangedAt;
  }

  async requestPasswordReset(email) {
    const user = await User.findOne({ where: { email: email.toLowerCase().trim(), isActive: true } });
    if (!user) return false; // Retornar falso discretamente para evitar enumeración de cuentas

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await user.update({
      resetPasswordToken: resetToken,
      resetPasswordExpiry: resetTokenExpiry
    });

    return resetToken;
  }

  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { [db.Sequelize.Op.gt]: new Date() },
        isActive: true
      }
    });

    if (!user) throw new BadRequestError('Token inválido o expirado');

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) throw new BadRequestError('La nueva contraseña debe ser diferente a la anterior');

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiry: null,
      passwordChangedAt: new Date()
    });

    return user.passwordChangedAt;
  }

  async createDefaultAdmin() {
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (adminExists) return null;

    let defaultChurch = await Church.findOne({ where: { name: 'Iglesia Principal' } });
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
    }

    const defaultPassword = process.env.ADMIN_PASSWORD || 'AdminMisionero2024!';
    const hashedPassword = await bcrypt.hash(defaultPassword, BCRYPT_SALT_ROUNDS);

    const adminUser = await User.create({
      email: process.env.ADMIN_EMAIL || 'admin@misionero.com',
      password: hashedPassword,
      firstName: process.env.ADMIN_FIRST_NAME || 'Andre',
      lastName: process.env.ADMIN_LAST_NAME || 'Administrator',
      role: 'admin',
      churchId: defaultChurch.id,
      isActive: true,
      isApproved: true,
      phone: process.env.ADMIN_PHONE || '+1234567890'
    });

    return { user: adminUser, church: defaultChurch, defaultPassword };
  }
}

module.exports = new AuthService();