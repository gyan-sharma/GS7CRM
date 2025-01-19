/*
  # Review Details View
  
  Creates a view that shows:
  1. Review request details
  2. Associated documents
  3. All reviews for each request
*/

-- Create view for offer review details
CREATE OR REPLACE VIEW offer_review_details_view AS
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
SELECT 
  req.id as request_id,
  req.offer_id,
  req.request_details,
  req.created_at as request_created_at,
  COALESCE(d.documents, '[]'::json) as documents,
  COALESCE(
    json_agg(
      json_build_object(
        'review_id', r.id,
        'reviewer_name', u.name,
        'reviewer_role', u.role,
        'review_type', r.review_type,
        'review_status', r.status,
        'review_comments', r.comments,
        'review_created_at', r.created_at
      ) ORDER BY r.created_at DESC
    ) FILTER (WHERE r.id IS NOT NULL),
    '[]'::json
  ) as reviews
FROM offer_review_requests req
LEFT JOIN review_docs d ON req.id = d.request_id
LEFT JOIN offer_reviews r ON req.id = r.request_id
LEFT JOIN users u ON r.reviewer_id = u.id
GROUP BY req.id, req.offer_id, req.request_details, req.created_at, d.documents;