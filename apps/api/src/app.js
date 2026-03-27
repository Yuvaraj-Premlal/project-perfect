const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
require('express-async-errors');

const { tenantMiddleware } = require('./middleware/tenant');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// ─────────────────────────────────────────────
// Rate limiting — per IP
// 200 requests per 15 minutes on all routes
// Tighter limit on AI routes (60 per 15 min)
// ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests — please try again later' }
});

app.use(globalLimiter);

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
app.use('/api/projects/:projectId/tasks/:taskId/updates', require('./routes/task-updates'));
app.use('/api/projects/:projectId/tasks',             require('./routes/tasks'));
app.use('/api/projects/:projectId/reviews',           require('./routes/reviews'));
app.use('/api/projects/:projectId/nudges',            aiLimiter, require('./routes/nudges'));
app.use('/api/projects/:projectId/weekly-reports',    aiLimiter, require('./routes/weekly-reports'));
app.use('/api/projects/:projectId/ccr',              require('./routes/ccr'));
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
