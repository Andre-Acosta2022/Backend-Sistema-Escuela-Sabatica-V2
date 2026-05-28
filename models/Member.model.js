/**
 * MEMBER.MODEL.JS - Modelo de miembros de grupos
 * Sistema de Gestión Misionera
 * 
 * Define la estructura para miembros de grupos de estudio
 * con información personal y espiritual
 */

module.exports = (sequelize, DataTypes) => {
  const Member = sequelize.define('Member', {
    // =============================================
    // INFORMACIÓN BÁSICA
    // =============================================
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El nombre es requerido'
        },
        len: {
          args: [1, 100],
          msg: 'El nombre debe tener entre 1 y 100 caracteres'
        },
        is: {
          args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/,
          msg: 'El nombre solo puede contener letras y espacios'
        }
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
          args: [1, 100],
          msg: 'El apellido debe tener entre 1 y 100 caracteres'
        },
        is: {
          args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/,
          msg: 'El apellido solo puede contener letras y espacios'
        }
      }
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      unique: {
        msg: 'Ya existe un miembro con este email'
      },
      validate: {
        isEmail: {
          msg: 'Formato de email inválido'
        },
        len: {
          args: [0, 150],
          msg: 'El email no puede exceder 150 caracteres'
        }
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        is: {
          args: /^[\+]?[0-9\-\(\)\s]{7,20}$/,
          msg: 'Formato de teléfono inválido'
        }
      }
    },

    // =============================================
    // INFORMACIÓN DEMOGRÁFICA
    // =============================================
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Fecha de nacimiento inválida'
        },
        isBefore: {
          args: new Date().toISOString().split('T')[0],
          msg: 'La fecha de nacimiento no puede ser futura'
        },
        isRealistic(value) {
          if (value) {
            const birthYear = new Date(value).getFullYear();
            const currentYear = new Date().getFullYear();
            if (currentYear - birthYear > 120) {
              throw new Error('La edad no puede exceder 120 años');
            }
            if (currentYear - birthYear < 0) {
              throw new Error('Fecha de nacimiento inválida');
            }
          }
        }
      }
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
      allowNull: true,
      validate: {
        isIn: {
          args: [['male', 'female', 'other', 'prefer_not_to_say']],
          msg: 'Género inválido'
        }
      }
    },
    maritalStatus: {
      type: DataTypes.ENUM('single', 'married', 'divorced', 'widowed', 'other'),
      allowNull: true,
      validate: {
        isIn: {
          args: [['single', 'married', 'divorced', 'widowed', 'other']],
          msg: 'Estado civil inválido'
        }
      }
    },

    // =============================================
    // UBICACIÓN
    // =============================================
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 500],
          msg: 'La dirección no puede exceder 500 caracteres'
        }
      }
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'La ciudad no puede exceder 100 caracteres'
        }
      }
    },
    district: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: {
          args: [0, 100],
          msg: 'El distrito no puede exceder 100 caracteres'
        }
      }
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

    // =============================================
    // INFORMACIÓN ESPIRITUAL
    // =============================================
    baptized: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    baptismDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Fecha de bautismo inválida'
        },
        isBefore: {
          args: new Date().toISOString().split('T')[0],
          msg: 'La fecha de bautismo no puede ser futura'
        },
        isAfterBirth(value) {
          if (value && this.dateOfBirth && new Date(value) < new Date(this.dateOfBirth)) {
            throw new Error('La fecha de bautismo debe ser posterior al nacimiento');
          }
        }
      }
    },
    conversionDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Fecha de conversión inválida'
        },
        isBefore: {
          args: new Date().toISOString().split('T')[0],
          msg: 'La fecha de conversión no puede ser futura'
        }
      }
    },
    
    spiritualStatus: {
      type: DataTypes.ENUM(
        'new_believer',     // Nuevo creyente
        'growing',          // En crecimiento
        'mature',           // Maduro espiritualmente
        'leader',           // Líder
        'teacher',          // Maestro/Predicador
        'visitor',          // Visitante
        'inactive',         // Inactivo
        'other'             // Otro
      ),
      allowNull: false,
      defaultValue: 'visitor',
      validate: {
        isIn: {
          args: [['new_believer', 'growing', 'mature', 'leader', 'teacher', 'visitor', 'inactive', 'other']],
          msg: 'Estado espiritual inválido'
        }
      }
    },

    // =============================================
    // PARTICIPACIÓN Y ASISTENCIA
    // =============================================
    joinDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      validate: {
        isDate: {
          msg: 'Fecha de ingreso inválida'
        },
        isBefore: {
          args: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0], // Permitir fecha de mañana
          msg: 'La fecha de ingreso no puede ser futura'
        }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'transferred', 'graduated'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'inactive', 'suspended', 'transferred', 'graduated']],
          msg: 'Estado inválido'
        }
      }
    },
    attendanceScore: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'El puntaje de asistencia no puede ser negativo'
        },
        max: {
          args: 100,
          msg: 'El puntaje de asistencia no puede exceder 100'
        }
      }
    },

    // =============================================
    // INFORMACIÓN ADICIONAL
    // =============================================
    occupation: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: {
        len: {
          args: [0, 150],
          msg: 'La ocupación no puede exceder 150 caracteres'
        }
      }
    },
    education: {
      type: DataTypes.ENUM(
        'elementary',       // Primaria
        'high_school',      // Secundaria
        'technical',        // Técnico
        'university',       // Universitario
        'graduate',         // Postgrado
        'other',            // Otro
        'not_specified'     // No especificado
      ),
      allowNull: true,
      validate: {
        isIn: {
          args: [['elementary', 'high_school', 'technical', 'university', 'graduate', 'other', 'not_specified']],
          msg: 'Nivel educativo inválido'
        }
      }
    },

    // =============================================
    // CONTACTO DE EMERGENCIA
    // =============================================
    emergencyContact: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
      validate: {
        isValidContact(value) {
          if (value && typeof value === 'object') {
            if (value.name && typeof value.name !== 'string') {
              throw new Error('El nombre del contacto de emergencia debe ser texto');
            }
            if (value.phone && !/^[\+]?[0-9\-\(\)\s]{7,20}$/.test(value.phone)) {
              throw new Error('Teléfono de contacto de emergencia inválido');
            }
            if (value.relationship && typeof value.relationship !== 'string') {
              throw new Error('La relación debe ser texto');
            }
          }
        }
      }
    },

    // =============================================
    // CONTROL Y METADATOS
    // =============================================
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 2000],
          msg: 'Las notas no pueden exceder 2000 caracteres'
        }
      }
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidTags(value) {
          if (value && Array.isArray(value)) {
            if (value.length > 10) {
              throw new Error('No se pueden tener más de 10 etiquetas');
            }
            for (const tag of value) {
              if (typeof tag !== 'string' || tag.length > 50) {
                throw new Error('Las etiquetas deben ser texto de máximo 50 caracteres');
              }
            }
          }
        }
      }
    }
  }, {
    
    // =============================================
    // CONFIGURACIÓN DEL MODELO
    // =============================================
    tableName: 'members',
    timestamps: true,
    paranoid: true, // Soft delete
    underscored: true,
    
    // Índices limpios, explícitos y con la propiedad fields garantizada en cada uno
    indexes: [
      {
        name: 'idx_members_group_id_status',
        fields: ['group_id', 'status']
      },
      {
        name: 'idx_members_full_name',
        fields: ['first_name', 'last_name']
      },
      {
        name: 'idx_members_email_unique',
        unique: true,
        fields: ['email'], // <-- Asegurado que esté aquí
        where: {
          email: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        name: 'idx_members_status_active',
        fields: ['status', 'is_active']
      },
      {
        name: 'idx_members_spiritual_status',
        fields: ['spiritual_status']
      },
      {
        name: 'idx_members_join_date',
        fields: ['join_date']
      },
      {
        name: 'idx_members_date_of_birth',
        fields: ['date_of_birth']
      },
      {
        name: 'idx_members_location',
        fields: ['city', 'district']
      }
    ],

    // =============================================
    // HOOKS DEL MODELO
    // =============================================
    hooks: {
      beforeValidate: (member, options) => {
        if (member.firstName) member.firstName = member.firstName.trim();
        if (member.lastName) member.lastName = member.lastName.trim();
        if (member.email) member.email = member.email.toLowerCase().trim();
        
        if (member.baptized && !member.baptismDate) {
          member.baptismDate = member.conversionDate || member.joinDate;
        }
      },
      beforeCreate: (member, options) => {
        console.log(`👤 Creando nuevo miembro: ${member.firstName} ${member.lastName}`);
      },
      afterCreate: (member, options) => {
        console.log(`✅ Miembro creado exitosamente: ${member.firstName} ${member.lastName} (ID: ${member.id})`);
      },
      beforeUpdate: (member, options) => {
        console.log(`📝 Actualizando miembro: ${member.firstName} ${member.lastName}`);
      },
      afterUpdate: (member, options) => {
        console.log(`✅ Miembro actualizado: ${member.firstName} ${member.lastName}`);
      }
    }
  });

  // =============================================
  // DEFINIR RELACIONES
  // =============================================
  Member.associate = (models) => {
    Member.belongsTo(models.Group, {
      foreignKey: 'groupId',
      as: 'group',
      onDelete: 'CASCADE'
    });

    Member.hasMany(models.Indicator, {
      foreignKey: 'memberId',
      as: 'indicators',
      onDelete: 'CASCADE'
    });
  };

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  Member.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    if (values.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(values.dateOfBirth);
      values.age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        values.age--;
      }
    }
    
    values.fullName = `${values.firstName} ${values.lastName}`;
    
    if (values.joinDate) {
      const joinDate = new Date(values.joinDate);
      const today = new Date();
      const monthsInGroup = (today.getFullYear() - joinDate.getFullYear()) * 12 + 
                            (today.getMonth() - joinDate.getMonth());
      values.monthsInGroup = Math.max(0, monthsInGroup);
    }
    
    if (values.dateOfBirth) values.dateOfBirthFormatted = new Date(values.dateOfBirth).toLocaleDateString('es-PE');
    if (values.joinDate) values.joinDateFormatted = new Date(values.joinDate).toLocaleDateString('es-PE');
    if (values.baptismDate) values.baptismDateFormatted = new Date(values.baptismDate).toLocaleDateString('es-PE');
    
    return values;
  };

  // =============================================
  // MÉTODOS ESTÁTICOS
  // =============================================
  Member.findByGroup = async function(groupId, options = {}) {
    return await this.findAll({
      where: { 
        groupId,
        isActive: true,
        ...options.where 
      },
      include: [
        {
          model: this.sequelize.models.Group,
          as: 'group',
          attributes: ['id', 'name', 'type']
        }
      ],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
      ...options
    });
  };

  Member.getStats = async function(groupId = null) {
    const whereClause = groupId ? { groupId } : {};
    
    const stats = await this.findAll({
      where: whereClause,
      attributes: [
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'total'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'active' THEN 1 END")), 'active'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'inactive' THEN 1 END")), 'inactive'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN baptized = true THEN 1 END")), 'baptized'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN gender = 'male' THEN 1 END")), 'male'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN gender = 'female' THEN 1 END")), 'female'],
        [this.sequelize.fn('AVG', this.sequelize.col('attendanceScore')), 'avgAttendance']
      ],
      raw: true
    });

    return stats[0];
  };

  Member.findBirthdays = async function(month = null, day = null) {
    const whereClause = {
      isActive: true,
      dateOfBirth: {
        [this.sequelize.Sequelize.Op.ne]: null
      }
    };

    if (month && day) {
      whereClause[this.sequelize.Sequelize.Op.and] = [
        this.sequelize.where(this.sequelize.fn('EXTRACT', 'month', this.sequelize.col('dateOfBirth')), month),
        this.sequelize.where(this.sequelize.fn('EXTRACT', 'day', this.sequelize.col('dateOfBirth')), day)
      ];
    } else if (month) {
      whereClause[this.sequelize.Sequelize.Op.and] = [
        this.sequelize.where(this.sequelize.fn('EXTRACT', 'month', this.sequelize.col('dateOfBirth')), month)
      ];
    }

    return await this.findAll({
      where: whereClause,
      include: [
        {
          model: this.sequelize.models.Group,
          as: 'group',
          attributes: ['id', 'name'],
          include: [
            {
              model: this.sequelize.models.Church,
              as: 'church',
              attributes: ['id', 'name']
            }
          ]
        }
      ],
      order: [
        [this.sequelize.fn('EXTRACT', 'month', this.sequelize.col('dateOfBirth')), 'ASC'],
        [this.sequelize.fn('EXTRACT', 'day', this.sequelize.col('dateOfBirth')), 'ASC']
      ]
    });
  };

  return Member;
};