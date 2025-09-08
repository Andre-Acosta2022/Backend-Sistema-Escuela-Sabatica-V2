/**
 * AUTH.CONFIG.JS - Configuración de autenticación JWT
 * Sistema de Gestión Misionera
 * 
 * Configuración centralizada para JWT, roles y seguridad
 */

require('dotenv').config();

/**
 * Configuración JWT
 */
const jwtConfig = {
  // Clave secreta para firmar tokens
  secret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
  
  // Tiempo de expiración del token principal
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  
  // Tiempo de expiración del refresh token
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  // Algoritmo de firma
  algorithm: 'HS256',
  
  // Issuer del token
  issuer: 'mission-system-api',
  
  // Audience
  audience: 'mission-system-client'
};

/**
 * Roles del sistema en orden jerárquico
 */
const roles = {
  ADMIN: 'admin',
  DIRECTOR: 'director', 
  LEADER: 'leader',
  READER: 'reader'
};

/**
 * Jerarquía de roles (mayor número = mayor privilegio)
 */
const roleHierarchy = {
  [roles.READER]: 1,
  [roles.LEADER]: 2,
  [roles.DIRECTOR]: 3,
  [roles.ADMIN]: 4
};

/**
 * Permisos por rol
 */
const permissions = {
  [roles.ADMIN]: [
    // Gestión de usuarios
    'users:create',
    'users:read',
    'users:update', 
    'users:delete',
    'users:approve',
    'users:change-role',
    
    // Gestión de iglesias
    'churches:create',
    'churches:read',
    'churches:update',
    'churches:delete',
    
    // Gestión de grupos
    'groups:create',
    'groups:read',
    'groups:update',
    'groups:delete',
    
    // Gestión de miembros
    'members:create',
    'members:read',
    'members:update',
    'members:delete',
    
    // Gestión de estudiantes
    'students:create',
    'students:read', 
    'students:update',
    'students:delete',
    
    // Métricas e indicadores
    'metrics:create',
    'metrics:read',
    'metrics:update',
    'metrics:delete',
    'indicators:create',
    'indicators:read',
    'indicators:update',
    'indicators:delete',
    
    // Reportes
    'reports:create',
    'reports:read',
    'reports:export',
    'reports:delete',
    
    // Sistema
    'system:read',
    'system:configure'
  ],
  
  [roles.DIRECTOR]: [
    // Solo lectura de usuarios
    'users:read',
    
    // Gestión limitada de iglesias (solo las asignadas)
    'churches:read',
    'churches:update',
    
    // Gestión de grupos
    'groups:create',
    'groups:read', 
    'groups:update',
    'groups:delete',
    
    // Gestión de miembros
    'members:create',
    'members:read',
    'members:update',
    'members:delete',
    
    // Gestión de estudiantes
    'students:create',
    'students:read',
    'students:update', 
    'students:delete',
    
    // Métricas e indicadores
    'metrics:create',
    'metrics:read',
    'metrics:update',
    'indicators:create',
    'indicators:read', 
    'indicators:update',
    
    // Reportes
    'reports:create',
    'reports:read',
    'reports:export'
  ],
  
  [roles.LEADER]: [
    // Solo su perfil
    'users:read',
    
    // Solo su iglesia
    'churches:read',
    
    // Solo sus grupos
    'groups:read',
    'groups:update',
    
    // Gestión de miembros de sus grupos
    'members:create',
    'members:read',
    'members:update',
    'members:delete',
    
    // Gestión de estudiantes de sus grupos
    'students:create',
    'students:read',
    'students:update',
    'students:delete',
    
    // Métricas e indicadores de sus grupos
    'metrics:create',
    'metrics:read', 
    'metrics:update',
    'indicators:create',
    'indicators:read',
    'indicators:update',
    
    // Reportes de sus grupos
    'reports:read',
    'reports:export'
  ],
  
  [roles.READER]: [
    // Solo lectura de su perfil
    'users:read',
    
    // Solo lectura de su iglesia
    'churches:read',
    
    // Solo lectura de grupos permitidos
    'groups:read',
    'members:read',
    'students:read',
    'metrics:read',
    'indicators:read',
    
    // Solo lectura de reportes
    'reports:read'
  ]
};

