const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * POST /api/prescriptions
 * Submit a prescription image/URL for pharmacist verification and hostel delivery dispatch
 * Body: { studentId, imageBase64OrUrl, hostelDeliveryAddress, notes }
 */
router.post(
  '/',
  validateBody(['studentId', 'imageBase64OrUrl', 'hostelDeliveryAddress']),
  async (req, res, next) => {
    try {
      const { studentId, imageBase64OrUrl, hostelDeliveryAddress, notes } = req.body;

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

      const prescription = await prisma.prescription.create({
        data: {
          studentId,
          imageBase64OrUrl,
          hostelDeliveryAddress,
          notes: notes || null,
          status: 'PENDING'
        },
        include: {
          student: {
            select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
          }
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Prescription submitted successfully for pharmacist review & hostel dispatch',
        data: prescription
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/prescriptions
 * List prescriptions with optional filters (studentId, status)
 */
router.get('/', async (req, res, next) => {
  try {
    const { studentId, status } = req.query;

    const where = {};
    if (studentId) where.studentId = studentId;
    if (status) where.status = status.toUpperCase();

    const prescriptions = await prisma.prescription.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      count: prescriptions.length,
      data: prescriptions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prescriptions/:id
 * Fetch single prescription details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true, phone: true }
        }
      }
    });

    if (!prescription) {
      return res.status(404).json({
        success: false,
        error: 'Prescription not found'
      });
    }

    return res.json({
      success: true,
      data: prescription
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/prescriptions/:id/status
 * Pharmacist workflow: verify and dispatch prescription
 * Body: { status: "PENDING" | "VERIFIED" | "DISPATCHED", pharmacistNotes }
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, pharmacistNotes } = req.body;

    const validStatuses = ['PENDING', 'VERIFIED', 'DISPATCHED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const updateData = {
      status: status.toUpperCase()
    };
    if (pharmacistNotes !== undefined) {
      updateData.pharmacistNotes = pharmacistNotes;
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: { id: true, name: true, email: true, hostelBlock: true }
        }
      }
    });

    return res.json({
      success: true,
      message: `Prescription status updated to ${status.toUpperCase()}`,
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
