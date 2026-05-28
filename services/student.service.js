/**
 * STUDENT.SERVICE.JS - Lógica de Negocio Completa para Estudiantes
 * Sistema de Gestión Misionera
 */

const { Op, Sequelize } = require('sequelize');
const db = require('../models');
const { 
  NotFoundError, 
  AuthorizationError, 
  ValidationError, 
  ConflictError 
} = require('../middlewares/error.middleware');

const Student = db.Student; // Asegurar que apunte al modelo correcto de tu index
const Group = db.Group;
const Church = db.Church;
const User = db.User;

/**
 * Helper: Obtener el total de lecciones por defecto según el programa
 */
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

/**
 * Helper: Generar código de estudiante basado en la estructura original
 */
const generateStudentCode = async (groupId, transaction) => {
  const group = await Group.findByPk(groupId, {
    include: [{ model: Church, attributes: ['code'] }],
    transaction
  });
  
  const year = new Date().getFullYear();
  const churchCode = group?.Church?.code || 'IGX';
  const groupCode = group?.code || 'G01';
  
  const studentCount = await Student.count({
    where: {
      groupId,
      createdAt: {
        [Op.gte]: new Date(`${year}-01-01`),
        [Op.lt]: new Date(`${year + 1}-01-01`)
      }
    },
    lock: transaction.LOCK.UPDATE, // Evita condiciones de carrera
    transaction
  });
  
  const sequence = String(studentCount + 1).padStart(3, '0');
  return `${churchCode}-${groupCode}-${year}-${sequence}`;
};

/**
 * Helper: Validar del lado del servidor los ámbitos y jerarquías de seguridad
 */
const verifyStudentPermissions = async (user, groupId) => {
  const group = await Group.findByPk(groupId);
  if (!group) throw new NotFoundError('Grupo no encontrado', 'GROUP_NOT_FOUND');

  if (user.role === 'leader' && group.leaderId !== user.id) {
    throw new AuthorizationError('Solo puedes gestionar estudiantes en tus propios grupos', 'GROUP_ACCESS_DENIED');
  } 
  
  if (user.role === 'director' && group.churchId !== user.churchId) {
    throw new AuthorizationError('Solo puedes gestionar estudiantes en grupos de tu iglesia', 'CHURCH_ACCESS_DENIED');
  }
};

class StudentService {

  async createStudent(groupId, studentData, currentUser) {
    await verifyStudentPermissions(currentUser, groupId);

    if (studentData.email) {
      const existingStudent = await Student.findOne({
        where: { groupId, email: studentData.email.toLowerCase(), isActive: true }
      });
      if (existingStudent) {
        throw new ConflictError('Ya existe un estudiante con este email en el grupo', 'DUPLICATE_EMAIL');
      }
    }

    return await db.sequelize.transaction(async (t) => {
      const studentCode = await generateStudentCode(groupId, t);
      const totalLessons = studentData.totalLessons || getDefaultTotalLessons(studentData.studyProgram);

      const student = await Student.create({
        ...studentData,
        groupId,
        studentCode,
        firstName: studentData.firstName.trim(),
        lastName: studentData.lastName.trim(),
        email: studentData.email ? studentData.email.toLowerCase() : null,
        currentLevel: 1,
        completedLessons: 0,
        totalLessons,
        academicProgress: 0,
        isActive: studentData.isActive !== undefined ? studentData.isActive : true
      }, { transaction: t });

      return await Student.findByPk(student.id, {
        include: [{ model: Group, attributes: ['id', 'name'], include: [{ model: Church, attributes: ['id', 'name'] }] }],
        transaction: t
      });
    });
  }

