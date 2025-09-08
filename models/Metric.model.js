/**
 * METRIC.MODEL.JS - Modelo de métricas de grupos
 * Sistema de Gestión Misionera
 * 
 * Define métricas y estadísticas de seguimiento
 * para grupos y actividades misioneras
 */

module.exports = (sequelize, DataTypes) => {
  const Metric = sequelize.define('Metric', {
    // =============================================
    // INFORMACIÓN BÁSICA
    // =============================================
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // =============================================
    // RELACIONES PRINCIPALES
    // =============================================
    groupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Groups',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    semesterId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Semesters',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },

    // =============================================
    // PERÍODO DE LA MÉTRICA
    // =============================================
    periodType: {
      type: DataTypes.ENUM('weekly', 'monthly', 'quarterly', 'semester', 'annual'),
      allowNull: false,
      defaultValue: 'monthly',
      validate: {
        isIn: {
          args: [['weekly', 'monthly', 'quarterly', 'semester', 'annual']],
          msg: 'Tipo de período inválido'
        }
      }
    },
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: {
          msg: 'Fecha de inicio inválida'
        }
      }
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: {
          msg: 'Fecha de fin inválida'
        },
        isAfterStart(value) {
          if (value && this.periodStart && new Date(value) <= new Date(this.periodStart)) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },

    // =============================================
    // MÉTRICAS DE ASISTENCIA
    // =============================================
    totalMeetings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'El total de reuniones no puede ser negativo'
        },
        max: {
          args: 100,
          msg: 'El total de reuniones no puede exceder 100'
        }
      }
    },
    averageAttendance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'La asistencia promedio no puede ser negativa'
        }
      }
    },
    maxAttendance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'La asistencia máxima no puede ser negativa'
        }
      }
    },
    minAttendance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'La asistencia mínima no puede ser negativa'
        }
      }
    },

    // =============================================
    // MÉTRICAS DE CRECIMIENTO
    // =============================================
    newMembers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los nuevos miembros no pueden ser negativos'
        }
      }
    },
    leftMembers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los miembros que se fueron no pueden ser negativos'
        }
      }
    },
    netGrowth: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isConsistent(value) {
          if (this.newMembers !== undefined && this.leftMembers !== undefined) {
            const expectedGrowth = this.newMembers - this.leftMembers;
            if (value !== expectedGrowth) {
              throw new Error('El crecimiento neto debe ser consistente con nuevos miembros menos miembros que se fueron');
            }
          }
        }
      }
    },
    totalMembersStart: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'El total de miembros al inicio no puede ser negativo'
        }
      }
    },
    totalMembersEnd: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'El total de miembros al final no puede ser negativo'
        }
      }
    },

    // =============================================
    // MÉTRICAS ESPIRITUALES
    // =============================================
    newConversions: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Las nuevas conversiones no pueden ser negativas'
        }
      }
    },
    baptisms: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los bautismos no pueden ser negativos'
        }
      }
    },
    decisionsForChrist: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Las decisiones por Cristo no pueden ser negativas'
        }
      }
    },
    
    // =============================================
    // MÉTRICAS DE ESTUDIANTES BÍBLICOS
    // =============================================
    newStudents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los nuevos estudiantes no pueden ser negativos'
        }
      }
    },
    graduatedStudents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los estudiantes graduados no pueden ser negativos'
        }
      }
    },
    activeStudents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los estudiantes activos no pueden ser negativos'
        }
      }
    },

    // =============================================
    // MÉTRICAS DE ACTIVIDADES
    // =============================================
    evangelisticEvents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los eventos evangelísticos no pueden ser negativos'
        }
      }
    },
    communityServices: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Los servicios comunitarios no pueden ser negativos'
        }
      }
    },
    specialMeetings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Las reuniones especiales no pueden ser negativas'
        }
      }
    },

    // =============================================
    // MÉTRICAS FINANCIERAS (OPCIONAL)
    // =============================================
    offerings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'Las ofrendas no pueden ser negativas'
        }
      }
    },
    tithes: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'Los diezmos no pueden ser negativos'
        }
      }
    },
    specialOfferings: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'Las ofrendas especiales no pueden ser negativas'
        }
      }
    },

    // =============================================
    // OBJETIVOS Y METAS
    // =============================================
    attendanceGoal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La meta de asistencia debe ser mayor a 0'
        }
      }
    },
    membershipGoal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La meta de membresía debe ser mayor a 0'
        }
      }
    },
    evangelismGoal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La meta de evangelismo debe ser mayor a 0'
        }
      }
    },
    studentsGoal: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La meta de estudiantes debe ser mayor a 0'
        }
      }
    },

    // =============================================
    // PORCENTAJES DE LOGRO (CALCULADOS)
    // =============================================
    attendanceAchievement: {
      type: DataTypes.VIRTUAL(DataTypes.DECIMAL(5, 2)),
      get() {
        if (this.attendanceGoal && this.averageAttendance) {
          return ((this.averageAttendance / this.attendanceGoal) * 100).toFixed(2);
        }
        return null;
      }
    },
    membershipAchievement: {
      type: DataTypes.VIRTUAL(DataTypes.DECIMAL(5, 2)),
      get() {
        if (this.membershipGoal && this.totalMembersEnd) {
          return ((this.totalMembersEnd / this.membershipGoal) * 100).toFixed(2);
        }
        return null;
      }
    },
    evangelismAchievement: {
      type: DataTypes.VIRTUAL(DataTypes.DECIMAL(5, 2)),
      get() {
        if (this.evangelismGoal && this.newConversions) {
          return ((this.newConversions / this.evangelismGoal) * 100).toFixed(2);
        }
        return null;
      }
    },
    studentsAchievement: {
      type: DataTypes.VIRTUAL(DataTypes.DECIMAL(5, 2)),
      get() {
        if (this.studentsGoal && this.activeStudents) {
          return ((this.activeStudents / this.studentsGoal) * 100).toFixed(2);
        }
        return null;
      }
    },

    // =============================================
    // MÉTRICAS ADICIONALES
    // =============================================
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Las notas no pueden exceder 1000 caracteres'
        }
      }
    },
    challenges: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Los desafíos no pueden exceder 500 caracteres'
        }
      }
    },
    achievements: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'Los logros no pueden exceder 500 caracteres'
        }
      }
    },
    
    // =============================================
    // ESTADO Y APROBACIÓN
    // =============================================
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: {
          args: [['draft', 'pending', 'approved', 'rejected']],
          msg: 'Estado inválido'
        }
      }
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'La razón de rechazo no puede exceder 500 caracteres'
        }
      }
    },

    // =============================================
    // AUDITORÍA
    // =============================================
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    }
  }, {
    // =============================================
    // CONFIGURACIÓN DEL MODELO
    // =============================================
    tableName: 'Metrics',
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
      // Índice único para evitar métricas duplicadas por período
      {
        unique: true,
        fields: ['groupId', 'periodType', 'periodStart', 'periodEnd']
      },
      // Índices para consultas frecuentes
      {
        fields: ['groupId']
      },
      {
        fields: ['semesterId']
      },
      {
        fields: ['periodType']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdBy']
      },
      {
        fields: ['approvedBy']
      },
      {
        fields: ['createdAt']
      }
    ],
    defaultScope: {
      attributes: { exclude: ['deletedAt'] }
    },
    scopes: {
      // Métricas aprobadas
      approved: {
        where: {
          status: 'approved'
        }
      },
      // Métricas pendientes
      pending: {
        where: {
          status: 'pending'
        }
      },
      // Métricas por período
      byPeriod: (periodType) => ({
        where: {
          periodType: periodType
        }
      }),
      // Métricas con relaciones
      withRelations: {
        include: [
          {
            association: 'group',
            attributes: ['id', 'name', 'code']
          },
          {
            association: 'semester',
            attributes: ['id', 'name', 'startDate', 'endDate']
          },
          {
            association: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            association: 'approver',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      }
    },

    // =============================================
    // HOOKS DEL MODELO
    // =============================================
    hooks: {
      // Antes de crear, calcular crecimiento neto
      beforeCreate: (metric, options) => {
        metric.netGrowth = metric.newMembers - metric.leftMembers;
        
        // Validar consistencia de asistencias
        if (metric.maxAttendance < metric.averageAttendance) {
          throw new Error('La asistencia máxima no puede ser menor que el promedio');
        }
        if (metric.minAttendance > metric.averageAttendance) {
          throw new Error('La asistencia mínima no puede ser mayor que el promedio');
        }
      },

      // Antes de actualizar, recalcular valores
      beforeUpdate: (metric, options) => {
        if (metric.changed('newMembers') || metric.changed('leftMembers')) {
          metric.netGrowth = metric.newMembers - metric.leftMembers;
        }
        
        // Validar aprobación
        if (metric.changed('status') && metric.status === 'approved') {
          metric.approvedAt = new Date();
          if (!metric.approvedBy) {
            throw new Error('Se requiere especificar quién aprueba la métrica');
          }
        }
      },

      // Después de crear, log de auditoría
      afterCreate: async (metric, options) => {
        console.log(`✅ Métrica creada: ${metric.id} para grupo ${metric.groupId}`);
      },

      // Después de actualizar, log de auditoría
      afterUpdate: async (metric, options) => {
        console.log(`📝 Métrica actualizada: ${metric.id} - Estado: ${metric.status}`);
      }
    },

    // =============================================
    // MÉTODOS DE CLASE
    // =============================================
    classMethods: {
      // Obtener resumen de métricas por grupo
      async getSummaryByGroup(groupId, periodType = null) {
        const whereClause = { groupId, status: 'approved' };
        if (periodType) {
          whereClause.periodType = periodType;
        }

        return await this.findAll({
          where: whereClause,
          order: [['periodStart', 'DESC']],
          limit: 12 // Últimas 12 métricas
        });
      },

      // Obtener tendencias de crecimiento
      async getGrowthTrends(groupId, months = 6) {
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);

        return await this.findAll({
          where: {
            groupId,
            status: 'approved',
            periodStart: {
              [require('sequelize').Op.gte]: startDate
            }
          },
          order: [['periodStart', 'ASC']],
          attributes: [
            'periodStart',
            'totalMembersEnd',
            'averageAttendance',
            'newConversions',
            'activeStudents'
          ]
        });
      }
    }
  });

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  Metric.prototype.calculateOverallAchievement = function() {
    const achievements = [
      this.attendanceAchievement,
      this.membershipAchievement,
      this.evangelismAchievement,
      this.studentsAchievement
    ].filter(achievement => achievement !== null);

    if (achievements.length === 0) return null;
    
    const sum = achievements.reduce((acc, curr) => acc + parseFloat(curr), 0);
    return (sum / achievements.length).toFixed(2);
  };

  Metric.prototype.getPerformanceLevel = function() {
    const overall = this.calculateOverallAchievement();
    if (!overall) return 'Sin datos';
    
    const percentage = parseFloat(overall);
    if (percentage >= 90) return 'Excelente';
    if (percentage >= 75) return 'Bueno';
    if (percentage >= 60) return 'Regular';
    return 'Necesita mejora';
  };

  // =============================================
  // DEFINIR ASOCIACIONES
  // =============================================
  Metric.associate = function(models) {
    // Una métrica pertenece a un grupo
    Metric.belongsTo(models.Group, {
      foreignKey: 'groupId',
      as: 'group',
      onDelete: 'CASCADE'
    });

    // Una métrica puede pertenecer a un semestre
    Metric.belongsTo(models.Semester, {
      foreignKey: 'semesterId',
      as: 'semester',
      onDelete: 'SET NULL'
    });

    // Una métrica fue creada por un usuario
    Metric.belongsTo(models.User, {
      foreignKey: 'createdBy',
      as: 'creator',
      onDelete: 'CASCADE'
    });

    // Una métrica puede ser actualizada por un usuario
    Metric.belongsTo(models.User, {
      foreignKey: 'updatedBy',
      as: 'updater',
      onDelete: 'SET NULL'
    });

    // Una métrica puede ser aprobada por un usuario
    Metric.belongsTo(models.User, {
      foreignKey: 'approvedBy',
      as: 'approver',
      onDelete: 'SET NULL'
    });
  };

  return Metric;
};