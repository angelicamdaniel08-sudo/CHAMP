const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validate');

/**
 * GET /api/alerts
 * Fetch active campus health alerts (EPIDEMIC, HEATWAVE, VACCINATION, etc.)
 */
router.get('/', async (req, res, next) => {
  try {
    const { alertType, all } = req.query;

    const where = {};
    if (all !== 'true') {
      where.isActive = true;
    }
    if (alertType) {
      where.alertType = alertType.toUpperCase();
    }

    const alerts = await prisma.healthAlert.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });

    return res.json({
      success: true,
      count: alerts.length,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/alerts
 * Broadcast a new campus health alert
 * Body: { title, message, alertType: "EPIDEMIC"|"HEATWAVE"|"VACCINATION"|"GENERAL", severity }
 */
router.post(
  '/',
  validateBody(['title', 'message']),
  async (req, res, next) => {
    try {
      const { title, message, alertType, severity, isActive } = req.body;

      const validAlertTypes = ['EPIDEMIC', 'HEATWAVE', 'VACCINATION', 'GENERAL'];
      const type = alertType && validAlertTypes.includes(alertType.toUpperCase())
        ? alertType.toUpperCase()
        : 'GENERAL';

      const alert = await prisma.healthAlert.create({
        data: {
          title,
          message,
          alertType: type,
          severity: severity ? severity.toUpperCase() : 'HIGH',
          isActive: isActive !== undefined ? Boolean(isActive) : true
        }
      });

      return res.status(201).json({
        success: true,
        message: 'Campus health alert broadcasted successfully',
        data: alert
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/alerts/:id
 * Toggle alert status or update message
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, message, alertType, severity, isActive } = req.body;

    const data = {};
    if (title) data.title = title;
    if (message) data.message = message;
    if (alertType) data.alertType = alertType.toUpperCase();
    if (severity) data.severity = severity.toUpperCase();
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const updated = await prisma.healthAlert.update({
      where: { id },
      data
    });

    return res.json({
      success: true,
      message: 'Health alert updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
