-- Drop existing objects in correct order
DROP VIEW IF EXISTS review_details_view;
DROP TABLE IF EXISTS offer_review_history CASCADE;
DROP TABLE IF EXISTS offer_review_documents CASCADE;
DROP TABLE IF EXISTS offer_reviews CASCADE;
DROP TABLE IF EXISTS offer_review_requests CASCADE;

-- Create offer review requests table
CREATE TABLE IF NOT EXISTS offer_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  request_details text NOT NULL,
  requested_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer reviews table
CREATE TABLE IF NOT EXISTS offer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES offer_review_requests(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id),
  review_type text NOT NULL CHECK (review_type IN ('technical', 'commercial')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'needs_improvement')) DEFAULT 'pending',
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer review documents table
CREATE TABLE IF NOT EXISTS offer_review_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES offer_review_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer review history table
CREATE TABLE IF NOT EXISTS offer_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES offer_reviews(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('pending', 'approved', 'needs_improvement')),
  new_status text NOT NULL CHECK (new_status IN ('pending', 'approved', 'needs_improvement')),
  comments text,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_offer_review_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_offer_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
DROP TRIGGER IF EXISTS update_offer_review_requests_timestamp ON offer_review_requests;
CREATE TRIGGER update_offer_review_requests_timestamp
  BEFORE UPDATE ON offer_review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_review_requests_updated_at();

DROP TRIGGER IF EXISTS update_offer_reviews_timestamp ON offer_reviews;
CREATE TRIGGER update_offer_reviews_timestamp
  BEFORE UPDATE ON offer_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_reviews_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_review_requests_offer_id
  ON offer_review_requests(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_reviews_request_id
  ON offer_reviews(request_id);

CREATE INDEX IF NOT EXISTS idx_offer_reviews_reviewer_id
  ON offer_reviews(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_offer_review_documents_request_id
  ON offer_review_documents(request_id);

CREATE INDEX IF NOT EXISTS idx_offer_review_history_review_id
  ON offer_review_history(review_id);

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
LEFT JOIN review_docs d ON req.id = d.request_id;