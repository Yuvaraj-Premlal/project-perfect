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

// Protected
app.use('/api', tenantMiddleware);
app.use('/api/projects/:projectId/tasks',             require('./routes/tasks'));
app.use('/api/projects/:projectId/reviews',           require('./routes/reviews'));
app.use('/api/projects/:projectId/nudges',            require('./routes/nudges'));
app.use('/api/projects/:projectId/weekly-reports',    require('./routes/weekly-reports'));
app.use('/api/projects/:projectId/close',             require('./routes/closure'));
app.use('/api/projects',                              require('./routes/projects'));
app.use('/api/suppliers',                             require('./routes/suppliers'));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

module.exports = app;
