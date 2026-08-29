const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * GET /api/doctors
 * Fetch all available doctors, their specialty, room numbers, and current queue lengths
 */
router.get('/', async (req, res, next) => {
  try {
    const { specialty, status } = req.query;

    const where = {};
    if (specialty) {
      where.specialty = { contains: specialty };
    }
    if (status) {
      where.availabilityStatus = status.toUpperCase();
    }

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        _count: {
          select: {
            appointments: {
              where: {
                status: {
                  in: ['QUEUED', 'IN_PROGRESS']
                }
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Format response to provide real-time dynamic active queue count
    const formattedDoctors = doctors.map((doc) => ({
      id: doc.id,
      name: doc.name,
      specialty: doc.specialty,
      availabilityStatus: doc.availabilityStatus,
      currentQueueLength: doc._count.appointments,
      roomNumber: doc.roomNumber,
      email: doc.email,
      phone: doc.phone,
      createdAt: doc.createdAt
    }));

    return res.json({
      success: true,
      count: formattedDoctors.length,
      data: formattedDoctors
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/doctors/:id
 * Get single doctor details with active queue summary
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        appointments: {
          where: {
            status: { in: ['QUEUED', 'IN_PROGRESS'] }
          },
          orderBy: { queueNumber: 'asc' },
          select: {
            id: true,
            queueNumber: true,
            status: true,
            createdAt: true,
            student: {
              select: { id: true, name: true, hostelBlock: true }
            }
          }
        }
      }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found'
      });
    }

    return res.json({
      success: true,
      data: {
        id: doctor.id,
        name: doctor.name,
        specialty: doctor.specialty,
        availabilityStatus: doctor.availabilityStatus,
        roomNumber: doctor.roomNumber,
        currentQueueLength: doctor.appointments.length,
        activeAppointments: doctor.appointments
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/doctors
 * Add a new doctor to the campus healthcare registry
 */
router.post(
  '/',
  validateBody(['name', 'specialty']),
  async (req, res, next) => {
    try {
      const { name, specialty, roomNumber, email, phone, availabilityStatus } = req.body;

      const doctor = await prisma.doctor.create({
        data: {
          name,
          specialty,
          roomNumber,
          email,
          phone,
          availabilityStatus: availabilityStatus ? availabilityStatus.toUpperCase() : 'AVAILABLE'
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Doctor profile registered successfully',
        data: doctor
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/doctors/:id/status
 * Update doctor availability status (AVAILABLE | BUSY | OFFLINE)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { availabilityStatus } = req.body;

    const validStatuses = ['AVAILABLE', 'BUSY', 'OFFLINE'];
    if (!availabilityStatus || !validStatuses.includes(availabilityStatus.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updatedDoctor = await prisma.doctor.update({
      where: { id },
      data: { availabilityStatus: availabilityStatus.toUpperCase() }
    });

    return res.json({
      success: true,
      message: 'Doctor availability status updated',
      data: updatedDoctor
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
