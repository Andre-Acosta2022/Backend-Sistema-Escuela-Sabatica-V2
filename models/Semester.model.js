/**
 * SEMESTER.MODEL.JS - Modelo de semestres académicos
 * Sistema de Gestión Misionera
 * 
 * Define períodos académicos para organizar
 * métricas e indicadores por tiempo
 */

module.exports = (sequelize, DataTypes) => {
  const Semester = sequelize.define('Semester', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 2020,
        max: 2050
      }
    },
    
    period: {
      type: DataTypes.ENUM('first', 'second', 'third', 'fourth', 'annual'),
      allowNull: false,
      defaultValue: 'first'
    },
    
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterStart(value) {
          if (this.startDate && new Date(value) <= new Date(this.startDate)) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'semesters',
    timestamps: true,
    underscored: true,
    
    indexes: [
      { fields: ['year', 'period'], unique: true },
      { fields: ['isActive'] },
      { fields: ['isCurrent'] },
      { fields: ['startDate', 'endDate'] }
    ],
    
    hooks: {
      beforeSave: async (semester, options) => {
        // Solo un semestre puede estar marcado como actual
        if (semester.isCurrent) {
          await semester.constructor.update(
            { isCurrent: false },
            { 
              where: { 
                isCurrent: true,
                id: { [sequelize.Sequelize.Op.ne]: semester.id }
              }
            }
          );
        }
      }
    }
  });

  Semester.associate = (models) => {
    Semester.hasMany(models.Metric, {
      foreignKey: 'semesterId',
      as: 'metrics',
      onDelete: 'SET NULL'
    });

    Semester.hasMany(models.Indicator, {
      foreignKey: 'semesterId',
      as: 'indicators', 
      onDelete: 'SET NULL'
    });
  };

  // Método para obtener el semestre actual
  Semester.getCurrent = async function() {
    return await this.findOne({
      where: { isCurrent: true }
    });
  };

  // Método para obtener semestres activos
  Semester.getActive = async function() {
    return await this.findAll({
      where: { isActive: true },
      order: [['year', 'DESC'], ['period', 'DESC']]
    });
  };

  return Semester;
};