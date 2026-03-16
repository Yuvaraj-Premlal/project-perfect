const { validationResult } = require('express-validator');

// ─────────────────────────────────────────────
// Runs after express-validator checks
// Returns 400 with all errors if any fail
// ─────────────────────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

module.exports = { validate };
