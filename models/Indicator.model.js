/**
 * INDICATOR.MODEL.JS - Modelo de indicadores espirituales
 * Sistema de Gestión Misionera
 * 
 * Define indicadores de crecimiento espiritual
 * para seguimiento individual de miembros
 */

module.exports = (sequelize, DataTypes) => {
  const Indicator = sequelize.define('Indicator', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // Relaciones
    memberId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Members',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    semesterId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Semesters', 
        key: 'id'
      },
      onDelete: 'SET NULL'
    },

    // Indicadores de participación
    attendancePercentage: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    bibleReadingDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 31
      }
    },
    prayerFrequency: {
      type: DataTypes.ENUM('never', 'rarely', 'sometimes', 'often', 'daily'),
      allowNull: false,
      defaultValue: 'sometimes'
    },
    
    // Indicadores de servicio
    volunteering: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    evangelism: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    discipleship: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Indicadores de crecimiento
    spiritualGrowthLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 10
      }
    },
    
    // Período de evaluación
    evaluationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'spiritual_indicators',
    timestamps: true,
    underscored: true,
    
    indexes: [
 {
        name: 'idx_indicators_member_id_evaluation_date',
        fields: ['member_id', 'evaluation_date'] // 🌟 CORREGIDO: Mismo nombre físico de la BD
      },
      {
        name: 'idx_indicators_semester_id',
        fields: ['semester_id'] // 🌟 CORREGIDO: Mismo nombre físico de la BD
      }
    ]
  });

  Indicator.associate = (models) => {
    Indicator.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member',
      onDelete: 'CASCADE'
    });

    Indicator.belongsTo(models.Semester, {
      foreignKey: 'semesterId', 
      as: 'semester',
      onDelete: 'SET NULL'
    });
  };

  return Indicator;
};