/*
  # Opportunities Module Setup

  1. Tables Created:
    - opportunity_records: Main opportunities table
    - opportunity_document_records: Documents linked to opportunities
    - opportunity_status_history: Track opportunity stage changes

  2. Storage:
    - opportunity_document_storage: Storage bucket for opportunity files
    
  3. Functions:
    - update_opportunity_records_updated_at: Timestamp trigger
    - update_opportunity_document_records_updated_at: Timestamp trigger
    - update_opportunity_status_history_updated_at: Timestamp trigger

  Note: All names are prefixed with 'opportunity_' to avoid conflicts
*/

-- Create opportunities table
CREATE TABLE IF NOT EXISTS opportunity_records (
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

-- Create opportunity documents table
CREATE TABLE IF NOT EXISTS opportunity_document_records (
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

-- Create opportunity status history table
CREATE TABLE IF NOT EXISTS opportunity_status_history (
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

-- Create storage bucket for opportunity documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity_document_storage', 'opportunity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for opportunity documents storage
CREATE POLICY "Allow authenticated to upload opportunity files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'opportunity_document_storage'
);

CREATE POLICY "Allow authenticated to read opportunity files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'opportunity_document_storage'
);

CREATE POLICY "Allow authenticated to delete opportunity files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'opportunity_document_storage'
);

-- Create updated_at trigger function for opportunity_records
CREATE OR REPLACE FUNCTION update_opportunity_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger function for opportunity_document_records
CREATE OR REPLACE FUNCTION update_opportunity_document_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger function for opportunity_status_history
CREATE OR REPLACE FUNCTION update_opportunity_status_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_opportunity_records_timestamp
  BEFORE UPDATE ON opportunity_records
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_records_updated_at();

CREATE TRIGGER update_opportunity_document_records_timestamp
  BEFORE UPDATE ON opportunity_document_records
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_document_records_updated_at();

CREATE TRIGGER update_opportunity_status_history_timestamp
  BEFORE UPDATE ON opportunity_status_history
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_status_history_updated_at();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_opportunity_records_customer_id
  ON opportunity_records(customer_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_records_deal_owner_id
  ON opportunity_records(deal_owner_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_records_stage
  ON opportunity_records(opportunity_stage);

CREATE INDEX IF NOT EXISTS idx_opportunity_document_records_opportunity_id
  ON opportunity_document_records(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_status_history_opportunity_id
  ON opportunity_status_history(opportunity_id);