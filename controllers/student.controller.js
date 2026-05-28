/**
 * STUDENT.CONTROLLER.JS - Controlador Delgado de Estudiantes
 * Sistema de Gestión Misionera
 */

const studentService = require('../services/student.service');
const logger = require('../utils/logger');
const { catchAsync, sendSuccess, sendPaginatedSuccess } = require('../middlewares/error.middleware');

const createStudent = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const student = await studentService.createStudent(groupId, req.body, req.user);

  logger.info(`Estudiante bíblico creado exitosamente por ID: ${req.user.id}`, { groupId });
  return sendSuccess(res, student, 'Estudiante bíblico creado exitosamente', 201);
});

const getStudentsByGroup = catchAsync(async (req, res) => {
  const { groupId } = req.params;
  const { count, rows: students } = await studentService.getStudentsByGroup(groupId, req.query, req.user);

  return sendPaginatedSuccess(res, students, {
    currentPage: parseInt(req.query.page) || 1,
    totalItems: count,
    itemsPerPage: parseInt(req.query.limit) || 10,
    message: 'Estudiantes obtenidos exitosamente'
  });
});

const getStudentById = catchAsync(async (req, res) => {
  const student = await studentService.getStudentById(req.params.id, req.user);
  return sendSuccess(res, student, 'Estudiante obtenido exitosamente');
});

const updateStudent = catchAsync(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.body, req.user);
  logger.info(`Estudiante ID: ${req.params.id} modificado`, { userId: req.user.id });
  return sendSuccess(res, student, 'Estudiante actualizado exitosamente');
});

const updateAcademicProgress = catchAsync(async (req, res) => {
  const progress = await studentService.updateAcademicProgress(req.params.id, req.body, req.user);
  return sendSuccess(res, progress, 'Progreso académico actualizado exitosamente');
});

const deleteStudent = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { permanent = false } = req.query;
  
  const result = await studentService.deleteStudent(id, permanent, req.user);
  
  const msg = result.permanent ? 'Estudiante eliminado permanentemente' : 'Estudiante desactivado exitosamente';
  return sendSuccess(res, null, msg);
});

const getStudentStats = catchAsync(async (req, res) => {
  const stats = await studentService.getStudentStats(req.params.groupId, req.user);
  return sendSuccess(res, stats, 'Estadísticas obtenidas exitosamente');
});

module.exports = {
  createStudent,
  getStudentsByGroup,
  getStudentById,
  updateStudent,
  updateAcademicProgress,
  deleteStudent,
  getStudentStats
};