/*
  # Consolidated Schema Migration

  This migration contains the complete database schema in a single file.
  It combines all previous migrations into one for easier management.

  1. Core Tables
    - users
    - customers
    - partners
    - services
    - license_pricing
  
  2. Business Process Tables
    - opportunities
    - offers
    - contracts
    - projects
  
  3. Supporting Tables
    - reviews
    - documents
    - team members
    - tasks
    - milestones
    
  4. History Tables
    - status history
    - review history
*/

-- Drop all existing objects
DROP VIEW IF EXISTS review_history_view CASCADE;
DROP VIEW IF EXISTS review_details_view CASCADE;
DROP VIEW IF EXISTS offer_review_details_view CASCADE;
DROP VIEW IF EXISTS contract_details_view CASCADE;
DROP VIEW IF EXISTS environments_view CASCADE;
DROP VIEW IF EXISTS project_details_view CASCADE;
DROP VIEW IF EXISTS task_status_history_view CASCADE;
DROP VIEW IF EXISTS milestone_status_history_view CASCADE;

DROP TABLE IF EXISTS task_status_history CASCADE;
DROP TABLE IF EXISTS milestone_status_history CASCADE;
DROP TABLE IF EXISTS payment_milestones CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS project_team_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS contract_documents CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS offer_review_history CASCADE;
DROP TABLE IF EXISTS offer_review_documents CASCADE;
DROP TABLE IF EXISTS offer_reviews CASCADE;
DROP TABLE IF EXISTS offer_review_requests CASCADE;
DROP TABLE IF EXISTS offer_environment_components CASCADE;
DROP TABLE IF EXISTS offer_environments CASCADE;
DROP TABLE IF EXISTS offer_service_components CASCADE;
DROP TABLE IF EXISTS offer_service_sets CASCADE;
DROP TABLE IF EXISTS offer_partner_records CASCADE;
DROP TABLE IF EXISTS offer_document_records CASCADE;
DROP TABLE IF EXISTS offer_records CASCADE;
DROP TABLE IF EXISTS opportunity_status_history CASCADE;
DROP TABLE IF EXISTS opportunity_document_records CASCADE;
DROP TABLE IF EXISTS opportunity_records CASCADE;
DROP TABLE IF EXISTS partner_documents CASCADE;
DROP TABLE IF EXISTS partner_service_areas CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS license_pricing CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create core tables
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL,
  password text NOT NULL,
  user_human_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_login timestamptz
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  industry text NOT NULL,
  country text NOT NULL,
  region text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  website text,
  number_of_employees text NOT NULL,
  company_human_id text UNIQUE NOT NULL,
  hubspot_id text,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  headquarter_country text NOT NULL,
  website text,
  region text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  is_sales_partner boolean DEFAULT false,
  is_delivery_subcontractor boolean DEFAULT false,
  company_human_id text UNIQUE NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  certification_level text CHECK (certification_level IN ('platinum', 'gold', 'silver', 'bronze')),
  revenue_sharing_percentage numeric CHECK (revenue_sharing_percentage >= 0 AND revenue_sharing_percentage <= 100),
  certifications text[],
  compliance_info text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT partner_type_check CHECK (is_sales_partner = true OR is_delivery_subcontractor = true)
);

CREATE TABLE partner_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  service_area text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, service_area)
);

CREATE TABLE partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  manday_rate numeric NOT NULL DEFAULT 300,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE license_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pretty_name text NOT NULL,
  type text NOT NULL,
  size text NOT NULL,
  hourly_price numeric NOT NULL CHECK (hourly_price >= 0),
  monthly_price numeric GENERATED ALWAYS AS (hourly_price * 730) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT license_pricing_name_type_size_key UNIQUE (pretty_name, type, size)
);

