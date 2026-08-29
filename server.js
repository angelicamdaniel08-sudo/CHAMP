require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./src/lib/prisma');
const errorHandler = require('./src/middleware/errorHandler');

// Route Imports
const doctorsRouter = require('./src/routes/doctors');
const appointmentsRouter = require('./src/routes/appointments');
const prescriptionsRouter = require('./src/routes/prescriptions');
const alertsRouter = require('./src/routes/alerts');
const emergencyRouter = require('./src/routes/emergency');
const usersRouter = require('./src/routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Support up to 10MB JSON payload (useful for base64 prescription images)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Root & Health Check Endpoints
app.get('/', (req, res) => {
  res.json({
    name: 'CHAMP API - Campus Healthcare Accessibility & Management Platform',
    version: '1.0.0',
    status: 'ONLINE',
    docs: '/api/health',
    endpoints: {
      doctors: '/api/doctors',
      appointments: '/api/appointments',
      queueStatus: '/api/appointments/queue/:id',
      prescriptions: '/api/prescriptions',
      alerts: '/api/alerts',
      emergency: '/api/emergency',
      users: '/api/users'
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    // Ping SQLite via Prisma
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'HEALTHY',
      database: 'CONNECTED (SQLite)',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      status: 'UNHEALTHY',
      database: 'DISCONNECTED',
      error: error.message
    });
  }
});

// API Routes Mounting
app.use('/api/doctors', doctorsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/emergency', emergencyRouter);
app.use('/api/users', usersRouter);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`
==========================================================
 🏥 CHAMP Backend API Server is Live!
 🚀 Listening on: http://localhost:${PORT}
 📋 Health Check: http://localhost:${PORT}/api/health
 📦 Database: SQLite (Prisma ORM)
==========================================================
    `);
  });
}

module.exports = app;
