/**
 * MODELS/INDEX.JS - Configuración principal de Sequelize
 * Sistema de Gestión Misionera
 * 
 * Inicialización de Sequelize y carga de todos los modelos
 * con sus relaciones y configuraciones
 */

const { Sequelize } = require('sequelize');
const dbConfig = require('../config/database');
const logger = require('../utils/logger');

// Crear instancia de Sequelize
let sequelize;

if (dbConfig.use_env_variable) {
  // Usar DATABASE_URL (típico en Render/Heroku)
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], {
    ...dbConfig,
    ...dbConfig.sequelizeOptions
  });
} else {
  // Usar configuración por componentes
  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username, 
    dbConfig.password,
    {
      ...dbConfig,
      ...dbConfig.sequelizeOptions
    }
  );
}

// Objeto para almacenar todos los modelos
const db = {};

// Importar todos los modelos
const User = require('./User.model')(sequelize, Sequelize.DataTypes);
const Church = require('./Church.model')(sequelize, Sequelize.DataTypes);
const Group = require('./Group.model')(sequelize, Sequelize.DataTypes);
const Member = require('./Member.model')(sequelize, Sequelize.DataTypes);
const Student = require('./Student.model')(sequelize, Sequelize.DataTypes);
const Metric = require('./Metric.model')(sequelize, Sequelize.DataTypes);
const Indicator = require('./Indicator.model')(sequelize, Sequelize.DataTypes);
const Semester = require('./Semester.model')(sequelize, Sequelize.DataTypes);

// Agregar modelos al objeto db
db.User = User;
db.Church = Church;
db.Group = Group;
db.Member = Member;
db.Student = Student;
db.Metric = Metric;
db.Indicator = Indicator;
db.Semester = Semester;

/**
 * DEFINIR RELACIONES ENTRE MODELOS
 */

// =============================================
// RELACIONES DE USER
// =============================================

// Un User puede pertenecer a una Church (excepto admin)
User.belongsTo(Church, {
  foreignKey: 'churchId',
  as: 'church',
  allowNull: true // Admin no tiene iglesia
});

Church.hasMany(User, {
  foreignKey: 'churchId',
  as: 'members'
});

// Un User (líder) puede tener muchos Groups
User.hasMany(Group, {
  foreignKey: 'leaderId',
  as: 'groups'
});

Group.belongsTo(User, {
  foreignKey: 'leaderId',
  as: 'leader'
});

// =============================================
// RELACIONES DE CHURCH
// =============================================

// Una Church tiene muchos Groups
Church.hasMany(Group, {
  foreignKey: 'churchId',
  as: 'groups',
  onDelete: 'CASCADE'
});

Group.belongsTo(Church, {
  foreignKey: 'churchId',
  as: 'church'
});

// =============================================
// RELACIONES DE GROUP
// =============================================

// Un Group tiene muchos Members
Group.hasMany(Member, {
  foreignKey: 'groupId',
  as: 'members',
  onDelete: 'CASCADE'
});

Member.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group'
});

// Un Group tiene muchos Students (estudiantes bíblicos)
Group.hasMany(Student, {
  foreignKey: 'groupId', 
  as: 'students',
  onDelete: 'CASCADE'
});

Student.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group'
});

// Un Group tiene muchas Metrics
Group.hasMany(Metric, {
  foreignKey: 'groupId',
  as: 'metrics',
  onDelete: 'CASCADE'
});

Metric.belongsTo(Group, {
  foreignKey: 'groupId',
  as: 'group'
});

// =============================================
// RELACIONES DE MEMBER
// =============================================

// Un Member tiene muchos Indicators
Member.hasMany(Indicator, {
  foreignKey: 'memberId',
  as: 'indicators',
  onDelete: 'CASCADE'
});

Indicator.belongsTo(Member, {
  foreignKey: 'memberId',
  as: 'member'
});

// =============================================
// RELACIONES DE SEMESTER
// =============================================

// Un Semester tiene muchas Metrics
Semester.hasMany(Metric, {
  foreignKey: 'semesterId',
  as: 'metrics'
});

Metric.belongsTo(Semester, {
  foreignKey: 'semesterId',
  as: 'semester'
});

// Un Semester tiene muchos Indicators  
Semester.hasMany(Indicator, {
  foreignKey: 'semesterId',
  as: 'indicators'
});

Indicator.belongsTo(Semester, {
  foreignKey: 'semesterId',
  as: 'semester'
});

