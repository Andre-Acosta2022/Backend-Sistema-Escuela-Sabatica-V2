/**
 * SERVER.JS - Punto de entrada del servidor
 * Sistema de Gestión Misionera
 */

require('dotenv').config();
const app = require('./app');
const db = require('./models');
const logger = require('./utils/logger');

// En Render, process.env.PORT se asigna dinámicamente. 0.0.0.0 es necesario para contenedores.
const PORT = process.env.PORT || 5000;

/**
 * Función para inicializar la base de datos
 */
async function initializeDatabase() {
  try {
    logger.info('🔄 Inicializando conexión a la base de datos...');
    
    // Verificar conexión
    await db.sequelize.authenticate();
    logger.info('✅ Conexión a PostgreSQL establecida correctamente');
    
    // Sincronizar modelos sin alterar datos en producción
    await db.sequelize.sync({ 
      force: false, 
      alter: process.env.NODE_ENV === 'development' 
    });
    logger.info('✅ Modelos sincronizados con la base de datos');
    
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
    // Inicializar base de datos primero
    await initializeDatabase();
    
    // Iniciar servidor HTTP escuchando en todas las interfaces para Render
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Servidor iniciado exitosamente`);
      logger.info(`🌐 Entorno activo: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 Puerto asignado: ${PORT}`);
    });
    
    server.timeout = 30000; // 30 segundos
    
    // Manejo correcto de apagado (Graceful shutdown)
    const shutdown = (signal) => {
      logger.info(`🛑 Señal ${signal} recibida. Cerrando servidor de forma segura...`);
      server.close(() => {
        logger.info('✅ Servidor HTTP cerrado de forma limpia');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    return server;
    
  } catch (error) {
    logger.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

/**
 * Manejo global de excepciones para evitar caídas silenciosas
 */
process.on('uncaughtException', (error) => {
  logger.error('💥 Excepción crítica no capturada:', error.message);
  logger.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Promesa rechazada no controlada:', reason);
  process.exit(1);
});

// Arrancar la aplicación
if (require.main === module) {
  startServer();
}

module.exports = startServer;