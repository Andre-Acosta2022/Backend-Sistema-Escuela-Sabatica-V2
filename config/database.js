/**
 * DATABASE.JS - Configuración de PostgreSQL con Sequelize
 * Sistema de Gestión Misionera
 * 
 * Configuración centralizada para la conexión a PostgreSQL
 * Compatible con desarrollo local y producción (Render)
 */

require('dotenv').config();

/**
 * Configuración base para diferentes entornos
 */
const baseConfig = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  
  // Pool de conexiones
  pool: {
    max: process.env.NODE_ENV === 'production' ? 20 : 5,
    min: 0,
    acquire: 30000, // Tiempo máximo para obtener conexión
    idle: 10000,    // Tiempo máximo de inactividad
    evict: 1000,    // Tiempo para verificar conexiones inactivas
    handleDisconnects: true
  },
  
  // Configuración de dialectos específicos
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false // Para Render y otros servicios cloud
    } : false,
    
    // Configuraciones adicionales para PostgreSQL
    statement_timeout: 30000, // 30 segundos
    idle_in_transaction_session_timeout: 30000,
    connectTimeout: 60000, // 60 segundos
  },
  
  // Configuración de timezone
  timezone: process.env.TZ || 'America/Lima',
  
  // Configuración de Sequelize
  define: {
    timestamps: true, // createdAt y updatedAt automáticos
    underscored: false, // Usar camelCase en lugar de snake_case
    freezeTableName: true, // No pluralizar nombres de tablas
    paranoid: false, // No usar soft deletes por defecto
    
    // Configuración de charset para PostgreSQL
    charset: 'utf8',
    collate: 'utf8_general_ci',
  },
  
  // Configuración de migraciones
  migrationStorage: 'sequelize',
  migrationStorageTableName: 'sequelize_meta',
  
  // Configuración de seeds
  seederStorage: 'sequelize',
  seederStorageTableName: 'sequelize_seeds',
};

/**
 * Obtener configuración de base de datos según el entorno
 */
function getDatabaseConfig() {
  // Si existe DATABASE_URL (típico en Render/Heroku)
  if (process.env.DATABASE_URL) {
    return {
      ...baseConfig,
      use_env_variable: 'DATABASE_URL'
    };
  }
  
  // Configuración manual por componentes
  return {
    ...baseConfig,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'mission_system_db',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
  };
}

/**
 * Configuraciones por entorno para Sequelize CLI
 */
const environments = {
  development: {
    ...getDatabaseConfig(),
    logging: console.log,
    
    // Configuraciones específicas de desarrollo
    dialectOptions: {
      ...baseConfig.dialectOptions,
      ssl: false
    },
    
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  
  test: {
    ...getDatabaseConfig(),
    database: process.env.DB_NAME_TEST || 'mission_system_test',
    logging: false,
    
    dialectOptions: {
      ...baseConfig.dialectOptions,
      ssl: false
    }
  },
  
  production: {
    ...getDatabaseConfig(),
    logging: false,
    
    // Configuraciones adicionales para producción
    dialectOptions: {
      ...baseConfig.dialectOptions,
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    
    pool: {
      max: 20,
      min: 5,
      acquire: 30000,
      idle: 10000,
      evict: 1000
    }
  }
};

/**
 * Obtener configuración actual según NODE_ENV
 */
const currentEnv = process.env.NODE_ENV || 'development';
const config = environments[currentEnv];

/**
 * Validar configuración de base de datos
 */
function validateDatabaseConfig() {
  const requiredFields = ['database', 'username'];
  
  for (const field of requiredFields) {
    if (!config[field] && !config.use_env_variable) {
      throw new Error(`Configuración de base de datos incompleta: falta ${field}`);
    }
  }
  
  if (!config.use_env_variable) {
    if (!config.password && currentEnv === 'production') {
      throw new Error('Password de base de datos requerido en producción');
    }
    
    if (!config.host) {
      throw new Error('Host de base de datos no especificado');
    }
  }
}

/**
 * Opciones adicionales para Sequelize
 */
const sequelizeOptions = {
  // Configuración de hooks globales
  hooks: {
    beforeConnect: (config) => {
      console.log(`🔌 Conectando a PostgreSQL: ${config.host || 'DATABASE_URL'}`);
    },
    
    afterConnect: (connection, config) => {
      console.log(`✅ Conectado a PostgreSQL exitosamente`);
    },
    
    beforeDisconnect: () => {
      console.log(`🔌 Desconectando de PostgreSQL...`);
    }
  },
  
  // Configuración de retry en caso de fallo
  retry: {
    max: 3,
    match: [
      /ETIMEDOUT/,
      /EHOSTUNREACH/,
      /ECONNRESET/,
      /ECONNREFUSED/,
      /TIMEOUT/,
    ]
  }
};

/**
 * Función para probar la conexión
 */
async function testConnection(sequelize) {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al conectar con la base de datos:', error.message);
    return false;
  }
}

// Validar configuración al cargar el módulo
try {
  validateDatabaseConfig();
} catch (error) {
  console.error('❌ Error en configuración de base de datos:', error.message);
  process.exit(1);
}

// Exportar configuraciones
module.exports = {
  // Configuración actual
  ...config,
  
  // Todas las configuraciones por entorno (para Sequelize CLI)
  development: environments.development,
  test: environments.test,
  production: environments.production,
  
  // Opciones adicionales
  sequelizeOptions,
  
  // Funciones helper
  testConnection,
  validateDatabaseConfig,
  getDatabaseConfig,
  
  // Variables de entorno
  currentEnvironment: currentEnv,
  isDevelopment: currentEnv === 'development',
  isProduction: currentEnv === 'production',
  isTest: currentEnv === 'test'
};