/**
 * SERVER.JS - Punto de entrada del servidor
 * Sistema de Gestión Misionera
 * 
 * Configuración inicial del servidor Express con:
 * - Carga de variables de entorno
 * - Conexión a base de datos
 * - Configuración de middleware global
 * - Inicialización del servidor HTTP
 */

require('dotenv').config();
const app = require('./app');
const db = require('./models');
const logger = require('./utils/logger');
const { createDefaultAdmin } = require('./seeders/admin-seeder');

// Puerto del servidor
const PORT = process.env.PORT || 5000;

/**
 * Función para inicializar la base de datos
 * Sincroniza modelos y ejecuta seeders necesarios
 */
async function initializeDatabase() {
  try {
    logger.info('🔄 Inicializando conexión a la base de datos...');
    
    // Verificar conexión
    await db.sequelize.authenticate();
    logger.info('✅ Conexión a PostgreSQL establecida correctamente');
    
    // Sincronizar modelos (crear tablas si no existen)
    await db.sequelize.sync({ 
      force: false, // No eliminar datos existentes
      alter: process.env.NODE_ENV === 'development' // Solo alterar en desarrollo
    });
    logger.info('✅ Modelos sincronizados con la base de datos');
    
    // Crear administrador por defecto si no existe
    await createDefaultAdmin();
    logger.info('✅ Administrador por defecto verificado');
    
  } catch (error) {
    logger.error('❌ Error al inicializar la base de datos:', error);
    throw error;
  }
}

/**
 * Función para iniciar el servidor
 */
async function startServer() {
  try {
    // Inicializar base de datos
    await initializeDatabase();
    
    // Iniciar servidor HTTP
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Servidor iniciado en puerto ${PORT}`);
      logger.info(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 URL base: http://localhost:${PORT}/api/v1`);
      logger.info(`💊 Health check: http://localhost:${PORT}/health`);
      
      // Log de configuración importante
      if (process.env.NODE_ENV === 'production') {
        logger.info('🔐 Modo producción activado');
      } else {
        logger.info('🔧 Modo desarrollo activado');
        logger.info(`🎯 Frontend CORS: ${process.env.FRONTEND_URL}`);
      }
    });
    
    // Configurar timeout del servidor
    server.timeout = 30000; // 30 segundos
    
    // Manejo graceful de cierre del servidor
    process.on('SIGTERM', () => {
      logger.info('🛑 SIGTERM recibido. Cerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('🛑 SIGINT recibido. Cerrando servidor...');
      server.close(() => {
        logger.info('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    });
    
    return server;
    
  } catch (error) {
    logger.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

/**
 * Manejo global de errores no capturados
 */
process.on('uncaughtException', (error) => {
  logger.error('💥 Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesa rechazada no manejada:', reason);
  logger.error('En la promesa:', promise);
  process.exit(1);
});

// Iniciar servidor
if (require.main === module) {
  startServer();
}

module.exports = startServer;