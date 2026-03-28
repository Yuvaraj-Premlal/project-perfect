const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');

// GET /api/users - active users for task owner picker
router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId,
    `SELECT u.user_id, u.full_name, u.email, u.role, u.contact_phone,
            d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE u.tenant_id = $1 AND u.is_active = true
     ORDER BY u.full_name ASC`,
    [req.tenantId]
  );
  res.json(result.rows);
});

module.exports = router;
