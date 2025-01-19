/*
  # Offer Review Details View
  
  Creates a view that provides a denormalized view of offer reviews with nested documents
  and review details.
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
),
review_details AS (
  SELECT 
    r.request_id,
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
    ) as reviews
  FROM offer_reviews r
  LEFT JOIN users u ON r.reviewer_id = u.id
  GROUP BY r.request_id
)
SELECT 
  req.id as request_id,
  req.offer_id,
  req.request_details,
  req.created_at as request_created_at,
  o.offer_human_id,
  o.offer_summary as offer_name,
  o.status as offer_status,
  c.company_name as customer_name,
  c.id as customer_id,
  COALESCE(d.documents, '[]'::json) as documents,
  COALESCE(rd.reviews, '[]'::json) as reviews
FROM offer_review_requests req
LEFT JOIN offer_records o ON req.offer_id = o.id
LEFT JOIN opportunity_records opp ON o.opportunity_id = opp.id
LEFT JOIN customers c ON opp.customer_id = c.id
LEFT JOIN review_docs d ON req.id = d.request_id
LEFT JOIN review_details rd ON req.id = rd.request_id;