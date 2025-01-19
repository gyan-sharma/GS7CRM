-- Create view for review history
CREATE OR REPLACE VIEW review_history_view AS
SELECT 
  h.id as history_id,
  h.review_id,
  h.previous_status,
  h.new_status,
  h.comments,
  h.created_at as change_date,
  u.name as changed_by_name,
  u.role as changed_by_role,
  r.review_type,
  rev.name as reviewer_name,
  rev.role as reviewer_role,
  req.offer_id,
  o.offer_human_id,
  COALESCE(o.offer_summary, 'Untitled Offer') as offer_name,
  o.status as offer_status
FROM offer_review_history h
INNER JOIN offer_reviews r ON h.review_id = r.id
INNER JOIN users u ON h.changed_by = u.id
INNER JOIN users rev ON r.reviewer_id = rev.id
INNER JOIN offer_review_requests req ON r.request_id = req.id
INNER JOIN offer_records o ON req.offer_id = o.id
ORDER BY h.created_at DESC;