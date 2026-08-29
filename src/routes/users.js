const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * GET /api/users
 * List campus users with optional role filter
 */
router.get('/', async (req, res, next) => {
  try {
    const { role } = req.query;

    const where = {};
    if (role) {
      where.role = role.toUpperCase();
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    return res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * Register a new user (Student, Doctor, Pharmacist, Counselor)
 */
router.post(
  '/',
  validateBody(['name', 'email']),
  async (req, res, next) => {
    try {
      const { name, email, role, hostelBlock, phone } = req.body;

      const validRoles = ['STUDENT', 'DOCTOR', 'PHARMACIST', 'COUNSELOR'];
      const userRole = role && validRoles.includes(role.toUpperCase())
        ? role.toUpperCase()
        : 'STUDENT';

      const user = await prisma.user.create({
        data: {
          name,
          email,
          role: userRole,
          hostelBlock: hostelBlock || null,
          phone: phone || null
        }
      });

      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
