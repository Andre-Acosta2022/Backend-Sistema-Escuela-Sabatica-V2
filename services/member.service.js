/**
 * MEMBER.SERVICE.JS - Servicio de Gestión de Miembros
 * Sistema de Gestión Misionera
 */
const { Op, Sequelize } = require('sequelize');
const { Member, Group, Church, User, Indicator, Semester } = require('../models');
const { NotFoundError, BadRequestError } = require('../middlewares/error.middleware');

class MemberService {
  
  async create(groupId, data) {
    const group = await Group.findByPk(groupId);
    if (!group) throw new NotFoundError('Grupo');

    // Verificar capacidad en tiempo real
    const currentMembers = await Member.count({ where: { groupId, isActive: true } });
    if (currentMembers >= group.capacity) {
      throw new BadRequestError(`El grupo alcanzó su capacidad máxima de ${group.capacity} miembros`);
    }

    // Verificar duplicidad de correo electrónico activo en el grupo
    if (data.email) {
      const existingMember = await Member.findOne({
        where: { groupId, email: data.email.toLowerCase(), isActive: true }
      });
      if (existingMember) throw new BadRequestError('Ya existe un miembro con este email en el grupo');
    }

    const member = await Member.create({
      ...data,
      groupId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email ? data.email.toLowerCase().trim() : null
    });

    return this.getById(member.id);
  }

  async getByGroup(groupId, filters) {
    const { page = 1, limit = 10, search = '', isActive, gender, maritalStatus, sortBy = 'createdAt', sortOrder = 'DESC' } = filters;
    
    const where = { groupId };

    if (search) {
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (gender) where.gender = gender;
    if (maritalStatus) where.maritalStatus = maritalStatus;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: members } = await Member.findAndCountAll({
      where,
      include: [
        { model: Group, attributes: ['id', 'name'], include: [{ model: Church, attributes: ['id', 'name'] }] },
        { 
          model: Indicator, 
          attributes: ['id', 'type', 'value', 'createdAt'],
          include: [{ model: Semester, attributes: ['id', 'name'] }],
          separate: true,
          limit: 5,
          order: [['createdAt', 'DESC']]
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      distinct: true
    });

    return {
      members,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    };
  }

  async getById(id) {
    const member = await Member.findByPk(id, {
      include: [
        { model: Group, attributes: ['id', 'name', 'leaderId', 'churchId'], include: [{ model: Church, attributes: ['id', 'name'] }] },
        { model: Indicator, include: [{ model: Semester, attributes: ['id', 'name'] }] }
      ],
      order: [[Indicator, 'createdAt', 'DESC']]
    });
    if (!member) throw new NotFoundError('Miembro');
    return member;
  }

  async update(id, updates) {
    const member = await this.getById(id);

    if (updates.email && updates.email.toLowerCase() !== member.email) {
      const existingMember = await Member.findOne({
        where: { groupId: member.groupId, email: updates.email.toLowerCase(), isActive: true, id: { [Op.ne]: id } }
      });
      if (existingMember) throw new BadRequestError('Ya existe un miembro con este email en el grupo');
    }

    // Sanitizar strings mutables de forma segura
    const payload = { ...updates };
    if (payload.firstName !== undefined) payload.firstName = payload.firstName.trim();
    if (payload.lastName !== undefined) payload.lastName = payload.lastName.trim();
    if (payload.email !== undefined) payload.email = payload.email.toLowerCase().trim();

    await member.update(payload);
    return this.getById(id);
  }

  async delete(id, isPermanent) {
    const member = await this.getById(id);

    if (isPermanent) {
      await Indicator.destroy({ where: { memberId: id } });
      await member.destroy();
      return { permanent: true };
    } else {
      await member.update({ isActive: false });
      return { permanent: false };
    }
  }

  async getStats(groupId) {
    const group = await Group.findByPk(groupId, { attributes: ['capacity'] });
    if (!group) throw new NotFoundError('Grupo');

    // Construcción de consulta de rangos de edad segura y portable (agrupada por la función idéntica)
    const ageGroupExpression = Sequelize.literal(`
      CASE 
        WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 18 THEN 'Menores (0-17)'
        WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 30 THEN 'Jóvenes (18-29)'
        WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 50 THEN 'Adultos (30-49)'
        WHEN EXTRACT(YEAR FROM AGE(birth_date)) < 65 THEN 'Adultos Mayores (50-64)'
        ELSE 'Ancianos (65+)'
      END
    `);

    const [totalMembers, genderStats, maritalStats, ageGroups, recentMembers] = await Promise.all([
      Member.count({ where: { groupId, isActive: true } }),
      Member.findAll({ where: { groupId, isActive: true }, attributes: ['gender', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']], group: ['gender'], raw: true }),
      Member.findAll({ where: { groupId, isActive: true }, attributes: ['maritalStatus', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']], group: ['maritalStatus'], raw: true }),
      Member.findAll({ 
        where: { groupId, isActive: true, birthDate: { [Op.ne]: null } }, 
        attributes: [[ageGroupExpression, 'ageGroup'], [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']], 
        group: [ageGroupExpression], // Corregido: Agrupación por expresión literal completa, no por alias dinámico
        raw: true 
      }),
      Member.findAll({
        where: { groupId, isActive: true, membershipDate: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        attributes: ['id', 'firstName', 'lastName', 'membershipDate'],
        order: [['membershipDate', 'DESC']],
        limit: 5,
        raw: true
      })
    ]);

    return {
      totalMembers,
      capacity: group.capacity,
      occupancyRate: group.capacity > 0 ? ((totalMembers / group.capacity) * 100).toFixed(1) : '0.0',
      genderDistribution: genderStats.reduce((acc, item) => { acc[item.gender || 'No especificado'] = parseInt(item.count); return acc; }, {}),
      maritalDistribution: maritalStats.reduce((acc, item) => { acc[item.maritalStatus || 'No especificado'] = parseInt(item.count); return acc; }, {}),
      ageDistribution: ageGroups.reduce((acc, item) => { acc[item.ageGroup] = parseInt(item.count); return acc; }, {}),
      recentMembers
    };
  }
}

module.exports = new MemberService();