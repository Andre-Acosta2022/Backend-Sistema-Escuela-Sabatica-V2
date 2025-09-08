/**
 * STUDENT.MODEL.JS - Modelo de estudiantes bíblicos
 * Sistema de Gestión Misionera
 * 
 * Define la estructura para estudiantes en programas de
 * educación bíblica y discipulado
 */

module.exports = (sequelize, DataTypes) => {
  const Student = sequelize.define('Student', {
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
    teacherId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    },

    // =============================================
    // INFORMACIÓN ACADÉMICA
    // =============================================
    enrollmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      validate: {
        isDate: {
          msg: 'Fecha de inscripción inválida'
        },
        isBefore: {
          args: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
          msg: 'La fecha de inscripción no puede ser futura'
        }
      }
    },
    program: {
      type: DataTypes.ENUM(
        'basic_bible',        // Biblia básica
        'intermediate_bible', // Biblia intermedio
        'advanced_bible',     // Biblia avanzado
        'theology',          // Teología
        'discipleship',      // Discipulado
        'leadership',        // Liderazgo
        'missions',          // Misiones
        'evangelism',        // Evangelismo
        'counseling',        // Consejería
        'worship',           // Alabanza
        'children_ministry', // Ministerio infantil
        'youth_ministry',    // Ministerio juvenil
        'other'              // Otro
      ),
      allowNull: false,
      defaultValue: 'basic_bible',
      validate: {
        isIn: {
          args: [[
            'basic_bible', 'intermediate_bible', 'advanced_bible', 'theology',
            'discipleship', 'leadership', 'missions', 'evangelism', 'counseling',
            'worship', 'children_ministry', 'youth_ministry', 'other'
          ]],
          msg: 'Programa inválido'
        }
      }
    },
    level: {
      type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'graduate'),
      allowNull: false,
      defaultValue: 'beginner',
      validate: {
        isIn: {
          args: [['beginner', 'intermediate', 'advanced', 'graduate']],
          msg: 'Nivel inválido'
        }
      }
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [0, 20],
          msg: 'El semestre no puede exceder 20 caracteres'
        }
      }
    },

    // =============================================
    // RENDIMIENTO ACADÉMICO
    // =============================================
    currentGrade: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'La nota no puede ser negativa'
        },
        max: {
          args: 20,
          msg: 'La nota no puede exceder 20'
        }
      }
    },
    attendancePercentage: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 0,
          msg: 'El porcentaje de asistencia no puede ser negativo'
        },
        max: {
          args: 100,
          msg: 'El porcentaje de asistencia no puede exceder 100'
        }
      }
    },
    completedLessons: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: {
          args: 0,
          msg: 'Las lecciones completadas no pueden ser negativas'
        }
      }
    },
    totalLessons: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'El total de lecciones debe ser mayor a 0'
        },
        max: {
          args: 200,
          msg: 'El total de lecciones no puede exceder 200'
        }
      }
    },

    // =============================================
    // PROGRESO Y CERTIFICACIÓN
    // =============================================
    status: {
      type: DataTypes.ENUM('enrolled', 'active', 'completed', 'dropped', 'suspended', 'graduated'),
      allowNull: false,
      defaultValue: 'enrolled',
      validate: {
        isIn: {
          args: [['enrolled', 'active', 'completed', 'dropped', 'suspended', 'graduated']],
          msg: 'Estado inválido'
        }
      }
    },
    graduationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Fecha de graduación inválida'
        },
        isAfterEnrollment(value) {
          if (value && this.enrollmentDate && new Date(value) < new Date(this.enrollmentDate)) {
            throw new Error('La fecha de graduación debe ser posterior a la inscripción');
          }
        }
      }
    },
    certificateIssued: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    certificateNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
      validate: {
        len: {
          args: [0, 50],
          msg: 'El número de certificado no puede exceder 50 caracteres'
        }
      }
    },

    // =============================================
    // INFORMACIÓN ESPIRITUAL
    // =============================================
    isBeliever: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
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
        }
      }
    },
    churchMember: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    previousStudy: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Los estudios previos no pueden exceder 1000 caracteres'
        }
      }
    },

    // =============================================
    // MOTIVACIÓN Y OBJETIVOS
    // =============================================
    motivationForStudy: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'La motivación no puede exceder 1000 caracteres'
        }
      }
    },
    careerGoals: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: {
          args: [0, 1000],
          msg: 'Los objetivos profesionales no pueden exceder 1000 caracteres'
        }
      }
    },
    ministryInterest: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: [],
      validate: {
        isValidInterests(value) {
          if (value && Array.isArray(value)) {
            const validInterests = [
              'preaching', 'teaching', 'evangelism', 'missions', 'counseling',
              'youth_ministry', 'children_ministry', 'music', 'administration',
              'social_work', 'pastoral_care', 'leadership', 'prayer', 'discipleship'
            ];
            for (const interest of value) {
              if (!validInterests.includes(interest)) {
                throw new Error(`Interés ministerial inválido: ${interest}`);
              }
            }
            if (value.length > 5) {
              throw new Error('No se pueden seleccionar más de 5 intereses ministeriales');
            }
          }
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
    tableName: 'students',
    timestamps: true,
    paranoid: true, // Soft delete
    underscored: true,
    
    // Índices para optimización
    indexes: [
      {
        fields: ['groupId', 'status']
      },
      {
        fields: ['teacherId']
      },
      {
        fields: ['firstName', 'lastName']
      },
      {
        fields: ['program', 'level']
      },
      {
        fields: ['status', 'isActive']
      },
      {
        fields: ['enrollmentDate']
      },
      {
        fields: ['graduationDate']
      },
      {
        fields: ['certificateNumber'],
        unique: true,
        where: {
          certificateNumber: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      }
    ],

    // =============================================
    // HOOKS DEL MODELO
    // =============================================
    hooks: {
      beforeValidate: (student, options) => {
        // Normalizar datos antes de validar
        if (student.firstName) {
          student.firstName = student.firstName.trim();
        }
        if (student.lastName) {
          student.lastName = student.lastName.trim();
        }
        if (student.email) {
          student.email = student.email.toLowerCase().trim();
        }
        
        // Validar coherencia de datos
        if (student.completedLessons && student.totalLessons && 
            student.completedLessons > student.totalLessons) {
          throw new Error('Las lecciones completadas no pueden exceder el total');
        }
        
        // Auto-generar número de certificado si se gradúa
        if (student.status === 'graduated' && !student.certificateNumber) {
          const year = new Date().getFullYear();
          const randomNumber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          student.certificateNumber = `CERT-${year}-${randomNumber}`;
          student.certificateIssued = true;
          student.graduationDate = student.graduationDate || new Date();
        }
      },
      
      beforeCreate: (student, options) => {
        console.log(`📚 Creando nuevo estudiante: ${student.firstName} ${student.lastName}`);
      },
      
      afterCreate: (student, options) => {
        console.log(`✅ Estudiante creado exitosamente: ${student.firstName} ${student.lastName} (ID: ${student.id})`);
      },
      
      beforeUpdate: (student, options) => {
        console.log(`📝 Actualizando estudiante: ${student.firstName} ${student.lastName}`);
      },
      
      afterUpdate: (student, options) => {
        console.log(`✅ Estudiante actualizado: ${student.firstName} ${student.lastName}`);
      }
    }
  });

  // =============================================
  // DEFINIR RELACIONES
  // =============================================
  Student.associate = (models) => {
    // Pertenece a un grupo
    Student.belongsTo(models.Group, {
      foreignKey: 'groupId',
      as: 'group',
      onDelete: 'CASCADE'
    });

    // Tiene un maestro/instructor (usuario)
    Student.belongsTo(models.User, {
      foreignKey: 'teacherId',
      as: 'teacher',
      onDelete: 'SET NULL'
    });
  };

  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  Student.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    
    // Calcular edad
    if (values.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(values.dateOfBirth);
      values.age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        values.age--;
      }
    }
    
    // Nombre completo
    values.fullName = `${values.firstName} ${values.lastName}`;
    
    // Progreso del curso
    if (values.totalLessons && values.totalLessons > 0) {
      values.progressPercentage = Math.round((values.completedLessons / values.totalLessons) * 100);
    } else {
      values.progressPercentage = 0;
    }
    
    // Tiempo en el programa
    if (values.enrollmentDate) {
      const enrollDate = new Date(values.enrollmentDate);
      const today = new Date();
      const monthsEnrolled = (today.getFullYear() - enrollDate.getFullYear()) * 12 + 
                            (today.getMonth() - enrollDate.getMonth());
      values.monthsEnrolled = Math.max(0, monthsEnrolled);
    }
    
    // Estado de graduación
    values.isGraduated = values.status === 'graduated';
    values.canGraduate = values.progressPercentage >= 80 && values.attendancePercentage >= 75;
    
    // Formatear fechas
    if (values.dateOfBirth) {
      values.dateOfBirthFormatted = new Date(values.dateOfBirth).toLocaleDateString('es-PE');
    }
    if (values.enrollmentDate) {
      values.enrollmentDateFormatted = new Date(values.enrollmentDate).toLocaleDateString('es-PE');
    }
    if (values.graduationDate) {
      values.graduationDateFormatted = new Date(values.graduationDate).toLocaleDateString('es-PE');
    }
    
    return values;
  };

  // =============================================
  // MÉTODOS ESTÁTICOS
  // =============================================
  
  // Buscar estudiantes por grupo
  Student.findByGroup = async function(groupId, options = {}) {
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
        },
        {
          model: this.sequelize.models.User,
          as: 'teacher',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['firstName', 'ASC'], ['lastName', 'ASC']],
      ...options
    });
  };

  // Obtener estadísticas de estudiantes
  Student.getStats = async function(groupId = null) {
    const whereClause = groupId ? { groupId } : {};
    
    const stats = await this.findAll({
      where: whereClause,
      attributes: [
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'total'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'active' THEN 1 END")), 'active'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'enrolled' THEN 1 END")), 'enrolled'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'completed' THEN 1 END")), 'completed'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN status = 'graduated' THEN 1 END")), 'graduated'],
        [this.sequelize.fn('COUNT', this.sequelize.literal("CASE WHEN baptized = true THEN 1 END")), 'baptized'],
        [this.sequelize.fn('AVG', this.sequelize.col('currentGrade')), 'avgGrade'],
        [this.sequelize.fn('AVG', this.sequelize.col('attendancePercentage')), 'avgAttendance']
      ],
      raw: true
    });

    // Estadísticas por programa
    const programStats = await this.findAll({
      where: whereClause,
      attributes: [
        'program',
        [this.sequelize.fn('COUNT', this.sequelize.col('id')), 'count']
      ],
      group: ['program'],
      raw: true
    });

    return {
      ...stats[0],
      byProgram: programStats.reduce((acc, item) => {
        acc[item.program] = parseInt(item.count);
        return acc;
      }, {})
    };
  };

  // Buscar estudiantes próximos a graduarse
  Student.findNearGraduation = async function() {
    return await this.findAll({
      where: {
        status: 'active',
        isActive: true,
        [this.sequelize.Sequelize.Op.and]: [
          this.sequelize.literal('(completed_lessons * 100.0 / NULLIF(total_lessons, 0)) >= 80'),
          this.sequelize.literal('attendance_percentage >= 75')
        ]
      },
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
      order: [['firstName', 'ASC'], ['lastName', 'ASC']]
    });
  };

  return Student;
};