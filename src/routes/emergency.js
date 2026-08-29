const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * POST /api/emergency
 * Trigger instant priority emergency dispatch with student telemetry & location
 * Body: { studentId, studentName, contactNumber, location, details }
 */
router.post(
  '/',
  validateBody(['location']),
  async (req, res, next) => {
    try {
      const { studentId, studentName, contactNumber, location, details } = req.body;

      let resolvedStudentName = studentName;
      let resolvedContact = contactNumber;

      if (studentId) {
        const student = await prisma.user.findUnique({
          where: { id: studentId }
        });
        if (student) {
          resolvedStudentName = resolvedStudentName || student.name;
          resolvedContact = resolvedContact || student.phone;
        }
      }

      const emergency = await prisma.emergencyDispatch.create({
        data: {
          studentId: studentId || null,
          studentName: resolvedStudentName || 'Anonymous Student',
          contactNumber: resolvedContact || 'N/A',
          location,
          details: details || 'Medical assistance requested urgently',
          status: 'DISPATCHED'
        },
        include: {
          student: {
            select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
          }
        }
      });

      // Priority Telemetry Log for Campus Response Unit
      console.warn(`🚨 [EMERGENCY DISPATCH TRIGGERED] ID: ${emergency.id} | Loc: ${location} | Student: ${resolvedStudentName}`);

      return res.status(201).json({
        success: true,
        priority: 'CRITICAL_DISPATCH',
        message: 'Campus emergency response unit and ambulance dispatched immediately to your location.',
        emergencyContactHotline: '+1-800-CAMPUS-EMS (Ext. 911)',
        data: emergency
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/emergency
 * Real-time emergency feed for campus medical response teams & dispatchers
 */
router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const dispatches = await prisma.emergencyDispatch.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return res.json({
      success: true,
      count: dispatches.length,
      data: dispatches
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/emergency/:id/status
 * Update emergency status (DISPATCHED -> RESPONDING -> RESOLVED)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DISPATCHED', 'RESPONDING', 'RESOLVED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await prisma.emergencyDispatch.update({
      where: { id },
      data: { status: status.toUpperCase() },
      include: {
        student: {
          select: { id: true, name: true, hostelBlock: true }
        }
      }
    });

    return res.json({
      success: true,
      message: `Emergency dispatch status updated to ${status.toUpperCase()}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
