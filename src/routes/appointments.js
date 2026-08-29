const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * POST /api/appointments
 * Book a doctor appointment and atomically auto-increment queueNumber
 * Body: { studentId, doctorId, reason }
 */
router.post(
  '/',
  validateBody(['studentId', 'doctorId']),
  async (req, res, next) => {
    try {
      const { studentId, doctorId, reason } = req.body;

      // Verify student exists
      const student = await prisma.user.findUnique({
        where: { id: studentId }
      });
      if (!student) {
        return res.status(404).json({
          success: false,
          error: `Student with ID '${studentId}' not found.`
        });
      }

      // Verify doctor exists
      const doctor = await prisma.doctor.findUnique({
        where: { id: doctorId }
      });
      if (!doctor) {
        return res.status(404).json({
          success: false,
          error: `Doctor with ID '${doctorId}' not found.`
        });
      }

      if (doctor.availabilityStatus === 'OFFLINE') {
        return res.status(400).json({
          success: false,
          error: `Dr. ${doctor.name} is currently OFFLINE and cannot accept new queue bookings.`
        });
      }

      // Atomic Transaction: find highest queueNumber for today for this doctor & create appointment
      const result = await prisma.$transaction(async (tx) => {
        // Find max queueNumber for this doctor today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const lastAppointment = await tx.appointment.findFirst({
          where: {
            doctorId,
            createdAt: { gte: startOfDay }
          },
          orderBy: { queueNumber: 'desc' }
        });

        const nextQueueNumber = lastAppointment ? lastAppointment.queueNumber + 1 : 1;

        // Create the new appointment
        const appointment = await tx.appointment.create({
          data: {
            studentId,
            doctorId,
            queueNumber: nextQueueNumber,
            reason: reason || null,
            status: 'QUEUED'
          },
          include: {
            doctor: {
              select: { id: true, name: true, specialty: true, roomNumber: true }
            },
            student: {
              select: { id: true, name: true, email: true, hostelBlock: true }
            }
          }
        });

        // Update Doctor's currentQueueLength count
        const activeQueueCount = await tx.appointment.count({
          where: {
            doctorId,
            status: { in: ['QUEUED', 'IN_PROGRESS'] }
          }
        });

        await tx.doctor.update({
          where: { id: doctorId },
          data: { currentQueueLength: activeQueueCount }
        });

        return { appointment, activeQueueCount };
      });

      return res.status(201).json({
        success: true,
        message: 'Appointment booked successfully. Added to queue.',
        data: {
          ...result.appointment,
          estimatedWaitMinutes: (result.activeQueueCount - 1) * 10
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/appointments/queue/:id
 * Real-time queue status check for a given appointment ID
 */
router.get('/queue/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        doctor: true,
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Calculate queue dynamics
    // 1. Current appointment in progress with this doctor (if any)
    const currentlyServing = await prisma.appointment.findFirst({
      where: {
        doctorId: appointment.doctorId,
        status: 'IN_PROGRESS'
      },
      select: {
        id: true,
        queueNumber: true,
        status: true
      }
    });

    // 2. Count of patients queued ahead of this appointment
    const aheadInQueueCount = await prisma.appointment.count({
      where: {
        doctorId: appointment.doctorId,
        status: 'QUEUED',
        queueNumber: { lt: appointment.queueNumber }
      }
    });

    // 3. Total active in queue
    const totalActiveInQueue = await prisma.appointment.count({
      where: {
        doctorId: appointment.doctorId,
        status: { in: ['QUEUED', 'IN_PROGRESS'] }
      }
    });

    let statusDescription = 'Waiting in queue';
    if (appointment.status === 'IN_PROGRESS') {
      statusDescription = 'Currently in consultation with doctor';
    } else if (appointment.status === 'COMPLETED') {
      statusDescription = 'Consultation completed';
    } else if (appointment.status === 'CANCELLED') {
      statusDescription = 'Appointment was cancelled';
    } else if (aheadInQueueCount === 0) {
      statusDescription = 'You are next in line!';
    }

    return res.json({
      success: true,
      data: {
        appointmentId: appointment.id,
        queueNumber: appointment.queueNumber,
        status: appointment.status,
        statusDescription,
        student: appointment.student,
        doctor: {
          id: appointment.doctor.id,
          name: appointment.doctor.name,
          specialty: appointment.doctor.specialty,
          roomNumber: appointment.doctor.roomNumber,
          availabilityStatus: appointment.doctor.availabilityStatus
        },
        queueTelemetry: {
          patientsAhead: aheadInQueueCount,
          estimatedWaitMinutes: appointment.status === 'QUEUED' ? (aheadInQueueCount + 1) * 10 : 0,
          currentlyServingToken: currentlyServing ? currentlyServing.queueNumber : 'None currently in consultation',
          totalWaitingPatients: totalActiveInQueue
        },
        createdAt: appointment.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/appointments
 * List appointments with query filters (studentId, doctorId, status)
 */
router.get('/', async (req, res, next) => {
  try {
    const { studentId, doctorId, status } = req.query;

    const where = {};
    if (studentId) where.studentId = studentId;
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status.toUpperCase();

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        doctor: {
          select: { id: true, name: true, specialty: true, roomNumber: true }
        },
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true }
        }
      },
      orderBy: [
        { status: 'asc' },
        { queueNumber: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return res.json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/appointments/:id/status
 * Update appointment status (QUEUED | IN_PROGRESS | COMPLETED | CANCELLED)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.update({
        where: { id },
        data: { status: status.toUpperCase() },
        include: { doctor: true, student: true }
      });

      // Recalculate doctor queue length
      const activeCount = await tx.appointment.count({
        where: {
          doctorId: appt.doctorId,
          status: { in: ['QUEUED', 'IN_PROGRESS'] }
        }
      });

      await tx.doctor.update({
        where: { id: appt.doctorId },
        data: { currentQueueLength: activeCount }
      });

      return appt;
    });

    return res.json({
      success: true,
      message: `Appointment status updated to ${status.toUpperCase()}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
