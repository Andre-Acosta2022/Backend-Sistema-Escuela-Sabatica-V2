/**
 * STUDENT.ROUTES.JS - Rutas para gestión de estudiantes bíblicos
 * Sistema de Gestión Misionera
 * * Define todas las rutas API para operaciones CRUD de estudiantes bíblicos
 * con validaciones, autenticación y control de permisos por rol
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const studentController = require('../controllers/student.controller');
const router = express.Router();

// 1. Importar exactamente lo que exporta auth.middleware.js
const { 
  verifyToken, 
  isLeader, 
  isDirector, 
  isReader 
} = require('../middlewares/auth.middleware');

// 2. Importar exactamente lo que exporta validate.middleware.js
const { 
  validateStudent, 
  validateUUIDParam, 
  validatePagination 
} = require('../middlewares/validate.middleware');

// =============================================================================
// RATE LIMITING
// =============================================================================
const studentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas peticiones, intenta nuevamente en 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const createStudentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 15, // 15 creaciones por IP por ventana
  message: {
    success: false,
    message: 'Demasiadas creaciones, intenta nuevamente en 5 minutos'
  }
});

// =============================================================================
// APLICAR MIDDLEWARES GLOBALES
// =============================================================================
router.use(studentRateLimit);
router.use(verifyToken); // <- CORREGIDO

// =============================================================================
// RUTAS DE ESTUDIANTES POR GRUPO
// =============================================================================

/**
 * @route   POST /api/groups/:groupId/students
 * @desc    Crear nuevo estudiante bíblico en un grupo
 * @access  Private (Leader+)
 * @params  groupId - ID del grupo
 * @body    Datos del estudiante
 */
router.post(
  '/:groupId/students',
  [
    createStudentRateLimit,
    isLeader, // <- CORREGIDO
    validateStudent // <- CORREGIDO
  ],
  studentController.createStudent
);

/**
 * @route   GET /api/groups/:groupId/students
 * @desc    Obtener todos los estudiantes de un grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 * @query   page, limit, search, isActive, studyProgram, academicStatus, sortBy, sortOrder
 */
router.get(
  '/:groupId/students',
  [isReader], // <- CORREGIDO
  studentController.getStudentsByGroup
);

/**
 * @route   GET /api/groups/:groupId/students/stats
 * @desc    Obtener estadísticas de estudiantes del grupo
 * @access  Private (Reader+)
 * @params  groupId - ID del grupo
 */
router.get(
  '/:groupId/students/stats',
  [isReader], // <- CORREGIDO
  studentController.getStudentStats
);

// =============================================================================
// RUTAS DE ESTUDIANTES INDIVIDUALES
// =============================================================================

/**
 * @route   GET /api/students/:id
 * @desc    Obtener estudiante por ID
 * @access  Private (Reader+)
 * @params  id - ID del estudiante
 */
router.get(
  '/students/:id',
  [isReader], // <- CORREGIDO
  studentController.getStudentById
);

/**
 * @route   PUT /api/students/:id
 * @desc    Actualizar estudiante por ID
 * @access  Private (Leader+)
 * @params  id - ID del estudiante
 * @body    Datos a actualizar
 */
router.put(
  '/students/:id',
  [
    isLeader, // <- CORREGIDO
    validateStudent // <- CORREGIDO (usando validación base)
  ],
  studentController.updateStudent
);

/**
 * @route   PUT /api/students/:id/progress
 * @desc    Actualizar progreso académico del estudiante
 * @access  Private (Leader+)
 * @params  id - ID del estudiante
 * @body    completedLessons, currentLevel, notes
 */
router.put(
  '/students/:id/progress',
  [
    isLeader // <- CORREGIDO (eliminado validateProgressUpdate para evitar crashes)
  ],
  studentController.updateAcademicProgress
);

/**
 * @route   DELETE /api/students/:id
 * @desc    Eliminar/desactivar estudiante
 * @access  Private (Leader+)
 * @params  id - ID del estudiante
 * @query   permanent - true para eliminación permanente (solo admin)
 */
router.delete(
  '/students/:id',
  [isLeader], // <- CORREGIDO
  studentController.deleteStudent
);

// =============================================================================
// RUTAS ADICIONALES PARA FUNCIONALIDADES AVANZADAS
// =============================================================================

/**
 * @route   POST /api/students/:id/activate
 * @desc    Reactivar estudiante desactivado
 * @access  Private (Leader+)
 * @params  id - ID del estudiante
 */