-- Create opportunity tables
CREATE TABLE opportunity_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_human_id text UNIQUE NOT NULL,
  opportunity_name text NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  deal_owner_id uuid REFERENCES users(id),
  budget numeric NOT NULL DEFAULT 0,
  currency text NOT NULL,
  region text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  close_date date NOT NULL,
  opportunity_creation_date date NOT NULL,
  opportunity_stage text NOT NULL CHECK (
    opportunity_stage IN (
      'Lead',
      'Qualification',
      'Proposal',
      'Negotiation',
      'Closed Won',
      'Closed Lost'
    )
  ),
  opportunity_type text NOT NULL CHECK (
    opportunity_type IN (
      'New Business',
      'Upsell',
      'Renewal'
    )
  ),
  lead_source text NOT NULL CHECK (
    lead_source IN (
      'Website',
      'Outbound Efforts',
      'Referral',
      'Partner',
      'Email Campaign',
      'Cold Call',
      'Event/Conference',
      'Other'
    )
  ),
  use_case_summary text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE opportunity_document_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  document_type text NOT NULL CHECK (
    document_type IN (
      'Proposal',
      'Contract',
      'Supporting Material'
    )
  ),
  document_status text NOT NULL CHECK (
    document_status IN (
      'Uploaded',
      'Signed',
      'Pending'
    )
  ),
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE opportunity_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  previous_stage text,
  new_stage text NOT NULL,
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer tables
CREATE TABLE offer_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid REFERENCES opportunity_records(id) ON DELETE CASCADE,
  presales_engineer_id uuid REFERENCES users(id),
  offer_human_id text UNIQUE NOT NULL,
  offer_summary text,
  offer_creation_date date NOT NULL DEFAULT CURRENT_DATE,
  offer_due_date date NOT NULL,
  status text NOT NULL CHECK (
    status IN (
      'Draft',
      'In Review',
      'Approved',
      'Sent',
      'Won',
      'Lost',
      'Cancelled',
      'Hold'
    )
  ) DEFAULT 'Draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE offer_partner_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(offer_id, partner_id)
);