/**
 * MÉTODOS HELPER PARA CONSULTAS COMUNES
 */

// Helper para obtener estadísticas de una iglesia
Church.prototype.getStats = async function() {
  const groups = await this.getGroups();
  const users = await this.getMembers();
  
  let totalMembers = 0;
  let totalStudents = 0;
  
  for (const group of groups) {
    const members = await group.getMembers();
    const students = await group.getStudents();
    totalMembers += members.length;
    totalStudents += students.length;
  }
  
  return {
    totalGroups: groups.length,
    totalMembers,
    totalStudents,
    totalUsers: users.length
  };
};

// Helper para obtener estadísticas de un grupo
Group.prototype.getStats = async function() {
  const [members, students, metrics] = await Promise.all([
    this.getMembers(),
    this.getStudents(),
    this.getMetrics()
  ]);
  
  return {
    totalMembers: members.length,
    totalStudents: students.length,
    totalMetrics: metrics.length,
    activeMembers: members.filter(m => m.isActive).length,
    activeStudents: students.filter(s => s.status === 'active').length
  };
};

// Helper para obtener el progreso de un estudiante
Student.prototype.getProgress = function() {
  return Math.min(100, Math.max(0, this.progress || 0));
};

// Helper para calcular promedio de indicadores de un miembro
Member.prototype.getAverageIndicators = async function(semesterId = null) {
  const whereClause = semesterId ? { semesterId } : {};
  const indicators = await this.getIndicators({ where: whereClause });
  
  if (indicators.length === 0) return null;
  
  const totals = indicators.reduce((acc, indicator) => {
    acc.attendance += indicator.attendance || 0;
    acc.participation += indicator.participation || 0;
    acc.biblicalKnowledge += indicator.biblicalKnowledge || 0;
    acc.spiritualGrowth += indicator.spiritualGrowth || 0;
    acc.evangelism += indicator.evangelism || 0;
    return acc;
  }, {
    attendance: 0,
    participation: 0,
    biblicalKnowledge: 0,
    spiritualGrowth: 0,
    evangelism: 0
  });
  
  const count = indicators.length;
  return {
    attendance: Math.round(totals.attendance / count),
    participation: Math.round(totals.participation / count),
    biblicalKnowledge: Math.round(totals.biblicalKnowledge / count),
    spiritualGrowth: Math.round(totals.spiritualGrowth / count),
    evangelism: Math.round(totals.evangelism / count),
    overall: Math.round((
      totals.attendance + 
      totals.participation + 
      totals.biblicalKnowledge + 
      totals.spiritualGrowth + 
      totals.evangelism
    ) / (count * 5))
  };
};

/**
 * HOOKS GLOBALES DE SEQUELIZE (CORREGIDO)
 */

// Usamos el objeto de hooks de la instancia de forma segura
if (sequelize.options) {
  sequelize.options.define = sequelize.options.define || {};
  sequelize.options.define.hooks = {
    beforeCreate: (instance, options) => {
      if (logger && typeof logger.database === 'function') {
        logger.database('CREATE', instance.constructor.tableName || 'unknown', 'NEW', options.userId || 'system');
      }
    },
    afterUpdate: (instance, options) => {
      if (logger && typeof logger.database === 'function') {
        logger.database('UPDATE', instance.constructor.tableName || 'unknown', instance.id || 'unknown', options.userId || 'system');
      }
    },
    afterDestroy: (instance, options) => {
      if (logger && typeof logger.database === 'function') {
        logger.database('DELETE', instance.constructor.tableName || 'unknown', instance.id || 'unknown', options.userId || 'system');
      }
    }
  };
}
/**
 * FUNCIÓN PARA SINCRONIZAR MODELOS
 */
const syncDatabase = async (options = {}) => {
  try {
    logger.info('🔄 Sincronizando modelos con la base de datos...');
    
    await sequelize.sync(options);
    
    logger.info('✅ Modelos sincronizados correctamente');
    return true;
  } catch (error) {
    logger.error('❌ Error al sincronizar modelos:', error);
    throw error;
  }
};

/**
 * FUNCIÓN PARA CERRAR CONEXIÓN
 */
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('✅ Conexión a la base de datos cerrada');
  } catch (error) {
    logger.error('❌ Error al cerrar conexión:', error);
    throw error;
  }
};

// Agregar instancia de Sequelize al objeto db
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Agregar funciones helper
db.sync = syncDatabase;
db.close = closeConnection;

// Exportar toda la configuración
module.exports = db;