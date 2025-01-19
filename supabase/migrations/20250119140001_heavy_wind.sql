-- Create view for review details
CREATE OR REPLACE VIEW review_details_view AS
WITH review_docs AS (
  SELECT 
    request_id,
    COALESCE(
      json_agg(
        json_build_object(
          'id', id,
          'name', name,
          'file_path', file_path,
          'file_type', file_type,
          'file_size', file_size,
          'created_at', created_at
        )
      ) FILTER (WHERE id IS NOT NULL),
      '[]'::json
    ) as documents
  FROM offer_review_documents
  GROUP BY request_id
)
SELECT DISTINCT ON (r.id)
  r.id as review_id,
  r.request_id,
  r.reviewer_id,
  u.name as reviewer_name,
  u.role as reviewer_role,
  r.review_type,
  r.status as review_status,
  r.comments as review_comments,
  r.created_at as review_created_at,
  r.updated_at as review_updated_at,
  req.request_details,
  req.requested_by,
  req.created_at as request_created_at,
  o.id as offer_id,
  o.offer_human_id,
  COALESCE(o.offer_summary, 'Untitled Offer') as offer_name,
  o.status as offer_status,
  c.company_name as customer_name,
  c.id as customer_id,
  COALESCE(d.documents, '[]'::json) as documents
FROM offer_reviews r
INNER JOIN offer_review_requests req ON r.request_id = req.id
INNER JOIN users u ON r.reviewer_id = u.id
INNER JOIN offer_records o ON req.offer_id = o.id
INNER JOIN opportunity_records opp ON o.opportunity_id = opp.id
INNER JOIN customers c ON opp.customer_id = c.id
LEFT JOIN review_docs d ON req.id = d.request_id
ORDER BY r.id, r.created_at DESC;