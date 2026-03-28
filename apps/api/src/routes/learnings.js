const router = require('express').Router();
const { dbQuery } = require('../middleware/db-context');

router.get('/', async (req, res) => {
  const result = await dbQuery(req.tenantId, `
    SELECT
      cr.report_id, cr.project_id, cr.sections, cr.tags,
      cr.actual_end_date, cr.planned_end_date, cr.days_variance,
      cr.total_tasks, cr.completed_tasks, cr.total_slippages,
      cr.final_opv, cr.final_lfv, cr.created_at,
      p.project_name, p.project_code, p.customer_name, p.risk_tier, p.start_date,
      u.full_name AS pm_name,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'thumbs_up') AS thumbs_up_count,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'lightbulb') AS lightbulb_count,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'warning')   AS warning_count,
      (SELECT COUNT(*) FROM kb_comments  kc WHERE kc.report_id = cr.report_id AND kc.deleted = false)             AS comment_count
    FROM closure_reports cr
    JOIN projects p ON p.project_id = cr.project_id
    LEFT JOIN users u ON u.user_id = cr.generated_by
    WHERE cr.tenant_id = $1
    ORDER BY cr.created_at DESC
  `, [req.tenantId]);
  res.json(result.rows);
});

router.get('/:reportId', async (req, res) => {
  const { reportId } = req.params;
  const userId = req.userId;
  const result = await dbQuery(req.tenantId, `
    SELECT cr.*, p.project_name, p.project_code, p.customer_name, p.risk_tier, p.start_date,
      u.full_name AS pm_name,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'thumbs_up') AS thumbs_up_count,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'lightbulb') AS lightbulb_count,
      (SELECT COUNT(*) FROM kb_reactions kr WHERE kr.report_id = cr.report_id AND kr.reaction_type = 'warning')   AS warning_count,
      (SELECT COUNT(*) FROM kb_comments  kc WHERE kc.report_id = cr.report_id AND kc.deleted = false)             AS comment_count
    FROM closure_reports cr
    JOIN projects p ON p.project_id = cr.project_id
    LEFT JOIN users u ON u.user_id = cr.generated_by
    WHERE cr.report_id = $1 AND cr.tenant_id = $2
  `, [reportId, req.tenantId]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Case study not found' });
  const myReactions = await dbQuery(req.tenantId, `
    SELECT reaction_type FROM kb_reactions
    WHERE report_id = $1 AND user_id = $2 AND tenant_id = $3
  `, [reportId, userId, req.tenantId]);
  res.json({ ...result.rows[0], my_reactions: myReactions.rows.map(r => r.reaction_type) });
});

router.post('/:reportId/reactions', async (req, res) => {
  const { reportId } = req.params;
  const { reaction_type } = req.body;
  const userId = req.userId;
  if (!['thumbs_up', 'lightbulb', 'warning'].includes(reaction_type)) {
    return res.status(400).json({ error: 'Invalid reaction type' });
  }
  const existing = await dbQuery(req.tenantId, `
    SELECT reaction_id FROM kb_reactions
    WHERE report_id = $1 AND user_id = $2 AND reaction_type = $3 AND tenant_id = $4
  `, [reportId, userId, reaction_type, req.tenantId]);
  if (existing.rows.length > 0) {
    await dbQuery(req.tenantId, `
      DELETE FROM kb_reactions WHERE report_id = $1 AND user_id = $2 AND reaction_type = $3 AND tenant_id = $4
    `, [reportId, userId, reaction_type, req.tenantId]);
    return res.json({ action: 'removed', reaction_type });
  } else {
    await dbQuery(req.tenantId, `
      INSERT INTO kb_reactions (tenant_id, report_id, user_id, reaction_type) VALUES ($1, $2, $3, $4)
    `, [req.tenantId, reportId, userId, reaction_type]);
    return res.json({ action: 'added', reaction_type });
  }
});

router.get('/:reportId/comments', async (req, res) => {
  const { reportId } = req.params;
  const result = await dbQuery(req.tenantId, `
    SELECT kc.comment_id, kc.parent_id, kc.body, kc.tag,
      kc.created_at, kc.updated_at, kc.deleted, kc.user_id,
      u.full_name AS author_name
    FROM kb_comments kc
    LEFT JOIN users u ON u.user_id = kc.user_id
    WHERE kc.report_id = $1 AND kc.tenant_id = $2
    ORDER BY kc.created_at ASC
  `, [reportId, req.tenantId]);
  res.json(result.rows);
});

router.post('/:reportId/comments', async (req, res) => {
  const { reportId } = req.params;
  const { body, tag, parent_id } = req.body;
  const userId = req.userId;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });
  const validTags = ['we_experienced_this', 'different_outcome', 'useful_recommendation', 'general'];
  const commentTag = validTags.includes(tag) ? tag : 'general';
  const result = await dbQuery(req.tenantId, `
    INSERT INTO kb_comments (tenant_id, report_id, user_id, body, tag, parent_id)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
  `, [req.tenantId, reportId, userId, body.trim(), commentTag, parent_id || null]);
  const withAuthor = await dbQuery(req.tenantId, `
    SELECT kc.*, u.full_name AS author_name FROM kb_comments kc
    LEFT JOIN users u ON u.user_id = kc.user_id WHERE kc.comment_id = $1
  `, [result.rows[0].comment_id]);
  res.status(201).json(withAuthor.rows[0]);
});

router.delete('/:reportId/comments/:commentId', async (req, res) => {
  const { commentId } = req.params;
  const userId = req.userId;
  await dbQuery(req.tenantId, `
    UPDATE kb_comments SET deleted = true, deleted_by = $1, deleted_at = NOW()
    WHERE comment_id = $2 AND tenant_id = $3
  `, [userId, commentId, req.tenantId]);
  res.json({ success: true });
});

module.exports = router;
