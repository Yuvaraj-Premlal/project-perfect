const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');
const { requireRole } = require('../middleware/tenant');

// ─────────────────────────────────────────────
// GET /api/suppliers
// List all suppliers for this tenant
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT * FROM suppliers
    WHERE tenant_id = $1
    ORDER BY supplier_name ASC
  `, [req.tenantId]);

  res.json(result.rows);
});

// ─────────────────────────────────────────────
// POST /api/suppliers
// Add a supplier to the registry
// Access: PM only
// ─────────────────────────────────────────────
router.post('/', requireRole('pm'), async (req, res) => {
  const { supplier_name, supplier_type, contact_name, contact_email } = req.body;

  if (!supplier_name || !supplier_type) {
    return res.status(400).json({ error: 'supplier_name and supplier_type are required' });
  }

  const result = await dbQuery(req.tenantId, `
    INSERT INTO suppliers (tenant_id, supplier_name, supplier_type, contact_name, contact_email)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [req.tenantId, supplier_name, supplier_type, contact_name || null, contact_email || null]);

  res.status(201).json(result.rows[0]);
});

module.exports = router;
