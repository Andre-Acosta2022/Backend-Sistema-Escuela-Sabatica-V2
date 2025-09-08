/**
 * EMAIL.SERVICE.JS - Servicio de emails y notificaciones
 * Sistema de Gestión Misionera
 * 
 * Maneja el envío de emails para:
 * - Notificaciones de nuevos usuarios
 * - Reportes automáticos
 * - Alertas de sistema
 * - Confirmaciones de acciones importantes
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Configuración del transportador de email
let transporter;

const initializeEmailService = () => {
  try {
    // Configuración para diferentes proveedores
    if (process.env.EMAIL_PROVIDER === 'smtp') {
      transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
      transporter = nodemailer.createTransporter({
        service: 'SendGrid',
        auth: {
          user: 'apikey',
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else {
      // Gmail por defecto (para desarrollo)
      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }

    logger.info('Servicio de email inicializado correctamente');
  } catch (error) {
    logger.error('Error al inicializar servicio de email:', error);
  }
};

// =============================================================================
// TEMPLATES DE EMAIL
// =============================================================================

const emailTemplates = {
  // Template para nuevo usuario registrado
  newUserRegistration: (userData) => ({
    subject: '🎉 Nuevo usuario registrado - Sistema Misionero',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1>🎉 Nuevo Usuario Registrado</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>Detalles del Usuario:</h2>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Nombre:</strong> ${userData.firstName} ${userData.lastName}</li>
            <li><strong>Email:</strong> ${userData.email}</li>
            <li><strong>Teléfono:</strong> ${userData.phone || 'No proporcionado'}</li>
            <li><strong>Rol solicitado:</strong> ${userData.role}</li>
            <li><strong>Iglesia:</strong> ${userData.churchName}</li>
            <li><strong>Fecha de registro:</strong> ${new Date(userData.createdAt).toLocaleDateString('es-ES')}</li>
          </ul>
          
          <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <strong>⚠️ Acción requerida:</strong><br>
            Este usuario necesita aprobación de un administrador antes de poder acceder al sistema.
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/admin/users" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              🔍 Revisar Usuario
            </a>
          </div>
        </div>
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          Sistema de Gestión Misionera &copy; ${new Date().getFullYear()}
        </div>
      </div>
    `
  }),

  // Template para aprobación de usuario
  userApproval: (userData) => ({
    subject: '✅ Tu cuenta ha sido aprobada - Sistema Misionero',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1>✅ ¡Cuenta Aprobada!</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2>¡Hola ${userData.firstName}!</h2>
          <p>Nos complace informarte que tu cuenta ha sido aprobada y ya puedes acceder al Sistema de Gestión Misionera.</p>
          
          <div style="background-color: #d4edda; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3>📋 Detalles de tu cuenta:</h3>
            <ul>
              <li><strong>Email:</strong> ${userData.email}</li>
              <li><strong>Rol:</strong> ${userData.role}</li>
              <li><strong>Iglesia:</strong> ${userData.churchName}</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              🚀 Iniciar Sesión
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Si tienes alguna pregunta o necesitas ayuda, no dudes en contactar al administrador del sistema.
          </p>
        </div>
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          Sistema de Gestión Misionera &copy; ${new Date().getFullYear()}
        </div>
      </div>
    `
  }),

  // Template para reporte semanal automático
  weeklyReport: (reportData) => ({
    subject: `📊 Reporte Semanal - ${reportData.groupName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
          <h1>📊 Reporte Semanal</h1>
          <h2>${reportData.groupName}</h2>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h3>Resumen de la Semana (${reportData.weekStart} - ${reportData.weekEnd})</h3>
          
          <div style="display: flex; justify-content: space-between; margin: 20px 0;">
            <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; flex: 1; margin: 0 5px;">
              <h4 style="color: #4CAF50; margin: 0;">👥 Asistencia</h4>
              <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.attendance}</p>
            </div>
            <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; flex: 1; margin: 0 5px;">
              <h4 style="color: #FF9800; margin: 0;">👋 Visitantes</h4>
              <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.newVisitors}</p>
            </div>
            <div style="background-color: white; padding: 15px; border-radius: 8px; text-align: center; flex: 1; margin: 0 5px;">
              <h4 style="color: #9C27B0; margin: 0;">💝 Ofrendas</h4>
              <p style="font-size: 20px; font-weight: bold; margin: 5px 0;">$${reportData.offerings}</p>
            </div>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4>📈 Progreso Espiritual Promedio</h4>
            <div style="background-color: #e0e0e0; border-radius: 10px; height: 20px; overflow: hidden;">
              <div style="background-color: #4CAF50; height: 100%; width: ${(reportData.spiritualScore / 5) * 100}%; 
                          display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                ${reportData.spiritualScore}/5.0
              </div>
            </div>
          </div>
          
          ${reportData.highlights ? `
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4>⭐ Aspectos Destacados:</h4>
              <p>${reportData.highlights}</p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/groups/${reportData.groupId}" 
               style="background-color: #2196F3; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              📋 Ver Reporte Completo
            </a>
          </div>
        </div>
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          Sistema de Gestión Misionera &copy; ${new Date().getFullYear()}
        </div>
      </div>
    `
  }),

  // Template para alertas del sistema
  systemAlert: (alertData) => ({
    subject: `🚨 Alerta del Sistema - ${alertData.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f44336; color: white; padding: 20px; text-align: center;">
          <h1>🚨 Alerta del Sistema</h1>
        </div>
        <div style="padding: 20px; background-color: #f9f9f9;">
          <h2 style="color: #f44336;">${alertData.title}</h2>
          <p>${alertData.description}</p>
          
          <div style="background-color: #ffebee; padding: 15px; margin: 20px 0; border-radius: 5px; border-left: 5px solid #f44336;">
            <strong>Detalles:</strong><br>
            <ul>
              <li><strong>Tipo:</strong> ${alertData.type}</li>
              <li><strong>Severidad:</strong> ${alertData.severity}</li>
              <li><strong>Fecha:</strong> ${new Date(alertData.timestamp).toLocaleString('es-ES')}</li>
              ${alertData.affectedResource ? `<li><strong>Recurso afectado:</strong> ${alertData.affectedResource}</li>` : ''}
            </ul>
          </div>
          
          ${alertData.actionRequired ? `
            <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <strong>⚠️ Acción requerida:</strong><br>
              ${alertData.actionRequired}
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/admin/system" 
               style="background-color: #f44336; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              🔧 Ir al Panel de Administración
            </a>
          </div>
        </div>
        <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
          Sistema de Gestión Misionera &copy; ${new Date().getFullYear()}
        </div>
      </div>
    `
  })
};

// =============================================================================
// FUNCIONES DE ENVÍO DE EMAIL
// =============================================================================

// Función genérica para enviar emails
const sendEmail = async (to, template, templateData) => {
  try {
    if (!transporter) {
      logger.warn('Servicio de email no inicializado - simulando envío');
      return { success: true, simulated: true };
    }

    const emailContent = emailTemplates[template](templateData);
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'Sistema Misionero'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: emailContent.subject,
      html: emailContent.html
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email enviado exitosamente a ${to}`, {
      template,
      messageId: result.messageId
    });

    return {
      success: true,
      messageId: result.messageId
    };

  } catch (error) {
    logger.error('Error al enviar email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Notificar nuevo usuario a administradores
const notifyNewUser = async (userData, adminEmails) => {
  try {
    const results = await Promise.all(
      adminEmails.map(email => 
        sendEmail(email, 'newUserRegistration', userData)
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Notificación de nuevo usuario: ${successful} exitosos, ${failed} fallidos`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed
    };

  } catch (error) {
    logger.error('Error al notificar nuevo usuario:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Notificar aprobación de usuario
const notifyUserApproval = async (userData) => {
  try {
    const result = await sendEmail(userData.email, 'userApproval', userData);
    return result;

  } catch (error) {
    logger.error('Error al notificar aprobación:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Enviar reporte semanal automático
const sendWeeklyReport = async (reportData, recipientEmails) => {
  try {
    const results = await Promise.all(
      recipientEmails.map(email => 
        sendEmail(email, 'weeklyReport', reportData)
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Reporte semanal enviado: ${successful} exitosos, ${failed} fallidos`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed
    };

  } catch (error) {
    logger.error('Error al enviar reporte semanal:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Enviar alerta del sistema
const sendSystemAlert = async (alertData, adminEmails) => {
  try {
    const results = await Promise.all(
      adminEmails.map(email => 
        sendEmail(email, 'systemAlert', alertData)
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    logger.info(`Alerta del sistema enviada: ${successful} exitosos, ${failed} fallidos`);

    return {
      success: successful > 0,
      sent: successful,
      failed: failed
    };

  } catch (error) {
    logger.error('Error al enviar alerta del sistema:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Verificar configuración del servicio
const testEmailConfiguration = async () => {
  try {
    if (!transporter) {
      return {
        success: false,
        error: 'Servicio de email no inicializado'
      };
    }

    await transporter.verify();
    
    logger.info('Configuración de email verificada correctamente');
    return {
      success: true,
      message: 'Configuración de email verificada correctamente'
    };

  } catch (error) {
    logger.error('Error en configuración de email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// =============================================================================
// INICIALIZAR SERVICIO
// =============================================================================
initializeEmailService();

// =============================================================================
// EXPORTAR FUNCIONES
// =============================================================================
module.exports = {
  sendEmail,
  notifyNewUser,
  notifyUserApproval,
  sendWeeklyReport,
  sendSystemAlert,
  testEmailConfiguration
};