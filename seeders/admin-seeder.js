/**
 * ADMIN-SEEDER.JS - Creación automática de administrador
 * Sistema de Gestión Misionera
 * 
 * Crea el usuario administrador por defecto automáticamente
 * al inicializar la base de datos
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { defaultAdmin, roles } = require('../config/auth.config');
const logger = require('../utils/logger');

/**
 * Función principal para crear el administrador por defecto
 */
async function createDefaultAdmin() {
  try {
    // Importar el modelo de User (evitar importación circular)
    const { User } = require('../models');
    
    logger.info('🔍 Verificando existencia del administrador por defecto...');
    
    // Verificar si ya existe un administrador
    const existingAdmin = await User.findOne({
      where: {
        role: roles.ADMIN
      }
    });
    
    if (existingAdmin) {
      logger.info('✅ Administrador ya existe en el sistema');
      
      // Verificar si es el admin por defecto y actualizarlo si es necesario
      if (existingAdmin.email === defaultAdmin.email) {
        await updateDefaultAdminIfNeeded(existingAdmin);
      }
      
      return existingAdmin;
    }
    
    logger.info('👤 Creando administrador por defecto...');
    
    // Validar configuración del admin
    validateAdminConfig();
    
    // Crear el administrador por defecto
    const hashedPassword = await bcrypt.hash(
      defaultAdmin.password, 
      parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    );
    
    const adminUser = await User.create({
      id: uuidv4(),
      email: defaultAdmin.email,
      password: hashedPassword,
      firstName: defaultAdmin.firstName,
      lastName: defaultAdmin.lastName,
      phone: defaultAdmin.phone,
      role: defaultAdmin.role,
      churchId: null, // Admin no está asociado a una iglesia
      isActive: true,
      isApproved: true, // Admin se auto-aprueba
      createdBy: null, // Creado por el sistema
      lastLogin: null
    });
    
    // Log de seguridad
    logger.admin('ADMIN_CREATED', null, adminUser.id, {
      email: adminUser.email,
      createdAt: adminUser.createdAt,
      source: 'auto-seeder'
    });
    
    logger.info(`✅ Administrador creado exitosamente:`);
    logger.info(`📧 Email: ${adminUser.email}`);
    logger.info(`👤 Nombre: ${adminUser.firstName} ${adminUser.lastName}`);
    logger.info(`🆔 ID: ${adminUser.id}`);
    
    // En desarrollo, mostrar credenciales
    if (process.env.NODE_ENV === 'development') {
      logger.info(`🔑 Credenciales de acceso:`);
      logger.info(`   Email: ${defaultAdmin.email}`);
      logger.info(`   Contraseña: ${defaultAdmin.password}`);
    } else {
      logger.info(`🔐 Credenciales configuradas desde variables de entorno`);
    }
    
    return adminUser;
    
  } catch (error) {
    logger.error('❌ Error al crear el administrador por defecto:', error);
    
    // En producción, es crítico tener un admin
    if (process.env.NODE_ENV === 'production') {
      logger.error('🚨 CRÍTICO: No se pudo')
    }
}
}