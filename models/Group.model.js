/**
 * GROUP.MODEL.JS - Modelo de grupos misioneros
 * Sistema de Gestión Misionera
 * 
 * Define la estructura y validaciones para los grupos
 * de la iglesia con sus miembros, estudiantes y métricas
 */

module.exports = (sequelize, DataTypes) => {
  
  const Group = sequelize.define('Group', {
    
    // =============================================
    // CAMPOS PRINCIPALES
    // =============================================
    
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El nombre del grupo es requerido'
        },
        len: {
          args: [3, 200],
          msg: 'El nombre debe tener entre 3 y 200 caracteres'
        }
      },
      set(value) {
        this.setDataValue('name', value ? value.trim() : value);
      }
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'La descripción no puede exceder 1000 caracteres'
        }
      },
      set(value) {
        this.setDataValue('description', value ? value.trim() : value);
      }
    },
    
    // =============================================
    // RELACIONES
    // =============================================
    
    churchId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Churches',
        key: 'id'
      },
      validate: {
        notNull: {
          msg: 'El grupo debe estar asociado a una iglesia'
        }
      }
    },
    
    leaderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      },
      validate: {
        notNull: {
          msg: 'El grupo debe tener un líder asignado'
        }
      }
    },
    
    // =============================================
    // CLASIFICACIÓN Y TIPO
    // =============================================
    
    type: {
      type: DataTypes.ENUM(
        'youth',      // Jóvenes
        'adults',     // Adultos
        'children',   // Niños
        'seniors',    // Adultos mayores
        'couples',    // Parejas
        'singles',    // Solteros
        'women',      // Mujeres
        'men',        // Hombres
        'students',   // Estudiantes
        'professionals', // Profesionales
        'mixed'       // Mixto
      ),
      allowNull: false,
      defaultValue: 'mixed',
      validate: {
        isIn: {
          args: [['youth', 'adults', 'children', 'seniors', 'couples', 'singles', 'women', 'men', 'students', 'professionals', 'mixed']],
          msg: 'Tipo de grupo inválido'
        }
      }
    },
    
    category: {
      type: DataTypes.ENUM(
        'bible_study',    // Estudio bíblico
        'prayer',         // Oración
        'evangelism',     // Evangelismo
        'discipleship',   // Discipulado
        'worship',        // Alabanza
        'service',        // Servicio
        'fellowship',     // Hermandad
        'training',       // Capacitación
        'mission'         // Misional
      ),
      allowNull: false,
      defaultValue: 'bible_study',
      validate: {
        isIn: {
          args: [['bible_study', 'prayer', 'evangelism', 'discipleship', 'worship', 'service', 'fellowship', 'training', 'mission']],
          msg: 'Categoría de grupo inválida'
        }
      }
    },
    
    // =============================================
    // HORARIOS Y REUNIONES
    // =============================================
    
    meetingDay: {
      type: DataTypes.ENUM(
        'monday', 'tuesday', 'wednesday', 'thursday', 
        'friday', 'saturday', 'sunday'
      ),
      allowNull: false,
      validate: {
        isIn: {
          args: [['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']],
          msg: 'Día de reunión inválido'
        }
      }
    },
    
    meetingTime: {
      type: DataTypes.TIME,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'La hora de reunión es requerida'
        }
      }
    },
    
    meetingDuration: {
      type: DataTypes.INTEGER, // En minutos
      allowNull: true,
      defaultValue: 90,
      validate: {
        min: {
          args: 30,
          msg: 'La duración mínima es 30 minutos'
        },
        max: {
          args: 300,
          msg: 'La duración máxima es 300 minutos (5 horas)'
        }
      }
    },
    
    meetingLocation: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        len: {
          args: [0, 255],
          msg: 'La ubicación no puede exceder 255 caracteres'
        }
      },
      set(value) {
        this.setDataValue('meetingLocation', value ? value.trim() : value);
      }
    },
    
    // =============================================
    // CAPACIDAD Y LÍMITES
    // =============================================
    
    maxCapacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La capacidad máxima debe ser mayor a 0'
        },
        max: {
          args: 500,
          msg: 'La capacidad máxima no puede exceder 500'
        }
      }
    },
    
    currentSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'El tamaño actual no puede ser negativo'
        }
      }
    },
    
    // =============================================
    // ESTADO Y CONFIGURACIÓN
    // =============================================
    
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    status: {
      type: DataTypes.ENUM('planning', 'active', 'paused', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'planning',
      validate: {
        isIn: {
          args: [['planning', 'active', 'paused', 'completed', 'cancelled']],
          msg: 'Estado inválido'
        }
      }
    },
    
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Debe proporcionar una fecha válida de inicio'
        }
      }
    },
    
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Debe proporcionar una fecha válida de fin'
        },
        isAfterStart(value) {
          if (value && this.startDate && value <= this.startDate) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    
    // =============================================
    // CONFIGURACIONES ADICIONALES
    // =============================================
    
    isOpenToNewMembers: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    
    requiresApproval: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    
    // Recursos y materiales (JSON)
    resources: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidResources(value) {
          if (value && typeof value !== 'object') {
            throw new Error('Los recursos deben ser un objeto JSON válido');
          }
        }
      }
    },
    
    // Objetivos del grupo (JSON)
    goals: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidGoals(value) {
          if (value && !Array.isArray(value)) {
            throw new Error('Los objetivos deben ser un array');
          }
          
          if (value && value.length > 0) {
            for (const goal of value) {
              if (!goal.title || typeof goal.title !== 'string') {
                throw new Error('Cada objetivo debe tener un título válido');
              }
            }
          }
        }
      }
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
    
    tableName: 'Groups',
    timestamps: true,
    
    // Índices para mejorar rendimiento
    indexes: [
      {
        name: 'idx_groups_church_id',
        fields: ['churchId']
      },
      {
        name: 'idx_groups_leader_id',
        fields: ['leaderId']
      },
      {
        name: 'idx_groups_type_category',
        fields: ['type', 'category']
      },
      {
        name: 'idx_groups_is_active_status',
        fields: ['isActive', 'status']
      },
      {
        name: 'idx_groups_meeting_day_time',
        fields: ['meetingDay', 'meetingTime']
      },
      {
        name: 'idx_groups_start_end_date',
        fields: ['startDate', 'endDate']
      }
    ],
    
    // =============================================
    // HOOKS DEL MODELO
    // =============================================
    
    hooks: {
      
      // Antes de crear, validar capacidad
      beforeCreate: async (group) => {
        if (group.maxCapacity && group.currentSize > group.maxCapacity) {
          throw new Error('El tamaño actual no puede exceder la capacidad máxima');
        }
      },
      
      // Antes de actualizar, validar capacidad
      beforeUpdate: async (group) => {
        if (group.maxCapacity && group.currentSize > group.maxCapacity) {
          throw new Error('El tamaño actual no puede exceder la capacidad máxima');
        }
        
        // Si se desactiva el grupo, actualizar estado
        if (group.changed('isActive') && !group.isActive && group.status === 'active') {
          group.status = 'paused';
        }
      },
      
      // Después de crear, incrementar estadísticas de iglesia
      afterCreate: async (group, options) => {
        // Aquí se podría actualizar contadores de la iglesia
        console.log(`Nuevo grupo creado: ${group.name} en iglesia ${group.churchId}`);
      },
      
      // Después de eliminar, decrementar estadísticas
      afterDestroy: async (group, options) => {
        // Aquí se podría actualizar contadores de la iglesia
        console.log(`Grupo eliminado: ${group.name}`);
      }
    },
    
    // =============================================
    // SCOPES PARA CONSULTAS
    // =============================================
    
    scopes: {
      
      // Solo grupos activos
      active: {
        where: {
          isActive: true,
          status: 'active'
        }
      },
      
      // Por tipo de grupo
      byType: (type) => ({
        where: { type }
      }),
      
      // Por categoría
      byCategory: (category) => ({
        where: { category }
      }),
      
      // Por iglesia
      byChurch: (churchId) => ({
        where: { churchId }
      }),
      
      // Por líder
      byLeader: (leaderId) => ({
        where: { leaderId }
      }),
      
      // Abiertos a nuevos miembros
      openToNewMembers: {
        where: {
          isOpenToNewMembers: true,
          isActive: true,
          status: 'active'
        }
      },
      
      // Con espacio disponible
      withSpace: {
        where: {
          [sequelize.Sequelize.Op.or]: [
            { maxCapacity: null },
            sequelize.Sequelize.where(
              sequelize.Sequelize.col('currentSize'),
              '<',
              sequelize.Sequelize.col('maxCapacity')
            )
          ]
        }
      },
      
      // Con información completa
      full: {
        include: [
          {
            association: 'church',
            attributes: ['id', 'name', 'city', 'state']
          },
          {
            association: 'leader',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          }
        ]
      },
      
      // Con estadísticas
      withStats: {
        include: [
          {
            association: 'members',
            attributes: ['id', 'isActive'],
            separate: true
          },
          {
            association: 'students',
            attributes: ['id', 'status'],
            separate: true
          },
          {
            association: 'metrics',
            attributes: ['id', 'recordedAt'],
            separate: true
          }
        ]
      }
    }
    
  });
  
  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  
  /**
   * Obtener información de horario formateada
   */
  Group.prototype.getMeetingInfo = function() {
    const days = {
      monday: 'Lunes',
      tuesday: 'Martes', 
      wednesday: 'Miércoles',
      thursday: 'Jueves',
      friday: 'Viernes',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    
    return {
      day: days[this.meetingDay] || this.meetingDay,
      time: this.meetingTime,
      duration: this.meetingDuration,
      location: this.meetingLocation,
      formatted: `${days[this.meetingDay]} ${this.meetingTime}${this.meetingLocation ? ` - ${this.meetingLocation}` : ''}`
    };
  };
  
  /**
   * Verificar si tiene capacidad disponible
   */
  Group.prototype.hasSpace = function() {
    if (!this.maxCapacity) return true;
    return this.currentSize < this.maxCapacity;
  };
  
  /**
   * Obtener espacios disponibles
   */
  Group.prototype.getAvailableSpaces = function() {
    if (!this.maxCapacity) return null;
    return Math.max(0, this.maxCapacity - this.currentSize);
  };
  
  /**
   * Calcular porcentaje de ocupación
   */
  Group.prototype.getOccupancyRate = function() {
    if (!this.maxCapacity) return null;
    return Math.round((this.currentSize / this.maxCapacity) * 100);
  };
  
  /**
   * Verificar si puede aceptar nuevos miembros
   */
  Group.prototype.canAcceptNewMembers = function() {
    return (
      this.isActive &&
      this.status === 'active' &&
      this.isOpenToNewMembers &&
      this.hasSpace()
    );
  };
  
  /**
   * Obtener tipo y categoría formateados
   */
  Group.prototype.getClassification = function() {
    const types = {
      youth: 'Jóvenes',
      adults: 'Adultos',
      children: 'Niños',
      seniors: 'Adultos Mayores',
      couples: 'Parejas',
      singles: 'Solteros',
      women: 'Mujeres',
      men: 'Hombres',
      students: 'Estudiantes',
      professionals: 'Profesionales',
      mixed: 'Mixto'
    };
    
    const categories = {
      bible_study: 'Estudio Bíblico',
      prayer: 'Oración',
      evangelism: 'Evangelismo',
      discipleship: 'Discipulado',
      worship: 'Alabanza',
      service: 'Servicio',
      fellowship: 'Hermandad',
      training: 'Capacitación',
      mission: 'Misional'
    };
    
    return {
      type: types[this.type] || this.type,
      category: categories[this.category] || this.category,
      formatted: `${types[this.type]} - ${categories[this.category]}`
    };
  };
  
  /**
   * Verificar si está en período activo
   */
  Group.prototype.isInActivePeriod = function() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (this.startDate && new Date(this.startDate) > today) return false;
    if (this.endDate && new Date(this.endDate) < today) return false;
    
    return true;
  };
  
  // =============================================
  // MÉTODOS ESTÁTICOS (DE CLASE)
  // =============================================
  
  /**
   * Buscar grupos por iglesia
   */
  Group.findByChurch = async function(churchId) {
    return await this.scope('active').findAll({
      where: { churchId }
    });
  };
  
  /**
   * Buscar grupos por líder
   */
  Group.findByLeader = async function(leaderId) {
    return await this.scope('active').findAll({
      where: { leaderId }
    });
  };
  
  /**
   * Buscar grupos disponibles para nuevos miembros
   */
  Group.findAvailableForJoining = async function(churchId = null) {
    const whereClause = {
      isActive: true,
      status: 'active',
      isOpenToNewMembers: true
    };
    
    if (churchId) whereClause.churchId = churchId;
    
    return await this.findAll({
      where: whereClause,
      include: [
        {
          association: 'church',
          attributes: ['id', 'name', 'city']
        },
        {
          association: 'leader',
          attributes: ['id', 'firstName', 'lastName']
        }
      ]
    });
  };
  
  /**
   * Obtener estadísticas generales
   */
  Group.getStats = async function() {
    const [total, active, byType, byCategory] = await Promise.all([
      this.count(),
      this.count({ where: { isActive: true, status: 'active' } }),
      this.count({
        attributes: ['type'],
        group: ['type'],
        raw: true
      }),
      this.count({
        attributes: ['category'],
        group: ['category'],
        raw: true
      })
    ]);
    
    const typeStats = {};
    byType.forEach(stat => {
      typeStats[stat.type] = stat.count;
    });
    
    const categoryStats = {};
    byCategory.forEach(stat => {
      categoryStats[stat.category] = stat.count;
    });
    
    return {
      total,
      active,
      inactive: total - active,
      byType: typeStats,
      byCategory: categoryStats
    };
  };
  
  return Group;
};