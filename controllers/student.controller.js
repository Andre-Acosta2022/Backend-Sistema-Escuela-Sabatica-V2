/**
 * STUDENT.CONTROLLER.JS - Controlador de estudiantes bíblicos
 * Sistema de Gestión Misionera
 * 
 * Maneja CRUD completo de estudiantes bíblicos con seguimiento académico
 * Incluye gestión de programas de estudio, progreso académico y estadísticas
 */

const { Student, User, Group, Church, Semester } = require('../models');
const { Op, Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// =============================================================================
// CREAR NUEVO ESTUDIANTE BÍBLICO
// =============================================================================
const createStudent = async (req, res) => {
  try {
    const { 
      firstName, lastName, email, phone, birthDate, gender,
      address, city, country, occupation, educationLevel,
      studyProgram, enrollmentDate, expectedGraduation,
      previousKnowledge, studyGoals, notes, isActive 
    } = req.body;
    
    const { groupId } = req.params;

    // Verificar que el grupo existe
    const group = await Group.findByPk(groupId, {
      include: [{ model: Church }]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar permisos según rol
    if (req.userRole === 'leader') {
      if (group.leaderId !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes agregar estudiantes a tus propios grupos'
        });
      }
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes agregar estudiantes a grupos de tu iglesia'
        });
      }
    }

    // Verificar email único en el grupo
    if (email) {
      const existingStudent = await Student.findOne({
        where: { 
          groupId,
          email: email.toLowerCase(),
          isActive: true
        }
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un estudiante con este email en el grupo'
        });
      }
    }

    // Generar código de estudiante único
    const studentCode = await generateStudentCode(groupId);

    // Crear estudiante
    const student = await Student.create({
      groupId,
      studentCode,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email ? email.toLowerCase() : null,
      phone,
      birthDate,
      gender,
      address,
      city,
      country,
      occupation,
      educationLevel,
      studyProgram,
      enrollmentDate,
      expectedGraduation,
      previousKnowledge,
      studyGoals,
      notes,
      currentLevel: 1,
      completedLessons: 0,
      totalLessons: getDefaultTotalLessons(studyProgram),
      academicProgress: 0,
      isActive: isActive !== undefined ? isActive : true
    });

    // Obtener estudiante completo con relaciones
    const newStudent = await Student.findByPk(student.id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    logger.info(`Estudiante bíblico creado: ${student.firstName} ${student.lastName} en grupo ${group.name}`, {
      studentId: student.id,
      studentCode: student.studentCode,
      groupId,
      userId: req.userId
    });

    res.status(201).json({
      success: true,
      message: 'Estudiante bíblico creado exitosamente',
      data: newStudent
    });

  } catch (error) {
    logger.error('Error al crear estudiante bíblico:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// OBTENER TODOS LOS ESTUDIANTES DE UN GRUPO
// =============================================================================
const getStudentsByGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      isActive,
      studyProgram,
      academicStatus,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId, {
      include: [{ model: Church }]
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Verificar permisos
    if (req.userRole === 'leader' && group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes ver estudiantes de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes ver estudiantes de grupos de tu iglesia'
        });
      }
    }

    // Construir filtros
    const where = { groupId };

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { studentCode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (studyProgram) {
      where.studyProgram = studyProgram;
    }

    if (academicStatus) {
      switch (academicStatus) {
        case 'beginning':
          where.academicProgress = { [Op.lt]: 25 };
          break;
        case 'intermediate':
          where.academicProgress = { [Op.between]: [25, 75] };
          break;
        case 'advanced':
          where.academicProgress = { [Op.gt]: 75 };
          break;
        case 'graduated':
          where.academicProgress = 100;
          break;
      }
    }

    // Calcular offset
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Obtener estudiantes con paginación
    const { count, rows: students } = await Student.findAndCountAll({
      where,
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    res.json({
      success: true,
      message: 'Estudiantes obtenidos exitosamente',
      data: {
        students,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / parseInt(limit))
        },
        group: {
          id: group.id,
          name: group.name,
          church: group.Church.name
        }
      }
    });

  } catch (error) {
    logger.error('Error al obtener estudiantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// OBTENER ESTUDIANTE POR ID
// =============================================================================
const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findByPk(id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name', 'leaderId'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }, {
            model: User,
            as: 'Leader',
            attributes: ['id', 'firstName', 'lastName']
          }]
        }
      ]
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
        message: 'No tienes permisos para ver este estudiante'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (student.Group.Church.id !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para ver este estudiante'
        });
      }
    }

    res.json({
      success: true,
      message: 'Estudiante obtenido exitosamente',
      data: student
    });

  } catch (error) {
    logger.error('Error al obtener estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ACTUALIZAR ESTUDIANTE
// =============================================================================
const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Buscar estudiante
    const student = await Student.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
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
        message: 'Solo puedes editar estudiantes de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (student.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes editar estudiantes de grupos de tu iglesia'
        });
      }
    }

    // Verificar email único si se está actualizando
    if (updates.email && updates.email !== student.email) {
      const existingStudent = await Student.findOne({
        where: { 
          groupId: student.groupId,
          email: updates.email.toLowerCase(),
          isActive: true,
          id: { [Op.ne]: id }
        }
      });

      if (existingStudent) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un estudiante con este email en el grupo'
        });
      }
    }

    // Calcular progreso académico si se actualizan las lecciones
    if (updates.completedLessons !== undefined) {
      const totalLessons = updates.totalLessons || student.totalLessons;
      updates.academicProgress = Math.min(100, Math.round((updates.completedLessons / totalLessons) * 100));
    }

    // Limpiar y procesar updates
    if (updates.firstName) updates.firstName = updates.firstName.trim();
    if (updates.lastName) updates.lastName = updates.lastName.trim();
    if (updates.email) updates.email = updates.email.toLowerCase();

    // Actualizar estudiante
    await student.update(updates);

    // Obtener estudiante actualizado
    const updatedStudent = await Student.findByPk(id, {
      include: [
        {
          model: Group,
          attributes: ['id', 'name'],
          include: [{
            model: Church,
            attributes: ['id', 'name']
          }]
        }
      ]
    });

    logger.info(`Estudiante bíblico actualizado: ${student.firstName} ${student.lastName}`, {
      studentId: id,
      updates: Object.keys(updates),
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Estudiante actualizado exitosamente',
      data: updatedStudent
    });

  } catch (error) {
    logger.error('Error al actualizar estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ACTUALIZAR PROGRESO ACADÉMICO
// =============================================================================
const updateAcademicProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { completedLessons, currentLevel, notes } = req.body;

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

    // Verificar permisos (solo líderes y superiores pueden actualizar progreso)
    if (req.userRole === 'reader') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para actualizar el progreso académico'
      });
    }

    if (req.userRole === 'leader' && student.Group.leaderId !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Solo puedes actualizar el progreso de estudiantes de tus grupos'
      });
    }

    // Calcular nuevo progreso
    const newProgress = Math.min(100, Math.round((completedLessons / student.totalLessons) * 100));

    // Actualizar progreso
    await student.update({
      completedLessons,
      currentLevel: currentLevel || student.currentLevel,
      academicProgress: newProgress,
      notes: notes || student.notes,
      lastProgressUpdate: new Date()
    });

    logger.info(`Progreso académico actualizado: ${student.firstName} ${student.lastName} - ${newProgress}%`, {
      studentId: id,
      completedLessons,
      academicProgress: newProgress,
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Progreso académico actualizado exitosamente',
      data: {
        studentId: student.id,
        completedLessons: student.completedLessons,
        totalLessons: student.totalLessons,
        academicProgress: student.academicProgress,
        currentLevel: student.currentLevel
      }
    });

  } catch (error) {
    logger.error('Error al actualizar progreso académico:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ELIMINAR ESTUDIANTE
// =============================================================================
const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;

    // Buscar estudiante
    const student = await Student.findByPk(id, {
      include: [{
        model: Group,
        attributes: ['id', 'name', 'leaderId', 'churchId']
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
        message: 'Solo puedes eliminar estudiantes de tus propios grupos'
      });
    } else if (req.userRole === 'director') {
      const userChurch = await User.findByPk(req.userId, {
        attributes: ['churchId']
      });
      
      if (student.Group.churchId !== userChurch.churchId) {
        return res.status(403).json({
          success: false,
          message: 'Solo puedes eliminar estudiantes de grupos de tu iglesia'
        });
      }
    }

    if (permanent === 'true') {
      // Eliminación permanente (solo admin)
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden eliminar permanentemente'
        });
      }

      await student.destroy();

      logger.warn(`Estudiante bíblico eliminado permanentemente: ${student.firstName} ${student.lastName}`, {
        studentId: id,
        userId: req.userId
      });

      res.json({
        success: true,
        message: 'Estudiante eliminado permanentemente'
      });

    } else {
      // Eliminación lógica (desactivar)
      await student.update({ isActive: false });

      logger.info(`Estudiante bíblico desactivado: ${student.firstName} ${student.lastName}`, {
        studentId: id,
        userId: req.userId
      });

      res.json({
        success: true,
        message: 'Estudiante desactivado exitosamente'
      });
    }

  } catch (error) {
    logger.error('Error al eliminar estudiante:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// ESTADÍSTICAS DE ESTUDIANTES
// =============================================================================
const getStudentStats = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Verificar grupo y permisos
    const group = await Group.findByPk(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Grupo no encontrado'
      });
    }

    // Estadísticas básicas
    const totalStudents = await Student.count({
      where: { groupId, isActive: true }
    });

    const programStats = await Student.findAll({
      where: { groupId, isActive: true },
      attributes: [
        'studyProgram',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['studyProgram']
    });

    const progressStats = await Student.findAll({
      where: { groupId, isActive: true },
      attributes: [
        [Sequelize.literal(`
          CASE 
            WHEN academic_progress < 25 THEN 'Principiante'
            WHEN academic_progress < 75 THEN 'Intermedio'
            WHEN academic_progress < 100 THEN 'Avanzado'
            ELSE 'Graduado'
          END
        `), 'progressLevel'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: [Sequelize.literal('progress_level')],
      raw: true
    });

    const averageProgress = await Student.findOne({
      where: { groupId, isActive: true },
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('academicProgress')), 'avgProgress']
      ],
      raw: true
    });

    const recentEnrollments = await Student.findAll({
      where: { 
        groupId, 
        isActive: true,
        enrollmentDate: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      attributes: ['id', 'firstName', 'lastName', 'enrollmentDate', 'studyProgram'],
      order: [['enrollmentDate', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: {
        totalStudents,
        programDistribution: programStats,
        progressDistribution: progressStats,
        averageProgress: parseFloat(averageProgress.avgProgress || 0).toFixed(1),
        recentEnrollments
      }
    });

  } catch (error) {
    logger.error('Error al obtener estadísticas de estudiantes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================
const generateStudentCode = async (groupId) => {
  const group = await Group.findByPk(groupId, {
    include: [{ model: Church, attributes: ['code'] }]
  });
  
  const year = new Date().getFullYear();
  const churchCode = group.Church.code || 'IGX';
  const groupCode = group.code || 'G01';
  
  // Contar estudiantes existentes en el grupo este año
  const studentCount = await Student.count({
    where: {
      groupId,
      createdAt: {
        [Op.gte]: new Date(`${year}-01-01`),
        [Op.lt]: new Date(`${year + 1}-01-01`)
      }
    }
  });
  
  const sequence = String(studentCount + 1).padStart(3, '0');
  return `${churchCode}-${groupCode}-${year}-${sequence}`;
};

const getDefaultTotalLessons = (studyProgram) => {
  const programLessons = {
    'fundamentos_fe': 12,
    'discipulado_basico': 24,
    'liderazgo_cristiano': 36,
    'teologia_sistematica': 48,
    'ministerio_pastoral': 60,
    'misionologia': 30,
    'consejeria_biblica': 40
  };
  
  return programLessons[studyProgram] || 24;
};

// =============================================================================
// EXPORTAR FUNCIONES
// =============================================================================
module.exports = {
  createStudent,
  getStudentsByGroup,
  getStudentById,
  updateStudent,
  updateAcademicProgress,
  deleteStudent,
  getStudentStats
};