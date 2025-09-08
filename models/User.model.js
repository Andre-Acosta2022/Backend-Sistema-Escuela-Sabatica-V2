/**
 * USER.MODEL.JS - Modelo de usuarios del sistema
 * Sistema de Gestión Misionera
 * 
 * Define la estructura y validaciones para los usuarios
 * con roles jerárquicos y permisos específicos
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { roles, roleHierarchy } = require('../config/auth.config');

module.exports = (sequelize, DataTypes) => {
  
  const User = sequelize.define('User', {
    
    // =============================================
    // CAMPOS PRINCIPALES
    // =============================================
    
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'unique_user_email',
        msg: 'El email ya está registrado en el sistema'
      },
      validate: {
        isEmail: {
          msg: 'Debe proporcionar un email válido'
        },
        notEmpty: {
          msg: 'El email es requerido'
        },
        len: {
          args: [5, 255],
          msg: 'El email debe tener entre 5 y 255 caracteres'
        }
      },
      set(value) {
        this.setDataValue('email', value ? value.toLowerCase().trim() : value);
      }
    },
    
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'La contraseña es requerida'
        },
        len: {
          args: [8, 255],
          msg: 'La contraseña debe tener al menos 8 caracteres'
        }
      }
    },
    
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El nombre es requerido'
        },
        len: {
          args: [2, 100],
          msg: 'El nombre debe tener entre 2 y 100 caracteres'
        },
        isAlpha: {
          msg: 'El nombre solo debe contener letras'
        }
      },
      set(value) {
        this.setDataValue('firstName', value ? value.trim() : value);
      }
    },
    
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El apellido es requerido'
        },
        len: {
          args: [2, 100],
          msg: 'El apellido debe tener entre 2 y 100 caracteres'
        },
        isAlpha: {
          msg: 'El apellido solo debe contener letras'
        }
      },
      set(value) {
        this.setDataValue('lastName', value ? value.trim() : value);
      }
    },
    
    // =============================================
    // SISTEMA DE ROLES
    // =============================================
    
    role: {
      type: DataTypes.ENUM(Object.values(roles)),
      allowNull: false,
      defaultValue: roles.READER,
      validate: {
        isIn: {
          args: [Object.values(roles)],
          msg: 'Rol inválido'
        }
      }
    },
    
    // =============================================
    // INFORMACIÓN DE CONTACTO
    // =============================================
    
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [10, 20],
          msg: 'El teléfono debe tener entre 10 y 20 dígitos'
        },
        isNumeric: {
          msg: 'El teléfono solo debe contener números'
        }
      },
      set(value) {
        // Remover espacios y caracteres especiales
        if (value) {
          this.setDataValue('phone', value.replace(/\D/g, ''));
        }
      }
    },
    
    profileImage: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'La imagen de perfil debe ser una URL válida'
        }
      }
    },
    
    // =============================================
    // RELACIÓN CON IGLESIA
    // =============================================
    
    churchId: {
      type: DataTypes.UUID,
      allowNull: true, // Admin no tiene iglesia asignada
      references: {
        model: 'Churches',
        key: 'id'
      }
    },
    
    // =============================================
    // ESTADO Y CONTROL
    // =============================================
    
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    isApproved: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false // Requiere aprobación por admin
    },
    
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    loginAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    
    lockedUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // =============================================
    // METADATOS
    // =============================================
    
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    }
    
  }, {
    
    // =============================================
    // CONFIGURACIÓN DEL MODELO
    // =============================================
    
    tableName: 'Users',
    timestamps: true,
    
    // Índices para mejorar rendimiento
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['role']
      },
      {
        fields: ['churchId']
      },
      {
        fields: ['isActive', 'isApproved']
      },
      {
        fields: ['createdAt']
      }
    ],
    
    // =============================================
    // HOOKS DEL MODELO
    // =============================================
    
    hooks: {
      
      // Hash de contraseña antes de crear
      beforeCreate: async (user) => {
        if (user.password) {
          const saltRounds = process.env.BCRYPT_SALT_ROUNDS || 12;
          user.password = await bcrypt.hash(user.password, parseInt(saltRounds));
        }
      },
      
      // Hash de contraseña antes de actualizar
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const saltRounds = process.env.BCRYPT_SALT_ROUNDS || 12;
          user.password = await bcrypt.hash(user.password, parseInt(saltRounds));
        }
      },
      
      // Validaciones adicionales antes de crear
      beforeCreate: async (user) => {
        // Admin no debe tener churchId
        if (user.role === roles.ADMIN && user.churchId) {
          throw new Error('El administrador no debe estar asociado a una iglesia');
        }
        
        // Otros roles requieren churchId (excepto en casos específicos)
        if (user.role !== roles.ADMIN && !user.churchId) {
          console.warn(`Usuario ${user.email} creado sin iglesia asignada`);
        }
      },
      
      // Validaciones antes de actualizar
      beforeUpdate: async (user) => {
        // Evitar que admin se asigne a una iglesia
        if (user.role === roles.ADMIN && user.churchId) {
          throw new Error('El administrador no puede estar asociado a una iglesia');
        }
        
        // Registrar cambios de rol importantes
        if (user.changed('role')) {
          console.log(`Cambio de rol para usuario ${user.email}: ${user._previousDataValues.role} -> ${user.role}`);
        }
      }
    },
    
    // =============================================
    // SCOPES PARA CONSULTAS
    // =============================================
    
    scopes: {
      
      // Solo usuarios activos
      active: {
        where: {
          isActive: true
        }
      },
      
      // Solo usuarios aprobados
      approved: {
        where: {
          isApproved: true
        }
      },
      
      // Usuarios activos y aprobados
      available: {
        where: {
          isActive: true,
          isApproved: true
        }
      },
      
      // Por rol específico
      byRole: (role) => ({
        where: {
          role: role
        }
      }),
      
      // Por iglesia
      byChurch: (churchId) => ({
        where: {
          churchId: churchId
        }
      }),
      
      // Información básica (sin contraseña)
      public: {
        attributes: {
          exclude: ['password', 'loginAttempts', 'lockedUntil']
        }
      },
      
      // Con información de iglesia
      withChurch: {
        include: [{
          association: 'church',
          attributes: ['id', 'name', 'city', 'state']
        }]
      },
      
      // Con grupos (para líderes)
      withGroups: {
        include: [{
          association: 'groups',
          attributes: ['id', 'name', 'type', 'isActive']
        }]
      }
    }
    
  });
  
  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  
  /**
   * Verificar contraseña
   */
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };
  
  /**
   * Generar JWT token
   */
  User.prototype.generateAuthToken = function() {
    const payload = {
      id: this.id,
      email: this.email,
      role: this.role,
      churchId: this.churchId,
      firstName: this.firstName,
      lastName: this.lastName
    };
    
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || 'fallback-secret',
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        issuer: 'mission-system-api',
        audience: 'mission-system-client'
      }
    );
  };
  
  /**
   * Obtener información pública del usuario
   */
  User.prototype.getPublicInfo = function() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      fullName: this.getFullName(),
      role: this.role,
      churchId: this.churchId,
      phone: this.phone,
      profileImage: this.profileImage,
      isActive: this.isActive,
      isApproved: this.isApproved,
      lastLogin: this.lastLogin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  };
  
  /**
   * Obtener nombre completo
   */
  User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`.trim();
  };
  
  /**
   * Verificar si el usuario tiene un rol específico
   */
  User.prototype.hasRole = function(role) {
    return this.role === role;
  };
  
  /**
   * Verificar si el usuario tiene mayor jerarquía que otro rol
   */
  User.prototype.hasHigherRoleThan = function(otherRole) {
    return roleHierarchy[this.role] > roleHierarchy[otherRole];
  };
  
  /**
   * Verificar si la cuenta está bloqueada
   */
  User.prototype.isLocked = function() {
    return !!(this.lockedUntil && this.lockedUntil > Date.now());
  };
  
  /**
   * Incrementar intentos fallidos de login
   */
  User.prototype.incLoginAttempts = async function() {
    // Si ya está bloqueado y el tiempo expiró, resetear
    if (this.lockedUntil && this.lockedUntil < Date.now()) {
      return await this.update({
        loginAttempts: 1,
        lockedUntil: null
      });
    }
    
    const updates = { 
      loginAttempts: this.loginAttempts + 1 
    };
    
    // Bloquear cuenta después de 5 intentos
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
      updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    }
    
    return await this.update(updates);
  };
  
  /**
   * Resetear intentos de login después de login exitoso
   */
  User.prototype.resetLoginAttempts = async function() {
    return await this.update({
      loginAttempts: 0,
      lockedUntil: null,
      lastLogin: new Date()
    });
  };
  
  /**
   * Verificar si puede gestionar a otro usuario
   */
  User.prototype.canManage = function(otherUser) {
    // Admin puede gestionar a todos excepto otros admins
    if (this.role === roles.ADMIN) {
      return otherUser.role !== roles.ADMIN || this.id === otherUser.id;
    }
    
    // Director puede gestionar líderes y lectores de su iglesia
    if (this.role === roles.DIRECTOR) {
      return (
        this.churchId === otherUser.churchId &&
        this.hasHigherRoleThan(otherUser.role)
      );
    }
    
    // Líderes solo pueden verse a sí mismos
    if (this.role === roles.LEADER) {
      return this.id === otherUser.id;
    }
    
    // Lectores no pueden gestionar a nadie
    return false;
  };
  
  // =============================================
  // MÉTODOS ESTÁTICOS (DE CLASE)
  // =============================================
  
  /**
   * Buscar usuario por email
   */
  User.findByEmail = async function(email) {
    return await this.findOne({
      where: { 
        email: email.toLowerCase().trim() 
      }
    });
  };
  
  /**
   * Buscar usuarios por rol
   */
  User.findByRole = async function(role) {
    return await this.scope('available').findAll({
      where: { role }
    });
  };
  
  /**
   * Buscar usuarios por iglesia
   */
  User.findByChurch = async function(churchId) {
    return await this.scope(['available', 'public']).findAll({
      where: { churchId }
    });
  };
  
  /**
   * Obtener estadísticas de usuarios
   */
  User.getStats = async function() {
    const [total, active, approved, byRole] = await Promise.all([
      this.count(),
      this.count({ where: { isActive: true } }),
      this.count({ where: { isApproved: true } }),
      this.count({
        attributes: ['role'],
        group: ['role'],
        raw: true
      })
    ]);
    
    const roleStats = {};
    byRole.forEach(stat => {
      roleStats[stat.role] = stat.count;
    });
    
    return {
      total,
      active,
      approved,
      inactive: total - active,
      pending: total - approved,
      byRole: roleStats
    };
  };
  
  return User;
};