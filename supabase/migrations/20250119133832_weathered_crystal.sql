-- Create view for review details
CREATE OR REPLACE VIEW review_details_view AS
SELECT 
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
  o.offer_summary as offer_name,
  o.status as offer_status,
  c.company_name as customer_name,
  c.id as customer_id,
  COALESCE(
    (
      SELECT json_agg(json_build_object(
        'id', d.id,
        'name', d.name,
        'file_path', d.file_path,
        'file_type', d.file_type,
        'file_size', d.file_size,
        'created_at', d.created_at
      ))
      FROM offer_review_documents d
      WHERE d.request_id = req.id
    ),
    '[]'::json
  ) as documents
FROM offer_reviews r
LEFT JOIN offer_review_requests req ON r.request_id = req.id
LEFT JOIN users u ON r.reviewer_id = u.id
LEFT JOIN offer_records o ON req.offer_id = o.id
LEFT JOIN opportunity_records opp ON o.opportunity_id = opp.id
LEFT JOIN customers c ON opp.customer_id = c.id;