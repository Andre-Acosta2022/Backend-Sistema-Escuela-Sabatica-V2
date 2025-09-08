/**
 * CHURCH.MODEL.JS - Modelo de iglesias del sistema
 * Sistema de Gestión Misionera
 * 
 * Define la estructura y validaciones para las iglesias
 * con información completa de contacto, ubicación y servicios
 */

module.exports = (sequelize, DataTypes) => {
  
  const Church = sequelize.define('Church', {
    
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
          msg: 'El nombre de la iglesia es requerido'
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
    
    // =============================================
    // INFORMACIÓN DE UBICACIÓN
    // =============================================
    
    address: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'La dirección es requerida'
        },
        len: {
          args: [10, 500],
          msg: 'La dirección debe tener entre 10 y 500 caracteres'
        }
      },
      set(value) {
        this.setDataValue('address', value ? value.trim() : value);
      }
    },
    
    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'La ciudad es requerida'
        },
        len: {
          args: [2, 100],
          msg: 'La ciudad debe tener entre 2 y 100 caracteres'
        }
      },
      set(value) {
        this.setDataValue('city', value ? value.trim() : value);
      }
    },
    
    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'El estado/departamento es requerido'
        },
        len: {
          args: [2, 100],
          msg: 'El estado debe tener entre 2 y 100 caracteres'
        }
      },
      set(value) {
        this.setDataValue('state', value ? value.trim() : value);
      }
    },
    
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'Perú',
      validate: {
        len: {
          args: [2, 100],
          msg: 'El país debe tener entre 2 y 100 caracteres'
        }
      },
      set(value) {
        this.setDataValue('country', value ? value.trim() : value);
      }
    },
    
    zipCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [3, 20],
          msg: 'El código postal debe tener entre 3 y 20 caracteres'
        }
      },
      set(value) {
        this.setDataValue('zipCode', value ? value.trim() : value);
      }
    },
    
    // Coordenadas geográficas para mapas
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      validate: {
        min: -90,
        max: 90
      }
    },
    
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      validate: {
        min: -180,
        max: 180
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
          args: [7, 20],
          msg: 'El teléfono debe tener entre 7 y 20 dígitos'
        }
      },
      set(value) {
        if (value) {
          this.setDataValue('phone', value.replace(/\D/g, ''));
        }
      }
    },
    
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: {
          msg: 'Debe proporcionar un email válido'
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
    
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: {
          msg: 'Debe proporcionar una URL válida'
        }
      },
      set(value) {
        if (value && !value.startsWith('http')) {
          value = `https://${value}`;
        }
        this.setDataValue('website', value);
      }
    },
    
    // Redes sociales (JSON)
    socialMedia: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidSocialMedia(value) {
          if (value) {
            const allowedPlatforms = ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok'];
            const platforms = Object.keys(value);
            
            for (const platform of platforms) {
              if (!allowedPlatforms.includes(platform)) {
                throw new Error(`Plataforma de red social no válida: ${platform}`);
              }
              
              if (typeof value[platform] !== 'string' || value[platform].length === 0) {
                throw new Error(`URL inválida para ${platform}`);
              }
            }
          }
        }
      }
    },
    
    // =============================================
    // INFORMACIÓN PASTORAL Y LIDERAZGO
    // =============================================
    
    pastor: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: {
        len: {
          args: [2, 200],
          msg: 'El nombre del pastor debe tener entre 2 y 200 caracteres'
        }
      },
      set(value) {
        this.setDataValue('pastor', value ? value.trim() : value);
      }
    },
    
    pastorPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: {
          args: [7, 20],
          msg: 'El teléfono del pastor debe tener entre 7 y 20 dígitos'
        }
      },
      set(value) {
        if (value) {
          this.setDataValue('pastorPhone', value.replace(/\D/g, ''));
        }
      }
    },
    
    pastorEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: {
          msg: 'Debe proporcionar un email válido para el pastor'
        }
      },
      set(value) {
        this.setDataValue('pastorEmail', value ? value.toLowerCase().trim() : value);
      }
    },
    
    // =============================================
    // CAPACIDAD E INSTALACIONES
    // =============================================
    
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: {
          args: 1,
          msg: 'La capacidad debe ser mayor a 0'
        },
        max: {
          args: 10000,
          msg: 'La capacidad debe ser menor a 10,000'
        }
      }
    },
    
    // Instalaciones disponibles (JSON)
    facilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        parking: false,
        accessibility: false,
        audioVideo: false,
        kitchen: false,
        nursery: false,
        library: false,
        gymnasium: false,
        outdoorSpace: false
      },
      validate: {
        isValidFacilities(value) {
          if (value) {
            const validFacilities = [
              'parking', 'accessibility', 'audioVideo', 'kitchen', 
              'nursery', 'library', 'gymnasium', 'outdoorSpace'
            ];
            
            const facilities = Object.keys(value);
            for (const facility of facilities) {
              if (!validFacilities.includes(facility)) {
                throw new Error(`Instalación no válida: ${facility}`);
              }
              
              if (typeof value[facility] !== 'boolean') {
                throw new Error(`Valor inválido para instalación ${facility}`);
              }
            }
          }
        }
      }
    },
    
    // =============================================
    // HORARIOS DE SERVICIOS
    // =============================================
    
    // Servicios religiosos (JSON)
    services: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        sunday: {
          morning: { time: '09:00', active: true },
          evening: { time: '18:00', active: false }
        },
        wednesday: {
          evening: { time: '19:00', active: true }
        },
        friday: {
          evening: { time: '19:00', active: false }
        }
      },
      validate: {
        isValidServices(value) {
          if (value) {
            const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const validTimes = ['morning', 'afternoon', 'evening'];
            
            for (const day in value) {
              if (!validDays.includes(day)) {
                throw new Error(`Día inválido: ${day}`);
              }
              
              for (const timeSlot in value[day]) {
                if (!validTimes.includes(timeSlot)) {
                  throw new Error(`Horario inválido: ${timeSlot}`);
                }
                
                const service = value[day][timeSlot];
                if (!service.time || typeof service.active !== 'boolean') {
                  throw new Error(`Configuración de servicio inválida para ${day} ${timeSlot}`);
                }
                
                // Validar formato de hora (HH:MM)
                if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(service.time)) {
                  throw new Error(`Hora inválida: ${service.time}`);
                }
              }
            }
          }
        }
      }
    },
    
    // =============================================
    // ESTADO Y CONTROL
    // =============================================
    
    status: {
      type: DataTypes.ENUM('active', 'construction', 'planning', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: {
          args: [['active', 'construction', 'planning', 'inactive']],
          msg: 'Estado inválido'
        }
      }
    },
    
    foundedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: {
          msg: 'Debe proporcionar una fecha válida'
        },
        isBefore: {
          args: new Date().toISOString(),
          msg: 'La fecha de fundación no puede ser futura'
        }
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
    
    tableName: 'Churches',
    timestamps: true,
    
    // Índices para mejorar rendimiento
    indexes: [
      {
        unique: true,
        fields: ['name', 'city'] // Evitar iglesias duplicadas en la misma ciudad
      },
      {
        fields: ['city', 'state']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ],
    
    // =============================================
    // SCOPES PARA CONSULTAS
    // =============================================
    
    scopes: {
      
      // Solo iglesias activas
      active: {
        where: {
          status: 'active'
        }
      },
      
      // Por estado
      byStatus: (status) => ({
        where: {
          status: status
        }
      }),
      
      // Por ubicación
      byLocation: (city, state = null) => ({
        where: state ? { city, state } : { city }
      }),
      
      // Con estadísticas básicas
      withStats: {
        include: [
          {
            association: 'groups',
            attributes: ['id', 'name', 'isActive'],
            separate: true
          },
          {
            association: 'members',
            attributes: ['id', 'firstName', 'lastName', 'role', 'isActive'],
            separate: true
          }
        ]
      },
      
      // Información resumida
      summary: {
        attributes: [
          'id', 'name', 'city', 'state', 'status', 
          'capacity', 'pastor', 'phone', 'email'
        ]
      }
    }
    
  });
  
  // =============================================
  // MÉTODOS DE INSTANCIA
  // =============================================
  
  /**
   * Obtener dirección completa
   */
  Church.prototype.getFullAddress = function() {
    const parts = [this.address, this.city, this.state];
    if (this.zipCode) parts.push(this.zipCode);
    if (this.country && this.country !== 'Perú') parts.push(this.country);
    
    return parts.filter(part => part).join(', ');
  };
  
  /**
   * Obtener coordenadas
   */
  Church.prototype.getCoordinates = function() {
    if (this.latitude && this.longitude) {
      return {
        lat: parseFloat(this.latitude),
        lng: parseFloat(this.longitude)
      };
    }
    return null;
  };
  
  /**
   * Verificar si tiene una instalación específica
   */
  Church.prototype.hasFacility = function(facility) {
    return this.facilities && this.facilities[facility] === true;
  };
  
  /**
   * Obtener servicios activos
   */
  Church.prototype.getActiveServices = function() {
    const activeServices = [];
    
    if (this.services) {
      for (const day in this.services) {
        for (const timeSlot in this.services[day]) {
          const service = this.services[day][timeSlot];
          if (service.active) {
            activeServices.push({
              day: day,
              time: timeSlot,
              hour: service.time
            });
          }
        }
      }
    }
    
    return activeServices;
  };
  
  /**
   * Verificar si está abierta en un día/hora específica
   */
  Church.prototype.isOpenOn = function(day, timeSlot = null) {
    if (!this.services || !this.services[day]) return false;
    
    if (timeSlot) {
      return this.services[day][timeSlot]?.active || false;
    }
    
    // Si no se especifica hora, verificar si tiene algún servicio activo ese día
    return Object.values(this.services[day]).some(service => service.active);
  };
  
  /**
   * Obtener información de contacto completa
   */
  Church.prototype.getContactInfo = function() {
    return {
      phone: this.phone,
      email: this.email,
      website: this.website,
      socialMedia: this.socialMedia || {},
      pastor: {
        name: this.pastor,
        phone: this.pastorPhone,
        email: this.pastorEmail
      }
    };
  };
  
  // =============================================
  // MÉTODOS ESTÁTICOS (DE CLASE)
  // =============================================
  
  /**
   * Buscar iglesias por ubicación
   */
  Church.findByLocation = async function(city, state = null) {
    const whereClause = { city };
    if (state) whereClause.state = state;
    
    return await this.scope('active').findAll({
      where: whereClause
    });
  };
  
  /**
   * Buscar iglesias cercanas (requiere coordenadas)
   */
  Church.findNearby = async function(lat, lng, radiusKm = 10) {
    // Implementación básica - en producción se podría usar PostGIS
    return await this.scope('active').findAll({
      where: {
        latitude: { [sequelize.Sequelize.Op.not]: null },
        longitude: { [sequelize.Sequelize.Op.not]: null }
      }
    });
  };
  
  /**
   * Obtener estadísticas generales
   */
  Church.getStats = async function() {
    const [total, byStatus, byLocation] = await Promise.all([
      this.count(),
      this.count({
        attributes: ['status'],
        group: ['status'],
        raw: true
      }),
      this.count({
        attributes: ['state'],
        group: ['state'],
        raw: true
      })
    ]);
    
    const statusStats = {};
    byStatus.forEach(stat => {
      statusStats[stat.status] = stat.count;
    });
    
    const locationStats = {};
    byLocation.forEach(stat => {
      locationStats[stat.state] = stat.count;
    });
    
    return {
      total,
      byStatus: statusStats,
      byLocation: locationStats
    };
  };
  
  return Church;
};