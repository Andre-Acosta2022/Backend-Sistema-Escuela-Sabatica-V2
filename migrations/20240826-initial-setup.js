/**
 * INITIAL-SETUP.JS - Migraciones iniciales de la base de datos
 * Sistema de Gestión Misionera
 * 
 * Crea todas las tablas y relaciones necesarias para el sistema
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // =============================================
      // 1. TABLA DE IGLESIAS
      // =============================================
      await queryInterface.createTable('Churches', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        city: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        state: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        country: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: 'Perú'
        },
        zipCode: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        latitude: {
          type: Sequelize.DECIMAL(10, 8),
          allowNull: true
        },
        longitude: {
          type: Sequelize.DECIMAL(11, 8),
          allowNull: true
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: true,
          unique: true
        },
        website: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        socialMedia: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {}
        },
        pastor: {
          type: Sequelize.STRING(200),
          allowNull: true
        },
        pastorPhone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        pastorEmail: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        capacity: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        facilities: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {
            parking: false,
            accessibility: false,
            audioVideo: false,
            kitchen: false,
            nursery: false,
            library: false,
            gymnasium: false,
            outdoorSpace: false
          }
        },
        services: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {
            sunday: {
              morning: { time: '09:00', active: true },
              evening: { time: '18:00', active: false }
            },
            wednesday: {
              evening: { time: '19:00', active: true }
            },
            friday: {
              evening: { time: '19:00', active: false }
            }
          }
        },
        status: {
          type: Sequelize.ENUM('active', 'construction', 'planning', 'inactive'),
          allowNull: false,
          defaultValue: 'active'
        },
        foundedDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        updatedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 2. TABLA DE USUARIOS
      // =============================================
      await queryInterface.createTable('Users', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        password: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        firstName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        lastName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        role: {
          type: Sequelize.ENUM('admin', 'director', 'leader', 'reader'),
          allowNull: false,
          defaultValue: 'reader'
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        profileImage: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        churchId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Churches',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        isApproved: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        lastLogin: {
          type: Sequelize.DATE,
          allowNull: true
        },
        lastLoginIp: {
          type: Sequelize.STRING(45),
          allowNull: true
        },
        loginAttempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        lockedUntil: {
          type: Sequelize.DATE,
          allowNull: true
        },
        resetPasswordToken: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        resetPasswordExpiry: {
          type: Sequelize.DATE,
          allowNull: true
        },
        passwordChangedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        approvedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        approvedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        rejectionReason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        updatedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        deletedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 3. TABLA DE SEMESTRES
      // =============================================
      await queryInterface.createTable('Semesters', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        year: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        period: {
          type: Sequelize.ENUM('first', 'second', 'third', 'fourth', 'annual'),
          allowNull: false,
          defaultValue: 'first'
        },
        startDate: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        endDate: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        isCurrent: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // =============================================
      // 4. TABLA DE GRUPOS
      // =============================================
      await queryInterface.createTable('Groups', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        name: {
          type: Sequelize.STRING(200),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        churchId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Churches',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        leaderId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        },
        type: {
          type: Sequelize.ENUM(
            'youth', 'adults', 'children', 'seniors', 'couples', 
            'singles', 'women', 'men', 'students', 'professionals', 'mixed'
          ),
          allowNull: false,
          defaultValue: 'mixed'
        },
        category: {
          type: Sequelize.ENUM(
            'bible_study', 'prayer', 'evangelism', 'discipleship', 
            'worship', 'service', 'fellowship', 'training', 'mission'
          ),
          allowNull: false,
          defaultValue: 'bible_study'
        },
        meetingDay: {
          type: Sequelize.ENUM(
            'monday', 'tuesday', 'wednesday', 'thursday', 
            'friday', 'saturday', 'sunday'
          ),
          allowNull: false
        },
        meetingTime: {
          type: Sequelize.TIME,
          allowNull: false
        },
        meetingDuration: {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 90
        },
        meetingLocation: {
          type: Sequelize.STRING(255),
          allowNull: true
        },
        maxCapacity: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        currentSize: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        status: {
          type: Sequelize.ENUM('planning', 'active', 'paused', 'completed', 'cancelled'),
          allowNull: false,
          defaultValue: 'planning'
        },
        startDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        endDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        isOpenToNewMembers: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        requiresApproval: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        resources: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: {}
        },
        goals: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: []
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        updatedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        deletedBy: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 5. TABLA DE MIEMBROS
      // =============================================
      await queryInterface.createTable('Members', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        firstName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        lastName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(150),
          allowNull: true,
          unique: true
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        dateOfBirth: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        gender: {
          type: Sequelize.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
          allowNull: true
        },
        maritalStatus: {
          type: Sequelize.ENUM('single', 'married', 'divorced', 'widowed', 'other'),
          allowNull: true
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        city: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        district: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        groupId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Groups',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        baptized: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        baptismDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        conversionDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        spiritualStatus: {
          type: Sequelize.ENUM(
            'new_believer', 'growing', 'mature', 'leader', 
            'teacher', 'visitor', 'inactive', 'other'
          ),
          allowNull: false,
          defaultValue: 'visitor'
        },
        joinDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        status: {
          type: Sequelize.ENUM('active', 'inactive', 'suspended', 'transferred', 'graduated'),
          allowNull: false,
          defaultValue: 'active'
        },
        attendanceScore: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        occupation: {
          type: Sequelize.STRING(150),
          allowNull: true
        },
        education: {
          type: Sequelize.ENUM(
            'elementary', 'high_school', 'technical', 'university', 
            'graduate', 'other', 'not_specified'
          ),
          allowNull: true
        },
        emergencyContact: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        tags: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: true,
          defaultValue: []
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 6. TABLA DE ESTUDIANTES BÍBLICOS
      // =============================================
      await queryInterface.createTable('Students', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        firstName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        lastName: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        email: {
          type: Sequelize.STRING(150),
          allowNull: true
        },
        phone: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        dateOfBirth: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        gender: {
          type: Sequelize.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
          allowNull: true
        },
        address: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        city: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        district: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        groupId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Groups',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        teacherId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        enrollmentDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        program: {
          type: Sequelize.ENUM(
            'basic_bible', 'intermediate_bible', 'advanced_bible', 'theology',
            'discipleship', 'leadership', 'missions', 'evangelism', 'counseling',
            'worship', 'children_ministry', 'youth_ministry', 'other'
          ),
          allowNull: false,
          defaultValue: 'basic_bible'
        },
        level: {
          type: Sequelize.ENUM('beginner', 'intermediate', 'advanced', 'graduate'),
          allowNull: false,
          defaultValue: 'beginner'
        },
        semester: {
          type: Sequelize.STRING(20),
          allowNull: true
        },
        currentGrade: {
          type: Sequelize.DECIMAL(4, 2),
          allowNull: true
        },
        attendancePercentage: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        completedLessons: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        totalLessons: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('enrolled', 'active', 'completed', 'dropped', 'suspended', 'graduated'),
          allowNull: false,
          defaultValue: 'enrolled'
        },
        graduationDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        certificateIssued: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        certificateNumber: {
          type: Sequelize.STRING(50),
          allowNull: true,
          unique: true
        },
        isBeliever: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        baptized: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        baptismDate: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        churchMember: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        previousStudy: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        motivationForStudy: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        careerGoals: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        ministryInterest: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: true,
          defaultValue: []
        },
        emergencyContact: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        tags: {
          type: Sequelize.ARRAY(Sequelize.STRING),
          allowNull: true,
          defaultValue: []
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 7. TABLA DE MÉTRICAS
      // =============================================
      await queryInterface.createTable('Metrics', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        groupId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Groups',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        semesterId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Semesters',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        periodType: {
          type: Sequelize.ENUM('weekly', 'monthly', 'quarterly', 'semester', 'annual'),
          allowNull: false,
          defaultValue: 'monthly'
        },
        periodStart: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        periodEnd: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        totalMeetings: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        averageAttendance: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        maxAttendance: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        minAttendance: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        newMembers: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        leftMembers: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        netGrowth: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        totalMembersStart: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        totalMembersEnd: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        newConversions: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        baptisms: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        decisionsForChrist: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        newStudents: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        graduatedStudents: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        activeStudents: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        evangelisticEvents: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        communityServices: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        specialMeetings: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        offerings: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        tithes: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        specialOfferings: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true
        },
        attendanceGoal: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        membershipGoal: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        evangelismGoal: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        studentsGoal: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        challenges: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        achievements: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.ENUM('draft', 'pending', 'approved', 'rejected'),
          allowNull: false,
          defaultValue: 'draft'
        },
        approvedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          }
        },
        approvedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        rejectionReason: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdBy: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id'
          }
        },
        updatedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id'
          }
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      }, { transaction });

      // =============================================
      // 8. TABLA DE INDICADORES ESPIRITUALES
      // =============================================
      await queryInterface.createTable('SpiritualIndicators', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        memberId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'Members',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        semesterId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'Semesters',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        attendancePercentage: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        bibleReadingDays: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        prayerFrequency: {
          type: Sequelize.ENUM('never', 'rarely', 'sometimes', 'often', 'daily'),
          allowNull: false,
          defaultValue: 'sometimes'
        },
        volunteering: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        evangelism: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        discipleship: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        spiritualGrowthLevel: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        evaluationDate: {
          type: Sequelize.DATEONLY,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // =============================================
      // CREAR ÍNDICES ÚNICOS Y DE RENDIMIENTO
      // =============================================
      
      // Índices para Churches
      await queryInterface.addIndex('Churches', ['name', 'city'], { 
        name: 'idx_churches_name_city',
        unique: true, 
        transaction 
      });
      await queryInterface.addIndex('Churches', ['email'], { 
        name: 'idx_churches_email',
        unique: true,
        where: { email: { [Sequelize.Op.ne]: null } },
        transaction 
      });
      await queryInterface.addIndex('Churches', ['status'], { transaction });

      // Índices para Users
      await queryInterface.addIndex('Users', ['email'], { 
        name: 'idx_users_email',
        unique: true, 
        transaction 
      });
      await queryInterface.addIndex('Users', ['role'], { transaction });
      await queryInterface.addIndex('Users', ['churchId'], { transaction });
      await queryInterface.addIndex('Users', ['isActive', 'isApproved'], { transaction });

      // Índices para Semesters
      await queryInterface.addIndex('Semesters', ['year', 'period'], { 
        name: 'idx_semesters_year_period',
        unique: true, 
        transaction 
      });
      await queryInterface.addIndex('Semesters', ['isCurrent'], { transaction });
      await queryInterface.addIndex('Semesters', ['isActive'], { transaction });

      // Índices para Groups
      await queryInterface.addIndex('Groups', ['churchId'], { transaction });
      await queryInterface.addIndex('Groups', ['leaderId'], { transaction });
      await queryInterface.addIndex('Groups', ['status'], { transaction });
      await queryInterface.addIndex('Groups', ['isActive'], { transaction });
      await queryInterface.addIndex('Groups', ['type', 'category'], { transaction });

      // Índices para Members
      await queryInterface.addIndex('Members', ['groupId'], { transaction });
      await queryInterface.addIndex('Members', ['email'], { 
        name: 'idx_members_email',
        unique: true,
        where: { email: { [Sequelize.Op.ne]: null } },
        transaction 
      });
      await queryInterface.addIndex('Members', ['status'], { transaction });
      await queryInterface.addIndex('Members', ['spiritualStatus'], { transaction });

      // Índices para Students
      await queryInterface.addIndex('Students', ['groupId'], { transaction });
      await queryInterface.addIndex('Students', ['teacherId'], { transaction });
      await queryInterface.addIndex('Students', ['certificateNumber'], { 
        name: 'idx_students_certificate',
        unique: true,
        where: { certificateNumber: { [Sequelize.Op.ne]: null } },
        transaction 
      });
      await queryInterface.addIndex('Students', ['status'], { transaction });
      await queryInterface.addIndex('Students', ['program', 'level'], { transaction });

      // Índices para Metrics
      await queryInterface.addIndex('Metrics', ['groupId', 'periodType', 'periodStart', 'periodEnd'], { 
        name: 'idx_metrics_group_period',
        unique: true,
        transaction 
      });
      await queryInterface.addIndex('Metrics', ['semesterId'], { transaction });
      await queryInterface.addIndex('Metrics', ['status'], { transaction });
      await queryInterface.addIndex('Metrics', ['createdBy'], { transaction });

      // Índices para SpiritualIndicators
      await queryInterface.addIndex('SpiritualIndicators', ['memberId', 'evaluationDate'], { 
        name: 'idx_indicators_member_date',
        transaction 
      });
      await queryInterface.addIndex('SpiritualIndicators', ['semesterId'], { transaction });
      await queryInterface.addIndex('SpiritualIndicators', ['spiritualGrowthLevel'], { transaction });

      // =============================================
      // CREAR DATOS INICIALES (SEEDS)
      // =============================================
      
      // Crear semestre inicial
      const currentYear = new Date().getFullYear();
      await queryInterface.bulkInsert('Semesters', [{
        id: Sequelize.UUIDV4,
        name: `Primer Semestre ${currentYear}`,
        year: currentYear,
        period: 'first',
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-06-30`,
        isActive: true,
        isCurrent: true,
        description: 'Semestre inicial del sistema',
        createdAt: new Date(),
        updatedAt: new Date()
      }], { transaction });

      // Crear usuario admin inicial
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await queryInterface.bulkInsert('Users', [{
        id: Sequelize.UUIDV4,
        email: 'admin@sistema-misionero.com',
        password: hashedPassword,
        firstName: 'Administrador',
        lastName: 'Sistema',
        role: 'admin',
        isActive: true,
        isApproved: true,
        approvedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }], { transaction });

      await transaction.commit();
      console.log('✅ Migración inicial completada exitosamente');
      console.log('📊 Tablas creadas: Churches, Users, Semesters, Groups, Members, Students, Metrics, SpiritualIndicators');
      console.log('🔍 Índices creados para optimización de consultas');
      console.log('🌱 Datos iniciales: Admin user y semestre actual');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en migración:', error.message);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Eliminar en orden inverso por las dependencias de foreign keys
      await queryInterface.dropTable('SpiritualIndicators', { transaction });
      await queryInterface.dropTable('Metrics', { transaction });
      await queryInterface.dropTable('Students', { transaction });
      await queryInterface.dropTable('Members', { transaction });
      await queryInterface.dropTable('Groups', { transaction });
      await queryInterface.dropTable('Semesters', { transaction });
      await queryInterface.dropTable('Users', { transaction });
      await queryInterface.dropTable('Churches', { transaction });
      
      await transaction.commit();
      console.log('✅ Rollback de migración completado - Todas las tablas eliminadas');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error en rollback:', error.message);
      throw error;
    }
  }
};