/**
 * Configuración de bcrypt para passwords
 */
const passwordConfig = {
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
  
  // Políticas de contraseñas
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  
  // Regex para validación
  passwordRegex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};

/**
 * Configuración del administrador por defecto
 */
const defaultAdmin = {
  email: process.env.ADMIN_EMAIL || 'admin@missionhub.com',
  password: process.env.ADMIN_PASSWORD || 'AdminSecure2024!',
  firstName: process.env.ADMIN_FIRST_NAME || 'System',
  lastName: process.env.ADMIN_LAST_NAME || 'Administrator', 
  phone: process.env.ADMIN_PHONE || '+1234567890',
  role: roles.ADMIN,
  isActive: true,
  churchId: null // Admin no está asociado a una iglesia específica
};

/**
 * Funciones helper para roles y permisos
 */
const authHelpers = {
  
  /**
   * Verificar si un rol tiene mayor jerarquía que otro
   */
  isHigherRole: (role1, role2) => {
    return roleHierarchy[role1] > roleHierarchy[role2];
  },
  
  /**
   * Verificar si un rol tiene cierto permiso
   */
  hasPermission: (role, permission) => {
    return permissions[role]?.includes(permission) || false;
  },
  
  /**
   * Obtener todos los permisos de un rol
   */
  getRolePermissions: (role) => {
    return permissions[role] || [];
  },
  
  /**
   * Verificar si un rol es válido
   */
  isValidRole: (role) => {
    return Object.values(roles).includes(role);
  },
  
  /**
   * Obtener roles disponibles para un usuario según su rol actual
   */
  getAvailableRoles: (currentRole) => {
    const currentHierarchy = roleHierarchy[currentRole];
    return Object.keys(roleHierarchy).filter(role => 
      roleHierarchy[role] < currentHierarchy
    );
  },
  
  /**
   * Validar formato de password
   */
  isValidPassword: (password) => {
    return passwordConfig.passwordRegex.test(password);
  },
  
  /**
   * Obtener mensaje de error para password inválido
   */
  getPasswordErrorMessage: () => {
    return 'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales';
  }
};

/**
 * Configuración de headers de autenticación
 */
const authHeaders = {
  authorization: 'authorization',
  accessToken: 'x-access-token',
  refreshToken: 'x-refresh-token'
};

/**
 * Configuración de cookies (si se usan)
 */
const cookieConfig = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000, // 24 horas en ms
  path: '/'
};

/**
 * Validar configuración de autenticación
 */
function validateAuthConfig() {
  // Verificar que existe JWT_SECRET en producción
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
    }
    
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
      throw new Error('ADMIN_PASSWORD debe ser configurado en producción');
    }
  }
  
  // Verificar configuración del admin
  if (!defaultAdmin.email.includes('@')) {
    throw new Error('Email del administrador inválido');
  }
  
  if (!authHelpers.isValidPassword(defaultAdmin.password)) {
    console.warn('⚠️  Contraseña del admin no cumple con las políticas de seguridad');
  }
}

// Validar configuración al cargar el módulo
try {
  validateAuthConfig();
} catch (error) {
  console.error('❌ Error en configuración de autenticación:', error.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

module.exports = {
  // Configuración JWT
  jwt: jwtConfig,
  
  // Roles y permisos
  roles,
  roleHierarchy,
  permissions,
  
  // Configuración de passwords
  password: passwordConfig,
  
  // Admin por defecto
  defaultAdmin,
  
  // Headers y cookies
  authHeaders,
  cookieConfig,
  
  // Helpers
  ...authHelpers,
  
  // Validación
  validateAuthConfig
};