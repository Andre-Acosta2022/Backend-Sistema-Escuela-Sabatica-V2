/**
 * MEMBER.ROUTES.JS - Rutas para gestión de miembros
 * Sistema de Gestión Misionera
 * * Define todas las rutas API para operaciones CRUD de miembros
 * con validaciones, autenticación y control de permisos por rol
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const memberController = require('../controllers/member.controller');

// 1. Importar exactamente lo que exporta auth.middleware.js
const { 
  verifyToken, 
  isLeader, 
  isDirector, 
  isReader 
} = require('../middlewares/auth.middleware');

// 2. Importar exactamente lo que exporta validate.middleware.js
const { 
  validateMember
} = require('../middlewares/validate.middleware');

const router = express.Router();

// =============================================================================
// RATE LIMITING
// =============================================================================
const memberRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta nuevamente en 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const createMemberRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 creaciones por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas creaciones, intenta nuevamente en 5 minutos'
  }
});

// =============================================================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================================================
router.use(memberRateLimit);
router.use(verifyToken); // <- CORREGIDO

// =============================================================================
// RUTAS DE MIEMBROS POR GRUPO
// =============================================================================

/**
 * @route   POST /api/groups/:groupId/members
 * @desc    Crear nuevo miembro en un grupo
 * @access  Private (Leader+)
 * @params  groupId - ID del grupo
 * @body    Datos del miembro
 */
router.post(
  '/:groupId/members',
  [
    createMemberRateLimit,
    isLeader, // <- CORREGIDO
    validateMember // <- CORREGIDO
  ],
  memberController.createMember
);

/**
 * @route   GET /api/groups/:groupId/members
 * @desc    Obtener todos los miembros de un grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 * @query   page, limit, search, isActive, gender, maritalStatus, sortBy, sortOrder
 */
router.get(
  '/:groupId/members',
  [isReader], // <- CORREGIDO
  memberController.getMembersByGroup
);

/**
 * @route   GET /api/groups/:groupId/members/stats
 * @desc    Obtener estadísticas de miembros del grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 */
router.get(
  '/:groupId/members/stats',
  [isReader], // <- CORREGIDO
  memberController.getMemberStats
);

// =============================================================================
// RUTAS DE MIEMBROS INDIVIDUALES
// =============================================================================

/**
 * @route   GET /api/members/:id
 * @desc    Obtener miembro por ID
 * @access  Private (Reader+)
 * @params  id - ID del miembro
 */
router.get(
  '/members/:id',
  [isReader], // <- CORREGIDO
  memberController.getMemberById
);

/**
 * @route   PUT /api/members/:id
 * @desc    Actualizar miembro por ID
 * @access  Private (Leader+)
 * @params  id - ID del miembro
 * @body    Datos a actualizar
 */
router.put(
  '/members/:id',
  [
    isLeader, // <- CORREGIDO
    validateMember // <- CORREGIDO (usando validación base)
  ],
  memberController.updateMember
);

/**
 * @route   DELETE /api/members/:id
 * @desc    Eliminar/desactivar miembro
 * @access  Private (Leader+)
 * @params  id - ID del miembro
 * @query   permanent - true para eliminación permanente (solo admin)
 */
router.delete(
  '/members/:id',
  [isLeader], // <- CORREGIDO
  memberController.deleteMember
);

// =============================================================================
// RUTAS ADICIONALES PARA FUNCIONALIDADES AVANZADAS
// =============================================================================

/**
 * @route   POST /api/members/:id/activate
 * @desc    Reactivar miembro desactivado
 * @access  Private (Leader+)
 * @params  id - ID del miembro
 */
router.post(
  '/members/:id/activate',
  [isLeader], // <- CORREGIDO
  async (req, res) => {
    try {
      const { Member, Group, User } = require('../models');
      const { id } = req.params;

      // Buscar miembro
      const member = await Member.findByPk(id, {
        include: [{
          model: Group,
          attributes: ['id', 'leaderId', 'churchId', 'capacity']
        }]
      });

      if (!member) {
        return res.status(404).json({
          success: false,
          message: 'Miembro no encontrado'
        });
      }

      // Verificar permisos (similar al controlador principal)
      if (req.userRole === 'leader' && member.Group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes reactivar miembros de tus propios grupos'
        });
      }

      // Verificar capacidad del grupo
      const activeMembers = await Member.count({
        where: { groupId: member.groupId, isActive: true }
      });

      if (activeMembers >= member.Group.capacity) {
        return res.status(400).json({
          success: false,
          message: `El grupo ha alcanzado su capacidad máxima de ${member.Group.capacity} miembros`
        });
      }

      // Reactivar miembro
      await member.update({ isActive: true });

      res.json({
        success: true,
        message: 'Miembro reactivado exitosamente',
        data: member
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

/**
 * @route   GET /api/members/search
 * @desc    Búsqueda global de miembros (solo admin/director)
 * @access  Private (Director+)
 * @query   q - término de búsqueda
 * @query   groupId - filtrar por grupo
 * @query   churchId - filtrar por iglesia
 */
router.get(
  '/members/search',
  [isDirector], // <- CORREGIDO
  async (req, res) => {
    try {
      const { Member, Group, Church } = require('../models');
      const { Op } = require('sequelize');
      const { q, groupId, churchId, limit = 20 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres'
        });
      }

      const where = {
        isActive: true,
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${q}%` } },
          { lastName: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ]
      };

      const include = [{
        model: Group,
        attributes: ['id', 'name', 'churchId'],
        include: [{
          model: Church,
          attributes: ['id', 'name']
        }]
      }];

      // Filtros adicionales
      if (groupId) {
        where.groupId = groupId;
      }

      if (churchId) {
        include[0].where = { churchId };
      }

      // Para directores, filtrar por su iglesia
      if (req.userRole === 'director') {
        const { User } = require('../models');
        const userChurch = await User.findByPk(req.userId, {
          attributes: ['churchId']
        });
        include[0].where = { churchId: userChurch.churchId };
      }

      const members = await Member.findAll({
        where,
        include,
        limit: parseInt(limit),
        order: [['firstName', 'ASC'], ['lastName', 'ASC']]
      });

      res.json({
        success: true,
        message: 'Búsqueda completada',
        data: members
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
);

// =============================================================================
// EXPORTAR ROUTER
// =============================================================================
module.exports = router;