CREATE TABLE offer_document_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  document_type text NOT NULL CHECK (
    document_type IN (
      'Customer RFP',
      'Subcontractor Proposal',
      'SettleMint Proposal'
    )
  ),
  document_status text NOT NULL CHECK (
    document_status IN (
      'Draft',
      'Final',
      'Archived'
    )
  ) DEFAULT 'Draft',
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  environment_human_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  license_duration_months integer NOT NULL CHECK (license_duration_months > 0),
  deployment_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_environment_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES offer_environments(id) ON DELETE CASCADE,
  component_name text NOT NULL,
  type text NOT NULL,
  size text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  monthly_price numeric NOT NULL CHECK (monthly_price >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_service_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  service_set_human_id text NOT NULL,
  name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  subcontractor_id uuid REFERENCES partners(id),
  services_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_service_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_set_id uuid REFERENCES offer_service_sets(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  manday_rate numeric NOT NULL CHECK (manday_rate >= 0),
  number_of_mandays integer NOT NULL CHECK (number_of_mandays > 0),
  profit_percentage numeric NOT NULL CHECK (profit_percentage >= 0),
  total_cost numeric GENERATED ALWAYS AS (manday_rate * number_of_mandays * (1 + profit_percentage / 100)) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create review tables
CREATE TABLE offer_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  request_details text NOT NULL,
  requested_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES offer_review_requests(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id),
  review_type text NOT NULL CHECK (review_type IN ('technical', 'commercial')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'needs_improvement')) DEFAULT 'pending',
  comments text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE offer_review_documents (
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

CREATE TABLE offer_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES offer_reviews(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('pending', 'approved', 'needs_improvement')),
  new_status text NOT NULL CHECK (new_status IN ('pending', 'approved', 'needs_improvement')),
  comments text,
  changed_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Create contract tables
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_human_id text UNIQUE NOT NULL,
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  contract_summary text,
  total_contract_value numeric NOT NULL CHECK (total_contract_value >= 0),
  total_mrr numeric NOT NULL CHECK (total_mrr >= 0),
  total_services_revenue numeric NOT NULL CHECK (total_services_revenue >= 0),
  payment_terms text NOT NULL,
  contract_start_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft', 'Active', 'Expired', 'Terminated')) DEFAULT 'Draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create project tables
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_human_id text UNIQUE NOT NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'On Hold', 'Completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE project_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  email text,
  phone text,
  allocation_percentage integer CHECK (allocation_percentage BETWEEN 0 AND 100),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id uuid REFERENCES project_tasks(id),
  title text NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('Not Started', 'In Progress', 'Completed')),
  priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  assigned_to uuid REFERENCES project_team_members(id),
  start_date date,
  due_date date,
  completed_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Pending', 'Invoiced', 'Paid')),
  payment_date date,
  invoice_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

-- Create history tables
CREATE TABLE task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES project_tasks(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Not Started', 'In Progress', 'Completed')),
  new_status text NOT NULL CHECK (new_status IN ('Not Started', 'In Progress', 'Completed')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

CREATE TABLE milestone_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid REFERENCES payment_milestones(id) ON DELETE CASCADE,
  previous_status text CHECK (previous_status IN ('Pending', 'Invoiced', 'Paid')),
  new_status text NOT NULL CHECK (new_status IN ('Pending', 'Invoiced', 'Paid')),
  changed_by uuid REFERENCES users(id),
  change_date timestamptz DEFAULT now(),
  comments text
);

-- Create environment BPaaS details
CREATE TABLE environment_bpaas_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES offer_environments(id) ON DELETE CASCADE,
  platform_identifier text NOT NULL,
  platform_link text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(environment_id)
);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('partner-documents', 'partner-documents', true),
  ('opportunity_document_storage', 'opportunity-documents', false),
  ('offer-documents', 'offer-documents', false),
  ('drp-documents', 'drp-documents', false),
  ('contract-documents', 'contract-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('partner-documents', 'opportunity_document_storage', 'offer-documents', 'drp-documents', 'contract-documents'));

CREATE POLICY "Allow authenticated users to read files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('partner-documents', 'opportunity_document_storage', 'offer-documents', 'drp-documents', 'contract-documents'));

CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('partner-documents', 'opportunity_document_storage', 'offer-documents', 'drp-documents', 'contract-documents'));

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_timestamp
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();

-- Create status tracking triggers
CREATE OR REPLACE FUNCTION track_task_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO task_status_history (
      task_id,
      previous_status,
      new_status,
      changed_by,
      comments
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION track_milestone_status_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO milestone_status_history (
      milestone_id,
      previous_status,
      new_status,
      changed_by,
      comments
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      NEW.updated_by,
      'Status changed from ' || OLD.status || ' to ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER track_task_status_changes
  AFTER UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION track_task_status_changes();

CREATE TRIGGER track_milestone_status_changes
  AFTER UPDATE ON payment_milestones
  FOR EACH ROW
  EXECUTE FUNCTION track_milestone_status_changes();

-- Create views
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

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_customers_company_name ON customers(company_name);
CREATE INDEX idx_partners_company_name ON partners(company_name);
CREATE INDEX idx_opportunity_records_customer_id ON opportunity_records(customer_id);
CREATE INDEX idx_offer_records_opportunity_id ON offer_records(opportunity_id);
CREATE INDEX idx_contracts_offer_id ON contracts(offer_id);
CREATE INDEX idx_projects_contract_id ON projects(contract_id);

-- Insert default admin user
DO $$ 
DECLARE
  admin_id uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@mail.com'
  ) THEN
    INSERT INTO users (
      id,
      name,
      email,
      role,
      password,
      user_human_id
    ) VALUES (
      admin_id,
      'Admin User',
      'admin@mail.com',
      'admin',
      'password',
      'ADM00001'
    );
  END IF;
END $$;