const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
require('express-async-errors');

const { tenantMiddleware } = require('./middleware/tenant');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Public
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'project-perfect-api',
    timestamp: new Date().toISOString()
  });
});

// Protected — tenant middleware on all /api routes
app.use('/api', tenantMiddleware);
app.use('/api/projects',                      require('./routes/projects'));
app.use('/api/projects/:projectId/tasks',     require('./routes/tasks'));
app.use('/api/suppliers',                     require('./routes/suppliers'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