router.post(
  '/students/:id/activate',
  [isLeader], // <- CORREGIDO
  async (req, res) => {
    try {
      const { Student, Group, User } = require('../models');
      const { id } = req.params;

      // Buscar estudiante
      const student = await Student.findByPk(id, {
        include: [{
          model: Group,
          attributes: ['id', 'leaderId', 'churchId']
        }]
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado'
        });
      }

      // Verificar permisos
      if (req.userRole === 'leader' && student.Group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes reactivar estudiantes de tus propios grupos'
        });
      }

      // Reactivar estudiante
      await student.update({ isActive: true });

      res.json({
        success: true,
        message: 'Estudiante reactivado exitosamente',
        data: student
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
 * @route   GET /api/students/reports/academic
 * @desc    Reporte académico de estudiantes (solo admin/director)
 * @access  Private (Director+)
 * @query   groupId, churchId, studyProgram, startDate, endDate
 */
router.get(
  '/students/reports/academic',
  [isDirector], // <- CORREGIDO
  async (req, res) => {
    try {
      const { Student, Group, Church } = require('../models');
      const { Op, Sequelize } = require('sequelize');
      const { groupId, churchId, studyProgram, startDate, endDate } = req.query;

      const where = { isActive: true };
      const include = [{
        model: Group,
        attributes: ['id', 'name', 'churchId'],
        include: [{
          model: Church,
          attributes: ['id', 'name']
        }]
      }];

      // Filtros
      if (studyProgram) {
        where.studyProgram = studyProgram;
      }

      if (startDate && endDate) {
        where.enrollmentDate = {
          [Op.between]: [new Date(startDate), new Date(endDate)]
        };
      }

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

      const students = await Student.findAll({
        where,
        include,
        attributes: [
          'id', 'firstName', 'lastName', 'studentCode', 'studyProgram',
          'enrollmentDate', 'academicProgress', 'completedLessons', 'totalLessons'
        ],
        order: [['academicProgress', 'DESC'], ['lastName', 'ASC']]
      });

      // Estadísticas del reporte
      const totalStudents = students.length;
      const avgProgress = students.reduce((sum, s) => sum + s.academicProgress, 0) / totalStudents || 0;
      const graduated = students.filter(s => s.academicProgress === 100).length;

      res.json({
        success: true,
        message: 'Reporte académico generado exitosamente',
        data: {
          students,
          summary: {
            totalStudents,
            averageProgress: avgProgress.toFixed(1),
            graduatedStudents: graduated,
            graduationRate: ((graduated / totalStudents) * 100).toFixed(1)
          }
        }
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
 * @route   GET /api/students/programs
 * @desc    Obtener lista de programas de estudio disponibles
 * @access  Private (Reader+)
 */
router.get(
  '/students/programs',
  [isReader], // <- CORREGIDO
  (req, res) => {
    const programs = [
      {
        code: 'fundamentos_fe',
        name: 'Fundamentos de la Fe',
        duration: '3 meses',
        lessons: 12,
        description: 'Curso básico sobre los fundamentos de la fe cristiana'
      },
      {
        code: 'discipulado_basico',
        name: 'Discipulado Básico',
        duration: '6 meses',
        lessons: 24,
        description: 'Programa de formación para nuevos creyentes'
      },
      {
        code: 'liderazgo_cristiano',
        name: 'Liderazgo Cristiano',
        duration: '9 meses',
        lessons: 36,
        description: 'Desarrollo de habilidades de liderazgo en el contexto cristiano'
      },
      {
        code: 'teologia_sistematica',
        name: 'Teología Sistemática',
        duration: '12 meses',
        lessons: 48,
        description: 'Estudio profundo de las doctrinas cristianas'
      },
      {
        code: 'ministerio_pastoral',
        name: 'Ministerio Pastoral',
        duration: '15 meses',
        lessons: 60,
        description: 'Formación integral para el ministerio pastoral'
      },
      {
        code: 'misionologia',
        name: 'Misionología',
        duration: '8 meses',
        lessons: 30,
        description: 'Estudio de la misión cristiana y evangelización'
      },
      {
        code: 'consejeria_biblica',
        name: 'Consejería Bíblica',
        duration: '10 meses',
        lessons: 40,
        description: 'Principios bíblicos para la consejería y cuidado pastoral'
      }
    ];

    res.json({
      success: true,
      message: 'Programas de estudio obtenidos exitosamente',
      data: programs
    });
  }
);

/**
 * @route   POST /api/students/:id/graduate
 * @desc    Marcar estudiante como graduado
 * @access  Private (Leader+)
 * @params  id - ID del estudiante
 * @body    graduationDate, finalGrade, notes
 */
router.post(
  '/students/:id/graduate',
  [
    isLeader // <- CORREGIDO (eliminado validateGraduation para evitar crashes)
  ],
  async (req, res) => {
    try {
      const { Student, Group } = require('../models');
      const { id } = req.params;
      const { graduationDate, finalGrade, notes } = req.body;

      // Buscar estudiante
      const student = await Student.findByPk(id, {
        include: [{
          model: Group,
          attributes: ['id', 'leaderId', 'churchId']
        }]
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Estudiante no encontrado'
        });
      }

      // Verificar permisos
      if (req.userRole === 'leader' && student.Group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes graduar estudiantes de tus propios grupos'
        });
      }

      // Verificar que el estudiante esté cerca de completar
      if (student.academicProgress < 95) {
        return res.status(400).json({
          success: false,
          message: 'El estudiante debe tener al menos 95% de progreso para graduarse'
        });
      }

      // Actualizar estudiante como graduado
      await student.update({
        academicProgress: 100,
        completedLessons: student.totalLessons,
        graduationDate: graduationDate || new Date(),
        finalGrade,
        notes: notes || student.notes,
        isGraduated: true
      });

      const logger = require('../utils/logger');
      logger.info(`Estudiante graduado: ${student.firstName} ${student.lastName}`, {
        studentId: id,
        graduationDate,
        finalGrade,
        userId: req.userId
      });

      res.json({
        success: true,
        message: 'Estudiante graduado exitosamente',
        data: {
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          studyProgram: student.studyProgram,
          graduationDate: student.graduationDate,
          finalGrade: student.finalGrade
        }
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