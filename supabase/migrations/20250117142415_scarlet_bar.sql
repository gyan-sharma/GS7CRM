/*
  # Create offers schema

  1. New Tables
    - `offer_records`
      - Core offer information
      - Links to opportunities, presales engineers, and partners
      - Tracks creation and due dates
      - Includes summary and status
    
    - `offer_partner_records`
      - Junction table for offers and partners
      - Tracks partner associations with offers
    
    - `offer_document_records`
      - Stores document metadata for offers
      - Supports different document types (RFP, Proposals)
      - Links to storage bucket

  2. Storage
    - Creates 'offer-documents' storage bucket
    - Sets up storage policies for authenticated users

  3. Indexes
    - Optimized indexes for common queries
    - Foreign key relationships for data integrity
*/

-- Create offers table
CREATE TABLE IF NOT EXISTS offer_records (
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
      'Cancelled'
    )
  ) DEFAULT 'Draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

-- Create offer partners junction table
CREATE TABLE IF NOT EXISTS offer_partner_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(offer_id, partner_id)
);

-- Create offer documents table
CREATE TABLE IF NOT EXISTS offer_document_records (
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

-- Create storage bucket for offer documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-documents', 'offer-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Allow authenticated users to upload offer files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated users to read offer files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'offer-documents');

CREATE POLICY "Allow authenticated users to delete offer files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'offer-documents');

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_offer_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_offer_document_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_offer_records_timestamp
  BEFORE UPDATE ON offer_records
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_records_updated_at();

CREATE TRIGGER update_offer_document_records_timestamp
  BEFORE UPDATE ON offer_document_records
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_document_records_updated_at();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_offer_records_opportunity_id
  ON offer_records(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_offer_records_presales_engineer_id
  ON offer_records(presales_engineer_id);

CREATE INDEX IF NOT EXISTS idx_offer_records_status
  ON offer_records(status);

CREATE INDEX IF NOT EXISTS idx_offer_partner_records_offer_id
  ON offer_partner_records(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_partner_records_partner_id
  ON offer_partner_records(partner_id);

CREATE INDEX IF NOT EXISTS idx_offer_document_records_offer_id
  ON offer_document_records(offer_id);

-- Create view for offer details
CREATE OR REPLACE VIEW offer_details AS
SELECT 
  o.*,
  opp.opportunity_name,
  opp.opportunity_human_id,
  c.company_name as customer_name,
  u.name as presales_engineer_name,
  array_agg(DISTINCT p.company_name) as partner_names,
  array_agg(DISTINCT p.id) as partner_ids
FROM offer_records o
LEFT JOIN opportunity_records opp ON o.opportunity_id = opp.id
LEFT JOIN customers c ON opp.customer_id = c.id
LEFT JOIN users u ON o.presales_engineer_id = u.id
LEFT JOIN offer_partner_records opr ON o.id = opr.offer_id
LEFT JOIN partners p ON opr.partner_id = p.id
GROUP BY o.id, opp.id, c.id, u.id;