  async getStudentsByGroup(groupId, query, currentUser) {
    await verifyStudentPermissions(currentUser, groupId);

    const { page = 1, limit = 10, search = '', isActive, studyProgram, academicStatus, sortBy = 'createdAt', sortOrder = 'DESC' } = query;
    const where = { groupId };

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { studentCode: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (studyProgram) where.studyProgram = studyProgram;

    if (academicStatus) {
      if (academicStatus === 'beginning') where.academicProgress = { [Op.lt]: 25 };
      else if (academicStatus === 'intermediate') where.academicProgress = { [Op.between]: [25, 75] };
      else if (academicStatus === 'advanced') where.academicProgress = { [Op.gt]: 75 };
      else if (academicStatus === 'graduated') where.academicProgress = 100;
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    return await Student.findAndCountAll({
      where,
      include: [{ model: Group, attributes: ['id', 'name'], include: [{ model: Church, attributes: ['id', 'name'] }] }],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });
  }

  async getStudentById(id, currentUser) {
    const student = await Student.findByPk(id, {
      include: [{ model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'], include: [{ model: Church, attributes: ['id', 'name'] }] }]
    });

    if (!student) throw new NotFoundError('Estudiante no encontrado', 'STUDENT_NOT_FOUND');
    await verifyStudentPermissions(currentUser, student.groupId);

    return student;
  }

  async updateStudent(id, updates, currentUser) {
    const student = await Student.findByPk(id);
    if (!student) throw new NotFoundError('Estudiante no encontrado', 'STUDENT_NOT_FOUND');
    
    await verifyStudentPermissions(currentUser, student.groupId);

    if (updates.email && updates.email.toLowerCase() !== student.email) {
      const existingStudent = await Student.findOne({
        where: { groupId: student.groupId, email: updates.email.toLowerCase(), isActive: true, id: { [Op.ne]: id } }
      });
      if (existingStudent) throw new ConflictError('Ya existe un estudiante con este email', 'DUPLICATE_EMAIL');
    }

    if (updates.completedLessons !== undefined) {
      const totalLessons = updates.totalLessons || student.totalLessons;
      updates.academicProgress = Math.min(100, Math.round((updates.completedLessons / totalLessons) * 100));
    }

    if (updates.firstName) updates.firstName = updates.firstName.trim();
    if (updates.lastName) updates.lastName = updates.lastName.trim();
    if (updates.email) updates.email = updates.email.toLowerCase();

    await student.update(updates);
    return this.getStudentById(id, currentUser);
  }

  async updateAcademicProgress(id, progressData, currentUser) {
    const student = await Student.findByPk(id);
    if (!student) throw new NotFoundError('Estudiante no encontrado', 'STUDENT_NOT_FOUND');
    
    if (currentUser.role === 'reader') {
      throw new AuthorizationError('No tienes permisos de escritura en el avance académico', 'WRITE_ACCESS_DENIED');
    }
    await verifyStudentPermissions(currentUser, student.groupId);

    const { completedLessons, currentLevel, notes } = progressData;
    const newProgress = Math.min(100, Math.round((completedLessons / student.totalLessons) * 100));

    await student.update({
      completedLessons: completedLessons !== undefined ? completedLessons : student.completedLessons,
      currentLevel: currentLevel || student.currentLevel,
      academicProgress: newProgress,
      notes: notes || student.notes,
      lastProgressUpdate: new Date()
    });

    return {
      studentId: student.id,
      completedLessons: student.completedLessons,
      totalLessons: student.totalLessons,
      academicProgress: student.academicProgress,
      currentLevel: student.currentLevel
    };
  }

  async deleteStudent(id, permanent, currentUser) {
    const student = await Student.findByPk(id);
    if (!student) throw new NotFoundError('Estudiante no encontrado', 'STUDENT_NOT_FOUND');
    
    await verifyStudentPermissions(currentUser, student.groupId);

    if (permanent === 'true') {
      if (currentUser.role !== 'admin') {
        throw new AuthorizationError('Solo administradores ejecutan eliminaciones físicas', 'ADMIN_REQUIRED');
      }
      await student.destroy();
      return { permanent: true };
    } else {
      await student.update({ isActive: false });
      return { permanent: false };
    }
  }

  async getStudentStats(groupId, currentUser) {
    await verifyStudentPermissions(currentUser, groupId);

    const totalStudents = await Student.count({ where: { groupId, isActive: true } });

    const programDistribution = await Student.findAll({
      where: { groupId, isActive: true },
      attributes: ['studyProgram', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      group: ['studyProgram']
    });

    const progressDistribution = await Student.findAll({
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
      attributes: [[Sequelize.fn('AVG', Sequelize.col('academicProgress')), 'avgProgress']],
      raw: true
    });

    const recentEnrollments = await Student.findAll({
      where: { 
        groupId, isActive: true,
        enrollmentDate: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      attributes: ['id', 'firstName', 'lastName', 'enrollmentDate', 'studyProgram'],
      order: [['enrollmentDate', 'DESC']],
      limit: 5
    });

    return {
      totalStudents,
      programDistribution,
      progressDistribution,
      averageProgress: parseFloat(averageProgress?.avgProgress || 0).toFixed(1),
      recentEnrollments
    };
  }
}

module.exports = new StudentService();